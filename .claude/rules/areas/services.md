---
paths:
  - "src/services/**"
---

# services — die Datenfassade

Die einzige Adresse, über die die Oberfläche Daten erreicht (ADR-0037). Fünf Fassaden plus der
eine Änderungs-Kanal: `rosterStore.js`, `systemLibrary.js`, `settings.js`, `catalogRevisions.js`,
`rosterTransfer.js`, `dataEvents.js`. Lauf: `forge-test --run src/services`.

- Jede Datei hier trägt ihren **Vertrag als Kopfkommentar** und hat eine eigene `*.test.js`
  daneben. Eine neue Fassade ohne beides ist unvollständig.
- Ein Modul ist eine Fassade, keine zweite Fachlogik: es reicht durch, bündelt die
  Vorbelegung (`refreshSystems` reicht `fetchCatalogText` selbst herein) und meldet den
  Abschluss. Ableitung, Abgleich und Formulierung bleiben oberhalb.
- **Jeder schreibende Aufruf** meldet über `emitDataChange` — erst nach der Zusage der Ablage,
  nie im Fehlerfall (der Fehler wird durchgereicht). Lesende Wege und der Katalog-Abgleich
  melden nichts; `rosterTransfer` schreibt nichts und meldet deshalb auch nichts.
- Der Emitter ist **an genau einer Stelle** abonniert: `src/hooks/useAppData.js` zieht die
  Roster-Liste aus der Meldung nach. Ein zweiter Abonnent in einem Bildschirm ist ein Rückfall —
  vorher erfuhr eine Ansicht einen fremden Stand nur durch `reloadData` beim Navigationswechsel.
  Ein Abonnent, der auf eine Meldung hin selbst aus der DB liest, ergibt einen Zugriff je Klick.
- Wer hier einfügt, muss beim UI-seitigen `setRosters` prüfen: das Ereignis hat den Stand
  womöglich schon eingesetzt. Blindes Anhängen ergibt das Roster doppelt
  (`useRosterList.createRoster` hält das Muster vor).
- Die Ereignisarten sind eine getypte Union (`DataChangeEvent` in `dataEvents.js`). Ein neues
  Feld nur im `emitDataChange`-Aufruf lässt `forge-typecheck` rot werden — die Union zuerst
  erweitern.
- Die Schicht kennt `src/i18n/` nicht (`keine-i18n-unter-ui`) und greift nicht auf
  `src/roster/`/`src/evaluation/` zurück (`daten-kein-rueckgriff`). Deshalb liefert
  `rosterTransfer.readRosterFile` das Roster **so, wie die Datei es beschreibt**; der Abgleich
  mit dem installierten System bleibt beim Aufrufer. Nur direkte Kanten werden gemessen, ein
  Umweg über `src/utils/` ist regelkonform und trotzdem eine Rückkopplung — sparsam einsetzen.
- Tests hier mocken die `src/db/`-Module mit `vi.mock` statt IndexedDB hochzufahren (es gibt kein
  globales `fake-indexeddb`-Setup). Ein bestehender Test eines Verbrauchers, der `../db/…`
  mockt, bleibt dadurch grün: die Fassade importiert dieselbe Modul-Id.
- In einer `vi.mock`-Fabrik darf kein Bezeichner stehen, den die Testdatei selbst importiert
  (z. B. `MissingSystemError`) — Vitest schreibt ihn auf das gehobene Modul um und die Suite
  fällt mit `Cannot access '__vi_import__' before initialization` aus. Lokal umbenennen.
