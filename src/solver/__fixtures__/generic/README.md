# Generic infoGroups fixture

`generic-infogroups.cat` is a small, hand-authored catalogue used to prove the
parser and profile/rule bridge handle BattleScribe's `infoGroups`,
`sharedInfoGroups` and `infoLink type="infoGroup"` constructs. It is deliberately
system-agnostic (not WHFB6) so the behaviour is demonstrated on a minimal,
readable dataset rather than production data.

It is schema-valid against the vendored `src/parser/schema/Catalogue.xsd`:

```
xmllint --noout --schema src/parser/schema/Catalogue.xsd \
  src/solver/__fixtures__/generic/generic-infogroups.cat
```

What it exercises:

- **Inline `infoGroups`** on the `unit-guardian` selection entry bundle a weapon
  profile (`prof-staff`).
- **`sharedInfoGroups`** at catalogue root declare `ig-blessings`.
- **`infoLink type="infoGroup"`** on the unit resolves `ig-blessings`, whose
  bundled rule (`rule-blessed`) and nested `infoLink type="rule"`
  (`rule-ward` → `sharedRules`) must both surface on the unit.
