---
status: active
branch: claude/evaluator-abschluss-kampagne-ipuqwm
pr:
---

# Evaluator gaps pinned by the coverage campaign

## Goal

Make every scenario listed below green by changing `src/evaluator/` production code. Each entry is a committed black-box E2E scenario whose expectations were derived from the catalog data alone; the scenario is the specification and the engine is what is wrong.

## Context

- The scenarios were authored by the `e2e-testcase-author` subagent under ADR 0033 and are pinned in `docs/testing/campaign-state.json` under `pinnedGaps`.
- `npx vitest run src/evaluator` runs the manifest-driven runner `src/evaluator/e2e.testcatalog.test.js` over them.

## Acceptance criteria

- `docs/testing/set-characteristic-force-gate` — failing case: `Szenario: set-characteristic-force-gate > rosters/02-standard-force-mv-base-7.ros`. What the catalog data demands: the Tomb stalker's unconditional Tomb-Scorpion `infoLink` (`fe84bf5a-d0f1-4b5e-ae5d-475128f4ee32`) must yield a profile info occurrence on the unit slot in EVERY force — in Standard (VC-AB) with the base values (Mv 7, name "Tomb Scorpion", `isHidden` true), since no modifier of that infoLink is gated on that force; the report currently carries no info element with that id on the hidden unit's slot.
- `docs/testing/set-primary-category-membership` — failing cases: `Szenario: set-primary-category-membership > rosters/01-kathleen-set-primary-regiment-of-renown.ros` and `Szenario: set-primary-category-membership > rosters/03-kathleen-and-slave-giant-rare-max.ros`. What the catalog data demands: a `modifier type="set-primary" field="category"` secures membership in the named category on its own. 'Kathleen' Halftank (`331a-3634-095a-574a`) carries an unconditional `set-primary` on Regiment of Renown (`ee09-9a50-ad78-9c32`) with no `categoryLink` to it and no accompanying `add`/`category`, so in the force Standard (OK-AB) — which links that category — her Regiment-of-Renown anchor must report `current` 1 (the report has 0). And since `set-primary` moves only the primary flag and removes nothing, Rare must still count her: with a second Rare unit the Rare anchor reaches `current` 2 and the `.gst` limit `0a44-2d3f-adfe-f3a1` fires with actual 2 / bound 1.

## Out of scope

- Changing, weakening or deleting any scenario under `docs/testing/` — its `.ros` files, its `scenario.json` and its `README.md` are the specification.
- Authoring new E2E scenarios; the coverage campaign's phase A does that.
- Any change outside `src/evaluator/` and its unit tests.

## Decisions

- The check command for this issue is `npx vitest run src/evaluator`.
- No version bump inside the campaign; the human decides that when the campaign branch merges.
