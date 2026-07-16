Status: resolved
Blocked by: None

## Description
Die Condition-Typen `atLeast`, `atMost` und `notInstanceOf` sind im BattleScribe-Format spezifiziert (`docs/battlescribe-data-format.md:641`), werden aber im Condition Evaluator (`src/solver/modifierEvaluator.js:81-93`) nicht behandelt.

- `atLeast` → äquivalent zu `>=` (alias für `greaterThanOrEqualTo`)
- `atMost` → äquivalent zu `<=` (alias für `lessThanOrEqualTo`)
- `notInstanceOf` → Negation von `instanceOf`

Fehlende `case`-Zweige in der `switch`-Anweisung in `modifierEvaluator.js` (ca. Zeile 81). Ohne diese Einträge werden Conditions mit diesen Typen aktuell als `undefined` ausgewertet und als falsy behandelt, was zu falschen Modifier-/Constraint-Ergebnissen führen kann, sobald ein Katalog diese Typen verwendet.

## Acceptance Criteria
- [ ] `atLeast` wird evaluiert wie `greaterThanOrEqualTo` (`>=`)
- [ ] `atMost` wird evaluiert wie `lessThanOrEqualTo` (`<=`)
- [ ] `notInstanceOf` wird als Negation von `instanceOf` evaluiert
- [ ] Tests in `modifierEvaluator` für alle drei neuen Typen

## Comments
- Added case 'atLeast' (alias for >=), 'atMost' (alias for <=), and 'notInstanceOf' (negation of instanceOf) to evaluateCondition() in src/solver/modifierEvaluator.js. Added 3 tests in src/solver/validator.test.js. All 364 tests pass.
