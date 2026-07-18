Status: resolved
Type: fix
Blocked by: [01]

## Description
Deckt Lücke #6 aus Main-Issue 19 ab. Konsumiert die kanonischen Attributnamen
aus dem SSOT (Kind-Issue 01).

Der Parser erfasst an Constraints die heute fehlenden Attribute `percentValue`,
`includeChildSelections` und `includeChildForces`. Die Zähl-/Validierungslogik
(Roster-Zählung und -Validierung) wertet sie korrekt aus:
- `percentValue` → Constraints, die einen Prozentanteil (statt einer absoluten
  Zahl) einer Bezugsgröße ausdrücken, greifen richtig.
- `includeChildSelections`/`includeChildForces` → Kind-Auswahlen bzw. Kind-Forces
  werden bei der Bezugsgröße korrekt mit- oder nicht mitgezählt.

Nachweis an generischen, schema-gültigen Fixtures; die bestehende
Roster-Validierung/-Zählung bleibt regressionsfrei.

## Acceptance Criteria
- [ ] `percentValue`, `includeChildSelections`, `includeChildForces` an Constraints werden geparst
- [ ] Prozent-Constraints validieren/zählen gegen die korrekte Bezugsgröße
- [ ] `includeChildSelections`/`includeChildForces` steuern die Einbeziehung von Kind-Auswahlen/-Forces korrekt
- [ ] Bestehende Roster-Zählung/-Validierung bleibt grün (Regressionsschutz)
- [ ] Generische, schema-gültige Fixtures belegen das Verhalten

## Comments
- Parser liest jetzt percentValue/includeChildSelections/includeChildForces an Constraints (via SSOT AttributeName). Neues Modul constraintScope.js kapselt die Prozent-/Kind-Einbeziehungs-Semantik; rosterValidator wertet Prozent-Constraints gegen die Bezugsgroesse im Scope aus und beruecksichtigt Kind-Auswahlen/-Forces. Generische Fixtures + Unit-Tests belegen das Verhalten, bestehende Validierung bleibt gruen.
