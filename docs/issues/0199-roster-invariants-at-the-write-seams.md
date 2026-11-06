---
status: backlog
branch:
pr:
---

# The roster asserts its own structural invariants, and a no-op stops looking like a write

## Goal

Finding T7 of [`docs/ddd-review-2026-08.md`](../ddd-review-2026-08.md). The diagnosis holds — the
roster record enters the app unasserted and the write use cases report failure by returning
identity — but **three of the review's four invariants do not survive verification, and its proposed
`throw` would take the app down**. What is left is smaller, sharper, and contains one real defect.

**Nothing between IndexedDB and the model asserts anything.**
`src/contexts/armylist/application/rosterStore.js:25-35` is `return getAllRosters()` /
`return getRoster(id)`; `src/platform/persistence/database.js:147-149` is `store.put(roster)` with no
shape check; `migrations.js` has no roster-shape migration at all. `src/shared/rostermodel/types.js`
is 65 lines of JSDoc and `export {}`, erased at runtime. The project already has the missing pattern
one layer over — `SlotIndex.fromMaps` validates every capability it is handed and throws.

**Invariant by invariant:**

- *A force belongs to its roster* — **vacuous, drop.** Forces are a nested array
  (`types.js:38`); no field references a force by id. The review's illustration is also false: an
  unknown `targetForceId` does not fail, it falls back to `forces[0]`
  (`raiseUnit.js:36-39`), pinned at `src/tests/ui/viewmodels/useRosterState.commands.test.js:175`.
  The guard the review cited, `raiseUnit.js:53`, is therefore **unreachable from both production
  callers** and exercised only by its own unit test.
- *Selection ids unique* — **no producer, drop.** Every construction site mints
  `crypto.randomUUID()` (`selectionFactory.js:41`, `rosterSerialization.js:264,297,384,428`,
  `copyUnit.js:14`); a `.ros` import discards the file's ids. `git log -S'crypto.randomUUID'` shows
  no era in which a copy reused ids.
- *`costLimit >= 0`* — **wrong direction.** `-1` is BattleScribe's *unlimited* sentinel
  (`docs/battlescribe/building-blocks/constraint.md` §7.6, `docs/battlescribe/reference/source-gaps.md` §15) and the ACL passes it through by decision
  (`src/tests/contexts/ruleengine/rosterAdapter.test.js:17,220`). The correct rule is
  `costLimit >= 0 || costLimit === -1`.
- *`number >= 1`* — **keep, and it is a live defect.** `rosterSerialization.js:361` is
  `parseInt(node.getAttribute('number')) || 1`, which catches `"0"` and `"abc"` but lets **`"-2"`**
  through, because a negative number is truthy. It reaches
  `src/contexts/ruleengine/acl/rosterAdapter.js:96` as `count: selection.number` — a negative
  multiplier on every cost line of that selection — and survives export at
  `rosterSerialization.js:182`. The editor cannot produce it (`subSelectionEditing.js:107-111`
  deletes at `<= 0`), so the import attribute is the only producer.
- **A second hole the review missed.** `rosterSerialization.js:331-344`: the `<costLimits>` branch
  guards its value (`:338`, `Number.isFinite(value) && value >= 0`) and the legacy-attribute
  fallback at `:342` does not, so `<roster costLimit="-500">` yields `-500`. The asymmetry is the
  defect — and the guarded branch is wrong in the other direction too, rejecting the legal `-1`.

**Throwing in the use cases is unsafe and must not be done.** Six of the seven write commands have
the shape `setRoster(prev => useCase(prev, …))`
(`src/ui/viewmodels/rosterCommandBindings.js:58,65,68,71,74,78`); `setRoster` dispatches into
`historyReducer` (`useUndoableState.js:9,19,51,57`), so React runs the updater **during the render
pass**, twice in StrictMode. And `grep -rn "ErrorBoundary|componentDidCatch|getDerivedStateFromError"
src` finds **nothing** — a throw there unmounts the React root: white screen, no toast, no autosave.
Use `{ roster, changed, reason }` with **eager** evaluation in the event handler instead — the shape
`raiseUnit` has used since issue 0188 (`rosterCommandBindings.js:47-55`), safe because
`bindRosterCommands` is rebuilt every render into `currentCommandsRef`. Throw only at the two seams
that already have a catch and a toast: the `.ros` import (`useRosterList.js:205-235`) and the save
path (`useRosterPersistence.js:52-55`). `describeRosterFileError` is duck-typed on `messageKey`, so
any `messageKey`-carrying error formulates through it unchanged.

**A better argument for the result type than the review's.** For three commands the identity return
does not even happen: `updateUnitChildSelections` returns `{ ...roster, forces }` unconditionally
(`subSelectionUseCases.js:41`) and `removeUnit` rebuilds unconditionally (`removeUnit.js:18-24`). So
a command aimed at an id the roster no longer holds produces a **new roster object** — a new `past`
entry in the undo history, a re-render, a fresh evaluation (the cache keys on identity) and a 150 ms
autosave, for a write that changed nothing. Only one caller reads the channel at all
(`rosterCommandBindings.js:51`, `if (!unit) return;`), and only for `raiseUnit`.

