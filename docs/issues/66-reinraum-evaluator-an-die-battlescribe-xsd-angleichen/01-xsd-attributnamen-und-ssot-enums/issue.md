Status: ready-for-agent
Type: refactor
Blocked by: None

## Description
Der Reinraum-Evaluator liest Bedingungen und Modifikatoren an den **kanonischen
BattleScribe-XSD-Attributnamen** statt am erfundenen Vokabular: eine Bedingung
trägt ihre Art an `type` (ConditionKind), ein Modifikator seine Art an `type`
(ModifierKind) und sein Ziel im `field`-String. Die Namen `op`, `operation`,
`targetKind` und `targetId` verschwinden ersatzlos aus der Engine (kein
Kompatibilitäts-Fallback).

Die geschlossenen Enum-Mengen des Formats bezieht die Engine aus der einen Quelle
der Wahrheit `src/parser/schema/battlescribeSchema.generated.js` (ADR-0016/0031)
statt aus eigenen Kopien in `model.js`. Damit werden auch die bisher fehlenden
Werte erkannt: vollständiges ConditionKind (u. a. `notEqualTo` neben
`lessThan`/`greaterThan`/`equalTo`/`atLeast`/`atMost`/`instanceOf`/`notInstanceOf`)
und vollständiges ModifierKind (u. a. `increment`, `decrement`, `append`,
`remove`, `prepend`, `set-primary`, `unset-primary` neben `set`/`add`/`multiply`).

Die harte Import-Isolation Evaluator ⇄ Solver bleibt unberührt; `scope`/`field`
bleiben String-Konvention (kein XSD-Enum) und behalten die engine-eigene
Bezugsrahmen-Behandlung. Die vorhandenen Engine-Fixtures, die das alte Vokabular
verwenden, werden auf echte BattleScribe-Syntax umgeschrieben, damit die Testsuite
grün bleibt.

## Acceptance Criteria
- [ ] Ein realer `<condition type="…">` wird an seiner Art erkannt und ausgewertet
      und erscheint nicht mehr als UNSUPPORTED-Diagnose.
- [ ] Ein realer `<modifier type="…" field="…" value="…">` wird an `type`/`field`
      erkannt und verändert den effektiven Wert entsprechend seiner Art; `op`,
      `operation`, `targetKind`, `targetId` kommen im Evaluator nirgends mehr vor.
- [ ] Alle ConditionKind-Werte inkl. `notEqualTo` werden korrekt zum Wahrheitswert
      ausgewertet; alle ModifierKind-Werte werden an ihrem Namen erkannt.
- [ ] Die Format-Enums der Engine stammen aus
      `battlescribeSchema.generated.js`; es gibt keine parallele Enum-Kopie mehr
      in `model.js`.
- [ ] Die gesamte Engine-Testsuite ist grün; die betroffenen Fixtures verwenden
      echte BattleScribe-Syntax (`type`/`field`), nicht das alte Vokabular.

## Comments
