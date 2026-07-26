# Category Scope Bug

Dieses Testszenario validiert, dass Constraints, die auf eine spezifische Kategorie gescoped sind, nur Selections zählen, die sich auch tatsächlich in dieser Kategorie befinden.

## Hintergrund
Im Katalog `Vampire Counts (6th definitive edition)` gibt es die Constraint `6afc-566e-34d4-d35c`. Diese Constraint limitiert die maximale Anzahl an Mounts im Scope `bf30-4ff0-a4d8-3909` (der *Strigoi* Kategorie) auf 0.

Laut Battlescribe-Regeln gilt: Wenn ein Element mit einem Mount ausgerüstet wird, aber *nicht* der Kategorie Strigoi angehört (wie z. B. ein Von Carstein Vampire), so wird diese Selection nicht im Scope "Strigoi" mitgezählt.
Ein Bug in der Auswertungsengine könnte jedoch dazu führen, dass fälschlicherweise das Mount gezählt wird, weil das Mount auf Roster-Ebene gesucht wird und es im selben Roster eine andere Einheit gibt, die der Strigoi-Kategorie angehört.

## Roster

* **01-mount-out-of-scope.ros**: Enthält einen `Vampire Count` (Von Carstein) ausgerüstet mit einem Mount, einen `Vampire Count` (Strigoi) ohne Mount, und einen `Master Necromancer` (um die fragliche Constraint in den Roster zu holen). Da das Mount am Von Carstein Vampire nicht die Strigoi-Kategorie hat, fällt sein Mount nicht in den Strigoi-Scope. Die Constraint `6afc-566e-34d4-d35c` darf also *nicht* feuern.
