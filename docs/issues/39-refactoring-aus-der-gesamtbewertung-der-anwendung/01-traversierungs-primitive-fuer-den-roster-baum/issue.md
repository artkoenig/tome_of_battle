Status: resolved
Type: refactor
Blocked by: None

## Description

**Geruch:** DRY-Verstoß / Shotgun Surgery.

Die Rekursion über den Roster-Baum (`roster.forces[].selections[].selections[]…`)
ist in mindestens sieben Modulen von Hand neu geschrieben: in der
Roster-Serialisierung, im Roster-Hook, in der Constraint-Scope-Auflösung, im
Roster-Zähler, im Modifier-Evaluator sowie in der Spiel- und der Editor-Ansicht.

Der Roster-Baum ist die zentrale Datenstruktur der Anwendung. Jede Änderung an
seiner Form — etwa eine zusätzliche Verschachtelungsebene — ist damit heute
Shotgun Surgery über sieben Module. Erschwerend behandelt jede dieser
Rekursionen den Fall „keine Kind-Selections vorhanden" auf eigene Weise.

**Vorgeschlagene Behebung:** Ein Modul mit den Traversierungs-Primitiven des
Domänenbaums — Durchlaufen, Abbilden und Suchen —, auf das die bestehenden
Aufrufer umgestellt werden. Die Primitiven sind rein und ohne React testbar.

**Prefactoring:** Dieses Kind-Issue ist bewusst vorangestellt. Die Kind-Issues
02 und 03 stützen sich darauf; ohne diese Grundlage würden sie ihre eigenen
Traversierungen mitbringen und den Befund vergrößern statt ihn zu schließen.

## Acceptance Criteria
- [ ] Es existiert ein Modul mit Traversierungs-Primitiven für den Roster-Baum
      (Durchlaufen, Abbilden unter Wahrung der Immutabilität, Suchen per ID)
- [ ] Die Primitiven sind rein, seiteneffektfrei und durch eigene Unit-Tests
      abgesichert
- [ ] Die zuvor handgeschriebenen Rekursionen in den betroffenen Modulen sind
      auf die Primitiven umgestellt
- [ ] Der Sonderfall „keine Kind-Selections" wird an genau einer Stelle
      behandelt
- [ ] `npm run lint` und `npm test` bleiben grün; kein verändertes Verhalten

## Comments
- Neues Modul src/solver/rosterTree.js buendelt die Traversierung des Roster-Baums (childSelectionsOf, rootSelectionsOf, effectiveCountOf, traverseSelectionTree, foldSelectionTree, findSelectionById/-InRoster, someSelection(-InSubtree), countSelections, mapSelectionTree, replaceSelectionById) und wird ueber die Solver-Fassade re-exportiert. Die handgeschriebenen Rekursionen in rosterCounter, constraintScope, modifierEvaluator, useRoster, rosterSerialization sowie die flachen Force-Zugriffe in PlayMode und RosterEditor sind darauf umgestellt; der Fall 'keine Kind-Selections' lebt nur noch in childSelectionsOf. 32 neue Unit-Tests, Verhalten unveraendert.
