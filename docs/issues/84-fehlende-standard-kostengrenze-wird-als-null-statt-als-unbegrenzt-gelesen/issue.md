Status: needs-triage
Type: fix
Blocked by: None

## Description

Die gemeinsame XML-Lese-Schicht deutet eine **fehlende** Standard-Kostengrenze
eines Kostentyps als "null erlaubt" statt als "unbegrenzt".

`src/parser/xmlParser.js:524` liest den Wert als
`parseFloat(el.getAttribute(...)) || 0`. Fehlt das Attribut oder ist es
unlesbar, liefert `parseFloat` `NaN`, der Oder-Ausdruck macht daraus `0` — also
eine Grenze von null Punkten. Das Schema sagt das Gegenteil: die Vorgabe ist
`-1` (`src/parser/schema/Catalogue.xsd:89`,
`<xs:attribute name="defaultCostLimit" type="xs:decimal" default="-1"/>`), und
minus eins bedeutet in diesem Format "keine Grenze".

Aus "unbegrenzt" wird damit die schaerfstmoegliche Grenze — dieselbe
Verwechslung, um die es in Main-Issue 79 geht, nur eine Schicht tiefer und mit
umgekehrtem Vorzeichen.

Der Nebeneffekt trifft auch den Wert `0` selbst: er ist vom Fehlerfall nicht mehr
unterscheidbar, weil beide denselben Ausgang nehmen.

**Nicht vom Cutover gedeckt.** ADR-0030 nimmt `src/solver/` von neuer Arbeit
aus, aber `src/parser/` ist eine geteilte Schicht: sie wird von
`src/evaluator`, `src/db`, `src/components`, `src/utils` und `src/solver`
importiert. Der Fehler ueberlebt die Abloesung der alten Engine.

Gefunden bei der Umsetzung von Main-Issue 79, dort bewusst nicht mitgeaendert.

## Acceptance Criteria
- [ ] Ein fehlendes oder unlesbares Attribut fuehrt zur Schema-Vorgabe "unbegrenzt", nicht zu einer Grenze von null.
- [ ] Ein ausdruecklich angegebener Wert von null bleibt eine Grenze von null und ist vom Fehlerfall unterscheidbar.
- [ ] Der Sentinel wird nicht als hartes Zahl-Literal wiederholt, sondern aus der bestehenden benannten Quelle bezogen.
- [ ] Ein Test haelt beide Faelle fest.
- [ ] Die uebrige Testsuite bleibt gruen; jede geaenderte Erwartung ist einzeln begruendet.

## Comments
- Belegt bei der PO-Sichtung: xmlParser.js:524 nutzt `parseFloat(...) || 0`; Catalogue.xsd:89 fuehrt default="-1". Importeure von src/parser laut Abhaengigkeiten: src/components, src/components/editor, src/components/play, src/db, src/evaluator, src/solver, src/utils.
