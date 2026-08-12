# src/components/editor — suite doc

Component tests for the roster editor: the recruit/adder dialogs
(`CategoryUnitAdder`, `NewRosterModal`), the force/section tree
(`ForceEditorSection`, `RosterCategorySection`, `RosterSidebar`), the
sub-selection editor (`SelectionConfigurator`, `OptionGroup`), rule/validation
display (`ListRuleChecklist`, `ValidationCauses`, `ValidationMessage`,
`RosterValidationPanel`) and small display components (`UnitChips`,
`CategoryCountBadge`, `RuleChipIcon`). Framework: vitest +
`@testing-library/react` (`render`/`fireEvent`/`screen`), plain
`describe`/`it`. Run the whole directory: `npx vitest run
src/components/editor`; a single file: `npx vitest run
src/components/editor/<file>.test.jsx`.

## Conventions

- Test titles (the `describe`/`it` strings) are German; code comments are
  English.
- Every file that renders a card stubs three things: `lucide-react` (icons
  become `data-testid="icon-<name>"` spans — `ChevronDown`/`ChevronRight` for
  expand state, `Plus`/`Minus` for a quantity stepper's buttons), `../../data/
  rulesLookup` (`getRuleUrl: () => null`) and `../../contexts/SettingsContext`
  (`useSettings: () => ({ whfb6LinkingEnabled: false })`). Nothing else is
  mocked in a `*.evaluator.test.jsx` or fixture-sweep file.
- The production seam for a card test is `processImportedData →
  createSelectionFromDef → toEvaluatorRoster → prepareDataset/evaluate →
  SelectionConfigurator` — see `SelectionConfigurator.mandatoryInCappedGroup.
  test.jsx` and both `*.fixtureSweep.test.jsx` files for the real-fixture-
  catalogue shape of this. Where the point is one slot state in isolation
  rather than a named real catalogue entry, a synthetic catalogue XML
  (`GAME_SYSTEM_XML`/`CATALOGUE_XML` built inline, `appSystem()`/`appRoster()`
  functions) is evaluated through the same real facade
  (`prepareDataset`/`evaluate`/`toEvaluatorRoster`) with a **hand-built** app
  roster, so a mandatory member can be genuinely present or genuinely absent —
  see the `*.evaluator.test.jsx` files and
  `SelectionConfigurator.mandatoryObligation.test.jsx`. `getUnitOptions` is
  stubbed to `[]` only where the point is that the list can ONLY come from the
  report (see the header comment of `SelectionConfigurator.evaluator.test.jsx`
  and `OptionGroup.evaluator.test.jsx`); a case that means to prove the list
  comes from real catalogue *group* membership leaves it unstubbed instead
  (`SelectionConfigurator.mandatoryObligation.test.jsx`,
  `SelectionConfigurator.mandatoryInCappedGroup.test.jsx`).
- Write operations are observed through `createSubSelectionOperationsMock`
  (`src/test-utils/subSelectionOperationsMock`), never through roster state —
  a case reads `operations.increaseCount`/`decreaseCount.mock.calls`, not a
  re-rendered roster.
- DOM helpers are observational, rebuilt per file (no shared helper module):
  `.sub-selection-row` a row, `.option-group` a section, `.option-group-header`
  its header (`.option-group-header--error` when a group constraint is
  violated), `.sub-selection-option-name` a row's name,
  `.nested-option-block` wraps the rows of an occupied option's own
  sub-selections. A row's control is `input[type="checkbox"]`,
  `input[type="radio"]`, or — for a quantity stepper —
  `.quantity-control` holding two `button.qty-btn` (`:first-child` decrements,
  `:last-child` increments) and a `.quantity-value` span with the current
  count. A card is opened with a local `expandAll(container)` that clicks
  every collapsed `.option-group-header` (identified by the
  `icon-chevron-right` testid) in rounds until none remain; a single group is
  opened with `ensureExpanded(groupName, expectedRowName)`, which clicks the
  group's header only if the expected row is not yet in the DOM.
- `identifiesOption(arg, defId)` reads an operations-mock call argument that
  may be a bare id or an object carrying `id`/`defId` — every file that
  asserts on `mock.calls` defines this locally (not shared) and uses it rather
  than asserting the exact argument shape.
- Every capability-driven case guards its own precondition against the real
  evaluator report first (`toMatchObject` on `anchorKind`, `effectiveMin`,
  `effectiveMax`, `isMandatoryUnmet`, `isBlocked`, `headroom`, `current`,
  `costs`, …) before asserting on the rendered DOM — a case never assumes
  what the report says.
- A fixture sweep (`*.fixtureSweep.test.jsx`) renders and fully expands every
  `type="unit"` entry of the six catalogues under
  `src/evaluator/__fixtures__/whfb6-definitive/` and `src/__fixtures__/
  whfb6/` (208 cards) once in a shared `beforeAll`, so each `test` reads an
  independent assertion off the same collected data — no `test` re-renders. A
  new measurement belongs in its own `*.fixtureSweep.test.jsx` file copying
  the harness rather than extending an existing one, so an earlier issue's
  frozen sweep stays untouched and green (see
  `SelectionConfigurator.groupMembership.fixtureSweep.test.jsx`, Issue 0143,
  and `SelectionConfigurator.mandatoryObligation.fixtureSweep.test.jsx`, Issue
  0145). An offender assertion reports `catalogue.cat / Unit Name` (and, for a
  per-row finding, `/ Row Name`) rather than a bare count, and a floor
  (`toBeGreaterThanOrEqual`), never an exact corpus count, guards a positive
  control — an exact count is hostage to any evaluator change; the actually
  measured figure is recorded in a comment instead.
- Naming: `<Component>.test.jsx` for a component's own tests;
  `<Component>.<topic>.test.jsx` for a case that isolates one topic (e.g.
  `OptionGroup.groupConstraints.regression.test.jsx`,
  `SelectionConfigurator.mandatoryObligation.test.jsx`); `<Component>.
  evaluator.test.jsx` specifically for the real-facade, `getUnitOptions`-
  stubbed shape described above.
