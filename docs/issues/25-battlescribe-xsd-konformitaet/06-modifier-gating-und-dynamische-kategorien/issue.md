Status: resolved
Type: fix
Blocked by: [01]

## Description
Deckt die Modifier-Lücken #1, #2, #3 aus Main-Issue 19 ab (gemeinsam, da sie
sich den Modifier-Parse/Eval-Pfad teilen). Konsumiert ModifierKind und
ConditionKind aus dem SSOT (Kind-Issue 01).

- **#1 modifierGroup-Gating:** Der Parser flacht `modifierGroup`s nicht mehr ab,
  sondern erhält deren gruppen-eigene `conditions`/`repeats`. Der Evaluator
  wendet die Gruppenbedingung als Gate an: enthaltene Modifier feuern nur, wenn
  die Gruppenbedingung erfüllt ist (heute feuern sie bedingungslos).
- **#2 includeChildSelections:** Das an `condition`/`repeat` bereits vom
  Evaluator erwartete Attribut `includeChildSelections` wird tatsächlich geparst,
  sodass Kind-Auswahlen bei der Bedingungsauswertung mitgezählt werden.
- **#3 dynamische Kategorien:** Die Modifier-Typen
  `add`/`remove`/`set-primary`/`unset-primary` werden in Evaluator und
  Anzeige-Bridge behandelt: konditionales Hinzufügen/Entfernen einer
  Kategorie-Zugehörigkeit bzw. Setzen/Lösen des Primär-Flags. Die exakte
  Feld-Semantik wird bei der Umsetzung gegen Wiki/`wham` bestätigt.

Nachweis an generischen, schema-gültigen Fixtures; sichtbare
Kategorie-/Primär-Änderungen werden mit abgedeckt.

## Acceptance Criteria
- [ ] `modifierGroup`-eigene conditions/repeats bleiben erhalten; enthaltene Modifier feuern nur bei erfüllter Gruppenbedingung
- [ ] `includeChildSelections` an condition/repeat wird geparst; Kind-Auswahlen werden bei der Auswertung mitgezählt
- [ ] Modifier-Typen `add`/`remove`/`set-primary`/`unset-primary` verändern Kategorie-Zugehörigkeit bzw. Primär-Flag konditional korrekt
- [ ] Kategorie-/Primär-Änderungen sind in der UI sichtbar
- [ ] Generische, schema-gültige Fixtures belegen jedes der drei Verhalten

## Comments
- Parser preserves modifierGroups (own conditions/repeats) instead of flattening; getEffectiveModifiers folds each group's conditions into contained modifiers so existing per-modifier gating fires them only when the group condition passes. Parsed includeChildSelections on condition/repeat. Added getEffectiveCategoryLinks (add/remove/set-primary/unset-primary, semantics per BattleScribe/bluescribe reference: field='category', value=category id) wired into computeRosterCounts so conditional category/primary changes show in category counts. Consumes ModifierKind/ConditionKind from the SSOT. New src/solver/modifierGating.test.js (17 tests); full suite green (474 passed).
