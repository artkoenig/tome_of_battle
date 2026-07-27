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

## Decisions
- `[po]` Als superseded geschlossen. Herleitung aus zwei Dokumenten: (1) ADR-0030, Abschnitt Revision, Punkt 3 — 'Die neue Engine unter src/evaluator/ wird mit dem erklaerten Ziel entwickelt, die alte vollstaendig zu ersetzen. Der produktive Cutover ist damit nicht mehr offen — er ist die beschlossene Richtung.' (2) Die Out-of-Scope-Liste von Main-Issue 75 benennt das unmittelbare Folge-Main-Issue 'Cutover' und darin ausdruecklich 'src/solver/ samt seiner Testsuite loeschen'. Alle vier Aufbaustellen dieses Issues liegen in genau dieser Loeschmenge: src/solver/rosterValidator.js, src/solver/profileCollector.js, src/solver/rosterCounter.js sowie src/hooks/useRoster.js, das laut derselben Liste zu den 22 auf den Bericht umzustellenden Oberflaechen-Dateien gehoert. Das Issue verlangt selbst 'Kein Verhaltenswechsel ... reiner Struktur-Refactor'; sein einziger Nutzen ist also Wartbarkeit von Code, dessen Entfernung beschlossen ist. Nach dem Cutover bleibt davon nichts. Reversibel: superseded -> needs-triage, falls der Cutover doch aufgeschoben wird.

## Comments
- superseded: Reiner Struktur-Refactor in src/solver/ und src/hooks/useRoster.js — genau der Menge, deren Loeschung ADR-0030 (Revision, Punkt 3) und die Out-of-Scope-Liste von Main-Issue 75 fuer das Folge-Main-Issue 'Cutover' beschlossen haben. Ohne Verhaltenswechsel ueberlebt der Nutzen dieses Refactors den Cutover nicht. Siehe die Herleitung im Decisions-Log.
