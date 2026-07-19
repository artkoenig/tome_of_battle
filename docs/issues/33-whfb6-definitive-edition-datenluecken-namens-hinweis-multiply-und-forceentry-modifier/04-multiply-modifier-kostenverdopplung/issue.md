Status: ready-for-agent
Type: feature
Blocked by: [01]

## Description
Voraussetzung: Kind-Issue 01 (`ModifierKind.MULTIPLY` existiert im
generierten Schema-Modul).

In Dwarfs 2001 und Dwarfs 2005 verdoppelt je ein `modifier type="multiply"
value="2" field="<pts-costTypeId>"` (6 Treffer, z. B. "Traditional Army",
DW1-AB p.53) die Punktekosten einer Einheit, sobald eine bestimmte Heeres-
Bedingung erfüllt ist. Die Kostenberechnung wertet nur `set`/`increment`/
`decrement` aus — `multiply` bleibt wirkungslos, die betroffene Einheit wird
zum halben korrekten Preis berechnet und exportiert. Reproduzierter Fehler:
die Kostenberechnung reicht den Modifier unverändert an dieselbe Funktion
durch, die auch Constraint-Werte modifiziert; deren `switch` kennt
`multiply` nicht.

## Acceptance Criteria
- [ ] Eine Einheit mit einem bedingungserfüllten `multiply`-Modifier auf
      ihre Punktekosten wird mit dem verdoppelten (bzw. allgemein: mit dem
      Modifier-Wert multiplizierten) Preis berechnet — im Roster-Editor, in
      der Gesamtsumme und im XML-Export.
- [ ] Ist die Bedingung nicht erfüllt, bleibt der Basispreis unverändert.
- [ ] Ein `multiply`-Modifier auf eine gewöhnliche Constraint (nicht nur
      Kosten) wird ebenfalls korrekt multipliziert (derselbe Auswertungspfad).
- [ ] Reproduktions-Regressionstest mit realdatennahem Fixture (Dwarfs 2001
      oder 2005, "Traditional Army"-Muster): vor dem Fix falscher (halbierter)
      Preis, danach korrekt verdoppelt.
- [ ] Die volle Testsuite (`npm test`) bleibt grün.

## Comments
