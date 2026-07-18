Status: resolved
Type: fix
Blocked by: None

## Description
In `src/components/editor/UnitSelectionCard.jsx:244` wird der Gesamtpunktwert
einer gewählten Einheit im Karten-Header unbedingt angezeigt:
`{displayPoints} {costTypeLabel}`. Soll bei `displayPoints === 0` ausgeblendet
werden, statt "0 Pkt." zu zeigen.

## Acceptance Criteria
- [ ] Der Span mit `{displayPoints} {costTypeLabel}` wird nur gerendert, wenn
      `displayPoints > 0`.
- [ ] Bestehende Tests in `UnitSelectionCard.test.jsx` bleiben grün (ggf.
      Test für den 0-Punkte-Fall ergänzen).

## Comments
- Kosten-Span wird jetzt nur bei displayPoints > 0 gerendert. Bestehende Tests (UnitSelectionCard.test.jsx, 27 Tests) bleiben grün.
