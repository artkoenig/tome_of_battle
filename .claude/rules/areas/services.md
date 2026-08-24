---
paths:
  - "src/domain/services/**"
---

# services — die Datenfassade

Die einzige Adresse, über die die Oberfläche Daten erreicht (ADR-0037, reklassifiziert von Daten
nach Fachlogik durch ADR-0040/Issue 0179). Fünf Fassaden plus der eine Änderungs-Kanal:
`rosterStore.js`, `systemLibrary.js`, `settings.js`, `catalogRevisions.js`, `rosterTransfer.js`,
`dataEvents.js`. Lauf: `forge-test --run src/domain/services`.

- Jede Datei hier trägt ihren **Vertrag als Kopfkommentar** und hat eine eigene `*.test.js`
  daneben. Eine neue Fassade ohne beides ist unvollständig.
- Ein Modul ist eine Fassade, keine zweite Fachlogik: es reicht durch, bündelt die
  Vorbelegung (`refreshSystems` reicht `fetchCatalogText` selbst herein) und meldet den
  Abschluss. Ableitung, Abgleich und Formulierung bleiben oberhalb.
- **Jeder schreibende Aufruf** meldet über `emitDataChange` — erst nach der Zusage der Ablage,
  nie im Fehlerfall (der Fehler wird durchgereicht). Lesende Wege und der Katalog-Abgleich
  melden nichts; `rosterTransfer` schreibt nichts und meldet deshalb auch nichts.
- Der Emitter ist **an genau einer Stelle** abonniert: `src/ui/viewmodels/useAppData.js` zieht die
  Roster-Liste aus der Meldung nach. Ein zweiter Abonnent in einem Bildschirm ist ein Rückfall —
  vorher erfuhr eine Ansicht einen fremden Stand nur durch `reloadData` beim Navigationswechsel.
  Ein Abonnent, der auf eine Meldung hin selbst aus der DB liest, ergibt einen Zugriff je Klick.
- Wer hier einfügt, muss beim UI-seitigen `setRosters` prüfen: das Ereignis hat den Stand
  womöglich schon eingesetzt. Blindes Anhängen ergibt das Roster doppelt
  (`useRosterList.createRoster` hält das Muster vor).
- Die Ereignisarten sind eine getypte Union (`DataChangeEvent` in `dataEvents.js`). Ein neues
  Feld nur im `emitDataChange`-Aufruf lässt `forge-typecheck` rot werden — die Union zuerst
  erweitern.
- Die Schicht kennt `src/ui/i18n/` nicht (`keine-i18n-unter-ui`) und greift nicht auf
  `src/domain/roster/`/`src/domain/evaluation/` zurück (`daten-kein-rueckgriff`). Deshalb liefert
  `rosterTransfer` nur den Datei-Inhalt **so, wie die Datei ihn trägt**; der Abgleich
  mit dem installierten System bleibt beim Aufrufer: `readRosterText` liefert den XML-Text,
  gedeutet wird er von `src/domain/roster/rosterSerialization.js`, zusammengesetzt in
  `useRosterList`. `src/utils/` als regelkonformer Umweg gibt es seit Issue 0169 nicht mehr —
  beide Schichtregeln sind blockierend.
- Ein Fehler dieser Schicht trägt seinen Übersetzungsschlüssel, nie den Text: `rosterFileError`
  in `rosterTransfer.js` setzt `messageKey`/`messageParams`/`detail`, und
  `describeRosterFileError` in `src/ui/viewmodels/useRosterList.js` formuliert ihn.
- Tests hier mocken die `src/data/db/`-Module mit `vi.mock` statt IndexedDB hochzufahren (es gibt kein
  globales `fake-indexeddb`-Setup). Ein bestehender Test eines Verbrauchers bleibt dadurch grün,
  solange er dieselbe Modul-Id mockt wie die Fassade importiert.
- Seit dem Umzug nach `src/domain/services/` (ADR-0040) importiert eine Datei hier `src/data/db/`
  und `src/data/parser/` über `../../data/`, nicht mehr über `../` — `domain/` und `data/` sind
  Geschwister, keine Unterordner voneinander. Das ist erlaubt: Fachlogik darf auf Daten zugreifen,
  nur der Rückweg ist verboten (`daten-kein-rueckgriff`).
- In einer `vi.mock`-Fabrik darf kein Bezeichner stehen, den die Testdatei selbst importiert
  (z. B. `MissingSystemError`) — Vitest schreibt ihn auf das gehobene Modul um und die Suite
  fällt mit `Cannot access '__vi_import__' before initialization` aus. Lokal umbenennen.
