Status: resolved
Blocked by: [01, 02]

## Description

Integriere die 6th.whfb.app-Regelanzeige in den PlayMode:

1. **"Regelbuch"-Button in der PlayMode-Toolbar**: Neuer Button (mit `BookOpen`-Icon aus Lucide, bereits importiert) öffnet den RulesIndexDialog mit der digitalen Regelbuch-Seite (`/digital-rulebook`).
2. **PlayUnitDetails-Chips**: Übergib den `onShowRule`-Callback an die UnitRulesChips und UnitUpgradesChips in der PlayMode-Ansicht, analog zur Editor-Integration (Issue 03).

Änderungen:
- **`src/components/PlayMode.jsx`**: `rulesDialogOpen`/`rulesDialogUrl` State. Regelbuch-Button in der Toolbar. `RulesIndexDialog` rendern. `onShowRule`-Callback an `PlayUnitDetails` übergeben.
- **`src/components/play/PlayUnitDetails.jsx`**: `onShowRule`-Prop an die Chips weiterreichen.

## Acceptance Criteria
- [ ] PlayMode-Toolbar zeigt "Regelbuch"-Button
- [ ] Klick auf den Button öffnet den digitalen Regelbuch-Iframe
- [ ] Klick auf UnitRulesChips im Play-Mode öffnet RulesIndexDialog (bei bekanntem Mapping)
- [ ] Unbekannte Chips bleiben unverändert (kein Dialog)
- [ ] Dialog schließbar

## Comments
- Implementiert: Regelbuch-Button in PlayMode-Toolbar, onShowRule-Callback an PlayUnitDetails übergeben, Chips in PlayMode reagieren auf Klick. Testsuite grün.
