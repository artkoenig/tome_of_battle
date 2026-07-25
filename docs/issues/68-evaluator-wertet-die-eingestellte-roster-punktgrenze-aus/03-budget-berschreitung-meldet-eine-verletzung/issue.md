Status: resolved
Type: refactor
Blocked by: [01]

## Description

Übersteigt die verplante Summe einer Kostenart die für diese Kostenart
eingestellte Grenze der Armee, meldet die Engine eine roster-weite
Budget-Verletzung. Liegt die Summe auf oder unter der Grenze, entsteht keine
Verletzung. Die Prüfung gilt je Kostenart gegen deren eigene Grenze.

Diese „Armee zu teuer"-Regel ist keine im Katalog hinterlegte Constraint,
sondern eine allgemeine Regel der Auswertungs-Engine. Da die Engine die
produktive Validierung übernimmt, gehört die Meldung in ihren Bericht — an
derselben Stelle wie die übrigen Verletzungen, nicht in eine getrennte
App-Prüfung.

## Acceptance Criteria
- [ ] Eine Armee, deren verplante Summe einer Kostenart die eingestellte Grenze
      dieser Kostenart übersteigt, erzeugt eine roster-weite Budget-Verletzung.
- [ ] Eine Armee auf oder unter der Grenze erzeugt keine Budget-Verletzung.
- [ ] Sind mehrere Kostengrenzen gesetzt, wird jede Kostenart gegen ihre eigene
      Grenze geprüft.

## Comments
- Neues Modul budget.js: engine-allgemeine Regel 'Armee zu teuer' - je Kostenart die am ROSTER-Rahmen verplante Summe (aus dem bestehenden Zaehlindex, includeChildSelections/Forces) gegen ihre eingestellte Grenze; Ueberschreitung => roster-weite Budget-Verletzung mit synthetischem Anker (model.js: ROSTER_BUDGET_ANCHOR, rosterBudgetLimitId). Verdrahtet in evaluator.js und in die eine violations-Liste (report.js, gleiche toViolation-Projektion). Unit- + E2E-Tests gruen.
