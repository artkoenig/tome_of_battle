---
status: backlog
branch:
pr:
---

# Datenschicht-Fassade src/services/

## Goal
Die Oberfläche erreicht Daten nur noch über eine Fassade. Die 14 in ADR-0037
gezählten Direktkanten nach `src/db/` und `src/parser/` — nach Issue 0165 in den
ViewModels statt in den Komponenten — werden auf `src/services/` umgelenkt. Erst
damit gibt es einen Ort, an dem Persistenz instrumentiert, ausgetauscht oder mit
einer Änderungs-Benachrichtigung versehen werden kann; IndexedDB bietet von sich
aus keine.

## Acceptance criteria
- AC1 `src/services/` enthält `rosterStore.js`, `systemLibrary.js`, `settings.js`, `catalogRevisions.js` und `rosterTransfer.js`, jedes mit dokumentiertem Vertrag und eigener Testdatei. | verify: forge-test --run src/services
- AC2 Keine Datei unter `src/components/`, `src/viewmodels/`, `src/hooks/` oder `src/contexts/` importiert `src/db/` oder `src/parser/`. | verify: forge-lint
- AC3 `ui-nicht-auf-daten` steht auf `severity: 'error'`. | verify: forge-lint
- AC4 Jeder schreibende Aufruf der Fassade meldet seinen Abschluss über einen Emitter; ein Verbraucher, der nur abonniert, sieht ein gespeichertes Roster ohne Navigationswechsel. Der Emitter ist an genau einer Stelle verdrahtet. | verify: forge-test --run src/services
- AC5 Verhalten unverändert: Import, Speichern, Löschen, Export und der Katalog-Abgleich tun, was sie heute tun. | verify: forge-test
- AC6 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope
- Tab-übergreifende Benachrichtigung (`BroadcastChannel`) — eigener Vorgang, sobald AC4 steht.
- Das Startverhalten und die Migration — Issue 0168.
- Ein Versionssprung, solange AC5 hält.
