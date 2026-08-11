---
status: active
branch: claude/evaluator-abschluss-kampagne-sxcj5z
pr:
---

# Evaluator gaps pinned by the coverage campaign

## Goal

Make every scenario listed below green by changing `src/evaluator/` production code. Each entry is a committed black-box E2E scenario whose expectations were derived from the catalog data alone; the scenario is the specification and the engine is what is wrong.

## Context

- The scenarios were authored by the `e2e-testcase-author` subagent under ADR 0033 and are pinned in `docs/testing/campaign-state.json` under `pinnedGaps`.
- `npx vitest run src/evaluator` runs the manifest-driven runner `src/evaluator/e2e.testcatalog.test.js` over them.

## Acceptance criteria

- `docs/testing/at-least-self-any-experimental-hydra-warning` is green in every case, in particular the two failing ones `rosters/01-veteran-hydra-warning-fires.ros` and `rosters/05-two-hydra-variants-group-max-fires.ros`. What the catalog data demands: an author message carried by a `selectionEntryGroup` must reach the report at that group's anchor when its gate holds. The group "War Hydras of Naggaroth" (`7f4e-4b7b-fbc4-a138`, Dark Elves) carries a `modifier type="add" field="warning"` gated on an and-group of `atLeast 1 selections scope="self" childId="any"` (the group itself is the counting frame) and `lessThan 1 selections scope="force"` of the toggle "Allow experimental rules?" (`e28d-f278-f209-63bd`). A roster that chooses one member of that group without the toggle (roster 01) and one that chooses two (roster 05) must each carry exactly one `authorMessage` of severity `warning` at `anchorDefId 7f4e-4b7b-fbc4-a138`. The report carries no author message at that anchor at all, while the three rosters demanding silence (empty group; populated frame with empty group; member plus toggle) are already correct — so the gate is not read too eagerly, the message is never projected at a group carrier.

## Out of scope

- Changing, weakening or deleting any scenario under `docs/testing/` — its `.ros` files, its `scenario.json` and its `README.md` are the specification.
- Authoring new E2E scenarios; the coverage campaign's phase A does that.
- Any change outside `src/evaluator/` and its unit tests.

## Decisions

- The check command for this issue is `npx vitest run src/evaluator`.
- No version bump inside the campaign; the human decides that when the campaign branch merges.
