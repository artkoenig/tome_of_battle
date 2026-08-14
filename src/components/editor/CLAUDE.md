# src/components/editor — suite doc

Component tests for the roster editor: the unit card (`UnitSelectionCard`), the
recruit/adder dialogs (`CategoryUnitAdder`, `NewRosterModal`), the force/section
tree (`ForceEditorSection`, `RosterCategorySection`, `RosterSidebar`), the
sub-selection editor (`SelectionConfigurator`, `OptionGroup`), rule/validation
display (`ListRuleChecklist`, `ValidationCauses`, `ValidationMessage`,
`RosterValidationPanel`) and small display components (`UnitChips`,
`CategoryCountBadge`, `RuleChipIcon`). Framework: vitest +
`@testing-library/react` (`render`/`fireEvent`/`screen`), plain
`describe`/`it`, German titles. Run the whole directory: `npx vitest run
src/components/editor`; a single file: `npx vitest run
src/components/editor/<file>.test.jsx`.

## Conventions

- Test titles (the `describe`/`it` strings) are German; code comments are
  English.
- A case that pins already-correct, existing behaviour as a regression guard is
  marked `KONTROLLE:` in its title, same convention as `src/evaluator/CLAUDE.md`.
- Naming: `<Component>.test.jsx` for a component's own baseline tests;
  `<Component>.<topic>.test.jsx` for a case that isolates one topic (e.g.
  `OptionGroup.groupConstraints.regression.test.jsx`,
  `SelectionConfigurator.mandatoryObligation.test.jsx`,
  `UnitSelectionCard.evaluator.test.jsx` — cost/profile display from the
  evaluator report); `<Component>.evaluator.test.jsx` specifically for the
  real-facade, `getUnitOptions`-stubbed shape described below. A case belongs in
  the file whose component owns the screen it pins.

### Seams — all production code, nothing of the evaluator ever mocked

Two seams, and which one a case takes follows from what it means to prove:

- **Synthetic seam** — a minimal inline `gameSystem`/`catalogue` XML string
  (`GAME_SYSTEM_XML`/`CATALOGUE_XML` built inline, `appSystem()`/`appRoster()`
  functions), driven through the real facade `prepareDataset` + `evaluate`
  (`../../evaluator/evaluator.js`) and `toEvaluatorRoster`
  (`../../evaluation/rosterAdapter.js`) with a **hand-built** app roster in the
  shape `toEvaluatorRoster` reads (`{ catalogueId, forces: [{ id, forceEntryId,
  catalogueId, selections: [{ id, name, entryLinkId, selectionEntryId, number,
  category, selections }] }] }`). Take this seam where the point is one slot
  state in isolation rather than a named real catalogue entry — a mandatory
  member can then be genuinely present or genuinely absent. See the
  `*.evaluator.test.jsx` files and
  `SelectionConfigurator.mandatoryObligation.test.jsx`.
- **Real-fixture seam** — the frozen catalogue/game-system files read via
  `fs.readFileSync`, parsed through `processImportedData`
  (`../../parser/xmlParser.js`) to get `system`/`catalogue`, then the same
  `prepareDataset`/`evaluate`/`toEvaluatorRoster` trio. The full production seam
  for a card test is `processImportedData → createSelectionFromDef →
  toEvaluatorRoster → prepareDataset/evaluate → SelectionConfigurator` — see
  `SelectionConfigurator.mandatoryInCappedGroup.test.jsx` and both
  `*.fixtureSweep.test.jsx` files. Load the fixtures once in `beforeAll`; the
  fixture parse dominates runtime. A case that needs only two or three known
  selection entries of a real catalogue (not a full walk of its groups)
  hand-builds the app roster directly in the shape above instead of going
  through `createSelectionFromDef` — see
  `UnitSelectionCard.gatedProfileCharacteristics.test.jsx`.

Where a file with an unstubbed `getUnitOptions` renders many cases from one
inline synthetic catalogue, `appSystem()` returns
`processImportedData(...).system` memoised in a module-level variable rather
than reparsed per case (see
`SelectionConfigurator.mandatoryObligation.test.jsx`).

### What is faked, and what is not

- What is real, always: the evaluator facade, the roster adapter,
  `processImportedData`, and the component under test itself.
