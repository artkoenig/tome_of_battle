Status: ready-for-agent
Type: refactor
Blocked by: None

## Description
Aufgetaucht im Gate-Review von Issue 63 (Standards A4 + ein neuer Nitpick nach
den Review-Fixes). Der flache Modifier-Auswertungs-Kontext
`{ roster, system, selectionCounts, forceCategoryCounts, selection,
parentSelection, force, counts, parentCatalogueId }` ist ein **Datenklumpen**:
er wird an ~9 Stellen von Hand zusammengebaut, mit über die Aufrufer driftenden
Feldern — u. a. `rosterValidator.js` (mehrere Constraint-ctxs), `profileCollector.js`
(`makeCtx`), `rosterCounter.js`, `hooks/useRoster.js`. Es gibt keinen Typ und keinen
Builder für diese Form, obwohl `QueryContext`/`EvaluationContext` für die
angrenzenden Kern-Belange bereits existieren.

Zusatzbefund aus dem Re-Review: `profileCollector.makeCtx` reicht seit dem
B1-Fix sowohl `counts` als auch dessen vorab extrahierte Scheiben
(`selectionCounts`, `forceCategoryCounts`) durch — dieselben Zahlen doppelt.
Das ist nur nötig, solange ältere Flach-Feld-Leser neben dem Kern existieren, der
`counts` liest.

Ziel: ein einziger getippter Builder/Kontext für die Modifier-Auswertung, sodass
alle Leser dieselbe Quelle nutzen und die doppelte Durchreichung (`counts` +
Scheiben) entfällt. Bewusst **nicht** Teil von Issue 63 (dort zurückgestellt, um
den Scope der Scope-Vereinheitlichung nicht zu sprengen).

## Acceptance Criteria
- [ ] Es gibt genau einen getippten Builder für den flachen Modifier-Auswertungs-Kontext; die ~9 hand-gebauten Aufbaustellen nutzen ihn.
- [ ] `counts` und seine vorab extrahierten Scheiben werden nicht mehr doppelt im selben ctx geführt (ein Leser-Vertrag, nicht zwei).
- [ ] Kein Verhaltenswechsel: vitest + E2E bleiben grün; reiner Struktur-Refactor.

## Comments
