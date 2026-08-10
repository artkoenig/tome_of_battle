---
status: active
branch: claude/evaluator-abschluss-kampagne-6hzwh7
pr:
---

# Evaluator gaps pinned by the coverage campaign

## Goal

Make every scenario listed below green by changing `src/evaluator/` production code. Each entry is a committed black-box E2E scenario whose expectations were derived from the catalog data alone; the scenario is the specification and the engine is what is wrong.

## Context

- The scenarios were authored by the `e2e-testcase-author` subagent under ADR 0033 and are pinned in `docs/testing/campaign-state.json` under `pinnedGaps`.
- `npx vitest run src/evaluator` runs the manifest-driven runner `src/evaluator/e2e.testcatalog.test.js` over them.
- Earlier rounds of this issue are archived beside it as `backlog.round-*.json`; the gaps they closed are recorded as `closed` under the `driver` key of `docs/testing/campaign-state.json` and must stay green.

## Acceptance criteria

- `docs/testing/equal-to-force-points-limit-border-patrol` is green in all four of its cases. The failing ones today are `rosters/01-budget-500-selected-min-raised.ros`, `rosters/02-budget-499-selected-min-unraised.ros` and `rosters/03-budget-501-selected-min-unraised.ros`. What the catalog data demands: a condition on the configured points budget (`field="limit::ecfa-8486-4f6c-c249"`) must read that budget even when it carries `scope="force"` — a `.ros` declares its budget only at the roster root, so the force frame is resolvable and yields exactly that roster budget. The shared entry `Border Patrol (500pts)` (`2066-082d-a465-4baf`, Mercenaries) raises its own minimum (`set 1` on `1a97-1579-ab05-a6d7`) via `equalTo 500` on that field; at a budget of exactly 500 the report still says `effectiveMin 0` instead of 1, and at 499 and 501 it additionally raises the diagnostic `UNRESOLVED_BUDGET_LIMIT`. Under the current evaluation the catalog author's rule is dead code.
- Every scenario that is green today stays green.

## Out of scope

- Changing, weakening or deleting any scenario under `docs/testing/` — its `.ros` files, its `scenario.json` and its `README.md` are the specification.
- Authoring new E2E scenarios; the coverage campaign's phase A does that.
- Any change outside `src/evaluator/` and its unit tests.

## Decisions

- The check command for this issue is `npx vitest run src/evaluator`.
- No version bump inside the campaign; the human decides that when the campaign branch merges.
