Status: claimed
Type: fix
Blocked by: None

## Description

Eine Query mit `scope="primary-catalogue"` kann die Engine nicht aufloesen. Sie
verhaelt sich dabei korrekt — sie meldet `unresolvedScope` und wertet
fail-closed statt still falsch — aber die Regel wirkt nicht.

**27 Vorkommen in den Fixture-Katalogen**: 7 in der `.gst`, 20 in
`Mercenaries (…).cat`.

Gefunden in Slice 75/07. Praktische Folge dort: der einzige Katalogfall, der
einen `field="name"`-Modifikator mit einer `{this}`-Autor-Meldung verbindet,
haengt an genau diesem Bezugsrahmen und kann deshalb nie feuern. Die betroffene
E2E-Facette wurde ausgelassen und als Luecke dokumentiert; die Regel selbst
bleibt durch einen Modultest festgehalten.

Zu klaeren ist zuerst die Fachfrage, **was** `primary-catalogue` in einem
Mehr-Katalog-Datensatz (ADR-0032) bezeichnet — der Datensatz loest global
by-id auf und kennt keinen ausgezeichneten „primaeren" Katalog. Die Antwort
gehoert an die Katalogdaten und an das Format-Dokument, nicht an eine Annahme.

## Acceptance Criteria
- [ ] Aus den Katalogdaten und dem Format-Dokument ist belegt, welchen Bezugsrahmen `primary-catalogue` bezeichnet.
- [ ] Eine Query mit diesem Bezugsrahmen wird ausgewertet; die Diagnose `unresolvedScope` entfaellt fuer sie.
- [ ] Ein Szenario an echten Katalogdaten deckt den Fall ab (ADR-0033, verfasst vom Black-Box-Autor).
- [ ] Die uebrige E2E-Suite bleibt gruen; jede geaenderte Erwartung ist einzeln begruendet.

## Comments
- PO-Sichtung: Die Fachfrage ist beantwortet und belegt — scope='primary-catalogue' bezeichnet den Armeekatalog der Roster-Force, in der der Knoten sitzt (<force catalogueId>). Beleg: alle 27 Vorkommen sind Bedingungen (18 instanceOf, 9 notInstanceOf); von den 14 verschiedenen childIds loesen genau die 3 im Fixture-Satz vorhandenen auf .cat-Wurzel-Ids auf (731d Ogre, 4d73 Vampire Counts, 4049 Orcs and Goblins), die uebrigen 11 benennen die restlichen Armeen der 17-Katalog-Ausgabe. Die Mercenaries-Bibliotheks-Id und die Spielsystem-Id kommen nie vor. ADR-0032 bleibt unberuehrt: der Datensatz hat keinen primaeren Katalog, das Roster hat einen.
- KORREKTUR der Issue-Praemisse durch die PO-Sichtung: Der Beschreibungstext sagt, die Engine verhalte sich korrekt und werte fail-closed. Das ist nachweislich falsch — sie wertet fail-OPEN. query.js:174-177 liefert bei ungeloestem Bezugsrahmen 0, modifiers.js:100 liest NOT_INSTANCE_OF als actual === 0, und conditionHolds kuerzt nur den Budget-Sentinel ab. Folge: jede notInstanceOf-primary-catalogue-Bedingung feuert heute, auch in genau der Armee, die sie ausschliessen soll. Am oeffentlichen Fassaden-Aufruf gegen ogre-kingdoms/02-general-and-two-core.ros nachgestellt: 9 unresolvedScope-Diagnosen mit scope 'primary-catalogue'. Der Fix dreht das Verhalten also in beide Richtungen, nicht nur in eine. Der Umfang des Issues waechst dadurch nicht, seine Dringlichkeit schon.
- PO-Entscheid zu einer Abweichung, die der Plan dem Maintainer vorbehalten hatte (Risiko R4): Der Plan empfahl, das generelle fail-closed fuer ALLE nicht aufloesbaren Bezugsrahmen NICHT in diesem Issue mitzuziehen, sondern als eigenen Befund zu erfassen. Der Implementierer hat es dennoch getan. Die Abweichung wird ANGENOMMEN, nicht zurueckgebaut — aus drei Gruenden. Erstens ist sie die Folge einer Vorgabe desselben Plans: er verlangt ausdruecklich EINEN gemeinsamen Sentinel statt eines zweiten (design.md:86). Mit einem gemeinsamen Sentinel laesst sich fuer manche ungeloesten Rahmen nicht weiterhin 0 liefern, ohne genau das Problem wieder einzufuehren, das ein Sentinel loesen soll: zwei Werte fuer dieselbe Aussage, von denen einer geprueft und einer vergessen wird. Der Plan hat sich hier selbst widersprochen. Zweitens ist die Wirkung gemessen und eng: ueber alle 112 Szenario-Roster aendern sich 16, ausschliesslich in der Sichtbarkeit, KEINE einzige Verletzung. Drittens ist die Wirkung eine Verbesserung der Ehrlichkeit: Issue 83 (Bezugsrahmen 'unit', 130 Vorkommen) wirkte bisher still falsch und ist jetzt sichtbar unwirksam. Ein Fehler, den man sieht, ist besser als einer, der als erfuellte Bedingung durchgeht. Der Implementierer hat die Abweichung offengelegt (Commit-Text und Querverweis an Issue 83), sie aber einseitig entschieden — das war nicht seine Entscheidung, und das ist ihm anzumerken, auch wenn das Ergebnis richtig ist.
