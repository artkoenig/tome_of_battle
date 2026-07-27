Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

Die Knoten des Auswertungsbaums werden an fuenf Stellen unabhaengig
zusammengebaut, und die Datei, die das tut, traegt sechs voneinander unabhaengige
Aufgaben. Beides zusammen macht jedes neue Knotenfeld zu einer Aenderung an fuenf
Stellen — ohne dass irgendetwas anschlaegt, wenn eine davon vergessen wird.

Gefunden bei der Standards-Pruefung von Main-Issue 77, dessen beauftragte Arbeit
belegt und abgeschlossen ist. Diese Punkte gehoeren bewusst NICHT mehr dorthin:
sie sind Struktur- und Vertragsfragen der Umgebung, keine offenen Enden jenes
Auftrags. Zwei von ihnen wurden allerdings **durch** ihn sichtbar — er war der
erste seit langem, der ein Feld an der Knotenform ergaenzt hat.

**1. Kein Ort, an dem ein Knoten entsteht.** Dieselbe elfstellige Knotenform
steht als Objekt-Literal in fuenf Fassungen nebeneinander
(`src/evaluator/evalTree.js:193`, `:234`, `:274`, `:525`, `:628`), jede mit
eigener handgeschriebener Vererbungsregel. Das eine neue Feld aus Main-Issue 77
musste deshalb fuenfmal eingetragen werden.

Der Schaden ist nicht die Tipparbeit, sondern die Stille danach: baut jemand eine
sechste Stelle und vergisst das Feld, ist es `undefined`. Der Lesezugriff reicht
das durch, und in `src/evaluator/query.js` ist dann weder "keine Id" noch "die
gesuchte Id" wahr — die Abfrage antwortet **"gehoert nicht zum primaeren
Katalog"** statt "nicht aufloesbar". Genau die Verwechslung, die Main-Issue 77
ueberall sonst ausgeraeumt hat, kaeme durch die Hintertuer zurueck. Weder ein
Test noch eine Pruefung schlaegt dabei an.

**2. Zwei gegensaetzliche Regeln fuer dieselbe Datensatzform, in einer Datei.**
Das neue Feld ist ausdruecklich immer besetzt und wird nie ueberschrieben
(`evalTree.js:207-210`). Ein anderes Feld derselben Knoten wird umgekehrt
nachtraeglich per Mutation angeheftet (`evalTree.js:560`), weshalb ein Leser in
einem anderen Modul auf `undefined` pruefen muss (`countIndex.js:120`). Eine
gemeinsame Fabrik muesste sich fuer eine der beiden Regeln entscheiden — das ist
der eigentliche Gewinn an Punkt 1.

**3. Die Datei traegt sechs Aufgaben.** 746 Zeilen fuer Rahmen-Identitaet, die
Bindung des primaeren Katalogs, den Knotenbau, Lesehilfen auf Definitionen, vier
Synthese-Durchlaeufe und sechs Traversierungs-Generatoren. Sie ist mit 14
Commits in sechs Monaten die meistgeaenderte Quelldatei des Repositories — das
ist die Signatur dieses Musters, kein Zufall. Main-Issue 77 hat sie aus einem
Grund angefasst, der mit ihren uebrigen fuenf Aufgaben nichts zu tun hat.

**4. Ein Modul greift am eigenen Lesezugriff vorbei.** In `query.js` liest eine
Stelle ein Knotenfeld roh aus (`query.js:106`), drei Zeilen von einer anderen
entfernt, die fuer das Nachbarfeld ausdruecklich den benannten Lesezugriff
benutzt — dessen Beschreibung diesen genau damit begruendet, dass das
Query-Primitiv "nie selbst in die Knotenform greift". Entweder beide oder keiner.

**5. Eine Zusicherung faellt zur unsicheren Seite, ohne es zu sagen.** Der
Bericht meldet eine nicht erfuellte Pflicht als "nicht offen", wenn die
Untergrenze gar nicht ausgewertet werden konnte (`report.js:381`). Das ist
gewollt — Main-Issue 77 hat ausdruecklich entschieden, eine unauswertbare
Untergrenze nicht als offene Pflicht zu behaupten — und der Ersatz steht bereit:
der Slot weist sie unter den nicht auswertbaren Grenzen aus. Nur sagt der
Vertrag das nicht: die Beschreibung erklaert allein die Gegenrichtung
(`report.js:352-353`), sodass ein Leser selbst darauf kommen muss, das zweite
Feld mitzupruefen. Zu ergaenzen ist die Zusicherung, nicht das Verhalten.

## Acceptance Criteria
- [ ] Ein Knoten des Auswertungsbaums entsteht an genau einer Stelle; die Vererbungsregeln stehen dort einmal statt fuenfmal.
- [ ] Ein vergessenes Pflichtfeld an einer neuen Erzeugungsstelle faellt auf, bevor es eine Abfrage falsch beantwortet — nicht erst im Bericht.
- [ ] Die Knotenfelder folgen einer Regel: entweder bei der Erzeugung besetzt oder nachtraeglich angeheftet, nicht beides nebeneinander.
- [ ] Die Aufgaben von `evalTree.js` sind entflochten; jede verbleibende Einheit hat einen benennbaren Grund, sich zu aendern.
- [ ] Das Query-Primitiv greift nirgends mehr roh in die Knotenform.
- [ ] Der Vertrag des Berichts sagt fuer beide Richtungen, wohin er faellt, wenn eine Grenze nicht auswertbar ist.
- [ ] Kein Verhaltenswechsel an echten Katalogdaten; die Testsuite bleibt gruen, keine Erwartung unter `docs/testing/` wird abgeschwaecht.

## Comments
- Entstehung: Standards-Achse zu Main-Issue 77. Ausgelagert aus demselben Grund wie Issue 88 zuvor — die Achse prueft ganze Dateien statt nur des Diffs und findet daher auch bei sauberem Stand weiter Umgebungs-Befunde. Weiterpolieren im Main-Issue haette dessen Abschluss verhindert, ohne den Auftrag zu verbessern.
- Punkt 5 ist bewusst kein Fehler-Issue: das Verhalten ist von Scheibe 04 begruendet gewaehlt und gemessen. Es fehlt allein die Zusicherung im Vertrag.
- Beruehrt Issue 88 (zaehlbare Kindarten): auch dort geht es um zwei Stellen, die dieselbe Frage unabhaengig beantworten, und um `evalTree.js`. Wer beide anfasst, sollte sie zusammen betrachten.
- Ein sechster Befund derselben Pruefung ist bereits behoben und daher hier nicht aufgenommen: der normative Datensatz in `docs/evaluator-architecture.md` beschrieb das neue Knotenfeld unter falschem Namen, in falscher Form, mit falschem Lesezugriff und der falschen Behauptung, es sei nur am Kontingent besetzt — waehrend zwei andere Abschnitte desselben Dokuments es richtig fuehrten.
