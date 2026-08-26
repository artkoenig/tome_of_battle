---
status: done
branch: claude/issues-186-192-r1f86s
pr:
---

# The write commands become use cases of the list context

## Goal

Finding F1 of `docs/ddd-assessment-and-refactoring-plan.md`: the domain model is anaemic and
its behaviour lives in React. `src/domain/types.js` defines `Selection`, `Force` and `Roster`
as JSDoc typedefs over plain objects — data contracts with no behaviour. The behaviour that
belongs to them sits in `src/ui/viewmodels/rosterCommands.js:49` (`createRosterCommands`), which
raises units, changes option counts and rewrites the selection tree by hand inside a
`setRoster(prev => ...)` callback.

The cost is measurable and it is not aesthetic. "When a unit is raised, its mandatory members
come with it" is spread over **13 files in three layers** today: `rosterCommands.js` plus four
editor view models in the UI, `selectionFactory.js`/`selectionMembers.js` in the model, and
`report.js`/`mandatoryListRules.js` in the evaluation. Because the UI has to know the shape of
the tree, 31 UI files import from the roster package and pull tree helpers
(`childSelectionsOf`, `countSelections`, `mapSelectionTree`, `replaceSelectionById`) straight
into view code — for example `src/ui/viewmodels/editor/useCategorySection.js:3` and
`src/ui/viewmodels/editor/optionRowDerivations.js:1`. The aggregate has no encapsulation;
every caller navigates its interior.

Move the write commands into `contexts/armylist/application/` as named use cases — `raiseUnit`,
`removeUnit`, `copyUnit`, `changeOptionCount`, `renameRoster` and the sub-selection operations —
each a plain function from roster (plus what the report and catalogue supply) to roster. The
view models keep their place and their identity-stable command bundle per ADR-0038; what changes
is that they call a use case instead of rebuilding the tree themselves.

The measurable end state is the one that makes this enforceable: **no module under `src/ui/**`
imports a selection-tree helper any more.** That is expressible as a cast rule, so the gate
holds it afterwards instead of a convention.

`slots` (the report's slot index) stays an argument the caller hands in — the write model does
not reach the report by itself (ADR-0039), and this issue does not change that direction.

## Acceptance criteria

- AC1: The write commands live in the list context's application layer, not under `src/ui/`. | verify: `bash -c 'test -d src/contexts/armylist/application && ! test -f src/ui/viewmodels/rosterCommands.js'`
- AC2: Each command is a named, exported use case reachable without React: `raiseUnit`, `removeUnit`, `copyUnit`, `changeOptionCount`, `renameRoster`. | verify: `bash -c 'for f in raiseUnit removeUnit copyUnit changeOptionCount renameRoster; do grep -rq "export function $f\|export const $f" src/contexts/armylist/application || { echo "missing: $f"; exit 1; }; done'`
- AC3: No module under `src/ui/` imports a selection-tree helper any more. | verify: `bash -c 'hits=$(grep -rnE "\b(mapSelectionTree|replaceSelectionById|childSelectionsOf|countSelections|withAddedInstance|withoutInstance|withChangedOptionCount)\b" src/ui --include=*.js --include=*.jsx || true); test -z "$hits" || { echo "$hits"; exit 1; }'`
- AC4: A cast rule makes AC3 permanent, and the gate is green. | verify: `bash -c 'grep -q "tree-helfer\|baum-helfer\|model-nur-ueber-use-cases" .cast/rules.json && npm run cast'`
- AC5: Every use case has a test that runs without rendering a component. | verify: `bash -c 'd=src/tests/contexts/armylist/application; test -d "$d" && ! grep -rq "renderHook\|@testing-library" "$d"'`
- AC6: The view models keep the ADR-0038 contract — the exported command bundle stays identity-stable across renders. | verify: `forge-test --run useRosterState`
- AC7: Behaviour is unchanged — the full suite passes. | verify: `forge-test`
- AC8: Types, lint and build stay green. | verify: `bash -c 'forge-typecheck && forge-lint && forge-build'`
- AC9: The editor still works in the real app: raising a unit, changing an option and removing a unit. | verify: `node e2e/ui.test.js`
- AC10: `.claude/rules/areas/viewmodels.md` records that a view model calls a use case and never rewrites the tree itself. | verify: `bash -c 'grep -qi "use case\|anwendungsfall" .claude/rules/areas/viewmodels.md'`

## Out of scope

- Issue 0186 must land first — this issue assumes `src/contexts/armylist/` exists. If it is run
  before, the same work applies to `src/domain/roster/` and the paths in the criteria change.
- Turning `Roster`, `Force` and `Selection` into classes. The use cases stay plain functions over
  plain objects; the point is where the behaviour lives, not which language feature holds it.
  A class-based aggregate would also break the IndexedDB round trip, which stores the plain
  object as-is.
- The mandatory-list-rule effect (issue 0189) and `gameState` (issue 0190).
- Undo/redo. `useUndoableState` (ADR-0013) keeps its place and its semantics; the use cases are
  called from inside the existing writer, not around it.
- A version bump — the user sees no change.