Measure: `src/contexts/armylist/model/rosterInvariants.js` (a *structural* assertion is exactly what
ADR-0011 and `.claude/rules/areas/roster.md` permit there, and `RosterFileError` is the precedent for
the error's home); the two parse-site repairs; `assertRosterInvariants` in `saveRoster` **before**
`persistRoster`, so nothing invalid reaches IndexedDB and `emitDataChange` still fires only after the
store's promise; `loadRoster`/`loadRosters` deliberately **do not** throw, because one bad legacy
record would blank the whole roster list at startup.

This is a user-visible fix — a malformed import can no longer corrupt a list — so a **patch** bump is
due before the PR. Propose it; do not decide it.

## Acceptance criteria

- AC1: `assertRosterInvariants` rejects a selection with `number <= 0` at any depth and a `costLimit` that is neither `>= 0` nor exactly `-1`, accepts `-1`, and carries `messageKey`/`messageParams` with no text. | verify: `forge-test --run src/tests/contexts/armylist/model/rosterInvariants`
- AC2: A `.ros` with `number="-2"` imports as `1`, one with `costLimit="-500"` as the default, and one with `costLimit="-1"` as `-1` — through both the `<costLimits>` block and the legacy attribute. | verify: `forge-test --run src/tests/contexts/armylist/model/rosterSerialization`
- AC3: `saveRoster` throws before `persistRoster` for an invalid roster and emits no `ROSTER_SAVED`; `loadRoster`/`loadRosters` still return whatever the store holds without throwing. | verify: `forge-test --run src/tests/contexts/armylist/application/rosterStore`
- AC4: `copyUnit`, `removeUnit` and the three sub-selection use cases return `{ roster, changed, reason }`, and `changed: false` comes with the **identical** roster object — no new object, no undo step. | verify: `forge-test --run src/tests/contexts/armylist/application`
- AC5: No use case reachable through `setRoster` throws; the changed commands are called eagerly and dispatch only on `changed`. | verify: `forge-test --run src/tests/ui/viewmodels/useRosterState.commands`
- AC6: A legitimate no-op stays quiet — the nine identity assertions in `mandatoryListRules.test.js` and the two in `raiseUnit.test.js` pass untouched. | verify: `forge-test --run src/tests/contexts/armylist/mandatoryListRules`
- AC7: The new error carries no German or English text, and both locales carry its keys. | verify: `bash -c 'grep -q "roster.invariant" src/ui/i18n/locales/de.json && grep -q "roster.invariant" src/ui/i18n/locales/en.json && ! grep -rqn "roster.invariant" src/contexts/ --include=*.json'`
- AC8: `rosterInvariants.js` imports nothing from `src/contexts/ruleengine/**` or `src/ui/**`. | verify: `forge-lint`
- AC9: The new result type is annotated and null-safe. | verify: `forge-typecheck`
- AC10: The full suite is green apart from the pinned red scenarios in `docs/testing/campaign-state.json`. | verify: `forge-test`
- AC11: `.claude/rules/areas/roster.md` records the new seam and the corrected contract — the identity return is no longer a failure channel. | verify: `bash -c 'grep -q "rosterInvariants" .claude/rules/areas/roster.md'`

## Out of scope

- Anything catalogue-driven: whether a `number` is within a constraint, whether a `costLimit` is
  exceeded, whether a `catalogueId` names an installed catalogue, whether a `forceEntryId` still
  exists. ADR-0011 and `.claude/rules/areas/roster.md` put all of it on the report.
- Selection-id uniqueness — no producer.
- A referential check on `targetForceId`, and any change to the `forces[0]` fallback. That is a
  product decision.
- A read-side guard in `loadRoster`/`loadRosters`, and any roster-shape migration in
  `src/platform/persistence/migrations.js`.
- Naming the document-not-aggregate pattern — that belongs to the vision statement (0197).

## Open questions

1. **A stored roster that already violates the invariant** — someone imported a bad `.ros` before
   this change — becomes **unsaveable**: it loads, the user edits, and every autosave raises the
   error toast. Options: accept (the record is already corrupt), repair on load, or repair once
   inside `saveRoster` instead of throwing. This is the one thing that could make the change worse
   than the bug, and it needs a decision before implementation.
2. `raiseUnit.js:53` is dead code. Keep it as a cheap net for a future third caller and drop only
   the "identity means failure" clause from the comment at `:42-44`, or delete it?
3. Does a silent no-op deserve a toast, or is `console.warn` enough? "That unit is no longer there"
   may read as noise.
4. The eager binding shape means two writes dispatched in one event handler would both read the same
   `roster`. No such pair exists today, but a future "raise and configure in one click" would break
   silently.
5. `docs/battlescribe/reference/source-gaps.md` (§15) says `-1` is unlimited only as a *written* value, not as
   a computed one. The measure treats a stored `costLimit` as written; worth one confirming read.
