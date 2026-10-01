---
status: active
branch: forge/0203-hidden-zero-capped-selection
pr:
---

# Remove a selection once a modifier hides it and caps it at zero

## Goal

When a change in the editor makes a selected option both hidden and capped at an effective max of
0, the app removes that selection as part of the same change, so the roster carries no error the
user cannot reach. Example: the Wood Elf Noble's Long Bow (Wood Elves 6th definitive edition) is
added on raise because of its min 1; ticking "Battle Standard Bearer" sets its max and min to 0 and
hides it. Today the Long Bow stays in the list, the report shows "„Long Bow" kann nicht gewählt
werden." and "„Long Bow" steht in der Liste, wird aber nicht angeboten.", and the configurator
offers no row to remove it.

## Acceptance criteria

- AC1: After an editor change that makes an occupied option both effectively hidden and of
  effective max 0, the resulting roster no longer contains any selection of that option, and the
  report of that roster carries neither a max violation nor a hidden-selection message for it. | verify: forge-test --run src/tests/contexts/armylist/application
- AC2: The removal belongs to the change that caused it: one undo restores both the triggering
  change and the removed selection.
- AC3: A selection that is hidden with an effective max above 0, or of effective max 0 but not
  hidden, is left in the roster; only both conditions together remove it.
- AC4: Reversing the trigger (unticking 'Battle Standard Bearer' in the example) re-creates the
  option at its min in the same undo step, as raising does; the report carries no unmet-min
  violation for it.
- AC5: The existing suite stays green. | verify: forge-test

## Out of scope

- Rosters loaded, imported or migrated are not pruned; a hidden selection arriving that way still
  shows the existing messages (Issue 0119).
- The hidden-selection message and the max violation themselves are unchanged.
- No new UI row for hidden selections.
