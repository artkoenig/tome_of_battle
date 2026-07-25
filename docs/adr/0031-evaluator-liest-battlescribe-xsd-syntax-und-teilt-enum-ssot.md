---
Status: accepted
---

# Der Reinraum-Evaluator liest die rohe BattleScribe-XSD-Syntax und teilt deren Enum-SSOT

ADR-0030 hat die zweite Auswertungs-Engine (`src/evaluator/`) bewusst mit einem
**eigenen, erfundenen Vokabular** (`op` / `operation` / `targetKind` / `targetId`)
gebaut und diese Abweichung von den echten BattleScribe-Attributen als „bewusst
offen gelassene Grenze" ehrlich dokumentiert (Issue 65, ADR-0030 „Umsetzungsstand
und bewusste Grenzen", Punkt 1). Folge: reale `.cat`/`.gst`-Kataloge wurden für
Bedingungen und Modifikatoren nie ausgewertet, sondern nur als Diagnose gemeldet.

Wir entscheiden, diese Grenze zu schließen. Der Evaluator liest ausschließlich die
**kanonischen XSD-Attributnamen** (`type`, `field`, `value`, `scope`, …) und
bezieht die geschlossenen Enum-Mengen (`ConstraintKind`, `ConditionKind`,
`ModifierKind`, `ConditionGroupKind`, `SelectionEntryKind`, …) aus der bereits
vendored XSD-SSOT `src/parser/schema/battlescribeSchema.generated.js` (ADR-0016),
statt sie in `src/evaluator/model.js` zu duplizieren. Der Import aus `src/parser/`
ist von ADR-0030 ausdrücklich erlaubt; die harte Import-Isolation gegen
`src/solver/` bleibt in beide Richtungen unberührt. Das erfundene Alt-Vokabular
wird **ersatzlos entfernt** (kein Kompatibilitäts-Fallback): keine realen Daten
nutzten es je, nur die engine-eigenen Fixtures, die auf echte BattleScribe-Syntax
umgeschrieben werden.

`scope` und `field` bleiben — wie in ADR-0016 festgehalten — auf XSD-Ebene reine
`xs:string`-Grammatik ohne geschlossene Wertemenge; ihre Domänen-Semantik
(Schlüsselwörter `roster`/`force`/`parent`/`self` bzw. eine Ziel-ID) bleibt daher
Evaluator-eigene Konvention und wird nicht aus `src/solver/` bezogen (der Import
`evaluator → solver` ist per ADR-0030 verboten).

Begründung: Die aus ADR-0016 gelernte Drift-Klasse (Parser-/Solver-Bugs durch
selbst gepflegte Enum-Kopien) soll sich in der zweiten Engine nicht wiederholen;
eine Engine, die reale Kataloge für Bedingungen/Modifikatoren gar nicht liest,
kann ihren Zweck — der Reinraum-Vergleich am echten Datenformat — nicht erfüllen.

## Konsequenzen

- **Positiv:** der Evaluator wertet reale Bedingungen und Modifikatoren
  tatsächlich aus; eine einzige Quelle der Wahrheit für die Format-Enums; keine
  stille Enum-Drift zwischen Engine und XSD mehr.
- **Neutral:** die übrige bewusste Duplikation aus ADR-0030 (eigener Parser,
  eigenes Datenmodell, eigener Report) bleibt bestehen — nur das
  Format-**Vokabular** wird geteilt. Über einen produktiven Cutover der Engine
  ist weiterhin nichts entschieden (ADR-0030 bleibt darin unberührt).
