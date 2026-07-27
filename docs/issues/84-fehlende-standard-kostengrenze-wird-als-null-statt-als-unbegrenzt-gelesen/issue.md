Status: resolved
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
- xmlParser liest costType/@defaultCostLimit nicht mehr mit 'parseFloat(...) || 0': der neue Helfer getDecimalAttribute faellt bei fehlendem oder unlesbarem Attribut auf die XSD-Vorgabe zurueck, ein ausdrueckliches 0 bleibt 0. Der Wert -1 wird nirgends neu hingeschrieben — der Codegen (scripts/generate-schema-module.js, ADR-0016) emittiert jetzt zusaetzlich die deklarierten Attribut-Vorgaben der vendored XSD als AttributeDefault; der Parser bezieht die Vorgabe aus dieser SSOT seiner eigenen Schicht, ohne Abhaengigkeit zum Evaluator (depcruise: 0 Fehler). Gemessen an den Fixture-Katalogen: 9 costType-Deklarationen in 3 .gst-Dateien, alle mit Attribut (6x -1.0, 3x -1), kein geparster Wert aendert sich — der Fehler war latent, und kein Produktivmodul liest defaultCostLimit heute. Tests: vier Faelle in xmlParser.staticAttributes.test.js (fehlend, unlesbar, ausdrueckliches 0, deklarierter Wert) plus Oberflaechen- und Guard-Tests fuer AttributeDefault. Suite gruen (2210 Tests + E2E).
- Review-Gate (verkuerzt auf drei Achsen; Standards entfaellt, weil sie Minuten zuvor dieselbe Codebasis geprueft hat und ihre Befunde als 87/88/90 liegen, Design-Konformitaet mangels Plan):

- Achse B (Spezifikation): 0 blockierende Befunde, alle fuenf Kriterien erfuellt. Zur Zuschnitt-Frage unabhaengig dieselbe Antwort wie hier, mit einem zusaetzlichen Beleg: der Evaluator fuehrt in catalogReader.js bereits ein eigenes hartcodiertes -1, weil ADR-0030 ihm einen eigenen XML-Leser vorschreibt, und dependency-cruiser.cjs:109-118 (severity error) verbietet dem Parser den Zugriff darauf. Es blieben nur ein lokales Literal (das AC3 verbietet) oder der Codegen. Kein Scope Creep.
- Achse D (Doku): 0 Befunde. Der ADR-0016-Zusatz deckt sich mit dem tatsaechlichen Codegen-Verhalten (Sortierung, Abbruch bei Konflikt, DEFAULT_COST_LIMIT '-1'), nachgeprueft an generate-schema-module.js:102-149.
- Achse C (Tests): Bericht VERWORFEN, siehe unten. Ersetzt durch eigene Messung: 212 Dateien / 2210 Tests gruen; lint 0, typecheck 0, depcruise 0 Fehler (die eine Warnung ist der vorbestehende Solver-Zyklus).

Vorfall, der festgehalten gehoert: waehrend der drei Achsen hat ein Pruef-Agent den Arbeitsbaum auf den Stand vor diesem Issue zurueckgesetzt und die Ruecknahme gestaged (209 geloeschte Zeilen). Die Achsen sind als nur-lesend definiert. Aufgefallen ist es am Zaehlwerk: der Testlauf meldete 2206 Tests, der Implementierer 2210 — die Differenz sind genau die Tests, die dieses Issue hinzufuegt. Nachgemessen auf dem wiederhergestellten Baum: 2210. Der Bericht der Test-Achse ist damit auf dem falschen Stand entstanden und belegt nichts; HEAD war unversehrt, der Baum wurde daraus zurueckgeholt. Achse B und D haben nachweislich gegen den Commit-Inhalt geprueft und bleiben gueltig.
