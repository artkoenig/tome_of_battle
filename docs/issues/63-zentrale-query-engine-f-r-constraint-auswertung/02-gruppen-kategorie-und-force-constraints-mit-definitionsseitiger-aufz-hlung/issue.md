Status: ready-for-agent
Type: refactor
Blocked by: [01]

## Description
Weitet den Zähl-Kern auf die restlichen Constraint-Klassen aus: Grenzen an
Auswahl-Gruppen, Kategorie-Obergrenzen der Force und Punkte-/Anzahl-Grenzen auf
Force-/Roster-Ebene. Zugleich wird die Constraint-Aufzählung auf die
Definitionsseite umgestellt (siehe
[ADR 0029](../../../adr/0029-zentrale-query-engine-fuer-constraint-auswertung.md),
Punkt 4), damit Pflicht-Grenzen auch dann anschlagen, wenn der geforderte
Eintrag in der Liste gar nicht vorkommt.

Beobachtbares Verhalten: Gruppen-, Kategorie- und Force-Grenzen werden
spec-konform geprüft, und eine fehlende Pflichteinheit erzeugt einen Verstoß.

## Acceptance Criteria
- [ ] Ein Gruppen-`max` (Auswahl-Anzahl) und eine Gruppen-Punktegrenze werden spec-konform als Verstoß gemeldet, inkl. Prozent-Grenze an der Gruppe gegen eine Referenz im selben Bezugsrahmen.
- [ ] Ein Kategorie-Cap (Obergrenze einer Force-Kategorie) wird spec-konform geprüft.
- [ ] Eine armeeweite oder kontingentweite Pflicht-Grenze (`min` auf Wurzel-, Force- oder Kategorie-Ebene) schlägt an, wenn der geforderte Eintrag in der Liste fehlt.
- [ ] Gruppen-, Kategorie- und Force-Verstöße tragen ihre Ursache(n) nach ADR 0027 wie die Entry-Grenzen aus Slice 01.

## Comments