- Every file that renders a card stubs three things: `lucide-react` (icons
  become `data-testid="icon-<name>"` spans — `ChevronDown`/`ChevronRight` for
  expand state, `Plus`/`Minus` for a quantity stepper's buttons),
  `../../data/rulesLookup` (`getRuleUrl: () => null`) and
  `../../contexts/SettingsContext`
  (`useSettings: () => ({ whfb6LinkingEnabled: false })`). Nothing else is
  mocked in a `*.evaluator.test.jsx` or fixture-sweep file.
- A test of a component that owns children with their own test files also fakes
  those children and `./BottomSheet` — e.g. `./SelectionConfigurator` and
  `./UnitChips` when testing `UnitSelectionCard`.
- `getUnitOptions` is stubbed to `[]` only where the point is that the list can
  ONLY come from the report (see the header comment of
  `SelectionConfigurator.evaluator.test.jsx` and `OptionGroup.evaluator.test.jsx`);
  a case that means to prove the list comes from real catalogue *group*
  membership leaves it unstubbed instead
  (`SelectionConfigurator.mandatoryObligation.test.jsx`,
  `SelectionConfigurator.mandatoryInCappedGroup.test.jsx`).

### Asserting

- Every case that asserts a value the evaluator *computed* guard-asserts against
  the real report FIRST — `toMatchObject` on the capability at
  `pathBySelectionId.get(<selection id>)` (`anchorKind`, `effectiveMin`,
  `effectiveMax`, `isMandatoryUnmet`, `isBlocked`, `headroom`, `current`,
  `costs`, `totalCosts`, `raiseCosts`, `infoElements`, …) — before asserting on the rendered
  DOM. The point of the guard is that a broken fixture or a wrong path fails
  loudly at the assumption, not inside a DOM query that could also fail for an
  unrelated reason; a case never assumes what the report says. A control case
  that pins an untouched base value, with no computed assumption to guard, may
  assert on the DOM alone (see the `KONTROLLE:` case of
  `UnitSelectionCard.gatedProfileCharacteristics.test.jsx`).
- Write operations are observed through `createSubSelectionOperationsMock`
  (`src/test-utils/subSelectionOperationsMock`), never through roster state — a
  case reads `operations.increaseCount`/`decreaseCount.mock.calls`, not a
  re-rendered roster.
- `identifiesOption(arg, defId)` reads an operations-mock call argument that may
  be a bare id or an object carrying `id`/`defId` — every file that asserts on
  `mock.calls` defines this locally (not shared) and uses it rather than
  asserting the exact argument shape.

### Reading the DOM

- DOM helpers are observational, rebuilt per file (no shared helper module):
  `.sub-selection-row` a row, `.option-group` a section, `.option-group-header`
  its header (`.option-group-header--error` when a group constraint is
  violated), `.sub-selection-option-name` a row's name, `.nested-option-block`
  wraps the rows of an occupied option's own sub-selections. A row's control is
  `input[type="checkbox"]`, `input[type="radio"]`, or — for a quantity stepper —
  `.quantity-control` holding two `button.qty-btn` (`:first-child` decrements,
  `:last-child` increments) and a `.quantity-value` span with the current count.
  A card is opened with a local `expandAll(container)` that clicks every
  collapsed `.option-group-header` (identified by the `icon-chevron-right`
  testid) in rounds until none remain; a single group is opened with
  `ensureExpanded(groupName, expectedRowName)`, which clicks the group's header
  only if the expected row is not yet in the DOM.
- The profile/statblock table renders as `.profile-table` with a `thead th`
  header row per characteristic and one `tbody tr` per profile of that type.
  Match a cell to its header by column INDEX (`thead th` index into the matching
  `tbody td`), never by scanning all cell texts — characteristic values collide
  (e.g. WS `9` and Ld `9` on the same row).

### Fixture sweeps

A fixture sweep (`*.fixtureSweep.test.jsx`) renders and fully expands every
`type="unit"` entry of the six catalogues under
`src/evaluator/__fixtures__/whfb6-definitive/` and `src/__fixtures__/whfb6/`
(208 cards) once in a shared `beforeAll`, so each `test` reads an independent
assertion off the same collected data — no `test` re-renders. A new measurement
belongs in its own `*.fixtureSweep.test.jsx` file copying the harness rather
than extending an existing one, so an earlier issue's frozen sweep stays
untouched and green (see
`SelectionConfigurator.groupMembership.fixtureSweep.test.jsx`, Issue 0143, and
`SelectionConfigurator.mandatoryObligation.fixtureSweep.test.jsx`, Issue 0145).
An offender assertion reports `catalogue.cat / Unit Name` (and, for a per-row
finding, `/ Row Name`) rather than a bare count, and a floor
(`toBeGreaterThanOrEqual`), never an exact corpus count, guards a positive
control — an exact count is hostage to any evaluator change; the actually
measured figure is recorded in a comment instead. Where a sweep must pair a
rendered row with the report slot it renders (not just check that a name appears
somewhere, the way `SelectionConfigurator.groupMembership.fixtureSweep.test.jsx`
does), a name that denotes more than one slot on one card cannot be paired 1:1 —
no DOM attribute carries a slot's defId — so that card's rows go into a
separate, counted "ambiguous" population instead (see
`SelectionConfigurator.mandatoryObligation.fixtureSweep.test.jsx`).
