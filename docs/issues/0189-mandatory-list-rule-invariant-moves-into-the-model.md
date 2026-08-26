---
status: done
branch: claude/issues-186-192-r1f86s
pr:
---

# The mandatory-list-rule invariant moves out of the React effect

## Goal

Finding F2 of `docs/ddd-assessment-and-refactoring-plan.md`. "An unambiguous mandatory list rule
is added automatically" is a rule of the game, and it is implemented as a `useEffect` in
`src/ui/viewmodels/useMandatoryListRuleAutoAdd.js`. The implementation is careful and well
documented — gated on `isFreshRoster`, routed through `replaceRoster` so it produces no undo
step, driven by the report rather than by the catalogue (ADR-0034). What it is not is a rule of
the model: it holds only while that component is mounted.

Two consequences, both real:

- **Coverage.** A roster that arrives by any other path — a `.ros` import, a migration, a future
  script or a non-React caller — silently skips the rule. Whether that is currently reachable in
  the app is beside the point; the invariant is a habit of the surface rather than a promise of
  the model.
- **Test cost.** Because the rule is an effect, its tests need a React renderer: **279 lines
  across two `renderHook` files** (`useMandatoryListRuleAutoAdd.test.js` 116,
  `useRosterState.mandatoryAutoAdd.test.js` 163) against 105 lines for the pure part in
  `mandatoryListRules.test.js`.

Move the rule into the list context as a function every write path runs through: roster in,
roster out, with the report and the catalogue as arguments. The hook shrinks to a call that
feeds it the current report. `findMissingMandatoryListRules` stays where it is — it is a
read-model projection and belongs to the rule engine, not to the list context; only the decision
"and therefore add it" moves.

The `isFreshRoster` gate is behaviour, not scaffolding: an existing roster is never changed
retroactively (AC4 of issue 0138). It moves with the rule and becomes an explicit argument
rather than a hook condition.

## Acceptance criteria

- AC1: The rule is a function of the list context, callable without React. | verify: `bash -c 'grep -rq "export function applyMandatoryListRules\|export const applyMandatoryListRules" src/contexts/armylist'`
- AC2: Every write path that creates or replaces a roster runs through it — new roster, `.ros` import, catalogue sync. | verify: `forge-test --run armylist`
- AC3: The rule is tested without rendering a component; the two `renderHook` test files are gone or reduced to the wiring they still cover. | verify: `bash -c 'test -f src/tests/contexts/armylist/mandatoryListRules.test.js && ! grep -rq "renderHook" src/tests/contexts/armylist/'`
- AC4: An existing roster is still never changed retroactively — the fresh-roster gate survives the move as an explicit argument. | verify: `forge-test --run mandatory`
- AC5: Still no undo step is produced for a rule the user did not click. | verify: `forge-test --run undo`
- AC6: No termination regression: a rule added once shows as `occupied` in the next report and is not added twice. | verify: `forge-test --run mandatory`
- AC7: Behaviour is unchanged — the full suite passes. | verify: `forge-test`
- AC8: Types, lint and build stay green. | verify: `bash -c 'forge-typecheck && forge-lint && forge-build'`
- AC9: Creating a roster in the real app still fills its unambiguous mandatory rules. | verify: `node e2e/ui.test.js`
- AC10: An ADR or the area note records that this invariant belongs to the aggregate and why an effect was the wrong home. | verify: `bash -c 'grep -rqi "mandatory\|pflichtregel" .claude/rules/areas/viewmodels.md docs/adr/*.md'`

## Out of scope

- Issue 0186 must land first for the paths in these criteria to exist; issue 0188 should land
  first so there is an application layer to put the rule in.
- `findMissingMandatoryListRules` and the report projection behind it. They stay in the rule
  engine; this issue moves the decision, not the detection.
- Extending the rule to ambiguous cases. It still only fires where exactly one choice satisfies
  the requirement — widening it is a product change and needs its own issue.
- Retrofitting existing stored rosters. The fresh-roster gate stays.
- A version bump — the behaviour a user sees is identical.
