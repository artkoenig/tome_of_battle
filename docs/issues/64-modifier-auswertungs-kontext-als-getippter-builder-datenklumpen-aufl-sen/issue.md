Status: superseded
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
- superseded: PO-Entscheid: ADR-0030 (Revision 2026-07-25, Punkt 1 und 3) erklaert src/solver/ fuer fehlerhaft und legt fest, dass bis zum Cutover jede neue Arbeit dem Ersatz dient, nicht der Koexistenz. Dieses Issue ist ein reiner Struktur-Refactor ueber 22 Produktiv- und 35 Testdateien genau in diesem abzuloesenden Code (28 Produktiv-/71 Testdateien unter src/solver/) — Koexistenz-Arbeit, die die ADR ausschliesst. Unabhaengig davon sind die eigenen Kriterien nicht gemeinsam erfuellbar: AC2 (keine doppelte Fuehrung von counts und seinen Scheiben) und AC3 (kein Verhaltenswechsel) kollidieren, weil an denselben Aufrufstellen zwei Leser verschiedene Zaehlrahmen lesen (rosterValidator.js:338-342: isSelectionEntryHidden liest die roster-aggregierte Scheibe, evaluateConstraintWithCauses liest counts.categoryCounts pro Force) und ein Kontext nur einen Rahmen tragen kann. Umkehrbar: bei anderer Entscheidung neu aufnehmen.
