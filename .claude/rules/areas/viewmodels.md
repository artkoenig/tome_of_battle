---
paths:
  - "src/ui/viewmodels/**"
---

# viewmodels

The ViewModel layer of ADR-0038: hooks that hold state and derive display values, plus the two
roster contexts. It sits **above** `src/ui/components/` in the UI layer of ADR-0037 — a ViewModel may
never import a component. Run it with `forge-test --run src/ui/viewmodels`.

- `useRosterState.js` is the editor's one state node: roster, UI selection and commands, in three
  bundles split by how often they change. The flat view `useRoster` in `src/ui/hooks/` is gone
  (Issue 0175): consumers and tests read `roster`, `report.*`, `commands.*` off the node itself.
- The `commands` bundle is identity-stable for the hook's whole lifetime: implementations are
  rebuilt each render into `currentCommandsRef`, the exported functions are `useMemo(…, [])`
  wrappers calling through it. Returning a freshly built command object (or memoizing it on
  `roster`) silently breaks `RosterCommandsContext` and is the mistake a change here is most
  likely to make; `useRosterState.test.js` and `rosterContexts.test.jsx` pin it.
- The node's own suite is `useRosterState.test.js` plus `useRosterState.<topic>.test.js`
  (`commands`, `evaluator`, `mandatoryAutoAdd`, `costedMandatoryAutoAdd`, `nestedMandatoryGroups`,
  `recruitCostAgreement`). A topic file that drives the **production seam** — real catalogue XML,
  unmocked `resolveEntry`/`createSelectionFromDef`, the real evaluation — loads its fixture with
  `fs.readFileSync` + `processImportedData` and builds the roster with `buildRoster`; nothing about
  roster or catalogue is hand-built. `costedMandatoryAutoAdd` is synthetic-but-shape-faithful,
  `nestedMandatoryGroups` reads `src/domain/evaluator/__fixtures__/whfb6-definitive/`.
  Test titles here are English, unlike `src/domain/*`.
