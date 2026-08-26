---
paths:
  - "src/contexts/armylist/application/**"
  - "src/contexts/armylist/ports/**"
  - "src/contexts/catalog/application/**"
  - "src/contexts/catalog/ports/**"
---

# application + ports — die Datenfassade der Kontexte

Die einzige Adresse, über die die Oberfläche Daten erreicht (ADR-0037, reklassifiziert von Daten
nach Fachlogik durch ADR-0040/Issue 0179). Seit Issue 0186 (ADR-0042) liegt sie nach Fachlichkeit
geteilt: `armylist/application/` (`rosterStore.js`, `settings.js`, `rosterTransfer.js`) und
`catalog/application/` (`systemLibrary.js`, `catalogRevisions.js`). Der eine Änderungs-Kanal liegt
nicht mehr hier, sondern im gemeinsamen Kern: `src/shared/events/dataEvents.js`.
Lauf: `forge-test --run src/tests/contexts`.

- **Die Plattform wird nur über den Port erreicht** — Einzelheiten in `contexts.md`. Braucht eine
  Fassade einen neuen Namen aus der Persistenz, wird er im Port ergänzt, nie direkt importiert.

- Jede Datei hier trägt ihren **Vertrag als Kopfkommentar** und hat eine eigene `*.test.js`
  daneben. Eine neue Fassade ohne beides ist unvollständig.
- Ein Modul ist eine Fassade, keine zweite Fachlogik: es reicht durch, bündelt die
  Vorbelegung (`refreshSystems` reicht `fetchCatalogText` selbst herein) und meldet den
  Abschluss. Ableitung, Abgleich und Formulierung bleiben oberhalb.
- **Jeder schreibende Aufruf** meldet über `emitDataChange` — erst nach der Zusage der Ablage,
  nie im Fehlerfall (der Fehler wird durchgereicht). Lesende Wege und der Katalog-Abgleich
  melden nichts; `rosterTransfer` schreibt nichts und meldet deshalb auch nichts.
- **Aus der Oberfläche ist der Emitter an genau einer Stelle abonniert**:
  `src/ui/viewmodels/useAppData.js` zieht die Roster-Liste aus der Meldung nach. Ein zweiter
  Abonnent in einem Bildschirm ist ein Rückfall — vorher erfuhr eine Ansicht einen fremden Stand
  nur durch `reloadData` beim Navigationswechsel. Ein **Kontext** darf zuhören, wenn eine Regel
  seiner Fachlichkeit an fremdem Schreiben hängt: `contexts/play/application/rosterDeletionPolicy.js`
  beendet die Partie einer gelöschten Liste (Issue 0193). Solch ein Abonnent liest dabei durchaus
  aus der DB — der Scan in `deleteGamesOfRoster` ist derselbe, den vorher die Oberfläche auslöste,
  also kein zusätzlicher Zugriff. Neu hinzukommen darf ein DB-Lesen je Meldung trotzdem nicht: ein
  Abonnent, der auf jede Meldung hin liest, ergibt einen Zugriff je Klick.
- Wer hier einfügt, muss beim UI-seitigen `setRosters` prüfen: das Ereignis hat den Stand
  womöglich schon eingesetzt. Blindes Anhängen ergibt das Roster doppelt
  (`useRosterList.createRoster` hält das Muster vor).
- Die Ereignisarten sind eine getypte Union (`DataChangeEvent` in
  `src/shared/events/dataEvents.js`). Ein neues Feld nur im `emitDataChange`-Aufruf lässt
  `forge-typecheck` rot werden — die Union zuerst erweitern.
- Die Schicht kennt `src/ui/i18n/` nicht (`keine-i18n-unter-ui`) und greift nicht auf die
  Deutung eines Rosters zurück. `daten-kein-rueckgriff` (`.cast/rules.json`) verbietet den Weg
  von `plattform` (= `src/platform/**`) nach `src/contexts/**`; ein Import aus
  `src/contexts/armylist/model/` fällt nicht darunter — Issue 0187 holt `RosterFileError` genau so
  von dort. Der **fachliche** Verzicht bleibt: deshalb liefert
  `rosterTransfer` nur den Datei-Inhalt **so, wie die Datei ihn trägt**; der Abgleich
  mit dem installierten System bleibt beim Aufrufer: `readRosterText` liefert den XML-Text,
  gedeutet wird er von `src/contexts/armylist/model/rosterSerialization.js`, zusammengesetzt in
  `useRosterList`. `src/utils/` als regelkonformer Umweg gibt es seit Issue 0169 nicht mehr —
  beide Schichtregeln sind blockierend.
