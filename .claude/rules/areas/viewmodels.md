---
paths:
  - "src/viewmodels/**"
---

# viewmodels

The ViewModel layer of ADR-0038: hooks that hold state and derive display values, plus the two
roster contexts. It sits **above** `src/components/` in the UI layer of ADR-0037 — a ViewModel may
never import a component. Run it with `forge-test --run src/viewmodels`.

- `useRosterState.js` is the editor's one state node: roster, UI selection and commands, returned
  in three bundles split by how often they change (`commands`, `report`, selection). `useRoster` in
  `src/hooks/` is only the flat 21-field view onto it and exists until every component reads from
  the contexts — change the behaviour here, not there.
- The `commands` bundle is identity-stable for the hook's whole lifetime: the implementations are
  rebuilt every render into `currentCommandsRef`, and the exported functions are thin `useMemo(…,
  [])` wrappers that call through the ref. Returning a freshly built command object (or memoizing
  it on `roster`/`capabilities`) silently breaks the promise of `RosterCommandsContext` and is the
  one thing a change here is most likely to get wrong; `useRosterState.test.js` and
  `rosterContexts.test.jsx` both pin it.
- Proving "does not render again" needs a `memo`-wrapped consumer. Without `memo` a consumer
  re-renders because its parent did, and the test proves nothing about the context.
- `rosterContexts.jsx` passes `commands` through **unchanged**; only the report context memoizes
  its bundle. Both hooks throw when no provider is above them — that is the contract, not a
  convenience. Any tree that renders an editor leaf therefore needs both providers, including the
  play view (`PlayMode.jsx` wraps its tree for `UnitChips`).
- The report context carries `{ report, roster, system, activeCatalogue }`. `system` is the frame a
  ViewModel resolves detail texts and catalogue structure in, never a display answer (ADR-0034);
  `activeCatalogue` is derived from `roster.catalogueId` unless the provider is handed one.
- `src/viewmodels/editor/` holds one hook per editor leaf (`useUnitCard`, `useOptionGroup`,
  `useSelectionConfigurator`, `useUnitChips`) and one per section (`useForceSection`,
  `useCategorySection`, `useRecruitOffer`, `useListRuleChecklist`, `useAutoFillSuggestions`,
  `useRosterSidebar`, `useValidationPanel`). A ViewModel may not import
  `components/editor/upgradeDetails.jsx` (it returns JSX): it hands the component the resolved
  entry and `system`, and the component renders the detail block.
- The report derivations `evaluation/listRuleGroups.js`, `armyWideSelectorSlots.js` and
  `violationStats.js` are read **here only** — the dependency-cruiser rule
  `ableitungen-nur-in-viewmodels` fails `forge-lint` on an import of them from `src/components/`.
  The cost-budget helpers (`costBudgetTextsOf`, `hasExceededCostBudget`) live in
  `useSelectionConfigurator.js` next to the other row derivations it shares with `useOptionGroup`;
  the former `costBudgets.js` is gone.
- A section ViewModel derives what the editor used to thread through as props: `costTypeLabel`
  from `roster`+`system`, `remainingPoints` from `roster.costLimit` minus `report.costTotals`,
  `extraResources` from `description.costTypes`, and the sidebar's force path from
  `report.pathByForceId` (never the roster's input index). What stays a prop is only what the
  caller knows: `force`/`forceId`, `forcePath`, `categoryLink`/`categoryId` and display state.
  `src/components/editor/sectionPropCount.test.js` pins the ceilings.
- `useAutoFillSuggestions` filters twice, and both halves are load-bearing: the slot **path** must
  lie in the force's subtree (`path === forcePath` or `` `${forcePath}/` `` prefix), and the slot's
  **frame** must be the force itself or a path in the roster-wide `pathBySelectionId` inverse (an
  option on an existing selection). The frame check alone leaks slots hanging on another force's
  units into this force's panel — `pathBySelectionId` is roster-wide, so a second force's
  selections pass it; the test `ein Slot an einer Auswahl eines anderen Kontingents ist kein
  Vorschlag` pins the subtree half.
- `useValidationPanel` reads `report.violations` **without** a `?? []` fallback on purpose: a
  missing list is a broken report and must fail loudly rather than read as "all clear"
  (`RosterEditor.test.jsx` pins the throw).
- A section component's own tests go through `src/test-utils/harnesses/<Component>Harness.jsx` —
  one file per component, not one shared module: a test that mocks `lucide-react` only partially
  would otherwise fail on the icons of a component it never renders. `sectionHarnessBase.jsx`
  holds the shared pieces, including the inversions a flat prop set needs (`costTypeLabel` → a
  cost-type declaration, `remainingPoints` → limit + totals, `extraResources` → description cost
  types, list-rule `states` → a capabilities map plus the entries in a catalogue).
- `useOptionGroup` imports `optionDescriptionOf`, `resolveRowSelectionId` and `subSelectionCountOf`
  from `useSelectionConfigurator.js` — the configurator owns the row derivations both share.
- An option row's description comes from `capability.infoElements` only. The old name-based lookup
  against `system.sharedRules` + every catalogue took the first same-named hit and confused two
  rules from different catalogues; do not reintroduce it (`useSelectionConfigurator.test.jsx` pins
  the case).
- The report the context carries is `useRosterReportModel` from `src/evaluation/rosterReport.js`
  (App evaluation + `unresolvedSelections`), referentially stable per `(system, roster)` on top of
  the WeakMap in `evaluationCache.js`. Any new derived field belongs in that bundle, memoized, or
  it destroys the stability every consumer depends on.
- Files here use the classic JSX runtime: a `.jsx` file (and its test) must `import React` or it
  fails at runtime with `React is not defined`, not at lint time.
- A test that needs a real report loads a fixture catalogue with `fs.readFileSync` +
  `processImportedData` and `buildRoster` (see `useRosterState.test.js`) — roughly 2 s per case.
  Where the case is about state or context only, pass `system = null`: the evaluation is then the
  frozen empty result and the test runs instantly.
- `src/test-utils/rosterProviders.jsx` seeds both providers (`renderWithRosterProviders`,
  `createRosterProviderWrapper` for `renderHook`, `createEmptyRosterReport`,
  `createNoopRosterCommands`) so a component still renders in isolation. Extend the empty report
  there when the report gains a field.
- A hook test here builds its report by hand (`new Map()` of slots) and runs instantly; only pin
  what the derivation does, not what the engine computes. Where the hand-built system does not
  resolve the frame, `getUnitOptions` returns nothing and the configurator's safety net keeps every
  group anchor as an empty section — expect those sections in an assertion over `sections`.
