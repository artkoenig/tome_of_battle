---
status: backlog
branch:
pr:
---

# One cost-type rule and one budget value, in the shared kernel

## Goal

Findings T1 and T6 of [`docs/ddd-review-2026-08.md`](../ddd-review-2026-08.md). They share a
measure, so they share an issue.

**The two implementations already disagree — on data this repository ships.** The question "which
cost type is this roster measured in, and what is it called?" is answered twice:
`src/contexts/armylist/model/costTypeLabels.js:21` `resolveCostLimitTypeId(roster, system)` and
`src/contexts/ruleengine/readmodel/costDisplays.js:24` `costLimitTypeIdOf(roster, costTypes)`, with
the label derivations duplicated beside them (`costTypeLabels.js:36,42` vs `costDisplays.js:37,50`)
and a **third** copy of the trim at `costDisplays.js:72`. The review assumed they agree by
coincidence. They do not:

- `system.costTypes` is parsed from the `.gst` root alone (`src/platform/battlescribe/xmlParser.js:522-527`,
  handed through at `:675`). `.cat` roots are never read for cost types on that path.
- `description.costTypes` reads **every** catalogue root
  (`src/contexts/ruleengine/engine/datasetDescription.js:57-59`), which is correct: `costTypes` sits
  on `CatalogueBase` in `src/platform/battlescribe/schema/Catalogue.xsd:720`, the complexType both
  `gameSystem` and `catalogue` extend.
- `src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/Lizardmen (6th definitive edition).cat`
  is a non-library book (`library="false"`) declaring `<costType name="SC Saurus Chars"
  id="bc66-b624-4194-2f0f"/>`. For that id `resolveCostTypeLabel(system, id)` returns `''` and
  `costTypeLabelOf(description.costTypes, id)` returns `'SC Saurus Chars'` — **today**. It is masked
  only because every value of that type in the book is `0` and `extraResourceTotalsOf`'s
  `total !== 0` filter (`costDisplays.js:75`) hides the row. One catalogue revision with a non-zero
  value or a `costSum` constraint makes it a nameless resource row or a budget text with a trailing
  space.

The *ordering* half of the worry is provably safe and should be retired: `documentsOf` puts the game
system document first and `firstOccurrencePerId` keeps the first hit, so
`description.costTypes[0] === system.costTypes[0]` whenever the `.gst` declares at least one type.
A `.gst` with **no** `<costTypes>` (schema-legal, not in the corpus) would diverge the id twins too.

**The census is eleven modules, not six, and there is a third answer nobody named.** Seven modules
read `roster.costLimitType` **raw, with no fallback at all**: `useRosterSidebar.js:40,60,65`,
`useValidationPanel.js:38`, `usePlayRoster.js:141`, `useRosterDashboard.js:41`,
`useRosterEditor.js:96`, `useAutoFillSuggestions.js:63`, `editor/useUnitCard.js:175`. The clearest
evidence is two lines apart in one file: `useRosterSidebar.js:60` reads the amount without a
fallback while `:62` fetches the label with one — so on a roster whose `costLimitType` is `null` the
sidebar shows `0 / 2000 pts`, a label for a cost type whose amount it refuses to read. And the
choice between the twins is not indifference at `editor/costBudgets.js:30`: `costTypeLabelOf` is
module-private, so labelling an *arbitrary* cost-type id has exactly one legal door.

**T6: the budget has no home.** `costTotals[roster.costLimitType] || 0` is recomputed in four
viewmodels (`useRosterSidebar.js:60`, `useAutoFillSuggestions.js:66`, `useRosterDashboard.js:41`,
`useRosterEditor.js:96`) under three name pairs — `totalCosts`/`costLimit`,
`currentPoints`/`limitPoints`, `currentPoints`/`costLimit`. Exactly one site computes the
difference, `useAutoFillSuggestions.js:63-67`, and there it drives behaviour, not display: which
suggestions are collected (`:84-85`), which fit (`:101`) and whether the panel opens (`:150-155`).

**The measure.** A shared kernel `src/shared/costs/`:

