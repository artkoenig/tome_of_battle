---
status: backlog
branch:
pr:
---

# An option inside a hidden group keeps a visible offer anchor

## Intent

When a `selectionEntryGroup` is hidden, the report drops the group's own anchor
— but an option the group holds still gets an offer anchor with
`isHidden: false`. On the unit card that option then renders as a stray row
with no group around it, even though the group that owns it is hidden.

Found while building a synthetic catalogue for issue 0130: a container whose
only member was a group marked `hidden="true"` emitted no anchor for that
member group, yet the option inside it stayed visible until the option itself
was marked hidden too. Whether hiding a group is meant to hide what it holds is
the question this issue has to settle first — the BattleScribe data format
reference decides it, not this file.

Provenance worth knowing: the observation comes from a synthetic catalogue, not
from catalogue data in the fixtures. Nobody has yet checked whether a real
catalogue hides a group while leaving its options unhidden. If none does, this
may be a latent case rather than a live defect, and the right outcome may be to
close it as such.

Acceptance criteria:

1. It is established from the BattleScribe data format reference whether a
   hidden group is meant to hide the options it holds, and the answer is
   recorded here with its source.
2. It is established whether any catalogue in the fixtures hides a group whose
   options are not themselves hidden, and the answer is recorded here with the
   command that established it.
3. If the format says a hidden group hides its options: an option held only by
   a hidden group carries `isHidden: true` in the report, and the unit card
   shows no row for it.
4. If the format says otherwise, or no real catalogue exercises the case, this
   issue closes with that finding recorded and no production change.

## Plan

## Tasks

## Decisions

## Log

- Observed by the `test-author` subagent while writing tests for issue 0130,
  against a synthetic catalogue it built for that purpose. Kept out of those
  tests deliberately: it is a different defect from the one 0130 is about.

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
