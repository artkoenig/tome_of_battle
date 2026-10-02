---
status: active
branch: forge/0204-zero-capped-option-stays-checkbox
pr:
---

# Keep a single-choice option a checkbox when a modifier caps it at zero

## Goal

An option that the catalogue offers at most once keeps its checkbox when a modifier lowers its
effective max to 0; it is shown disabled, not turned into a stepper with both buttons greyed out.
Example: "General" on the Wood Elf Noble (Wood Elves 6th definitive edition) has max 1 and a
modifier sets it to 0 once "Battle Standard Bearer" is selected — today the row flips from a
checkbox to a dead stepper.

## Acceptance criteria

- AC1: A standalone option whose declared max is 1 and whose effective max is 0 is classified as
  binary and rendered as a disabled checkbox. | verify: forge-test --run src/tests/ui/viewmodels/editor/selectionBehavior
- AC2: The same holds for an option inside a group: declared max 1, effective max 0 gives a
  disabled checkbox, not a stepper. | verify: forge-test --run src/tests/ui/viewmodels/editor
- AC3: An option whose effective max is above 1 still renders as a stepper, and an option whose
  effective max is 1 still renders as a checkbox, as today.
- AC4: The existing suite stays green. | verify: forge-test

## Out of scope

- Options whose declared max is already 0 (unlocked only by a modifier) keep today's rendering.
- Radio-button and group-max decisions are unchanged.
- The list-rule checklist, which already treats max 0 as binary.
