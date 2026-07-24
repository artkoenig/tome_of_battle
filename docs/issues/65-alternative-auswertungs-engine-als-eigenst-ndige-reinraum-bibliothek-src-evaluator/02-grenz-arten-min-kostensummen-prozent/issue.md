Status: ready-for-agent
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
- [ ] Eine MIN-Grenze meldet eine Verletzung mit Ist/Grenze/Delta, wenn der
      gezählte Wert unter dem Grenzwert liegt, und keine, wenn er erreicht oder
      überschritten wird.
- [ ] Grenzen über Kostensummen werten gegen die korrekte Kostenart (per ID, nicht
      Name) aus und liefern dasselbe Tripel Ist/Grenze/Delta.
- [ ] Eine Prozentgrenze wird gegen einen aus dem Nenner ihres Bezugsrahmens
      abgeleiteten Grenzwert ausgewertet (eine zentrale Rundungskonvention).
- [ ] Eine Prozentgrenze mit Nenner 0 erzeugt keine Verletzung, sondern eine
      Null-Nenner-Diagnose.

## Comments
