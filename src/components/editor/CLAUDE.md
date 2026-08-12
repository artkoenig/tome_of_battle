# src/components/editor — suite doc

Component tests for the roster-editor UI (`UnitSelectionCard`,
`SelectionConfigurator`, `RosterCategorySection`, `OptionGroup`, and their
neighbours). Framework: vitest + `@testing-library/react`, plain
`describe`/`it`, German titles. Run the whole directory: `npx vitest run
src/components/editor`; a single file: `npx vitest run
src/components/editor/<file>.test.jsx`.

## Conventions

- Naming: `<Component>.test.jsx` for a component's baseline tests;
  `<Component>.<topic>.test.jsx` for a case that isolates one topic (e.g.
  `UnitSelectionCard.evaluator.test.jsx` — cost/profile display from the
  evaluator report; `SelectionConfigurator.groupMembership.test.jsx`). A case
  belongs in the file whose component owns the screen it pins.
- Two seams, both real production code, nothing of the evaluator ever
  mocked:
  - **Synthetic seam** (`UnitSelectionCard.evaluator.test.jsx` and its
    siblings) — a minimal inline `gameSystem`/`catalogue` XML string, driven
    through `prepareDataset` + `evaluate` (`../../evaluator/evaluator.js`)
    and `toEvaluatorRoster` (`../../evaluation/rosterAdapter.js`); the app
    roster is a hand-built plain object in the shape `toEvaluatorRoster`
    reads (`{ catalogueId, forces: [{ id, forceEntryId, catalogueId,
    selections: [{ id, name, entryLinkId, selectionEntryId, number,
    category, selections }] }] }`).
  - **Real-fixture seam** (`SelectionConfigurator.groupMembership.test.jsx`
    and its siblings) — the frozen `whfb6-definitive` catalogue/game-system
    files read via `fs.readFileSync`, parsed through `processImportedData`
    (`../../parser/xmlParser.js`) to get `system`/`catalogue`, and the same
    `prepareDataset`/`evaluate`/`toEvaluatorRoster` pair. Load both once in
    `beforeAll` — the fixture parse dominates runtime.
  A case that needs only two or three known selection entries of a real
  catalogue (not a full walk of its groups) hand-builds the app roster
  directly in the shape above instead of going through
  `createSelectionFromDef` — see
  `UnitSelectionCard.gatedProfileCharacteristics.test.jsx`.
- A case that asserts a value the evaluator *computed* guard-asserts against
  the real report FIRST (`capability` at `pathBySelectionId.get(<selection
  id>)`, e.g. `capability.totalCosts`, `capability.infoElements`), before
  asserting on the rendered DOM — the point of the guard is that a broken
  fixture or wrong path fails loudly at the assumption, not inside a DOM
  query that could also fail for an unrelated reason. A control case that
  pins an untouched base value, with no computed assumption to guard, may
  assert on the DOM alone (see the `KONTROLLE:` case of
  `UnitSelectionCard.gatedProfileCharacteristics.test.jsx`).
- What is faked: `lucide-react` (icon components, always), `./BottomSheet`,
  and any child component that owns its own test file and isn't the
  component under test (`./SelectionConfigurator`, `./UnitChips` when
  testing `UnitSelectionCard`). What is real: the evaluator facade, the
  roster adapter, `processImportedData`, and the component under test
  itself.
- The profile/statblock table renders as `.profile-table` with a `thead th`
  header row per characteristic and one `tbody tr` per profile of that type.
  Match a cell to its header by column INDEX (`thead th` index into the
  matching `tbody td`), never by scanning all cell texts — characteristic
  values collide (e.g. WS `9` and Ld `9` on the same row).
- A case that pins already-correct, existing behaviour as a regression guard
  is marked `KONTROLLE:` in its title, same convention as
  `src/evaluator/CLAUDE.md`.
