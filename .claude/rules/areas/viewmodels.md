---
paths:
  - "src/viewmodels/**"
---

# viewmodels

The ViewModel layer of ADR-0038: hooks that hold state and derive display values, plus the two
roster contexts. It sits **above** `src/components/` in the UI layer of ADR-0037 — a ViewModel may
never import a component. Run it with `forge-test --run src/viewmodels`.

- `useRosterState.js` is the editor's one state node: roster, UI selection and commands, in three
  bundles split by how often they change. `useRoster` in `src/hooks/` is only the flat view onto
  it — change the behaviour here, not there.
- The `commands` bundle is identity-stable for the hook's whole lifetime: implementations are
  rebuilt each render into `currentCommandsRef`, the exported functions are `useMemo(…, [])`
  wrappers calling through it. Returning a freshly built command object (or memoizing it on
  `roster`) silently breaks `RosterCommandsContext` and is the mistake a change here is most
  likely to make; `useRosterState.test.js` and `rosterContexts.test.jsx` pin it.
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
  banned in `src/components/**` by an oxlint `no-restricted-imports` override (severity `error`,
  so it fails `forge-lint`) — every effect and every memo of a screen lives here.
  Adding an override for a components path there means repeating the evaluator-facade `patterns`
  block: oxlint replaces a rule's config per override rather than merging it.
- A ViewModel may **not** import `src/db/` or `src/parser/`: `viewmodel-keine-datenschicht` is
  an `error` and fails `forge-lint`, and since Issue 0167 without any exception — the three
  shell ViewModels `useRosterEditor`, `usePlayRoster` and `useImporter` run through
  `src/services/` like everything else.
- `viewmodel-kein-jsx` (`src/viewmodels/` → `src/components/`) is an `error` too, so the "never
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
- `src/viewmodels/editor/` holds one hook per editor leaf (`useUnitCard`, `useOptionGroup`,
  `useSelectionConfigurator`, `useUnitChips`) and one per section (`useForceSection`,
  `useCategorySection`, `useRecruitOffer`, `useListRuleChecklist`, `useAutoFillSuggestions`,
  `useRosterSidebar`, `useValidationPanel`). A ViewModel may not import
  `components/editor/upgradeDetails.jsx` (it returns JSX): it hands the component the resolved
  entry and `system`, and the component renders the detail block.
- The report derivations `evaluation/listRuleGroups.js`, `armyWideSelectorSlots.js` and
  `violationStats.js` are read **here only** — `ableitungen-nur-in-viewmodels` fails `forge-lint`
  on an import of them from `src/components/`. The cost-budget helpers live in
  `useSelectionConfigurator.js` next to the row derivations it shares with `useOptionGroup`.
- A section ViewModel derives what the editor used to thread through as props (`costTypeLabel`,
  `remainingPoints`, `extraResources`, the force path from `report.pathByForceId` — never the
  roster's input index). What stays a prop is only what the caller knows: `force`/`forceId`,
  `forcePath`, `categoryLink`/`categoryId` and display state;
  `src/components/editor/sectionPropCount.test.js` pins the ceilings.
- `useAutoFillSuggestions` filters twice, and both halves are load-bearing: the slot **path** must
  lie in the force's subtree (`path === forcePath` or `` `${forcePath}/` `` prefix) **and** its
  frame must be the force or a path in `pathBySelectionId`. The frame check alone leaks another
  force's slots into this panel (`pathBySelectionId` is roster-wide); the test `ein Slot an einer
  Auswahl eines anderen Kontingents ist kein Vorschlag` pins the subtree half.
- `useValidationPanel` reads `report.violations` **without** a `?? []` fallback on purpose: a
  missing list is a broken report and must fail loudly rather than read as "all clear"
  (`RosterEditor.test.jsx` pins the throw).
- A section component's own tests go through `src/test-utils/harnesses/<Component>Harness.jsx` —
  one file per component, not one shared module: a partial `lucide-react` mock would otherwise
  fail on the icons of a component it never renders. `sectionHarnessBase.jsx` holds the shared
  pieces, including the inversions a flat prop set needs (`costTypeLabel`, `remainingPoints`,
  `extraResources`, list-rule `states`).
- `useOptionGroup` imports `optionDescriptionOf`, `resolveRowSelectionId` and `subSelectionCountOf`
  from `useSelectionConfigurator.js` — the configurator owns the row derivations both share.
- An option row's description comes from `capability.infoElements` only. The old name-based lookup
  against `system.sharedRules` confused two same-named rules from different catalogues; do not
  reintroduce it (`useSelectionConfigurator.test.jsx` pins the case).
- The report the context carries is `useRosterReportModel` (`src/evaluation/rosterReport.js`),
  referentially stable per `(system, roster)`. A new derived field belongs in that bundle,
  memoized, or it destroys the stability every consumer depends on.
- Files here use the classic JSX runtime: a `.jsx` file (and its test) must `import React` or it
  fails at runtime with `React is not defined`, not at lint time.
- A test that needs a real report loads a fixture catalogue with `fs.readFileSync` +
  `processImportedData` and `buildRoster` — roughly 2 s per case. Where the case is about state or
  derivation only, pass `system = null`: the evaluation is the frozen empty result and runs
  instantly.
- `src/test-utils/rosterProviders.jsx` seeds both providers (`renderWithRosterProviders`,
  `createRosterProviderWrapper`, `createEmptyRosterReport`, `createNoopRosterCommands`). Extend
  the empty report there when the report gains a field.
- A hook test here builds its report by hand (`new Map()` of slots) and runs instantly; pin what
  the derivation does, not what the engine computes. Where the hand-built system resolves no
  frame, `getUnitOptions` returns nothing and the configurator keeps every group anchor as an
  empty section — expect those in an assertion over `sections`.
- `editor/selectionBehavior.js` is the one **display** classifier of an option row
  (`classifyGroupItem`, `classifyStandaloneOption`: mandatory/met, radio, binary, stepper). It is
  pure and takes only values the report already measured — it re-reads no catalogue. The
  catalogue-side twin of those questions lives once, in the report
  (`src/evaluator/groupBehavior.js`); a second reading here would drift from it.