- `costTypes.js` — `costLimitTypeIdOf(roster, costTypes)`, `costTypeLabelOf(costTypes, id)` (now
  **exported**, `costBudgets.js` needs it), `costLimitLabelOf(roster, costTypes)`; bodies moved
  verbatim from `costDisplays.js:24-52`. It qualifies for `src/shared/` **because** it takes the
  declarations as an argument: a module taking `system` would know the parser's shape, one taking
  `description` the engine's, so taking the list means it knows neither and
  `shared-haengt-an-nichts` cannot be violated by construction. It may read `id` and `name` **only**
  — the two producers' records differ (`xmlParser.js:522-527` yields `defaultCostLimit`/`hidden`,
  `catalogReader.js:1138-1147` yields `defaultLimit`/`isHidden`, already sentinel-decoded).
- `budget.js` — `budgetOf(roster, costTotals) → { typeId, limit, spent, remaining, isExceeded }`.
  It deliberately takes **no** `costTypes` and applies **no** fallback: all four current sites read
  the raw field, and adding the fallback would make the fill-up panel open on rosters that are
  silent today. `limit` is `null`, never `0` (or the sidebar's blank becomes a literal `0`);
  `remaining` is `null`, never `0`, where there is nothing to measure against.

`costTypeLabels.js` is deleted; `costDisplays.js` keeps only `extraResourceTotalsOf`, which reads
`isHidden` and `costTotals` and therefore stays in the read model.

**The one deliberate behaviour change** is which list the UI hands in: where a report is in hand,
pass `report?.description?.costTypes` rather than `system?.costTypes`. It is the superset and the
list `report.costTotals` is keyed by, and two existing tests already pin that intent by name
(`NewRosterModal.evaluator.test.jsx:132`, `RosterDashboard.evaluator.test.jsx:148`). See the open
questions.

Cut into three increments: **1** the kernel and T1 (shippable alone), **2** `budgetOf` and the four
adoptions, **3** glossary, rules and the format doc. No version bump — a refactoring plus a latent
defect nobody can currently see.

## Acceptance criteria

- AC1: `src/shared/costs/costTypes.js` exports exactly `costLimitTypeIdOf`, `costTypeLabelOf`, `costLimitLabelOf`; `src/shared/costs/budget.js` exports exactly `budgetOf`. | verify: `grep -n "^export function" src/shared/costs/costTypes.js src/shared/costs/budget.js`
- AC2: No second implementation exists — the old twins are gone by name and nothing outside `src/shared/costs/` re-derives the id. | verify: `bash -c '! grep -rqn "resolveCostLimitTypeId\|resolveCostTypeLabel\|resolveCostLimitLabel" src/ docs/glossary.md .claude/rules/ && test "$(grep -rn "costTypes?\.\[0\]?\.id" src/ --include=*.js --include=*.jsx | grep -v "^src/shared/costs/" | grep -v createRoster.js | wc -l)" -eq 0'`
- AC3: The trim of a cost-type name happens in exactly one place. | verify: `bash -c 'test "$(grep -rn "name?.trim()" src/ --include=*.js --include=*.jsx | grep -v /tests/ | wc -l)" -eq 1'`
- AC4: `costTotals[<limit type>]` is not indexed outside the kernel; the four viewmodels go through `budgetOf`. | verify: `bash -c 'test "$(grep -rn "costTotals\[" src/ui src/contexts --include=*.js --include=*.jsx | grep -v /tests/ | grep -v costProjection.js | wc -l)" -eq 0 && test "$(grep -rn "budgetOf(" src/ui/viewmodels | wc -l)" -ge 4'`
- AC5: No context imports another context's cost module; `src/shared/` fan-out stays 0. | verify: `forge-lint`
- AC6: `budgetOf` returns `remaining === null` — not `0` — with no `costLimitType` or a `costLimit` of 0, and `limit === null` (not `0`) when none is set. | verify: `forge-test --run src/tests/shared/costs/budget`
- AC7: The fill-up panel behaves exactly as before — the pinned window, the `null` gap, the open and closed states; its test file passes **unchanged**. | verify: `forge-test --run src/tests/ui/viewmodels/editor/useAutoFillSuggestions`
- AC8: A cost type declared only by a catalogue root is labelled, and the same lookup against a list without it returns `''` — the divergence is now a property of the argument, not of the module. | verify: `forge-test --run src/tests/shared/costs/costTypes`
- AC9: Nothing the user sees changes in the sidebar, top bar, dashboard cards, new-roster dialog or play view. | verify: `forge-test --run src/tests/ui`
- AC10: Whole suite green. | verify: `forge-test`
- AC11: Types hold under `strictNullChecks` and `strictFunctionTypes`, with no suppression added. | verify: `bash -c 'forge-typecheck && test "$(grep -rn "@ts-ignore\|@ts-expect-error\|@ts-nocheck" src/ | wc -l)" -eq 0'`
- AC12: No dead export left behind by the two barrels. | verify: `npm run knip`
- AC13: `docs/glossary.md` carries `costType`, `costLimitType`, `costLimit` and `budget` rows, and no row names a deleted function. | verify: `bash -c 'grep -q "| .costType." docs/glossary.md && grep -q "| .costLimitType." docs/glossary.md && grep -q "| .budget." docs/glossary.md'`
- AC14: `docs/battlescribe/overview.md` (§4, Objektmodell-Baum) no longer claims cost types are `.gst`/library only — `Catalogue.xsd:720` and the Lizardmen book disprove it, and that document outranks every other. | verify: `bash -c '! grep -n "costTypes" docs/battlescribe/overview.md | head -1 | grep -q "nur .gst"'`
- AC15: The browser E2E still drives the editor. | verify: `node e2e/ui.test.js`

## Out of scope

- **Renaming the three spent/limit name pairs to one.** It changes component props
  (`RosterSidebar.jsx`, `RosterEditorTopBar.jsx`, `RosterDashboard.jsx`), their tests, the harness
  inversions in `src/tests/test-utils/harnesses/sectionHarnessBase.jsx:43-52` and the ceilings in
  `src/ui/components/editor/sectionPropCount.test.js`. Worth doing, and it is the natural follow-up.
- `editor/useUnitCard.js:175` and `usePlayUnit.js:161` acquiring or losing the fallback. Same
  question per **slot**, different numerator (`capability.totalCosts`); aligning them changes which
  number a card shows and needs a product decision.
- `createRoster.js:26` — it *writes* `roster.costLimitType` before any report exists. Excluded from
  AC2 by name, deliberately.
- `editor/costBudgets.js` beyond its label call: it renders the report's per-slot `current / bound`
  and the engine's `satisfied` flag, a different concept, correctly homed. It must not be folded
  into `budgetOf`.
- `extraResourceTotalsOf` moving to `shared` — it reads description and report vocabulary.
- `ruleengine/engine/rosterBudget.js` — the limits going *into* an evaluation, not the remainder
  coming out.
- The `<costs>` block of `rosterSerialization.js:117` omitting catalogue-declared types. A real
  export-fidelity defect found in passing; its own issue.

## Open questions

1. **The argument change.** Six hooks would ask `description.costTypes` instead of
   `system.costTypes`. On any dataset whose `.gst` declares a cost type the answer is identical
   (proved). On the Lizardmen dataset a label that was `''` becomes `'SC Saurus Chars'` — the fix,
   but still a change. Accept, or keep `system?.costTypes` for a strictly zero-diff change and lose
   half the point?
2. **Two things are called "budget"**: `src/shared/costs/budget.js#budgetOf` (what is left) and
   `ruleengine/engine/rosterBudget.js#createRosterBudget` (the limits going in), plus
   `editor/costBudgets.js` (a per-slot cap). Keep `budgetOf` — it is the domain's word — and
   disambiguate in the glossary row, or rename?
3. **Where do the tests live?** `.claude/rules/areas/shared.md` says moved tests keep their old
   mirror path, but `src/tests/shared/events/` exists for `dataEvents`. Proposal:
   `src/tests/shared/costs/` for both new and moved, with one bullet in the area note recording the
   choice.
4. No unit test covers the ruleengine twin today, so the survivor's behaviour is pinned for the
   first time here rather than carried over. Expect one surprise.
