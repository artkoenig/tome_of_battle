Status: resolved
Type: fix
Blocked by: None

## Description
In `src/components/play/PlayUnitDetails.jsx:366` wird der Gesamtpunktwert
einer Einheit im Play-Modus unbedingt angezeigt:
`{getSelectionTotalCost(...)} Pkt.`. Soll ausgeblendet werden, wenn der Wert 0
ist.

## Acceptance Criteria
- [ ] Der Punktwert-Span wird nur gerendert, wenn `getSelectionTotalCost(...) > 0`.
- [ ] Bestehende Tests für `PlayUnitDetails` (falls vorhanden) bleiben grün.

## Comments
- Kostenwert wird einmal in totalCost berechnet und nur bei totalCost > 0 gerendert. Bestehende Tests (PlayUnitDetails.test.jsx, PlayUnitDetails.infogroups.test.jsx) bleiben grün.
