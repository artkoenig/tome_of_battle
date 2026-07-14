Status: resolved
Blocked by: [01, 02]

## Description

Integriere den RulesIndexDialog in die Editor-Ansicht: Klick auf einen Regel-Chip (UnitRulesChips, UnitUpgradesChips) in der Einheiten-Detailansicht des Editors öffnet bei bekanntem Mapping den RulesIndexDialog statt des Detail-BottomSheets.

Änderungen:
- **`src/components/editor/UnitChips.jsx`**: Neuer Callback-Prop `onShowRule(ruleName)`. Bevor das Detail-BottomSheet geöffnet wird, ruft der Klick-Handler `getRuleUrl(ruleName)` auf. Bei Treffer → `onShowRule(ruleName)` aufrufen (öffnet RulesIndexDialog). Bei `null` → bestehendes BottomSheet-Verhalten.
- **`src/components/editor/RosterEditor.jsx`** (oder dem Parent, der die Chips rendert): Lokalen State für `rulesDialogRule` und `rulesDialogOpen` verwalten. `RulesIndexDialog` rendern und `onShowRule` an Chips übergeben.

Akzeptanz:
- Chip mit bekanntem Regelnamen → RulesIndexDialog öffnet sich
- Chip mit unbekanntem Regelnamen → Detail-BottomSheet öffnet sich (unchanged)
- Klick außerhalb/X → Dialog schließt

Tests: Erweiterung von `UnitChips.test.jsx` für das neue Verhalten.

## Acceptance Criteria
- [ ] Klick auf UnitRulesChip mit bekanntem Mapping öffnet den RulesIndexDialog
- [ ] Klick auf UnitUpgradesChip mit bekanntem Mapping öffnet den RulesIndexDialog
- [ ] Klick auf Chip mit unbekanntem Mapping öffnet den bestehenden Detail-BottomSheet
- [ ] Der Dialog hat den Regelnamen als Titel
- [ ] Tests für beide Pfade (bekannt/unbekannt)

## Comments
- Implementiert: onShowRule-Callback in UnitUpgradesChips, UnitRulesChips, UnitSelectionCard, RosterEditor. RulesIndexDialog wird im Editor geöffnet, wenn getRuleUrl einen Treffer liefert. Volles Testsuite grün.
