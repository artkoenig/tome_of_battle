---
status: backlog
branch:
pr:
---

# ViewModels für die Hüllen: Editor, Spielmodus, Bibliothek, Import

## Goal
Die fünf Bildschirm-Hüllen bekommen ihr ViewModel. Damit verschwindet die letzte
Ableitung aus dem Render — darunter der Aufruf von `evaluateAppRoster` innerhalb
der Map-Schleife von `RosterDashboard` und die zweite, von `useAppData` unabhängige
Systemliste im Importer.

## Acceptance criteria
- AC1 `src/viewmodels/` enthält `useRosterEditor`, `usePlayRoster`, `usePlayUnit`, `useRosterDashboard`, `useImporter` und `useNewRosterModal`, jedes mit eigener `renderHook`-Testdatei. | verify: forge-test --run src/viewmodels
- AC2 `evaluateAppRoster` wird nirgends innerhalb einer Render-Schleife aufgerufen; `useRosterDashboard` memoisiert einen Bericht je Roster, und ein Test weist nach, dass ein zweiter Renderdurchlauf ohne Datenänderung keine erneute Auswertung auslöst. | verify: forge-test --run src/viewmodels
- AC3 Es gibt genau eine Systemliste. `Importer` hält keinen eigenen `getAllSystems`-Zustand mehr, sondern liest dieselbe Quelle wie `useAppData`; ein Import ist danach ohne Navigationswechsel im Editor sichtbar. | verify: forge-test --run src/components
- AC4 Kein `.jsx` unter `src/components/` enthält `useEffect` oder `useMemo`. | verify: forge-lint
- AC5 `importer/importMessages.js`, `importer/revisionDisplay.js` und `profileCellClasses.js` sind in ihren ViewModels aufgegangen und gelöscht. | verify: forge-lint
- AC6 Was auf dem Bildschirm steht, ist unverändert. | verify: forge-test --run src/components
- AC7 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope
- Das Scharfstellen der Regeln — Issue 0166.
- Die Datenschicht-Fassade — Issue 0167. Die Direktzugriffe auf `src/db/` liegen danach in den ViewModels statt in den Komponenten; geschnitten werden sie dort.
- Ein Versionssprung — es sei denn AC3 ändert sichtbares Verhalten; dann Patch.
