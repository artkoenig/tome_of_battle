Status: ready-for-agent
Type: fix
Blocked by: [02]

## Description

Diese Scheibe uebernimmt den Inhalt des bisher eigenstaendigen Issues 78, das
mit Abschluss dieser Arbeit als abgeloest geschlossen wird.

Ein Eintrag zaehlt unter seiner **Eintragsart** mit — ob er ein Modell, eine
Einheit oder eine Verbesserung ist. Bedingungen fragen genau danach ("zaehle die
Kinder, die Modelle sind"). Ein ueber einen Verweis hereingezogener Eintrag
zaehlt dort heute nicht mit: die Leseschicht nimmt die Eintragsart nur vom direkt
gesetzten Eintrag auf, nicht vom Verweis.

Folge: dieselbe Einheit zaehlt unterschiedlich, je nachdem wie sie ins Roster
kam. Eine Bedingung auf Modelle sieht im Verweis-Fall null Modelle.

**Die naheliegende Loesung ist falsch und darf nicht gewaehlt werden.** Der
Verweis traegt selbst ein Art-Attribut, aber mit voellig anderer Bedeutung: es
sagt, *worauf* der Verweis zeigt (auf einen Eintrag oder auf eine
Eintragsgruppe), nicht *was* das Ziel ist. Die beiden Wertemengen sind
verschieden und laut Schema getrennt. Die Art des Verweises als Eintragsart zu
lesen wuerde einen bedeutungslosen Wert in die Zaehlung tragen.

Richtig ist: die Eintragsart kommt **immer** vom aufgeloesten Ziel — auch dann,
wenn das Vorkommen ueber einen Verweis kam.

Diese Scheibe setzt die vorige voraus: vor ihr bindet kein Vorkommen je einen
Verweis, die Eintragsart waere also gar nicht pruefbar.

## Acceptance Criteria
- [ ] Ein ueber einen Verweis gesetzter Eintrag zaehlt unter derselben Eintragsart wie derselbe Eintrag direkt gesetzt.
- [ ] Eine Bedingung, die nach einer Eintragsart fragt, liefert in beiden Faellen dasselbe Ergebnis. Belegt wird das an der Eintragsart "Einheit": auf Modell-Ebene laesst der Fixture-Satz den Unterschied nicht trennen — nur drei Modell-Eintraege sind ueberhaupt Verweis-Ziel, und keiner ihrer verlinkenden Eltern traegt eine Modell-Bedingung. Diese Luecke ist zu dokumentieren, nicht durch erfundene Daten zu schliessen.
- [ ] Die Eintragsart wird vom aufgeloesten Ziel bezogen; das gleichnamige Attribut des Verweises fliesst nirgends in die Zaehlung ein.
- [ ] Ein Szenario an echten Katalogdaten deckt genau diesen Unterschied ab.
- [ ] Die uebrige Testsuite bleibt gruen; jede geaenderte Erwartung ist einzeln aus den Katalogdaten begruendet.
- [ ] Das Architektur-Dokument beschreibt, woher die Eintragsart eines verlinkten Vorkommens stammt.

## Comments
- Uebernimmt den Inhalt von Main-Issue 78. Dieses wird nach Abschluss als abgeloest geschlossen, mit Verweis hierher.
- Autorenschaft: das Szenario ist ein Black-Box-Testfall nach ADR-0033 und wird vom e2e-testcase-author allein aus den Katalogdaten verfasst — VOR der Engine-Aenderung. Fachliche Vorlage ist das vorhandene Szenario evaluator-bug-childid-model, das dieselbe Bedingung heute nur an direkt gesetzten Eintraegen prueft; der neue Fall ist dieselbe Aussage fuer einen ueber einen Verweis bezogenen Eintrag.
- Unabhaengig bestaetigt: ein externer Gutachter, der weder den Code noch diesen Plan gesehen hat, kam auf dieselbe Regel und nannte "die Eintragsart aus dem Art-Attribut des Verweises ableiten" ausdruecklich als etwas, das er verweigern wuerde.
