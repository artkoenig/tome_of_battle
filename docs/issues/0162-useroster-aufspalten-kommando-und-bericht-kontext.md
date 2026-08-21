---
status: done
branch: claude/forge-work-0162-bmddpn
pr: 254
---

# useRoster aufspalten: Roster-Zustand, Kommando-Kontext, Bericht-Kontext

## Goal
Der Seam für das ViewModel-Muster aus ADR-0038 entsteht: `useRoster` — heute 21
Rückgabefelder aus drei Verantwortungen — wird in den Zustands-Hook und zwei
Kontexte zerlegt, getrennt nach Änderungsfrequenz. Die Komponenten bleiben
unverändert und beziehen dieselben Werte weiter als Props; erst die Folge-Ausgaben
holen sie aus dem Kontext.

## Acceptance criteria
- AC1 `useRosterState` hält Roster, Auswahl und Kommandos; `RosterCommandsProvider` und `RosterReportProvider` stellen sie bereit, mit den Hooks `useRosterCommands()` und `useRosterReport()`. | verify: forge-test --run src/viewmodels
- AC2 Der Wert des Kommando-Kontexts behält seine Identität über eine Roster-Bearbeitung hinweg; ein Test weist das an einem Verbraucher nach, der ausschließlich am Kommando-Kontext hängt und dabei nicht neu rendert. | verify: forge-test --run src/viewmodels
- AC3 Kein `.jsx` unter `src/components/` ändert seine Prop-Signatur. | verify: forge-test --run src/components
- AC4 `src/test-utils/` stellt einen Wrapper bereit, der beide Provider mit einem Bericht bestückt, sodass eine Komponente weiterhin isoliert gerendert werden kann. | verify: forge-test --run src/components
- AC5 Der Bericht bleibt identitätsstabil: zwei Renderdurchläufe ohne Roster-Änderung liefern dasselbe Objekt. | verify: forge-test --run src/evaluation
- AC6 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope
- ViewModels und jede Änderung an einer Komponente — Issues 0163 bis 0165.
- Der Schreibpfad selbst: `addUnit` und Geschwister behalten ihr Verhalten.
- Ein Versionssprung.
