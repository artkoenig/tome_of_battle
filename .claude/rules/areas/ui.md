---
paths:
  - "src/components/**"
  - "src/hooks/**"
  - "src/styles/**"
  - "src/i18n/**"
---

# UI, hooks, styles, i18n

- This directory is the **UI layer** of ADR 0037 (`UI → Fachlogik → Daten`, the arrow is the
  allowed direction). It reaches data only through `src/services/`; a direct import of `src/db/`
  or `src/parser/` fails `forge-lint` on the dependency-cruiser rule `ui-nicht-auf-daten`
  (`error` since Issue 0167 moved the last 14 edges onto the facade — there is no exception left).
- `src/hooks/useAppData.js` is the **only** subscriber of the facade's change channel
  (`services/dataEvents.js`): a write through `src/services/` announces itself there and the one
  roster list follows. A screen that wants to see a foreign save subscribes nowhere — it reads
  the list it already gets.
- `useAppData` keeps the **start run** and the **re-entry** apart, and they must stay apart:
  `runStartupLoad` (mount effect only) reads the DB, runs the start migration and the network
  catalog refresh; `reloadData` — the one it hands out, and what `useRosterList` gets as its
  `reloadData` — reads IndexedDB and nothing else. Hanging the start run off an event that repeats
  (a nav click, a save) re-parses every stored catalogue and drops the evaluation cache with it.
- Navigation in `App.jsx` therefore reloads **nothing**: switching a view only navigates. The
  systems are already in state and roster writes arrive over the data channel.
- Most `.jsx` files are paired 1:1 with a `.test.jsx` next to them. A new component without its
  pair is an incomplete change.
- **The ViewModel pattern (ADR-0038), and it is blocking since Issue 0166.** Every UI building
  block is two files: the component here, JSX only, and its ViewModel next to it in
  `src/viewmodels/` (leaves and sections under `src/viewmodels/editor/`, mirroring the component
  tree). The ViewModel holds the state, reads the report and hands down finished display values;
  the component takes them as props and renders markup. A new component **without** its ViewModel
  pair is an incomplete change, the same way a missing `.test.jsx` is — the 22-prop signature and
  the derivations in the render came back every time the pattern was only a recommendation.
  - Which hook belongs where: `useState`, `useRef` and `useCallback` stay allowed in a component
    — an expanded sheet, a focus ref and a stable handler are presentation state. `useEffect`,
    `useLayoutEffect` and `useMemo` are **forbidden** here and belong in the ViewModel; that is
    where every effect, every derivation and every subscription lives. In `src/viewmodels/` all
    of them are allowed.
  - Four rules keep it, all `error`, all failing `forge-lint`: the oxlint
    `no-restricted-imports` override on `src/components/**` (the hook ban), and in
    `.dependency-cruiser.cjs` `viewmodel-kein-jsx` (`src/viewmodels/` → `src/components/`),
    `komponente-kein-bericht` (`src/components/` → `src/evaluation/`, `src/evaluator/`) and
    `viewmodel-keine-datenschicht` (`src/viewmodels/` → `src/db/`, `src/parser/`). The last one
    carries one named, closing exception: the three shell ViewModels `useRosterEditor`,
    `usePlayRoster` and `useImporter`, whose direct data edges Issue 0167 moves onto
    `src/services/`.
  - So a component never imports the report itself. It gets it through its ViewModel, which reads
    the two roster contexts.
- The four editor leaves (`UnitSelectionCard`, `SelectionConfigurator`, `OptionGroup`, `UnitChips`)
  are JSX only (ADR-0038): their derivations live in `src/viewmodels/editor/`, and they read the
  report through the two roster contexts instead of `capabilities`/`pathBySelectionId` props. A
  parent that renders one must sit under both providers — `RosterEditor.jsx` and `PlayMode.jsx`
  open them.
- The section level above them (`ForceEditorSection`, `RosterCategorySection`, `CategoryUnitAdder`,
  `ListRuleChecklist`, `AutoFillSuggestions`, `RosterSidebar`, `RosterValidationPanel`) follows the
  same rule since Issue 0164: no derivation in the render, one ViewModel each in
  `src/viewmodels/editor/`, both contexts instead of a flat prop set. Their tests take a harness
  from `src/test-utils/harnesses/`, one file per component.
- Since Issue 0165 the five screen shells (`RosterEditor`, `PlayMode`/`play/PlayUnitDetails`,
  `RosterDashboard`, `Importer`, `editor/NewRosterModal`) and the two overlays
  (`editor/BottomSheet`, `RulesIndexDialog`) do too. Timer, DOM-listener and body-scroll effects
  count as effects too, and go into the screen's ViewModel like any other.
