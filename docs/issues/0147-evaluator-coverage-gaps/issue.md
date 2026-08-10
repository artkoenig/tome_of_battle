---
status: active
branch: claude/evaluator-abschluss-kampagne-tk44u4
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

- `docs/testing/greater-than-force-unlimited-gate` — failing cases: `Szenario: greater-than-force-unlimited-gate > rosters/02-tyrant-one-slaughtermaster-unlimited.ros` and `rosters/03-tyrant-two-slaughtermasters-unlimited.ros`. What the catalog data demands: an occupied slot must keep reporting how many selections it holds when its `max` limit has been lifted to the written sentinel `-1` (unlimited). The Slaughtermaster slot (`0ff3-ec4d-1c6b-6d53`, frame `Standard (OK-AB)` `729f-9246-5cd3-5044`) reports `current` 0 in those two rosters, where the roster holds one resp. two of them and the `set -1` modifier on `c70d-c292-36ee-21b5` has opened the cap. Roster 01 is the control and passes with `current` 1 while the same limit still stands at `max 0`, so the count is lost exactly when the bound becomes unlimited, not in general. The limit's own firing and silence are already correct in all four rosters — do not change that behaviour while fixing the count.

- `docs/testing/at-least-parent-any-reveal` — failing cases: `Szenario: at-least-parent-any-reveal > rosters/01-empty-frame-wolf-lord-hidden.ros`, `rosters/02-one-selection-reveals-wolf-lord.ros` and `rosters/03-two-selections-reveal-unchanged.ros`. What the catalog data demands: an option that exists in the catalogue but is not selected must appear in the report as an offer anchor, so that its visibility is observable at all. `Wolf Lord` (link `b8be-a71f-569c-5cdc`, target `66bc-8fc1-81a2-9cd4`) carries `hidden="true"` plus a single `set hidden="false"` gated on `atLeast 1` selection of anything in its parent frame, and those three rosters assert exactly that flip (`isHidden` true at an empty frame, false once the frame holds one resp. two selections, `current` 0 throughout). The report carries no `anchorKind="offerAnchor"` slot for that `defId`/`targetDefId` pair at all in those rosters, so the flip cannot be seen. The same pair resolves as `anchorKind="occupied"` in rosters 04 and 05, which pass, and the sibling scenario `docs/testing/at-least-unit-upgrade-gate` shows an unselected option's offer anchor being projected in a shallower position. The option sits four `selectionEntryGroup` levels below the unit; whether the missing projection is the depth, the fact that nothing in that group chain is selected, or something else, is for this round to diagnose. Without the anchor a user is never offered the option at all — ADR 0034 makes the report the sole source of the surface.

## Out of scope

- Changing, weakening or deleting any scenario under `docs/testing/` — its `.ros` files, its `scenario.json` and its `README.md` are the specification.
- Authoring new E2E scenarios; the coverage campaign's phase A does that.
- Any change outside `src/evaluator/` and its unit tests.

## Decisions

- The check command for this issue is `npx vitest run src/evaluator`.
- No version bump inside the campaign; the human decides that when the campaign branch merges.
