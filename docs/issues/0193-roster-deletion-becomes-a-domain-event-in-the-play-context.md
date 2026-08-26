---
status: backlog
branch:
pr:
---

# "Deleting a roster ends its game" leaves the React hook and becomes a domain event

## Goal

Finding T4 of [`docs/ddd-review-2026-08.md`](../ddd-review-2026-08.md). A rule of the domain lives
in a screen: `src/ui/viewmodels/useRosterList.js:182-185` is `await deleteRoster(id); await
endGame(id);` inside `confirmRosterDeletion`, and that is the only place the rule exists.
`.claude/rules/areas/play.md:40-43` records it as intended — *"Weil kein Kontext den anderen ruft,
verdrahtet das die Oberfläche"* — but the premise is false: the published channel for exactly this
already exists and is idle. `src/shared/events/dataEvents.js:32` declares `DATA_EVENT.ROSTER_DELETED`
and `src/contexts/armylist/application/rosterStore.js:53` emits it after the persistence promise
resolves. `contexts/play` subscribing to `src/shared/**` needs **no** new `allowed` entry —
`kontexte -> shared` is forbidden nowhere, and `rosterStore.js:2` already takes that exact edge.

**Sell this honestly: it is placement and testability, not a live bug.** There is no second
deletion path. `deleteRoster`/`removeRoster` resolves to one production chain
(`useRosterList.js:182` → `rosterStore.js:51` → `ports/storagePort.js:14` →
`src/platform/persistence/database.js:159`); `scripts/lib/e2e-harness.js:287` drops the whole
IndexedDB database, which takes `games` with it. No migration, no bulk delete, no import path
deletes a roster. The orphaned-record scenario is unreachable today. What is real: the one exported
"end the game" verb of the play context (`src/contexts/play/index.js:12`) exists solely to serve a
hook in another layer — `usePlayState.js`, the actual play screen, never ends a game — and the
coupling can only be tested through `renderHook`.

Two things were verified favourably and make the move safe. `endGame` is **idempotent**:
`gameStore.js:59-61` delegates to `deleteGamesOfRoster`, which at `database.js:195-200` filters all
games by `rosterId` and iterates — an empty result is an empty loop, no write, no error. And the
subscription is **armed before any delete can happen**, because `useAppData.js:4` already imports
`migrateStoredGames` from `'../../contexts/play'` and `useAppData` runs from `App`.

One mechanical fact decides the shape of the fix and must not be discovered during implementation:
**`emitDataChange` is synchronous and does not await its listeners** (`dataEvents.js:57-70`,
contract at `:17-19`), while `endGame` is `async`. So the subscriber becomes fire-and-forget, the
ordering guarantee `await endGame(id)` gives today is given up (benign — nothing reads the `games`
store on that path), and the `try/catch` at `dataEvents.js:62-68` catches only a **synchronous**
throw. A returned rejected promise escapes as an unhandled rejection, which per
`.claude/rules/areas/roster.md` "turns a green run red without failing a test". The listener must
attach its own `.catch`; it may not `return endGame(rosterId)`.

The "exactly one subscriber" rule is stated in **four** area notes, not two, and one of them uses it
as the reason for a file's location — `.claude/rules/areas/shared.md:28-31`,
`application.md:29-32`, `viewmodels.md:33-36`, `play.md:40-43`. All four were written against
*screens* subscribing. They must be amended together or the tree contradicts itself; they are peers,
so there is no precedence tiebreak. Note also that the new subscriber *does* read from the DB
(`deleteGamesOfRoster` scans `getAllGames()`), which `application.md` warns about — it is the same
scan the UI triggers today, so no regression, but the amended rule has to say so rather than leave a
rule the change silently breaks.

No version bump: nothing a user can see changes.

## Acceptance criteria

- AC1: Deleting a roster through the application layer alone — no React, no renderer — deletes that roster's game; a new rendererless test pins it and fails on `main`. | verify: `forge-test --run src/tests/contexts/play/application/rosterDeletionPolicy`
- AC2: `endGame` has no caller under `src/ui/` and the play barrel no longer re-exports it. | verify: `bash -c '! grep -rqn "endGame" src/ui/ src/contexts/play/index.js'`
- AC3: `src/ui/viewmodels/useRosterList.js` imports exactly one bounded context. | verify: `bash -c 'test "$(grep -c "from .\.\./\.\./contexts/" src/ui/viewmodels/useRosterList.js)" -eq 1'`
- AC4: A `ROSTER_DELETED` for a roster that was never played is a no-op — no store write, no throw, no rejected promise out of `deleteRoster`. | verify: `forge-test --run src/tests/contexts/play/application/rosterDeletionPolicy`
- AC5: A failing game deletion is logged, does not reject the roster deletion and produces no unhandled rejection. | verify: `forge-test --run src/tests/contexts/play/application/rosterDeletionPolicy`
- AC6: The roster-list and app suites stay green, including the delete-failure toast. | verify: `forge-test --run src/tests/ui/viewmodels/useRosterList`
- AC7: The play, armylist-application and shared-events suites stay green. | verify: `forge-test --run src/tests/contexts/play`
- AC8: The new `contexts/play -> src/shared` edge breaks no boundary and no lint rule regresses. | verify: `forge-lint`
- AC9: The listener signature matches `DataChangeEvent` under `strictNullChecks`/`strictFunctionTypes`. | verify: `forge-typecheck`
- AC10: All four area notes state the amended subscriber rule, and none still names `useRosterList` as the game-deletion wiring. | verify: `bash -c '! grep -rqn "useRosterList.confirmRosterDeletion" .claude/rules/areas/ && grep -rqn "rosterDeletionPolicy" .claude/rules/areas/'`
- AC11: The full suite is green apart from the pinned red scenarios in `docs/testing/campaign-state.json`. | verify: `forge-test`

## Out of scope

- Making `emitDataChange` async or awaiting listeners. That changes the contract of the one change
  channel for every writer (`dataEvents.js:17-19`) and deserves its own issue if wanted at all.
- The redundant `reloadData()` at `useRosterList.js:186` — `useAppData.js:175-177` already removes
  the roster from the list on the same event, so the extra IndexedDB read is arguably dead.
  Separate question.
- Cross-tab notification (`BroadcastChannel`), explicitly deferred by `dataEvents.js:21-22`.
- A user-facing "end game" action. `endGame` has no UI caller today; giving the play screen one is a
  feature.
- Replacing the `getAllGames()` scan in `database.js:195-200` with an index —
  `.claude/rules/areas/play.md` records the scan as a deliberate choice.
- The other findings of the review.

## Open questions

1. The ordering guarantee is deliberately given up (see Goal). Accept, or grow an async listener
   contract in `dataEvents` first?
2. The subscription is armed by a module-level side effect reached through
   `src/contexts/play/index.js`, which is imported because `useAppData.js:4` needs
   `migrateStoredGames`. That is implicit: were that import removed, the policy would stop arming
   silently. The alternative — an explicit `subscribeToRosterDeletion()` call from `useAppData`'s
   startup effect — is more honest but leaves the *wiring* in the UI. Which?
3. Does a second context subscriber set a precedent that is wanted? The rule as written is a fence
   against screens; opening it for contexts is a deliberate architectural choice.