- `isFreshRoster` (the node's fifth argument) gates the automatic mandatory list-rule addition
  (Issue 0138/0140, §9.9): omit it or pass `false` to keep that effect out of a case about
  `addUnit` or another seam, pass `true` only where the fresh-roster auto-add is the point.
- `commands.addUnit(entry, categoryId, targetForceId?)` is the recruitment call the dialog makes.
  A case that measures what recruiting produces calls it inside `act(...)` and reads
  `result.current.roster.forces[0].selections`, never a lower-level factory (that is
  `src/domain/roster`).
- Proving "does not render again" needs a `memo`-wrapped consumer; without it the consumer
  re-renders because its parent did and the test proves nothing.
- `rosterContexts.jsx` passes `commands` through **unchanged**; only the report context memoizes
  its bundle. Both hooks throw without a provider above them — the contract, not a convenience —
  so any tree with an editor leaf needs both, the play view included.
- The report context carries `{ report, roster, system, activeCatalogue }`. `system` is the frame
  for detail texts and catalogue structure, never a display answer (ADR-0034).
- Since Issue 0165 each **screen shell** has its own ViewModel here too: `useRosterEditor`,
  `usePlayRoster`, `usePlayUnit`, `useRosterDashboard`, `useImporter`, `useNewRosterModal`, plus
  `useBottomSheet` and `useRulesIndexDialog` for the two overlays. `useEffect`/`useMemo` are
  banned in `src/ui/components/**` by an oxlint `no-restricted-imports` override (severity `error`,
  so it fails `forge-lint`) — every effect and every memo of a screen lives here.
  Adding an override for a components path there means repeating the evaluator-facade `patterns`
  block: oxlint replaces a rule's config per override rather than merging it.
- A ViewModel may **not** import `src/data/db/` or `src/data/parser/`: `viewmodel-keine-datenschicht` is
  an `error` and fails `forge-lint`, and since Issue 0167 without any exception — the three
  shell ViewModels `useRosterEditor`, `usePlayRoster` and `useImporter` run through
  `src/data/services/` like everything else.
- `viewmodel-kein-jsx` (`src/ui/viewmodels/` → `src/ui/components/`) is an `error` too, so the "never
  import a component" rule above is machine-checked rather than a convention.
- Text goes through `useTranslation()` here, not the bare `t` of `i18nStore`: a `useMemo` that
  formats a label needs `language` in its dependency list, or a language switch leaves the
  derived text stale. Where a derivation is also exported as a plain function, give it a
  `t = translate` default parameter and pass the hook's `t` from the hook.
- `useRosterDashboard` memoises one `evaluateAppRoster` report per card over `[rosters, systems]`.
  The memo only holds if the caller keeps those array identities — `useAppData` does; a test that
  writes `systems: [SYSTEM]` inline re-evaluates on every render and proves nothing.
- Resetting a form when a modal opens is done by comparing against a `wasOpen` state **in the
  render**, not in an effect (`useNewRosterModal`): an effect with `systems` in its dependency
  list discards the user's typing whenever the list gets a new identity.
- `profileCellDisplayOf` lives in `editor/useUnitCard.js` and is read from `usePlayUnit.js` as
  well (`modificationStateOf` next to it is module-private since Issue 0166) — one profile-cell presentation for the editor table and the play
  table; the former `components/profileCellClasses.js` is gone. The same move absorbed
  `components/importer/importMessages.js` and `revisionDisplay.js` into `useImporter.js`.
- A hook test that reaches `useRuleUrl` (every shell with a rule channel) must mock
  `../contexts/SettingsContext`; the real `useSettings` throws without its provider.
- `src/ui/viewmodels/editor/` holds one hook per editor leaf (`useUnitCard`, `useOptionGroup`,
  `useSelectionConfigurator`, `useUnitChips`) and one per section (`useForceSection`,
  `useCategorySection`, `useRecruitOffer`, `useListRuleChecklist`, `useAutoFillSuggestions`,
  `useRosterSidebar`, `useValidationPanel`). A ViewModel may not import
  `components/editor/upgradeDetails.jsx` (it returns JSX).
- The detail block of an upgrade is derived here, by `editor/upgradeDetailElements.js`
  (`upgradeDetailElementsOf(capability)` — one argument, no `system`, no `catalogueId`), out of
  `capability.infoElements` and `capability.source` alone (Issue 0173). Every row hook that offers
  an info tooltip puts the finished list on the row as `detailElements`;
  `renderUpgradeDetails(elements)` in the component only renders it. **No module under `src/ui/`
  looks a rule up by its name** — neither the old name-*similarity* (substring,
  last-ten-characters, a hard-wired `waaagh` case, first hit across all catalogues) nor the
  narrow equal-name fallback. The fallback lives in the report
  (`domain/evaluator/infoProjection.js`), so the detail block and `useUnitChips` read it from the
  same `infoElements`; a lookup re-added here would reach only one of the two.
  `publicationRefOf(source)` here is the one place the `[Book, S. 44]` form is written.
- A component test that mocks `domain/roster` wholesale (`vi.mock('../../../domain/roster', …)`)
  lists the exports by hand, so a new import a ViewModel adds there fails those files with
  "No <name> export is defined on the mock" — the mock, not the ViewModel, is what is out of date.
- The report's slot side arrives as `report.slots`, one `SlotIndex`
  (`src/domain/evaluation/slotIndex.js`) with the lookups as methods — never as `capabilities` +
  `pathBySelectionId` + `pathByForceId` side by side. A ViewModel that may see no report falls back
  to `EMPTY_SLOT_INDEX` and keeps `slots` (not the three maps) in its `useMemo` dependencies.
- `capabilityEntries.js` here is the one place that resolves a slot back to its catalogue entry
  (`findCapabilityEntry`, `capabilityEntryOf` with the `{ id, name }` stub). It lives in this
  folder because `src/domain/evaluation/` may not import `src/domain/roster/`.
- The report derivations `evaluation/listRuleGroups.js`, `armyWideSelectorSlots.js` and
  `violationStats.js` are read **here only** — `ableitungen-nur-in-viewmodels` fails `forge-lint`
  on an import of them from `src/ui/components/`.
- A section ViewModel derives what the editor used to thread through as props (`costTypeLabel`,
  `remainingPoints`, `extraResources`, the force path from `report.slots.pathOfForce(...)` — never the
  roster's input index). What stays a prop is only what the caller knows: `force`/`forceId`,
  `forcePath`, `categoryLink`/`categoryId` and display state;
  `src/ui/components/editor/sectionPropCount.test.js` pins the ceilings.
- `useAutoFillSuggestions` filters twice, and both halves are load-bearing: the slot **path** must
  lie in the force's subtree (`path === forcePath` or `` `${forcePath}/` `` prefix) **and** its
  frame must be the force or a path in `pathBySelectionId`. The frame check alone leaks another
  force's slots into this panel (`pathBySelectionId` is roster-wide); the test `ein Slot an einer
  Auswahl eines anderen Kontingents ist kein Vorschlag` pins the subtree half.
- `useValidationPanel` reads `report.violations` **without** a `?? []` fallback on purpose: a
  missing list is a broken report and must fail loudly rather than read as "all clear"
  (`RosterEditor.test.jsx` pins the throw).
- A section component's own tests go through `src/shared/test-utils/harnesses/<Component>Harness.jsx` —
  one file per component, not one shared module: a partial `lucide-react` mock would otherwise
  fail on the icons of a component it never renders. `sectionHarnessBase.jsx` holds the shared
  pieces, including the inversions a flat prop set needs (`costTypeLabel`, `remainingPoints`,
  `extraResources`, list-rule `states`).
- No file under `src/ui/viewmodels/` may exceed 300 lines (Issue 0176). The configurator is cut
  along that line into four modules, each with its own test file next to it:
  `editor/optionRowDerivations.js` (`findSelectionById`, `resolveRowSelectionId`,
  `subSelectionCountOf`, `optionDescriptionOf` — the row derivations `useOptionGroup` shares),
  `editor/costBudgets.js` (`costBudgetTextsOf`, `hasExceededCostBudget`),
  `editor/standaloneRow.js` (`buildStandaloneSection`) and `editor/configuratorSections.js`
  (`buildSections`, `holdsSelection`, `isRoleGroupName`). `useSelectionConfigurator.js` is the hook
  and nothing else. `buildSections`/`buildStandaloneSection` take the hook's memo bundle as a
  `context` argument (`{ slots, system, activeCatalogueId, costTypeId, costTypeLabel,
  subSelectionOperations }`) — pure functions, testable without a provider.
- An option row's description comes from `capability.infoElements` only. The old name-based lookup
  against `system.sharedRules` confused two same-named rules from different catalogues; do not
  reintroduce it (`editor/optionRowDerivations.test.js` pins the case).
- The report the context carries is `useRosterReportModel` (`src/domain/evaluation/rosterReport.js`),
  referentially stable per `(system, roster)`. A new derived field belongs in that bundle,
  memoized, or it destroys the stability every consumer depends on.
- Files here use the classic JSX runtime: a `.jsx` file (and its test) must `import React` or it
  fails at runtime with `React is not defined`, not at lint time.
- A test that needs a real report loads a fixture catalogue with `fs.readFileSync` +
  `processImportedData` and `buildRoster` — roughly 2 s per case. Where the case is about state or
  derivation only, pass `system = null`: the evaluation is the frozen empty result and runs
  instantly.
- `src/shared/test-utils/rosterProviders.jsx` seeds both providers (`renderWithRosterProviders`,
  `createRosterProviderWrapper`, `createEmptyRosterReport`, `createNoopRosterCommands`). Extend
  the empty report there when the report gains a field.
- A hook test here builds its report by hand (`new Map()` of slots, folded into a `SlotIndex` by
  `createEmptyRosterReport`) and runs instantly. Every slot of such a fixture must carry `isHidden`,
  `isIndependentSubUnit` and `primaryCategoryId`, or `SlotIndex.fromMaps` throws. Pin what
  the derivation does, not what the engine computes. Where the hand-built system resolves no
  frame, `getUnitOptions` returns nothing and the configurator keeps every group anchor as an
  empty section — expect those in an assertion over `sections`.
- `editor/selectionBehavior.js` is the one **display** classifier of an option row
  (`classifyGroupItem`, `classifyStandaloneOption`: mandatory/met, radio, binary, stepper). It is
  pure and takes only values the report already measured — it re-reads no catalogue. The
  catalogue-side twin of those questions lives once, in the report
  (`src/domain/evaluator/groupBehavior.js`); a second reading here would drift from it.
