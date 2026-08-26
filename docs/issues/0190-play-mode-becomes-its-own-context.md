---
status: done
branch: claude/issues-186-192-r1f86s
pr:
---

# Play mode becomes its own bounded context

## Goal

Finding F5 of `docs/ddd-assessment-and-refactoring-plan.md`, and the largest of the follow-ups.
`Roster.gameState` (`src/domain/types.js:39`) carries the state of an actual game — wounds per
selection — inside the army-list aggregate, and the only code that understands it is
`src/ui/viewmodels/usePlayState.js:18,55`. Two genuinely different subject areas share one
aggregate, one IndexedDB record and one undo history:

- **"What may I field?"** — a list is built against a catalogue, validated, exported as `.ros`,
  and lives as long as the user keeps it.
- **"What happened in this game?"** — wounds are taken, units fall, and it is over when the game
  is. It has no meaning in a `.ros` export and no business in an undo stack shared with list
  edits.

Today an autosave of a wound rewrites the whole list record, and a list edit and a wound sit in
the same history. Separate them: `contexts/play/` with its own aggregate, its own store and its
own lifetime, referencing the roster by id rather than living inside it.

This is the only follow-up with a **visible user effect** — a game in progress is a thing the
user can now start, keep and end independently of the list. It therefore needs a migration for
existing rosters that carry a `gameState`, a decision on what happens to a running game when its
list is edited, and a version bump. Both questions are product questions: write the PRD first
(`docs/PRD-*.md` is the established form) and let the owner decide before the code moves.

Open questions for the PRD, not to be resolved unilaterally by the run:

- Does editing a list invalidate a game in progress, or do they coexist?
- Is a game kept after it ends (history), or discarded?
- Does the `.ros` export change at all? It must not — the export is user data format.

## Acceptance criteria

- AC1: A PRD exists and answers the three questions above, approved by the owner before any code moves. | verify: `bash -c 'ls docs/PRD-*play* >/dev/null 2>&1'`
- AC2: `gameState` is no longer part of the roster type or the roster record. | verify: `bash -c '! grep -q "gameState" src/shared/rostermodel/types.js'`
- AC3: The play context exists with its own aggregate and store, referencing the roster by id. | verify: `bash -c 'test -d src/contexts/play && grep -rq "rosterId" src/contexts/play'`
- AC4: A migration moves the `gameState` of every stored roster into the new store without data loss, and is tested against a fixture written in the old shape. | verify: `forge-test --run migrations`
- AC5: The `.ros` export is byte-identical to before for a roster that has no game in progress. | verify: `forge-test --run rosterSerialization`
- AC6: A wound no longer rewrites the roster record, and no longer enters the list's undo history. | verify: `forge-test --run play`
- AC7: The play context is reachable from the UI through one facade, and no context imports another. | verify: `bash -c 'bad=0; for a in armylist ruleengine catalog rulebook play; do for b in armylist ruleengine catalog rulebook play; do [ "$a" = "$b" ] && continue; if grep -rqE "from .[^\"]*contexts/$b/" "src/contexts/$a" 2>/dev/null; then echo "$a -> $b"; bad=1; fi; done; done; exit $bad'`
- AC8: `npm run cast` covers the new context with rule N1 and stays green. | verify: `npm run cast`
- AC9: Behaviour is unchanged where the PRD says it should be — the full suite passes. | verify: `forge-test`
- AC10: Types, lint and build stay green. | verify: `bash -c 'forge-typecheck && forge-lint && forge-build'`
- AC11: Play mode works in the real app end to end: start, take a wound, reload the page, the wound is still there. | verify: `node e2e/ui.test.js`
- AC12: A minor version bump is proposed to the owner and, once confirmed, committed on this branch before the PR — this is the one measure with a user-visible effect. | verify: `node -e 'const v=require("./package.json").version.split(".").map(Number); if(!(v[0]>2||(v[0]===2&&v[1]>2))){console.error("version still "+v.join(".")+", expected a minor bump above 2.2");process.exit(1)}'`

## Out of scope

- Issues 0186 and 0188 land first. Without the context tree and the application layer this issue
  has nowhere to put the aggregate.
- New play-mode features. This is a move, not a product extension: what the user can do in play
  mode stays the same unless the PRD says otherwise for a consequence of the separation itself.
- Multi-game support, game history browsing, or statistics. They become possible once the
  aggregate is separate; they are not part of separating it.
- Any change to the `.ros` format.
