Status: superseded
Type: fix
Blocked by: None

## Description
Evaluator: Force categories not evaluated

## Acceptance Criteria
- [ ]

## Decisions
- `[po]` Als superseded geschlossen, weil der im Titel benannte Zustand nicht reproduziert und der Stub keine Reproduktion traegt. Recherche-Befund (spec-researcher): force-deklarierte Kategorie-Grenzen werden in src/evaluator/ ausgewertet — synthesizeForceCategoryAnchors in evalTree.js legt fuer jeden categoryLink einer Force-Definition immer einen Kategorie-Anker an, und limitsOf laesst einen categoryLink die Limits seines aufgeloesten categoryEntry erben. Belegt schwarzkastig an echten Katalogdaten durch die Szenarien evaluator-force-child-category-missing (min am categoryLink), explorer-force-constraints (max an der categoryEntry mit scope=force), explorer-category-constraints (max am categoryLink samt Modifikator) und category-scope-bug (Isolations-Gegenprobe); 486 Unit-Tests und 104 E2E-Szenarien gruen. Die engere Teilursache — Force-Instanzen wurden bei Kategorie-Grenzen als Selektionen mitgezaehlt — ist per Commit 4f042d3 behoben; derselbe Commit legte diesen Stub an, ohne ihn je zu fuellen. Die zweite in ADR-0030 benannte Luecke (Kategorie-Sichtbarkeit im Bericht) schloss Slice 75/05. Nicht zu verwechseln mit den gleichnamigen Befunden zu src/solver/checkForceCategoryLimits (Issues 27/06, 33/03, 63/02): die betreffen die alte Engine, die ADR-0030 als nicht mehr massgeblich erklaert.

## Comments
- superseded: Gegenstandslos: der Defekt reproduziert nicht. Der Stub wurde von Commit 4f042d3 mit leerer Beschreibung und leeren Akzeptanzkriterien angelegt und nie gefuellt; die engere Teilursache behob derselbe Commit, die zweite Luecke Slice 75/05. Ohne belegten Fehlfall an Katalogdaten ist keine Spezifikation moeglich. Herleitung samt Belegen im Decisions-Log.
