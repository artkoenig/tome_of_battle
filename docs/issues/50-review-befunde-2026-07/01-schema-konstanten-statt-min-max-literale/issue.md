Status: ready-for-agent
Type: fix
Blocked by: None

## Description

Prefactoring (Befund N1). Der Codegen erzeugt aus der vendorten XSD eine
Konstante für die Beschränkungsarten (`min`/`max`), doch kein Produktivmodul
verwendet sie — nur ein Guard-Test. Stattdessen stehen die Zeichenketten als
Literale verstreut in den Solver-Modulen (Validator, Zähler, Optionssammler,
Listenregeln, Profilsammler). Zwei weitere Module deklarieren sich dafür sogar
eine eigene lokale Konstante, sodass dieselbe Aussage dreifach im Code steht.

Genau diese Drift-Klasse sollte der Codegen nach ADR 0016 beseitigen.

Dieses Issue läuft zuerst, weil die nachfolgenden Slices dieselben Dateien
inhaltlich ändern — erst aufräumen, dann ändern. Rein strukturell: es ändert
sich kein beobachtbares Verhalten.

## Acceptance Criteria
- [ ] Kein Produktivmodul enthält die Beschränkungsart mehr als Zeichenketten-Literal; alle nutzen die generierte Konstante
- [ ] Die lokalen Konstanten-Duplikate sind entfernt und durch die generierte Konstante ersetzt
- [ ] Die bestehende Testsuite läuft grün, Lint ist sauber
- [ ] Kein Test musste angepasst werden, um grün zu bleiben — Beleg dafür, dass sich das Verhalten nicht geändert hat

## Comments
