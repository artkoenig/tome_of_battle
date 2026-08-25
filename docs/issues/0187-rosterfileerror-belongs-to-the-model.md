---
status: backlog
branch:
pr:
---

# Move RosterFileError out of the transfer service into the model

## Goal

`src/domain/roster/rosterSerialization.js:1` imports `RosterFileError` from
`src/domain/services/rosterTransfer.js`. That is the write model reaching into an application
service for an error class — a single edge, and the only thing that stands between the project
and a rule that would say "the model never depends on the application layer".

The class describes a failure of the roster **file format** (a `.ros`/`.rosz` that cannot be
read or written) and carries a translation key rather than a text, per `keine-i18n-unter-ui`.
That is model vocabulary. `rosterTransfer.js` only happens to be where it was first needed.

Small, mechanical, and it unlocks the rule. Worth doing before issue 0186 so the move lands with
one fewer exception; it also stands on its own if 0186 is postponed.

## Acceptance criteria

- AC1: `RosterFileError` is defined in the roster model, not in the service. | verify: `bash -c 'grep -rq "class RosterFileError" src/domain/roster/ && ! grep -q "class RosterFileError" src/domain/services/rosterTransfer.js'`
- AC2: `rosterSerialization.js` no longer imports from `src/domain/services/`. | verify: `bash -c '! grep -qE "from .[^\"]*services/" src/domain/roster/rosterSerialization.js'`
- AC3: Every existing caller — the service, the view models and the tests — resolves the class from its new home; no duplicate definition survives. | verify: `bash -c 'n=$(grep -rc "class RosterFileError" src --include=*.js --include=*.jsx | grep -v ":0" | wc -l); test "$n" -eq 1'`
- AC4: The error still carries the translation key rather than a message text, and the UI still formulates it. | verify: `forge-test --run rosterTransfer`
- AC5: Behaviour is unchanged — the full suite passes. | verify: `forge-test`
- AC6: Types, lint and build stay green. | verify: `bash -c 'forge-typecheck && forge-lint && forge-build'`

## Out of scope

- Any other module of `domain/services/`. `rosterStore`, `settings`, `systemLibrary` and
  `catalogRevisions` are untouched here; their infrastructure coupling is issue 0186.
- Switching on the cast rule `armylist/model/** -> armylist/application/**`. It can only be
  written once the directories from issue 0186 exist; this issue removes the one edge that
  would break it.
- Changing what the error means, when it is thrown, or how it is translated.
- A version bump — nothing a user can see changes.