- `Importer` takes the installed systems as a `systems` prop from `App` — the one list of
  `useAppData`. It must never read `getAllSystems` itself; a second list drifted from the first
  and a fresh import stayed invisible in the editor. Its test file therefore hands the list in
  (`renderImporter` + `installedSystems`) rather than mocking the DB read.
- "No derivation in the render" and "few props" are claims about the **source**, not the screen: a
  filter or sort put back into a component renders the same DOM and passes every behaviour test.
  Such a rule is pinned by a source-reading test next to the component
  (`sectionPropCount.test.js`, `CategoryUnitAdder.noRenderDerivation.test.js` — read the `.jsx`
  with `fs`, assert on the prop list, on the imports, and on the bindings between the ViewModel
  call and the JSX). Dependency-cruiser only covers the module edges it names, never a local
  derivation.
- A test that renders one of those leaves goes through `src/test-utils/editorHarness.jsx`: the
  harnesses take the **old** flat prop set (`capabilities`, `pathBySelectionId`, `system`,
  `activeCatalogue`, the commands, a directly handed `capability`) and wire the providers, so a
  test file only swaps its import. Extend a harness rather than building providers per call site.
- Hover and detail callbacks travel as one `tooltip` prop (`{ onEnter, onMove, onLeave, onOpen }`)
  from the card down through the configurator into every group.
- Styling is 33 numbered CSS layer files under `src/styles/`, loaded in cascade order (ADR 0004
  §6). Put a rule in the layer its number describes; a component-local style that fights the
  cascade is the usual cause of a "mysteriously overridden" property.
- Text never appears literally in a component: it goes through `src/i18n/` (own solution, no
  library, ADR 0026) with entries in both `locales/de.json` and `locales/en.json`. A missing `en`
  key does not fail a test — it fails silently for the user.
- The Puppeteer app E2E (`node e2e/ui.test.js`) is outside `forge-test`. Run it by hand for a
  change here; it is what catches a view that no longer renders.
- After a user-visible change, take a screenshot of the affected view and send it to the user
  (skip it when the session runs on the user's own machine): `node
  scripts/generate_screenshots.js` runs offline against the frozen fixture and needs no catalog
  data. For a one-off investigation build a throwaway script on `scripts/lib/e2e-harness.js` —
  it offers the browser console log, a DOM dump and a headed browser.
- A display question is answered by the report, never by a second catalogue walk (ADR-0034): the
  slot fields carry `isListRule`, `isMandatoryListRule`, `isIndependentSubUnit`,
  `isForeignCatalogue`, `isSingleChoice`/`isMaxRaisable`/`isRepeatableWithinGroup`, plus
  `isHidden`, `primaryCategoryId` and the info projection `infoElements`. Read them
  through `src/evaluation/slotLookups.js` (`slotOfSelection`, `isIndependentSubUnitSlot`,
  `childSlotsOf`, `findCategoryAnchorSlot`, `hasUnitSlotsInCategory`), or through the derivations
  next to it (`listRuleGroups.js`, `armyWideSelectorSlots.js`).
  `resolveEntry`/`findEntryInSystem` stay only for detail texts and
  for the entry the **write** path hands to `addUnit`.
- The **write** path asks the report too (Issue 0157): what recruiting an entry creates is
  `capability.raiseMembers` of its offer slot — `useRoster` looks it up (`findChildSlot` under the
  force, `findDescendantSlot` under a unit, since an option hangs below its group anchor) and
  hands it to the factory. Nothing in `src/roster/` derives an obligation from the catalogue any
  more, so a seam that recruits without a report creates a bare selection.
- Whether a category section appears is two report answers, both on the force's slots: the
  `categoryAnchor`'s `isHidden` (hidden plus nothing selected → no section) and whether any
  `occupied`/`offerAnchor`/`mandatoryPhantom` slot names the category as its `primaryCategoryId`
  (none and nothing selected → a rule keyword, no section). A hand-built `capabilities` fixture
  that omits either makes the whole section vanish.
- Profiles and rule texts of a card, its chips and the play view all come from one place —
  `capability.infoElements` (`kind: 'profile' | 'rule'`) — so the chip filter ("this upgrade is
  already in a table") matches the table by profile **id**. A component that resolves its slot
  from `capabilities` + `pathBySelectionId` also accepts a directly handed `capability`; pass it
  down to `UnitUpgradesChips`/`UnitRulesChips`, or the chips find no table and stop filtering.
- A component test that hand-builds a `capabilities` Map must carry those fields too — a missing
  one reads as `false` and silently changes what renders (a sub-unit loses its card, a checklist
  becomes a unit list). Give every slot of the fixture the fields its screen reads.
- The repo language is mixed by intent: docs, issues and commit messages in German, code and
  identifiers in English.
