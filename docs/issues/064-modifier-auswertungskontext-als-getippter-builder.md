---
status: active
branch: claude/new-session-jnwa1m-064
pr:
---

# Modifier-Auswertungskontext als getippten Builder auflösen

## Intent

Der flache Kontext der Modifier-Auswertung —
`{ roster, system, selectionCounts, forceCategoryCounts, selection,
parentSelection, force, counts, parentCatalogueId }` — ist ein Datenklumpen.
Er wird an rund neun Stellen von Hand zusammengebaut, mit über die Aufrufer
driftenden Feldern, unter anderem in `rosterValidator.js` (mehrere
Constraint-Kontexte), `profileCollector.js` (`makeCtx`), `rosterCounter.js` und
`hooks/useRoster.js`. Für diese Form gibt es weder einen Typ noch einen
Builder, obwohl `QueryContext` und `EvaluationContext` für die angrenzenden
Kern-Belange bereits existieren.

Dazu kommt eine doppelte Durchreichung: `profileCollector.makeCtx` gibt seit
dem B1-Fix sowohl `counts` als auch dessen vorab extrahierte Scheiben
(`selectionCounts`, `forceCategoryCounts`) weiter — dieselben Zahlen zweimal.
Das ist nur nötig, solange ältere Flach-Feld-Leser neben dem Kern existieren,
der `counts` liest.

Gewünschtes Ergebnis: ein einziger getippter Kontext für die
Modifier-Auswertung, den alle Leser benutzen, sodass die doppelte
Durchreichung entfällt. Reiner Strukturwandel — kein Verhalten ändert sich.

Acceptance criteria:

1. Es gibt genau einen getippten Builder für den flachen
   Modifier-Auswertungskontext, und die rund neun hand-gebauten Aufbaustellen
   benutzen ihn.
2. `counts` und seine vorab extrahierten Scheiben werden nicht mehr doppelt im
   selben Kontext geführt — ein Leser-Vertrag, nicht zwei.
3. Kein Verhaltenswechsel: die Suite und die E2E-Tests bleiben grün, jeweils
   mit Kommando, Umfang und Exit-Code belegt.

## Plan

Modules touched: new `src/solver/modifierContext.js`; build-site conversions
in `src/solver/rosterValidator.js` (6 sites), `src/solver/profileCollector.js`
(`makeCtx`), `src/solver/rosterCounter.js` (2 sites),
`src/solver/entryVisibility.js` (translator `buildEvalContext` + 2 variants),
`src/solver/entryAvailability.js`, `src/hooks/useRoster.js`, and the editor
components (`OptionGroup`, `SelectionConfigurator`, `AutoFillSuggestions`,
`RosterSidebar`, `RosterCategorySection`, `CategoryUnitAdder`,
`UnitSelectionCard`) via a facade export in `src/solver/validator.js`
(ADR 0023). `modifierEvaluator.js` stays UNCHANGED.

Contracts:
- `@typedef ModifierEvalContext` `{ roster, system, counts?, selectionCounts?,
  forceCategoryCounts?, selection?, parentSelection?, force?,
  parentCatalogueId? }` — plain, spreadable object (downstream spread-extends
  it, e.g. `_resolvingSelfScopeCategory`).
- One builder `buildModifierEvalContext(parts)` with an EXPLICIT category-count
  source, because three semantics exist: `counts` (per-force/aggregate derived
  by the reader as today), verbatim slice tables (incl. the `null` sentinel and
  rosterCounter's mid-count mutable tables), or none. The builder never emits
  `counts` AND slices in the same context — AC 2 lands at construction time.

Non-obvious choices:
1. `toQueryContext`'s precedence chain in `modifierEvaluator.js` stays — it is
   the reader for test-built legacy contexts (implementer may not edit tests)
   and for the slice path; AC 2's "ein Leser-Vertrag" is enforced where
   contexts are BUILT, not by breaking the reader.
2. Counts-carrying sites drop their redundant slices — provably dead today
   (reader precedence prefers `counts`; no other production reader exists,
   researcher-verified).
3. Per-site semantics are preserved exactly: deliberate omissions stay
   (no `parentSelection` at group constraints, rosterValidator.js:774-780; no
   `force` in `isCategoryLinkHidden`); `checkSelectionMessages` stays
   counts-less (its slice approximation is current behaviour).
4. Out of scope: `EvaluationContext` (cost path, own typedef), the deliberately
   empty `{}` static contexts, and `rosterSerialization.js`.
5. The identical ctx rebuilt inside the per-constraint forEach
   (rosterValidator.js:583) is hoisted during conversion — pure waste, no
   behaviour change.

Plan update (after implementer contact, 2026-07-29): the component slice is
NARROWED. Five component test files fully mock the solver facade without
`importOriginal` spread, so adding a facade import to those components breaks
their mocks, and tests are off-limits. Converted components: only
`AutoFillSuggestions.jsx` (no test) and `RosterSidebar.jsx:47` (test uses the
real solver). The five full-mocked components (`OptionGroup`,
`SelectionConfigurator`, `UnitSelectionCard`, `RosterCategorySection:93`,
`CategoryUnitAdder`) keep their hand-built slice-only contexts — AC 1's
"rund neun" sites (rosterValidator, profileCollector, rosterCounter,
useRoster) are all converted, AC 2 never applied to the slice-only component
contexts. VisibilityContext-typed bundles (ForceEditorSection,
RosterSidebar:50, RosterCategorySection:70, entryVisibility:181) are not
flat builds and stay. `armyWideSelectors.js:136` joins the inventory and is
converted (it is a solver-internal flat build, test-safe).

## Tasks

## Decisions

- Aus dem alten Tracker übernommen
  (`docs/issues/64-modifier-auswertungs-kontext-als-getippter-builder-datenklumpen-aufl-sen/issue.md`,
  Status `needs-triage`). Inhaltlich unverändert.
- **Herkunft:** Aufgetaucht im Gate-Review von Alt-Issue 63 (Standards-Befund
  A4 plus ein Nitpick nach den Review-Fixes). Dort bewusst zurückgestellt, um
  den Umfang der Scope-Vereinheitlichung nicht zu sprengen.

## Log

- 2026-07-29 implementer round 1: stopped before editing, per the
  plan-contact rule — five component test files mock the facade fully (no
  importOriginal), so the planned component conversions cannot land without
  test edits. Decision (default, human asleep): narrow the component scope
  instead of authorizing mechanical mock edits — the issue's own AC-1 site
  list is fully convertible test-free. Recorded as plan update above.
  Follow-up candidate for the human: allow one passthrough line per mock in
  a later run to finish the component conversions.

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — one typed builder, all hand-build
  sites converted, double pass-through gone at construction; pure structure,
  reader untouched.
- What surprised me? The issue's "rund neun" undercounts (12 production
  sites + components), and `counts`-presence is BEHAVIOUR (the reader
  approximates per-force from army-wide tables when counts are absent) — so
  "no behaviour change" requires per-site fidelity, not uniform filling.
  Also `forceCategoryCounts` has three semantics incl. a `null` sentinel.
- What am I assuming without having verified it? That dropping redundant
  slices at counts-carrying sites is a no-op (researcher verified reader
  precedence; the suite must confirm), and that no test imports the new
  module's internals (it is new). No test-author: pure refactor, the
  existing suite (2143 unit tests + E2E incl. the shape-pinning tests
  listed in the briefing) is the behaviour pin — recorded per invariant 2.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
