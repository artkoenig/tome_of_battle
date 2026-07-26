Status: resolved
Type: fix
Blocked by: None

## Description
**Problem:** Der Evaluator wertet Constraints (wie z. B. `type="min"`, Pflichtauswahlen) nur auf Knoten aus, die tatsächlich als Instanz (`selection`) im Roster-Baum existieren (`traverseSelectionTree`). Wenn ein Modell oder eine Option komplett abgewählt wird (0 count) und somit im `.ros`-Baum fehlt, wird das Constraint auf dieser Definition komplett übersprungen. 

**Ergebnis:** Eine fehlende Pflicht-Auswahl mit `scope="parent"` wird nicht gemeldet (siehe ADR 0029, "Bekannte Grenze"). 
*(Hinweis: Gruppen-Constraints werden dagegen korrekt ausgewertet, solange ihr besitzender Knoten instanziiert ist. Die Lücke betrifft also nur direkte Kind-Selektionen.)*

**Isolierung:** Der E2E-Test `parent-scope-missing-mandatory` (Halberdiers-Einheit mit 0 Halberdiers-Modellen) verlangt korrekterweise `firing` und schlägt aktuell in der Suite genau deshalb rot fehl.

## Acceptance Criteria
- [ ] Die Auswertungslogik für Constraints erfasst auch Pflicht-Auswahlen (`type="min"`), deren Ziel-Knoten im Roster vollständig fehlt.
- [ ] Der E2E-Test `parent-scope-missing-mandatory` ist grün, ohne dass seine Assertions aufgeweicht wurden.

## Comments
