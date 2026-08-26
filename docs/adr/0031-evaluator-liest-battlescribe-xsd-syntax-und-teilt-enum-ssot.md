---
Status: accepted
---

# Der Reinraum-Evaluator liest die rohe BattleScribe-XSD-Syntax und teilt deren Enum-SSOT

> **Nachtrag (Issue 0205, 2026-08-26).** Die Pfade unter `src/domain/` unten sind historisch: seit [ADR-0042](0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md) gibt es weder `src/domain/` noch `src/data/`, `src/domain/evaluator/` liegt seitdem als `src/contexts/ruleengine/engine/`, `src/domain/roster/` als `src/contexts/armylist/model/`. Die hier festgehaltene Entscheidung bleibt davon unberührt.

> **Nachtrag (Issue 0207, 2026-08-26).** Der Strukturprüfer heißt seit [ADR-0041](0041-cast-als-strukturpruefer.md)
> **cast** (`npm run cast`, Regeln in `.cast/rules.json`); ein `depcruise`-Script gibt es in
> `package.json` nicht mehr. Der vendorte XSD-SSOT liegt seit Issue 0186 als
> `src/shared/battlescribe/battlescribeSchema.generated.js` im gemeinsamen Kern, nicht mehr unter
> dem Parser. Die Entscheidung — der Reinraum teilt den XSD-SSOT, statt ihn zu duplizieren — bleibt
> davon unberührt.

ADR-0030 hat die zweite Auswertungs-Engine (`src/domain/evaluator/`) bewusst mit einem
**eigenen, erfundenen Vokabular** (`op` / `operation` / `targetKind` / `targetId`)
gebaut und diese Abweichung von den echten BattleScribe-Attributen als „bewusst
offen gelassene Grenze" ehrlich dokumentiert (Issue 65, ADR-0030 „Umsetzungsstand
und bewusste Grenzen", Punkt 1). Folge: reale `.cat`/`.gst`-Kataloge wurden für
Bedingungen und Modifikatoren nie ausgewertet, sondern nur als Diagnose gemeldet.

Wir entscheiden, diese Grenze zu schließen. Der Evaluator liest ausschließlich die
**kanonischen XSD-Attributnamen** (`type`, `field`, `value`, `scope`, …) und
bezieht die geschlossenen Enum-Mengen (`ConstraintKind`, `ConditionKind`,
`ModifierKind`, `ConditionGroupKind`, `InfoLinkKind`) aus der bereits
vendored XSD-SSOT `src/data/parser/schema/battlescribeSchema.generated.js` (ADR-0016),
statt sie in `src/domain/evaluator/model.js` zu duplizieren. Der Import aus `src/data/parser/`
ist von ADR-0030 ausdrücklich erlaubt; die harte Import-Isolation gegen die
zweite Engine bleibt in beide Richtungen unberührt. Das erfundene Alt-Vokabular
wird **ersatzlos entfernt** (kein Kompatibilitäts-Fallback): keine realen Daten
nutzten es je, nur die engine-eigenen Fixtures, die auf echte BattleScribe-Syntax
umgeschrieben werden.

Die Domänen-Semantik von `scope` und `field` — auf XSD-Ebene reine
`xs:string`-Grammatik, siehe [BSData-Doku](../battlescribe-data-format.md) §7.6 —
bleibt Evaluator-eigene Konvention und wird nicht aus dem Schreibmodell bezogen
(der Import `evaluator → roster` ist per ADR-0030 verboten und wird von
der Strukturprüfung als Fehler durchgesetzt — heute `npm run cast`, siehe
[ADR-0041](0041-cast-als-strukturpruefer.md)).

> **Stand nach Issue 0121 (2026-07-30).** Die Entscheidung gilt unverändert. Die
> Gegenseite der Import-Isolation heißt seit dem Cutover `src/domain/roster/` (das
> Schreibmodell, das aus `src/solver/` hervorgegangen ist); der Validierungsteil des
> Solvers ist gelöscht.

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
