---
paths:
  - "src/ui/viewmodels/**"
---

# viewmodels

The ViewModel layer of ADR-0038: hooks that hold state and derive display values, plus the two
roster contexts and `SettingsContext.jsx`. It sits **above** `src/ui/components/` in the UI layer
of ADR-0037 — a ViewModel may never import a component. Run it with
`forge-test --run src/ui/viewmodels`.

- Since Issue 0178 this is the **only** directory of the layer: the app-level hooks `useRosterList`,
  `useAppData`, `useAppNavigation`, `usePlayState`, `usePwaLifecycle`, `useRuleUrl`, `useToast`,
  `useUndoableState`, `useViewportHeight` and the shared `persistenceFailure` helper live here too,
  next to the screen ViewModels, and `SettingsContext.jsx` (ADR-0015, the whfb6 rule-linking
  toggle) moved here from the one-file `src/ui/contexts/`, which is gone with it. There is no
  `src/ui/hooks/` and no `src/ui/contexts/`; `App.jsx` imports them from
  `./viewmodels/`. The layer takes small mechanics as well (`useBottomSheet` is the precedent).
- The suite doc is `CLAUDE.md` here: English test titles (unlike `src/contexts/*`), `useX.test.js` /
  `useX.<topic>.test.js` naming, and the production-seam build-up with real catalogue XML.
- `usePlayState.js` holds the **running game**, not a roster field: since Issue 0190 it reads and
  writes through the facade `src/contexts/play/` (`loadGame`/`saveGame`) and takes only
  `(roster, reportError)`. It must not be given `setRoster` again — that is what put a wound into
  the list's undo history and rewrote the whole roster record per click. `usePlayRoster` keeps the
  roster in a setter-less `useState` for the evaluation cache's identity.
  The read is asynchronous, so the hook holds **two** move marks and they are not interchangeable:
  `hasUnsavedMove` drives the save effect and falls back with each write, `hasPlayed` latches for
  the roster's whole visit and is the guard the pending `loadGame().then` must ask — guarding the
  load with the save mark discards a wound taken while the read is still in flight and then
  persists the stale game. `hasPlayed` is reset at the top of the `[rosterId]` load effect, because
  another list is another game.
- `useAppData.js` is the **only** subscriber of the facade's change channel
  (`src/shared/events/dataEvents.js`): a write through `src/contexts/*/application/` announces itself
  there and the one roster list follows. A screen that wants to see a foreign save subscribes
  nowhere.
- `useAppData` keeps the **start run** and the **re-entry** apart, and they must stay apart:
  `runStartupLoad` (mount effect only) reads the DB, runs the start migration and the network
  catalog refresh; `reloadData` — what `useRosterList` gets — reads IndexedDB and nothing else.
  Hanging the start run off a repeating event re-parses every stored catalogue and drops the
  evaluation cache with it.
- `describeRosterFileError` in `useRosterList.js` is the only place that turns a `messageKey`/
  `messageParams`/`detail` error from `src/contexts/armylist/model/` or `src/contexts/*/application/` into text.

- `useRosterState.js` is the editor's one state node: roster, UI selection and commands, in three
  bundles split by how often they change. The flat view `useRoster` is gone
  (Issue 0175): consumers and tests read `roster`, `report.*`, `commands.*` off the node itself.
