Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

**Geruch:** Data Clump, Primitive Obsession, SRP- und OCP-Verstoß, DRY-Verstoß.

Der Katalog-Editor ist die schwächste Datei der Codebasis — ein früher Wurf,
der die spätere Qualitätslatte nie nachgezogen hat. Drei Befunde:

### Teil A — Zehn positionale Parameter

Die Funktion zum Aktualisieren des Roh-XML nimmt zehn Parameter entgegen, von
denen sechs je nach Eintragstyp bedeutungslos sind. Aufrufer müssen Ketten von
`undefined` übergeben. Erschwerend unterscheidet die Funktion `undefined` von
„leer", um „nicht ändern" von „löschen" zu trennen — an der Aufrufstelle ist
das unlesbar und beim Umsortieren still falsch.

### Teil B — Typkette statt Polymorphie

Dieselbe Funktion verzweigt in einer Kette über den Eintragstyp. Ein neuer
Eintragstyp bedeutet: genau hier editieren.

### Teil C — Zwei divergierende Traversierungen desselben Baums

Die Suche nach editierbaren Einträgen und die Suche nach einem exakten Eintrag
implementieren zwei getrennte Durchläufe über denselben Katalogbaum — mit
**unterschiedlichen Knotenmengen**. Die zweite kennt Kategorie-Einträge,
Info-Links, Force-Einträge und Kategorie-Links, die erste nicht. Folge: die
Suche findet heute schon Dinge nicht, welche die Exakt-Suche findet, und ein
neuer Knotentyp muss an zwei Stellen nachgezogen werden.

Zusätzlich sind die vier Funktionen zum Hinzufügen von Eintrag, Gruppe, Profil
und Regel wörtliche Kopien, die sich nur in einem String unterscheiden.

**Vorgeschlagene Behebung:** Ein Änderungsobjekt aus Kennung, Typ und Patch
statt der zehn Positionsparameter; eine Handler-Zuordnung je Typ statt der
Kette; ein generischer Katalogbaum-Durchlauf, auf dem beide öffentlichen
Suchfunktionen als Filter aufsetzen.

## Acceptance Criteria
- [ ] Die Aktualisierungsfunktion nimmt ein benanntes Änderungsobjekt entgegen;
      keine Ketten von `undefined` mehr an den Aufrufstellen
- [ ] Die Unterscheidung „nicht ändern" gegenüber „löschen" ist im
      Änderungsobjekt explizit ausgedrückt, nicht über `undefined` kodiert
- [ ] Die Typverzweigung ist durch eine Handler-Zuordnung ersetzt; ein neuer
      Eintragstyp erfordert keine Änderung an der Aktualisierungsfunktion
- [ ] Es existiert genau ein Katalogbaum-Durchlauf; beide Suchfunktionen setzen
      darauf auf und sehen dieselbe Knotenmenge
- [ ] Ein Test belegt, dass die Suche nach editierbaren Einträgen nun dieselben
      Knotentypen findet wie die Exakt-Suche
- [ ] Die vier Hinzufügen-Funktionen sind auf eine gemeinsame Umsetzung
      zurückgeführt
- [ ] `npm run lint` und `npm test` bleiben grün

## Comments
