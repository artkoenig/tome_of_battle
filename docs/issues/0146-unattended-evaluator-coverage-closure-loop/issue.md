---
status: waiting
branch: claude/evaluator-katalog-rules-t6nim4
pr: https://github.com/artkoenig/tome_of_battle/pull/202
---

# Unattended coverage-closure loop for the evaluator

## Goal

Build the tooling for an unattended campaign that finds every rule-construct
combination occurring in the real catalog corpus, pins each one with a
black-box E2E scenario, and drives implementation work until nothing is left
to implement. This issue builds the three tools below; running the campaign
itself is out of scope.

## Context

- The evaluator fails closed on unknown constructs with `UNSUPPORTED_*` /
  `UNRESOLVED_*` diagnostics, and `docs/testing/constraint-matrix.md` maps
  which combination cells are already covered by scenarios.
- The vendored XSD types `scope`, `field` and `childId` as open strings, so
  "all XSD combinations" is unbounded; the measurable target is the real
  corpus: `src/evaluator/__fixtures__/whfb6-definitive/` and
  `src/__fixtures__/whfb6/`.
- ADR 0033 mandates black-box authorship for evaluator E2E scenarios via the
  `e2e-testcase-author` subagent: expectations are derived from catalog data,
  never from engine source or engine output.
- The existing skill `.claude/skills/evaluator-constraint-explorer/SKILL.md`
  searches engine-code-first; this issue inverts it to data-first.

## Acceptance criteria

### 1. Coverage inventory script

- Add `scripts/evaluator-coverage-inventory.js`.
- Parse every `.cat`/`.gst` file of both fixture sets statically, without
  rosters and without running the evaluator.
- Record every occurring combination cell with its occurrence count and file
  locations, along these axes: constraint field-class × scope × flags
  (`shared`, `includeChildSelections`, `includeChildForces`, `percentValue`),
  condition type × scope × field-class, repeat attributes, modifier type ×
  target-field-class, and the nesting constructs (`conditionGroup` types
  including `not`, `modifierGroups`, nested `repeats`).
- Keep the record of covered cells machine-readable and diff the inventory
  against it automatically; do not require a human or an agent to read
  `constraint-matrix.md` inside the loop.
- Write the uncovered cells to `docs/testing/worklist.json`.
- Exit non-zero when the worklist is non-empty and zero when every occurring
  cell is covered.
- Cover the cell extraction with unit tests.

### 2. Inverted explorer skill

- Rewrite `.claude/skills/evaluator-constraint-explorer/SKILL.md` to work
  data-first: run the inventory script, take the next uncovered cell from
  `docs/testing/worklist.json`, delegate the scenario for that cell to the
  `e2e-testcase-author` subagent, then run the evaluator tests
  (`npx vitest run src/evaluator`).
- Keep a green scenario and mark its cell covered in the same commit.
- Keep a red scenario in place as a pinned gap and record it as
  implementation work for phase B.
- Forbid changing a scenario's expectations to make the engine pass.
- Park a cell whose intended semantics cannot be derived from the catalog
  data, the BSData wiki or the XSD: write the open question into the campaign
  state and continue with the next cell.
- Keep the engine-code hypothesis search as a documented secondary mode for
  semantics bugs inside already-covered cells.

### 3. Campaign driver skill

- Add a user-invocable skill `evaluator-closure-loop` under `.claude/skills/`
  that runs the campaign unattended.
- Alternate phase A (search: the inverted explorer working through the
  worklist) with phase B (implement: run `uroboros:agile-loop` on a campaign
  issue whose task list is the current set of red scenarios).
- Re-run phase A after every phase B round, because a fix can make new cells
  reachable.
- Terminate when the worklist is empty, every evaluator E2E scenario is
  green, and no parked question is open.
- At the end of every unfinished run, re-arm the loop with `send_later`
  (about one hour ahead); stop re-arming once the termination criterion
  holds.
- Cap each run at a fixed number of cells.
- Park a cell after two failed implementation rounds instead of retrying it
  again.
- Keep all campaign state in files (worklist, parked questions, campaign
  issue) so that a fresh session resumes from disk alone.
- Report parked questions to the human at the end of a run and fold their
  recorded answers back in before retrying the parked cells.

## Out of scope

- Running the campaign.
- Fixing any evaluator gap.
- Changing production code under `src/evaluator/`.

## Decisions

- The termination criterion is corpus coverage, not XSD cross-product
  coverage, because the XSD leaves `scope`/`field`/`childId` as open strings.
- Evaluator E2E scenarios are authored black-box before implementation; the
  uroboros chain implements against existing red scenarios and never authors
  evaluator E2E scenarios itself.
- Green scenarios are never deleted; campaign progress is monotone.
- No version bump: this is tooling, not user-facing.