- **A ViewModel calls a use case; it never rewrites the selection tree itself** (Issue 0188). The
  write commands are use cases of the list context — `raiseUnit`, `removeUnit`, `copyUnit`,
  `addSubSelectionInstance`/`removeSubSelectionInstance`/`changeOptionCount`, `renameRoster` under
  `src/contexts/armylist/application/` — plain functions from roster (plus the `system` and the
  report's `slots`, handed in per ADR-0039) to roster. `rosterCommandBindings.js`
  (`bindRosterCommands`, successor of the deleted `rosterCommands.js`) is **binding only**: call
  the use case, hand the result to `setRoster`, keep the UI's own selection state in step.
  `rosterSelectionFactory.js` moved to that application layer with them.
- **An invariant of the game is not a `useEffect`** (Issue 0189). The automatic addition of an
  unambiguous mandatory list rule (§9.9) is the use case
  `applyMandatoryListRules` (`src/contexts/armylist/application/mandatoryListRules.js`): as an
  effect it held only while the editor was mounted, so a roster arriving by any other path — the
  `.ros` import, a migration, a non-React caller — skipped it silently, and its tests needed a
  renderer. `useMandatoryListRuleAutoAdd.js` is now wiring only: hand the current report in, commit
  a changed roster through `replaceRoster` (no undo step). `useRosterList.js` runs the same use
  case when a roster is created and when one is imported, fetching the report itself
  (`evaluateAppRoster`, ADR-0039). A new automatic write belongs in the use case, not in a hook.
- **No module under `src/ui/**` may name a selection-tree helper.** `childSelectionsOf`,
  `countSelections`, `mapSelectionTree`, `replaceSelectionById` and the `with*` sub-selection
  operations are gone from `contexts/armylist/model/index.js` and the cast rule
  `baum-helfer-nicht-in-der-ui` (`error`) blocks the direct import of `model/rosterTree.js` and
  `model/subSelectionEditing.js` from here. Ask the aggregate a named question instead —
  `unitsOfForce(force)`, `subSelectionsOf(selection)`, `countOptionInstances(unit, defId)` — and
  add the next one to the model rather than reaching for the walker. A component test that mocks
  the model barrel lists those names by hand, so a new one has to be added to the mock too.
- The state node is cut along the same 300-line rule (Issue 0176): `rosterCommandBindings.js`
  (the write commands as a plain per-render factory over roster, report slots and the state
  writers), `useRosterPersistence.js` (catalogue sync,
  the 150 ms autosave, the unmount flush, and `saveNow` for the explicit save) and
  `useMandatoryListRuleAutoAdd.js` (the effect that feeds the §9.9 use case). `useRosterState.js` is
  the state apparatus and the identity-stable command wrappers, nothing else. A use-case test needs
  no React and no catalogue: an entry without a `targetId` resolves to itself, so a fake `slots`
  stub over a plain roster pins the whole write path in milliseconds — those tests live in
  `src/tests/contexts/armylist/application/` and may not render anything.
- The `commands` bundle is identity-stable for the hook's whole lifetime: implementations are
  rebuilt each render into `currentCommandsRef`, the exported functions are `useMemo(…, [])`
  wrappers calling through it. Returning a freshly built command object (or memoizing it on
  `roster`) silently breaks `RosterCommandsContext` and is the mistake a change here is most
  likely to make; `useRosterState.test.js` and `rosterContexts.test.jsx` pin it.
- The node's own suite is `useRosterState.test.js` plus `useRosterState.<topic>.test.js`
  (`commands`, `evaluator`, `mandatoryAutoAdd`, `costedMandatoryAutoAdd`, `nestedMandatoryGroups`,
  `raiseCostAgreement`). A topic file that drives the **production seam** — real catalogue XML,
  unmocked `resolveEntry`/`createSelectionFromDef`, the real evaluation — loads its fixture with
  `fs.readFileSync` + `processImportedData` and builds the roster with `buildRoster`; nothing about
  roster or catalogue is hand-built. `costedMandatoryAutoAdd` is synthetic-but-shape-faithful,
  `nestedMandatoryGroups` reads `src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`.
  Test titles here are English, unlike `src/contexts/*`.
- `isFreshRoster` (the node's fifth argument) gates the automatic mandatory list-rule addition
  (Issue 0138/0140, §9.9): omit it or pass `false` to keep that effect out of a case about
  `raiseUnit` or another seam, pass `true` only where the fresh-roster auto-add is the point.
- `commands.raiseUnit(entry, categoryId, targetForceId?)` is the raise call the dialog makes.
  A case that measures what a raise produces calls it inside `act(...)` and reads
  `result.current.roster.forces[0].selections`, never a lower-level factory (that is
  `src/contexts/armylist/model`).
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
- A ViewModel may **not** import `src/platform/persistence/` or `src/platform/battlescribe/`: `viewmodel-keine-datenschicht` is
  an `error` and fails `forge-lint`, and since Issue 0167 without any exception — the three
  shell ViewModels `useRosterEditor`, `usePlayRoster` and `useImporter` run through
  `src/contexts/*/application/` like everything else.
- `viewmodel-keine-komponente` (`src/ui/viewmodels/` → `src/ui/components/`) is an `error` too, so the "never
  import a component" rule above is machine-checked rather than a convention.
- Text goes through `useTranslation()` here, not the bare `t` of `i18nStore`: a `useMemo` that
  formats a label needs `language` in its dependency list, or a language switch leaves the
  derived text stale. Where a derivation is also exported as a plain function, give it a
  `t = translate` default parameter and pass the hook's `t` from the hook.
- `useRosterDashboard` memoises one `evaluateAppRoster` report per card over `[rosters, systems]`.
  The memo only holds if the caller keeps those array identities — `useAppData` does; a test that
  writes `systems: [SYSTEM]` inline re-evaluates on every render and proves nothing. Its return is
  `factionGroups` (the game-system grouping level is gone, Issue 0203) and the **filtering happens
  in a second memo over the finished cards** — putting the filter into the card memo re-evaluates
  every list on every checkbox.
- The overview's filter lives in three pieces: `rosterFilter.js` (pure — options, the OR/AND
  predicate, toggle/remove, chips), `useRosterFilter.js` (the binding, plus the mobile sheet's open
  state) and the persisted selection `{ systemIds, factionIds }` in `SettingsContext`. It belongs
  above both consumers because the control sits in the overview's toolbar on the desktop and in
  the **app header** on mobile, so `App.jsx` renders `SettingsProvider` around an inner `AppShell`
  and hands the whole bundle to `RosterDashboard` as one `filter` prop — the dashboard itself needs
  no provider, and its tests render without one.
- `SettingsContext` is no longer the single whfb6 flag: a **test that mocks
  `platform/persistence/database` wholesale must list every settings pair** (`getWhfb6LinkingEnabled`/
  `setWhfb6LinkingEnabled`/`WHFB6_LINKING_DEFAULT` **and** `getDashboardFilter`/`setDashboardFilter`/
  `DASHBOARD_FILTER_DEFAULT`), or the provider's hydration effect fails inside an unrelated screen
  test. A setting that hides user data reads a broken record as "nothing hidden".
- Resetting a form when a modal opens is done by comparing against a `wasOpen` state **in the
  render**, not in an effect (`useNewRosterModal`): an effect with `systems` in its dependency
  list discards the user's typing whenever the list gets a new identity.
- `profileCellDisplayOf` lives in `editor/useUnitCard.js` and is read from `usePlayUnit.js` as
  well (`modificationStateOf` next to it is module-private since Issue 0166) — one profile-cell presentation for the editor table and the play
  table; the former `components/profileCellClasses.js` is gone. The same move absorbed
  `components/importer/importMessages.js` and `revisionDisplay.js` into the import shell.
- A hook test that reaches `useRuleUrl` (every shell with a rule channel) must mock
  `./SettingsContext`; the real `useSettings` throws without its provider.
- The `react/only-export-components` exception for the context modules (provider and consumer hook
  stay in one file) is an `.oxlintrc.json` override on the **file names**
  `src/ui/viewmodels/**/*Context.jsx` and `**/*Contexts.jsx`, not on a directory — a new context
  module has to be named that way to inherit it. The rule is warn-only either way, so a miss does
  not fail `forge-lint`.
- `src/ui/viewmodels/editor/` holds one hook per editor leaf (`useUnitCard`, `useOptionGroup`,
  `useSelectionConfigurator`, `useUnitChips`) and one per section (`useForceSection`,
  `useCategorySection`, `useRaiseOffer`, `useListRuleChecklist`, `useAutoFillSuggestions`,
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
  (`contexts/ruleengine/engine/infoProjection.js`), so the detail block and `useUnitChips` read it from the
  same `infoElements`; a lookup re-added here would reach only one of the two.
  `publicationRefOf(source)` here is the one place the `[Book, S. 44]` form is written.
- A component test that mocks `contexts/armylist/model` wholesale (`vi.mock('../../../contexts/armylist/model', …)`)
  lists the exports by hand, so a new import a ViewModel adds there fails those files with
  "No <name> export is defined on the mock" — the mock, not the ViewModel, is what is out of date.
- The report's slot side arrives as `report.slots`, one `SlotIndex`
  (`src/contexts/ruleengine/readmodel/slotIndex.js`) with the lookups as methods — never as `capabilities` +
  `pathBySelectionId` + `pathByForceId` side by side. A ViewModel that may see no report falls back
  to `EMPTY_SLOT_INDEX` and keeps `slots` (not the three maps) in its `useMemo` dependencies.
- `capabilityEntries.js` here is the one place that resolves a slot back to its catalogue entry
  (`findCapabilityEntry`, `capabilityEntryOf` with the `{ id, name }` stub). It lives in this
  folder because `src/contexts/ruleengine/` may not import `src/contexts/armylist/model/`.
- The report derivations `evaluation/listRuleGroups.js`, `armyWideSelectorSlots.js` and
  `violationStats.js` are read **here only** — `ableitungen-nur-in-viewmodels` fails `forge-lint`
  on an import of them from `src/ui/components/`.
- A section ViewModel derives what the editor used to thread through as props (`costTypeLabel`,
  `remainingPoints`, `extraResources`, the force path from `report.slots.pathOfForce(...)` — never the
  roster's input index). What stays a prop is only what the caller knows: `force`/`forceId`,
  `forcePath`, `category`/`categoryId` — the translated `{ id, name, anchorIds }` of
  `src/contexts/armylist/acl/`, never a raw `categoryLink` (Issue 0191) — and display state;
  `src/ui/components/editor/sectionPropCount.test.js` pins the ceilings.
- `useAutoFillSuggestions` filters twice, and both halves are load-bearing: the slot **path** must
  lie in the force's subtree (`path === forcePath` or `` `${forcePath}/` `` prefix) **and** its
  frame must be the force or a path in `pathBySelectionId`. The frame check alone leaks another
  force's slots into this panel (`pathBySelectionId` is roster-wide); the test `ein Slot an einer
  Auswahl eines anderen Kontingents ist kein Vorschlag` pins the subtree half.
- `useValidationPanel` reads `report.violations` **without** a `?? []` fallback on purpose: a
  missing list is a broken report and must fail loudly rather than read as "all clear"
  (`RosterEditor.test.jsx` pins the throw).
- A section component's own tests go through `src/tests/test-utils/harnesses/<Component>Harness.jsx` —
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
- The import shell is cut along the same line: `importerMessages.js` (the three message builders),
  `importerRevisionDisplay.js` (`REVISION_TONE`, `buildRevisionDisplay`, `revisionLabelClassName` —
  the ADR 0014 state matrix), `importerBundle.js` (`allSelectedCatalogues`, `buildBundleView` —
  the chosen index system held against the installed list) and `systemArchiveExport.js`
  (`hasRawXmls`, `downloadSystemArchive`). `useImporter.js` is the flow and the state; it exports
  only the hook, and `Importer.jsx` reads `revisionLabelClassName` off the hook's return, so the
  component's props do not change when a derivation moves. A test for the export module stubs
  `URL.createObjectURL`/`revokeObjectURL` — jsdom has neither.
- An option row's description comes from `capability.infoElements` only. The old name-based lookup
  against `system.sharedRules` confused two same-named rules from different catalogues; do not
  reintroduce it (`editor/optionRowDerivations.test.js` pins the case).
- The report the context carries is `useRosterReportModel` (`src/contexts/ruleengine/readmodel/rosterReport.js`),
  referentially stable per `(system, roster)`. A new derived field belongs in that bundle,
  memoized, or it destroys the stability every consumer depends on.
- Files here use the classic JSX runtime: a `.jsx` file (and its test) must `import React` or it
  fails at runtime with `React is not defined`, not at lint time.
- A test that needs a real report loads a fixture catalogue with `fs.readFileSync` +
  `processImportedData` and `buildRoster` — roughly 2 s per case. Where the case is about state or
  derivation only, pass `system = null`: the evaluation is the frozen empty result and runs
  instantly.
- `src/tests/test-utils/rosterProviders.jsx` seeds both providers (`renderWithRosterProviders`,
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
  (`src/contexts/ruleengine/engine/groupBehavior.js`); a second reading here would drift from it.
- `strictNullChecks` is on (Issue 0185), and in a hook it bites at the state seam:
  `useState(null)` types the state `null`, `useState([])` types it `never[]`, and the setter then
  rejects every real value. Give the initial value a **module-level constant with a `@type`
  annotation** (`const NO_RULE_DIALOG = null;`, `const NO_ROSTERS = [];`) and pass that — no cast
  needed. `useRef(null)` is different: annotate the declaration
  (`/** @type {import('react').RefObject<HTMLDivElement|null>} */`), because a ref's initial value
  is not what the type must say. A module-level annotated constant used at **module** level
  (`createContext(NO_X)`) does not work — control-flow narrowing pins it back to `null` there, so
  the two context modules assert at the literal instead.
- A JSDoc block separated from its function by anything — a `const`, a second comment — stops
  applying, and the parameters silently fall back to `any`. Two hooks had drifted that way; keep
  the block flush against the `export function` line.
- One domain term, one name: [`docs/glossary.md`](../../../docs/glossary.md) decides per term whether
  the BattleScribe word or this app's own wins, and names the synonym it replaces (Issue 0192).
  `raise` is the term for putting a unit on the table — `recruit` and `addUnit` are gone.
