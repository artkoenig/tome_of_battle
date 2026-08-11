---
status: active
branch: claude/evaluator-abschluss-kampagne-uhbxfy
pr:
---

# Evaluator gaps pinned by the coverage campaign

## Goal

Make every scenario listed below green by changing `src/evaluator/` production
code. Each entry is a committed black-box E2E scenario whose expectations were
derived from the catalog data alone; the scenario is the specification and the
engine is what is wrong.

## Context

- The scenarios were authored by the `e2e-testcase-author` subagent under ADR
  0033 and are pinned in `docs/testing/campaign-state.json` under `pinnedGaps`.
- `npx vitest run src/evaluator` runs the manifest-driven runner
  `src/evaluator/e2e.testcatalog.test.js` over them.

## Acceptance criteria

- `docs/testing/self-scope-max-house-rules` is green in all six of its cases.
  The two failing cases are
  `rosters/01-both-house-rules-self-max-fires.ros` and
  `rosters/06-single-house-rule-number-two-self-max-fires.ros`.
  What the catalog data demands: a `max` constraint with `scope="self"` makes
  its own carrier selection the counting frame and counts the selections
  underneath it. The entry `Allow Mercenaries` (`fda5-49b9-b74c-aaf4`, game
  system) carries `max 1 field="selections" scope="self" shared="true"
  includeChildSelections="false"` (`714b-5314-33d4-dd68`) and holds exactly two
  direct children — the hidden house-rule entries `713c-28b1-0861-1ffd` and
  `698e-c660-5c99-d481`. A roster holding both children, and equally one holding
  a single child node with `number="2"`, must therefore make that limit fire
  with actual 2 against bound 1. Today the report carries no violation for
  `714b-5314-33d4-dd68` at all in either roster, while the four silent rosters
  pass — so the limit never fires rather than counting in the wrong frame. The
  frame is what roster 05 delimits: there the PARENT entry holds two direct
  children while the carrier holds only one, and the limit must stay silent, so
  a fix that simply counts in the parent frame is wrong. The parent-scoped
  sibling limit `1df9-8159-156a-641f` is asserted absent in every roster and is
  correct today; it must stay correct.

- Every scenario that is green today stays green: `npx vitest run src/evaluator`
  ends with no failing case other than, at most, the two named above while the
  work is unfinished.

## Out of scope

- Changing, weakening or deleting any scenario under `docs/testing/` — its
  `.ros` files, its `scenario.json` and its `README.md` are the specification.
- Authoring new E2E scenarios; the coverage campaign's phase A does that.
- Any change outside `src/evaluator/` and its unit tests.

## Decisions

- The check command for this issue is `npx vitest run src/evaluator`.
- No version bump inside the campaign; the human decides that when the campaign
  branch merges.
