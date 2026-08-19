---
status: done
branch: claude/hochelfen-pure-of-heart-ap1xda
pr: 242
---

# Pure of Heart lands on the army instead of a hero

## Goal

In a High Elves army list the rule "Pure of Heart" appears on army level, added
without anyone choosing it. The catalog offers it as an option of a hero, and
that is where it belongs: the army list must show it only once a hero has taken
it. Find why the entry is lifted to force level, fix it at the cause, and pin
the corrected behaviour with a black-box E2E scenario over the real High Elves
catalog data.

## Acceptance criteria

- AC1: In a High Elves roster no "Pure of Heart" selection exists on army or force level, and none is created there without a user choice. | verify: forge-test --run src/evaluator
- AC2: "Pure of Heart" is offered as a selectable option below the hero entry the catalog attaches it to, and can be taken there. | verify: forge-test --run src/evaluator
- AC3: A scenario under `docs/testing/` pins AC1 and AC2 against the real High Elves catalog data and runs through the manifest-driven E2E runner. | verify: forge-test --run src/evaluator
- AC4: Every existing evaluator unit and E2E test stays green. | verify: forge-test --run src/evaluator

## Out of scope

- Changing the Battlescribe catalog data (`.cat`/`.gst`) — the fix belongs in this app.
- Reworking how options are presented in the UI beyond making the hero option reachable.
- Entries other than "Pure of Heart" in other armies, unless the same cause happens to cover them.