- Ein Fehler dieser Schicht trägt seinen Übersetzungsschlüssel, nie den Text: `RosterFileError`
  wohnt seit Issue 0187 im Schreibmodell (`src/contexts/armylist/model/rosterFileError.js`) — er beschreibt
  das Dateiformat, nicht die Fassade —, `rosterTransfer.js` importiert ihn von dort und setzt
  `messageKey`/`messageParams`/`detail`, und
  `describeRosterFileError` in `src/ui/viewmodels/useRosterList.js` formuliert ihn.
- Tests (in `src/tests/contexts/<kontext>/application/`) mocken die `src/platform/persistence/`-Module
  mit `vi.mock` statt IndexedDB hochzufahren (es gibt kein globales `fake-indexeddb`-Setup). Das
  wirkt weiterhin durch den Port hindurch: er re-exportiert die Bindungen, ersetzt sie nicht.
- **Eine Zusage des Modells gehört hierher, nicht in einen Effekt**: `mandatoryListRules.js`
  (`applyMandatoryListRules`, Issue 0189) ergänzt die eindeutigen Pflicht-Listenregeln (§9.9) —
  Roster hinein, Roster heraus, `system`/`slots`/`isFreshRoster` als Argumente. Als `useEffect`
  galt die Regel nur bei montiertem Editor; jetzt läuft **jeder** Schreibweg durch sie (Anlegen und
  `.ros`-Import in `useRosterList.js`, Editor-Sitzung über `useMandatoryListRuleAutoAdd.js`). Das
  Frisch-Tor ist Verhalten (kein Gerüst) und bleibt ein ausdrückliches Argument; die Erkennung
  (`findMissingMandatoryListRules`) bleibt Projektion des Lesemodells.
- **Der Bericht wird hier geholt, nicht hereingereicht**: `mandatoryListRules.js`
  (`applyMandatoryListRulesToFreshRoster`) und `rosterExport.js` (`buildRosterExportFile`) rufen
  `evaluateAppRoster` selbst. Ein Bildschirm, der auswertet, um das Ergebnis in einen Schreibweg
  zu reichen, nennt einen zweiten Kontext nur für diesen einen Aufruf (Issue 0193). ADR-0039
  verbietet das Auswerten dem Schreib**modell** (`armylist/model/**`, blockierend), nicht dieser
  Schicht.
- Ein Anwendungsfall darf das Lesemodell **nur über seine eine Tür** nennen
  (`ruleengine/readmodel/index.js`, `allowed`-Ausnahme `lesemodell-die-eine-tuer`); jeder andere
  Pfad dorthin fällt unter `roster-keine-evaluator-abhaengigkeit` und bricht `forge-lint`.
- Ein Test dieser Schicht rendert nichts: die Slot-Seite ist ein handgebautes
  `{ capabilities: new Map(), pathOfForce }`, das System ein Zwei-Einträge-Katalog. Nur der
  **Wurzel**-Pfad (ohne `/`) und ein direktes Kind des Kontingent-Pfads zählen als Kandidat —
  ein Stub, dessen `pathOfForce` selbst keinen Trenner enthält, macht jeden fremden Slot zum
  Wurzel-Angebot.
- Der Barrel `armylist/model/index.js` wird von `rosterSelectionFactory.js` gelesen: eine
  Testdatei, die ihn ohne `importOriginal()` mockt, bringt jeden Anwendungsfall, der eine Selektion
  baut, mit "No `createSelectionFromDef` export is defined on the mock" zu Fall.
- In einer `vi.mock`-Fabrik darf kein Bezeichner stehen, den die Testdatei selbst importiert
  (z. B. `MissingSystemError`) — Vitest schreibt ihn auf das gehobene Modul um und die Suite
  fällt mit `Cannot access '__vi_import__' before initialization` aus. Lokal umbenennen.
