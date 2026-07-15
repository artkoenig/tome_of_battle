Status: resolved
Blocked by: [01, 02]

## Description

Integriere die 6th.whfb.app-Regelanzeige in den PlayMode:

1. **"Regelbuch"-Button in der PlayMode-Toolbar**: Neuer Button (mit `BookOpen`-Icon aus Lucide, bereits importiert) öffnet `https://6th.whfb.app/` in einem **neuen Tab** (`window.open(..., '_blank')`). (Ursprünglich als Iframe-Dialog mit `/digital-rulebook` geplant, bewusst auf neuen Tab revidiert – siehe ADR-0012.)
2. **PlayUnitDetails-Chips**: Übergib den `onShowRule`-Callback an die UnitRulesChips und UnitUpgradesChips in der PlayMode-Ansicht, analog zur Editor-Integration (Issue 03).

Änderungen:
- **`src/components/PlayMode.jsx`**: `rulesDialogOpen`/`rulesDialogUrl` State. Regelbuch-Button in der Toolbar. `RulesIndexDialog` rendern. `onShowRule`-Callback an `PlayUnitDetails` übergeben.
- **`src/components/play/PlayUnitDetails.jsx`**: `onShowRule`-Prop an die Chips weiterreichen.

## Acceptance Criteria
- [x] PlayMode-Toolbar zeigt "Regelbuch"-Button
- [x] Klick auf den Button öffnet 6th.whfb.app in einem neuen Tab
- [x] Klick auf UnitRulesChips im Play-Mode öffnet RulesIndexDialog (bei bekanntem Mapping)
- [x] Unbekannte Chips bleiben unverändert (kein Dialog)
- [x] Dialog schließbar

## Comments
- Implementiert: Regelbuch-Button in PlayMode-Toolbar, onShowRule-Callback an PlayUnitDetails übergeben, Chips in PlayMode reagieren auf Klick. Testsuite grün.
