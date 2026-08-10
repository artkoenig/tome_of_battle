---
status: active
branch: claude/evaluator-abschluss-kampagne-ipuqwm
pr: 204
---

# Evaluator gaps pinned by the coverage campaign

## Goal

Make every scenario listed below green by changing `src/evaluator/` production code. Each entry is a committed black-box E2E scenario whose expectations were derived from the catalog data alone; the scenario is the specification and the engine is what is wrong.

## Context

- The scenarios were authored by the `e2e-testcase-author` subagent under ADR 0033 and are pinned in `docs/testing/campaign-state.json` under `pinnedGaps`.
- `npx vitest run src/evaluator` runs the manifest-driven runner `src/evaluator/e2e.testcatalog.test.js` over them.

## Acceptance criteria

- `docs/testing/at-least-roster-points-limit` — failing cases: `Szenario: at-least-roster-points-limit > rosters/01-limit-2000-gate-open.ros`, `rosters/02-limit-1999-gate-closed.ros` and `rosters/03-limit-1999-spent-2000-gate-closed.ros`. What the catalog data demands: a single selection of "Tournament rules: Uprising (2026)" (`4bc4-8781-2091-d9df`, reached through the group `43b3-35c6-d7cc-e3c6` below the entry `6fcf-b33d-3cf5-b56a`, which carries `hidden="true"`) must be counted. Its occupied slot must report `current` 1 — the report has 0 — and its own limit `00f6-c1b3-ee85-5c02` (`type="max" value="0" field="selections" scope="force"`, raised to 1 by a `set` only while the `and` group of `atLeast 2000` and `atMost 2500` on `limit::ecfa-8486-4f6c-c249` holds) must fire with actual 1 against bound 0 at a `costLimit` of 1999; the report carries no message for that limit at all. Roster 03 additionally demands that `limit::<costTypeId>` reads the roster's **configured** cost limit and not the summed cost of its selections: at `costLimit` 1999 with 2000 points spent, the gate stays closed.

## Out of scope

- Changing, weakening or deleting any scenario under `docs/testing/` — its `.ros` files, its `scenario.json` and its `README.md` are the specification.
- Authoring new E2E scenarios; the coverage campaign's phase A does that.
- Any change outside `src/evaluator/` and its unit tests.

## Decisions

- The check command for this issue is `npx vitest run src/evaluator`.
- No version bump inside the campaign; the human decides that when the campaign branch merges.
