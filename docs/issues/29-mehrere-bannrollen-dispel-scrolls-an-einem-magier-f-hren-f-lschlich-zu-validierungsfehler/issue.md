Status: resolved
Type: fix
Blocked by: None

## Description
Nimmt ein Magier in der "Definitive Edition" (Warhammer Fantasy Battles 6th)
mehr als eine Bannrolle (Dispel Scroll), meldet der Roster-Validator fälschlich
einen Verstoß gegen ein Auswahl-Limit ("Kategorie 'Arcane Items' erlaubt
maximal 1 Auswahlen"). Das ist falsch: laut Regeltext sind Bannrollen
ausdrücklich nicht einzigartig — ein Magier darf mehrere tragen.

Reproduziert mit den echten Katalogdaten (Empire, Wizard Lord, "Magic Items
Selection"): eine Auswahl mit zwei Bannrollen löst `group-count-max` aus, eine
mit nur einer nicht.

**Ursache (verifiziert):** Die Katalogdaten modellieren die Regel korrekt über
einen selbstreferenzierenden `increment`-Modifier, der das Gruppenlimit (Basis
`max=1`) für jede bereits gewählte Bannrolle um 1 anhebt. Dieser Modifier wird
aber nur ausgewertet, wenn er direkt unter der Einheit hängt — sitzt die
"Arcane Items"-Gruppe (wie beim Empire Wizard Lord) hinter einer
zwischengeschalteten Wrapper-Auswahl ("Magic Items Selection"), löst der
Modifier nicht aus.

Konkret: `checkGroupConstraints` (`src/solver/rosterValidator.js`) übergibt an
`getModifiedConstraintValue`/`evaluateCondition` (`src/solver/modifierEvaluator.js`)
einen Kontext mit sowohl `selection` (dem eigentlichen Gruppen-Container, dessen
`.selections` auch `checkGroupConstraints` selbst für die Zählung verwendet) als
auch `parentSelection` (eine Ebene darüber). Die generische Scope-Auflösung dort
bevorzugt `parentSelection`, sobald es gesetzt ist (`ctx.parentSelection ||
ctx.selection`) — für Gruppen-Constraints ist das aber eine Ebene zu hoch, sobald
eine Wrapper-Auswahl dazwischenliegt. Die Bannrollen-Zählung greift dadurch ins
Leere, der Modifier trägt 0 bei, das Limit bleibt bei 1.

Ein geprüfter minimaler Fix (den Kontext für Gruppen-Constraints ohne die
fremde `parentSelection` aufzubauen, sodass `selection` — der tatsächliche
Gruppen-Container — konsistent verwendet wird) behebt den Fall in der
Reproduktion mit den echten Empire-Daten, ohne die volle bestehende Testsuite
(652 Tests) zu brechen.

## Acceptance Criteria
- [ ] Ein Magier, dessen Ausrüstungsgruppe hinter einer zwischengeschalteten
      Wrapper-Auswahl liegt (wie die Empire "Magic Items Selection"), kann
      mehrere Bannrollen wählen, ohne dass der Roster-Validator einen
      Gruppen-Limit-Fehler meldet.
- [ ] Die bestehenden Tests zu Gruppen-Constraints und selbstinkrementierenden
      Modifiern (u. a. Test 21/21b/21c in `src/solver/validator.test.js`)
      bleiben grün — insbesondere der bereits abgedeckte Fall ohne Wrapper
      (Bannrolle direkt unter der Einheit).
- [ ] Ein neuer, automatisierter Test deckt den bisher ungetesteten Fall ab:
      Gruppen-Constraint mit selbstinkrementierendem Modifier, dessen Gruppe
      hinter einer zwischengeschalteten (nicht-top-level) Auswahl liegt.
- [ ] Die volle Testsuite (`npm test`) bleibt grün.

## Comments
- Fix umgesetzt: checkGroupConstraints reicht parentSelection nicht mehr in den Gruppen-Constraint-Kontext (src/solver/rosterValidator.js). Regressionstest 21d in src/solver/validator.test.js deckt den Wrapper-Fall ab. Mit echten Empire-'Definitive Edition'-Katalogdaten reproduziert und verifiziert (Wizard Lord + Magic Items Selection + 2 Bannrollen). Volle Testsuite (653 Tests) grün, keine neuen Lint-Warnungen.
