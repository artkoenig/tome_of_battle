Status: ready-for-agent
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
