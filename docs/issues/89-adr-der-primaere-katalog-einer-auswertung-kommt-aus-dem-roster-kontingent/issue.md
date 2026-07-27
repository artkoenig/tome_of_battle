Status: needs-triage
Type: chore
Blocked by: None

## Description

Main-Issue 77 hat eine Architektur-Entscheidung getroffen und umgesetzt, aber
noch nicht als Entscheidungsdokument festgehalten. Der Mechanismus ist im
Architektur-Dokument beschrieben; was fehlt, ist der Beschluss samt Alternativen
und Begruendung.

**Die Entscheidung:** Der "primaere Katalog" einer Auswertung kommt aus dem
**Roster**, nicht aus dem Datensatz — genauer: aus der Katalog-Angabe des
Kontingents, in dem der auszuwertende Knoten sitzt. Ein Roster mit zwei
Kontingenten hat damit zwei verschiedene primaere Kataloge gleichzeitig.

**Warum das eine ADR verdient, keinen Kommentar:**

- Sie ist schwer umkehrbar: der oeffentliche Roster-Vertrag der Auswertung ist um
  ein Feld gewachsen, das jeder kuenftige Roster-Leser fuellen muss — auch der
  der Anwendung, sobald der Cutover kommt.
- Sie ueberrascht ohne Zusammenhang: ADR-0032 sagt ausdruecklich, der Datensatz
  loese global ueber Ids auf und kenne keinen ausgezeichneten primaeren Katalog.
  Beides gilt gleichzeitig und muss zusammen gelesen werden — der Datensatz hat
  keinen, das Roster hat einen je Kontingent.
- Es gab echte Alternativen: die Herkunft aus dem Roster, die Herkunft aus der
  Definition (in welchem Katalog steht die Regel?), und die Herkunft aus dem
  Zaehlindex. Die Wahl faellt nicht von selbst.

**Zweiter Beschluss derselben Umsetzung, der mit hineingehoert:** eine Abfrage
ohne Antwort liefert kuenftig einen eigenen Wert statt der Zahl null, und zwar
**einen** Wert fuer alle Herkuenfte. Vorher las eine Bedingung der Art "ist keine
Instanz von" die Null als "trifft zu" — jede Regel auf einem nicht aufloesbaren
Rahmen wirkte also, nur falsch herum. Die Entscheidung fuer genau einen Wert
statt mehrerer ist bewusst: zwei Werte fuer dieselbe Aussage laden dazu ein,
einen zu pruefen und den anderen zu vergessen.

Das Schreiben der ADR wurde bewusst dem Maintainer vorbehalten, weil sie
unmittelbar neben ADR-0032 liegt und moeglicherweise eine Ergaenzung dort
erfordert — eine redaktionelle Entscheidung an einer angenommenen ADR.

## Acceptance Criteria
- [ ] Eine ADR unter `docs/adr/` haelt fest, woher der primaere Katalog einer Auswertung kommt, mit den verworfenen Alternativen und ihrer Begruendung.
- [ ] Sie haelt ausserdem fest, dass eine Abfrage ohne Antwort einen eigenen Wert liefert statt der Zahl null, und warum es genau einer ist.
- [ ] Das Verhaeltnis zu ADR-0032 ist benannt; falls dort eine Ergaenzung noetig ist, ist sie vorgenommen.
- [ ] Die neue ADR ist im Index unter `docs/adr/README.md` eingetragen.
- [ ] Das Architektur-Dokument verweist auf sie.

## Comments
- Die Umsetzung liegt bereits vor (Main-Issue 77, Scheibe 03) und ist in docs/evaluator-architecture.md §3.2, §4.1, §4.3 und §4.5 beschrieben. Es fehlt allein das Entscheidungsdokument.
- Gleiche Lage bei zwei weiteren ADR-Kandidaten dieser Sitzung, die aus demselben Grund offen blieben: "Das Roster benennt eine Auswahl ueber den Verweis, nicht ueber sein Ziel" (Main-Issue 76) und "Die aufgeloeste Sicht des Evaluators wird nach der Aufbereitung eingefroren statt mutationsfrei gebaut" (Main-Issue 80). Wer diese ADR schreibt, sollte pruefen, ob die drei zusammengehoeren.
