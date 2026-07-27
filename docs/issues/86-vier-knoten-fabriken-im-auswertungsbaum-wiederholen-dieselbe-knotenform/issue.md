Status: needs-triage
Type: refactor
Blocked by: None

## Description

Der Auswertungsbaum der Reinraum-Engine wird von **vier** Fabriken bevoelkert —
eine je Ankerart: belegter Knoten, Pflicht-Phantom, Angebots-Anker,
Gruppen-Anker. Alle vier bauen dieselbe Knotenform auf und unterscheiden sich
jeweils in genau einem Feld.

Das ist die klassische Form eines Wartungsrisikos: ein Feld, das die Knotenform
neu braucht, muss an vier Stellen ergaenzt werden, und eine vergessene Stelle
faellt nicht auf, weil der Knoten strukturell weiterhin gueltig aussieht. Genau
das ist bei Main-Issue 81 beobachtbar geworden — dort mussten die neuen
Identitaetsfelder in jede Fabrik einzeln eingetragen werden.

Gemeldet vom Implementierer von Main-Issue 81 als naheliegende Bereinigung, die
er ausdruecklich **nicht** gebaut hat: sie lag ausserhalb seines Schnitts und
beruehrt die Pfadstabilitaet der Knoten, an der die Erwartungsdaten der E2E-Suite
haengen. Die Meldung statt der Umsetzung war richtig.

Zu klaeren ist, ob eine gemeinsame Fabrik die Pfadstabilitaet und die
Reihenfolge, in der Knoten entstehen, unveraendert laesst. Beides ist beobachtbar:
die Manifeste der E2E-Suite benennen Slots ueber Ankerart und Rahmen, und ein
Knoten, der unter einem anderen Pfad oder in anderer Reihenfolge entsteht,
verschiebt Erwartungen. Ein Refactor, der das tut, ist keiner.

## Acceptance Criteria
- [ ] Die Knotenform des Auswertungsbaums ist an einer Stelle beschrieben; die Ankerarten unterscheiden sich nur noch in dem, was sie tatsaechlich unterscheidet.
- [ ] Ein neues Feld der Knotenform muss nur an einer Stelle ergaenzt werden.
- [ ] Kein Verhaltenswechsel: Pfade, Entstehungsreihenfolge und Ankerarten der Knoten bleiben identisch, die gesamte Testsuite bleibt gruen, und keine Erwartung eines E2E-Manifests wird angefasst.
- [ ] Die Aufwandsmessung der Engine zeigt keine Verschlechterung.

## Decisions
- `[po]` Gemeldet vom Implementierer von Main-Issue 81 als Verbesserung, die er ausdruecklich nicht gebaut hat, weil sie ausserhalb seines Schnitts lag und die Pfadstabilitaet beruehrt. Neues Main-Issue auf needs-triage statt Child-Issue, weil es keinem Akzeptanzkriterium von 81 dient — reine Struktur, kein Verhaltenszuwachs. Loesungsfrei formuliert: das dritte Akzeptanzkriterium haelt ausdruecklich fest, dass Pfade und Entstehungsreihenfolge unveraendert bleiben muessen, weil die Erwartungsdaten der E2E-Suite daran haengen.

## Comments
