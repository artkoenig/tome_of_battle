---
status: active
branch: claude/evaluator-coverage-campaign
pr:
---

# Evaluator gaps pinned by the coverage campaign

## Goal

Make every scenario listed below green by changing `src/evaluator/` production code. Each entry is a committed black-box E2E scenario whose expectations were derived from the catalog data alone; the scenario is the specification and the engine is what is wrong.

## Context

- The scenarios were authored by the `e2e-testcase-author` subagent under ADR 0033 and are pinned in `docs/testing/campaign-state.json` under `pinnedGaps`.
- `npx vitest run src/evaluator` runs the manifest-driven runner `src/evaluator/e2e.testcatalog.test.js` over them.

## Acceptance criteria

- `docs/testing/at-least-force-toggle-gate` — failing case: `Szenario: at-least-force-toggle-gate > rosters/02-greasus-with-toggle-max1.ros`. What the catalog data demands: an atLeast(scope=force) condition whose childId names a root entryLink (9e50-7486-65ab-c449) must also count roster selections that carry only the link's resolved target id (8923-5946-7b10-8957, entryLinkId empty): with the toggle selected, the set-1 modifier must lift Greasus's max-0 constraint (cef8-c3b1-7850-85bc) so it no longer fires and the slot reports effectiveMax 1.

## Out of scope

- Changing, weakening or deleting any scenario under `docs/testing/` — its `.ros` files, its `scenario.json` and its `README.md` are the specification.
- Authoring new E2E scenarios; the coverage campaign's phase A does that.
- Any change outside `src/evaluator/` and its unit tests.

## Decisions

- The check command for this issue is `npx vitest run src/evaluator`.
- No version bump inside the campaign; the human decides that when the campaign branch merges.
