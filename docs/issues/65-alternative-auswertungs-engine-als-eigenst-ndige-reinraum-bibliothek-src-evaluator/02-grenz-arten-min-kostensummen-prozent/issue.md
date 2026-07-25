Status: resolved
Type: chore
Blocked by: [01]

## Description

Verbreitert die Grenz-Oberfläche über „MAX auf Anzahl" hinaus. Unterstützt MIN-
und MAX-Grenzen über **Selektionsanzahl** *und* **Kostensummen** (Kostenart per
ID) sowie **Prozentgrenzen**, deren Grenzwert aus einem im Bezugsrahmen
gezählten Nenner abgeleitet wird. Eine Prozentgrenze mit leerem Bezugsrahmen
(Nenner 0) gilt als **suspendiert** (mit Diagnose), nicht als verletzt
(Annahme A4). Genau eine dokumentierte Rundungskonvention.

## Acceptance Criteria
- [x] Eine MIN-Grenze meldet eine Verletzung mit Ist/Grenze/Delta, wenn der
      gezählte Wert unter dem Grenzwert liegt, und keine, wenn er erreicht oder
      überschritten wird.
- [x] Grenzen über Kostensummen werten gegen die korrekte Kostenart (per ID, nicht
      Name) aus und liefern dasselbe Tripel Ist/Grenze/Delta.
- [x] Eine Prozentgrenze wird gegen einen aus dem Nenner ihres Bezugsrahmens
      abgeleiteten Grenzwert ausgewertet (eine zentrale Rundungskonvention).
- [x] Eine Prozentgrenze mit Nenner 0 erzeugt keine Verletzung, sondern eine
      Null-Nenner-Diagnose.

## Comments
- Grenz-Oberflaeche verbreitert: MIN-Grenzen (actual>=bound), Kostensummen-Grenzen COST_SUM(costTypeId) per ID (Index fuehrt jetzt costSums je Tally), Prozentgrenzen mit Grenzwert aus dem Nenner des Bezugsrahmens und einer zentralen roundHalfUp-Konvention (rounding.js); Nenner 0 -> SUSPENDED + zeroDenominator-Diagnose (A4). Neu: src/evaluator/rounding.js (+ .test.js), src/evaluator/constraints.test.js. Erweitert: model.js, catalogReader.js, countIndex.js, query.js, constraints.js. Voller Testlauf gruen (1608 vitest + E2E); lint/typecheck/depcruise sauber, Evaluator/Solver-Isolation intakt.
