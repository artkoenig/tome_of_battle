---
paths:
  - "src/ui/components/**"
  - "src/ui/styles/**"
  - "src/ui/i18n/**"
---

# UI, components, styles, i18n

- This directory is the **UI layer** of ADR 0037 (`UI → Fachlogik → Daten`, the arrow is the
  allowed direction). It reaches data only through `src/contexts/*/application/`; a direct import of `src/platform/persistence/`
  or `src/platform/battlescribe/` is caught by the cast rule `ui-nicht-auf-daten` (`.cast/rules.json`).
  Issue 0167 moved the last 14 edges onto the facade, so the rule finds nothing today; since the
  port to cast (ADR 0041) — `error` since Issue 0181, so `forge-lint` fails on a new edge.
- Navigation in `App.jsx` therefore reloads **nothing**: switching a view only navigates. The
  systems are already in state and roster writes arrive over the data channel.
- Most `.jsx` files are paired 1:1 with a `.test.jsx` next to them. A new component without its
  pair is an incomplete change.
- **The ViewModel pattern (ADR-0038), and it is blocking since Issue 0166.** Every UI building
  block is two files: the component here, JSX only, and its ViewModel next to it in
  `src/ui/viewmodels/` (leaves and sections under `src/ui/viewmodels/editor/`, mirroring the component
  tree). The ViewModel holds the state, reads the report and hands down finished display values;
  the component takes them as props and renders markup. A new component **without** its ViewModel
  pair is an incomplete change, the same way a missing `.test.jsx` is — the 22-prop signature and
  the derivations in the render came back every time the pattern was only a recommendation.
  - Which hook belongs where: `useState`, `useRef` and `useCallback` stay allowed in a component
    — an expanded sheet, a focus ref and a stable handler are presentation state. `useEffect`,
    `useLayoutEffect` and `useMemo` are **forbidden** here and belong in the ViewModel; that is
    where every effect, every derivation and every subscription lives. In `src/ui/viewmodels/` all
    of them are allowed.
  - Four rules keep it. Only the oxlint `no-restricted-imports` override on
    `src/ui/components/**` (the hook ban) still fails `forge-lint`; the three module-edge rules
    in `.cast/rules.json` are `error` since Issue 0181 and block just as well: `viewmodel-keine-komponente` (`src/ui/viewmodels/` → `src/ui/components/`),
    `komponente-kein-bericht` (`src/ui/components/` → `src/contexts/ruleengine/`, `src/contexts/ruleengine/engine/`) and
    `viewmodel-keine-datenschicht` (`src/ui/viewmodels/` → `src/platform/persistence/`, `src/platform/battlescribe/`). The last one
    carries one named, closing exception: the three shell ViewModels `useRosterEditor`,
    `usePlayRoster` and `useImporter`, whose direct data edges Issue 0167 moves onto
    `src/contexts/*/application/`.
  - So a component never imports the report itself. It gets it through its ViewModel, which reads
    the two roster contexts.
- The four editor leaves (`UnitSelectionCard`, `SelectionConfigurator`, `OptionGroup`, `UnitChips`)
  are JSX only (ADR-0038): their derivations live in `src/ui/viewmodels/editor/`, and they read the
  report through the two roster contexts instead of `capabilities`/`pathBySelectionId` props. A
  parent that renders one must sit under both providers — `RosterEditor.jsx` and `PlayMode.jsx`
  open them.
- The section level above them (`ForceEditorSection`, `RosterCategorySection`, `CategoryUnitAdder`,
  `ListRuleChecklist`, `AutoFillSuggestions`, `RosterSidebar`, `RosterValidationPanel`) follows the
  same rule since Issue 0164: no derivation in the render, one ViewModel each in
  `src/ui/viewmodels/editor/`, both contexts instead of a flat prop set. Their tests take a harness
  from `src/tests/test-utils/harnesses/`, one file per component.
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
  call and the JSX). cast only covers the module edges its rules name, never a local
  derivation.
- A test that renders one of those leaves goes through `src/tests/test-utils/editorHarness.jsx`: the
  harnesses take the **old** flat prop set (`capabilities`, `pathBySelectionId`, `system`,
  `activeCatalogue`, the commands, a directly handed `capability`) and wire the providers, so a
  test file only swaps its import. Extend a harness rather than building providers per call site.
- Hover and detail callbacks travel as one `tooltip` prop (`{ onEnter, onMove, onLeave, onOpen }`)
  from the card down through the configurator into every group.
- Styling is 33 numbered CSS layer files under `src/ui/styles/`, loaded in cascade order (ADR 0004
  §6). Put a rule in the layer its number describes; a component-local style that fights the
  cascade is the usual cause of a "mysteriously overridden" property.
- Text never appears literally in a component: it goes through `src/ui/i18n/` (own solution, no
  library, ADR 0026) with entries in both `locales/de.json` and `locales/en.json`. A missing `en`
  key does not fail a test — it fails silently for the user.
- `describeRosterFileError` in `viewmodels/useRosterList.js` is the only place that turns a
  `messageKey`/`messageParams`/`detail` error from `src/contexts/armylist/model/` or `src/contexts/*/application/` into
  text. A test of that path mocks those modules with `importOriginal()` spread (`vi.mock(mod, async (importOriginal) =>
  ({ ...await importOriginal(), fn: vi.fn() }))`) so `MissingSystemError`/`RosterFileError` stay
  real and carry their keys, and asserts on the German toast text — a hand-built error with a
  ready-made `message` passes even when the translation step is gone.
- The Puppeteer app E2E (`node e2e/ui.test.js`) is outside `forge-test`. Run it by hand for a
  change here; it is what catches a view that no longer renders.
- After a user-visible change, take a screenshot of the affected view and send it to the user
  (skip it when the session runs on the user's own machine): `node
  scripts/generate_screenshots.js` runs offline against the frozen fixture and needs no catalog
  data. For a one-off investigation build a throwaway script on `scripts/lib/e2e-harness.js` —
  it offers the browser console log, a DOM dump and a headed browser.
- **A component consumes our vocabulary, never the catalogue's** (Issue 0191). No module under
  `src/ui/` may name `selectionEntries`, `entryLinks`, `categoryLinks`, `sharedSelectionEntries`,
  `infoLinks` or `targetId`, and none may import the BattleScribe schema kernel
  `src/shared/battlescribe/` — the cast rule `ui-kein-fremdformat` holds the module edge, the
  source-reading test `src/tests/ui/catalogVocabulary.test.js` holds the vocabulary (cast sees
  edges, not identifiers). What the UI needs from a catalogue entry it asks the list context's
  anti-corruption layer `src/contexts/armylist/acl/` (`forceCategoriesOf`, `offerDefIdsOf`,
  `offerIdentifiesSlot`, `childOffersOf`, `childOfferCountOf`), whose mapping rules stand in
  `catalogTranslation.js` — the counterpart of the evaluator's `rosterAdapter.js`. A force offers
  **categories** `{ id, name, anchorIds }`, not `categoryLinks`: `id` is the target, `name` is
  already resolved against `system.categoryEntries`, and `anchorIds` carries both ids the report
  may anchor the category under. Before adding a function there, check the report first — a
  question the slot index answers (ADR-0034) is not translated a second time.
- A display question is answered by the report, never by a second catalogue walk (ADR-0034): the
  slot fields carry `isListRule`, `isMandatoryListRule`, `isIndependentSubUnit`,
  `isForeignCatalogue`, `isSingleChoice`/`isMaxRaisable`/`isRepeatableWithinGroup`, plus
  `isHidden`, `primaryCategoryId` and the info projection `infoElements`. Read them
  through `report.slots`, the `SlotIndex` of `src/contexts/ruleengine/readmodel/slotIndex.js` (`slotOfSelection`,
  `isIndependentSubUnitSlot`, `childSlotsOf`, `findCategoryAnchorSlot`, `hasUnitSlotsInCategory`),
  or through the derivations next to it (`listRuleGroups.js`, `armyWideSelectorSlots.js`), which
  take that index rather than a bare `capabilities` map.
  `resolveEntry`/`findEntryInSystem` stay only for detail texts and
  for the entry the **write** path hands to `addUnit`.
- The **write** path asks the report too (Issue 0157): what recruiting an entry creates is
  `capability.raiseMembers` of its offer slot — `useRosterState` looks it up (`findChildSlot` under the
  force, `findDescendantSlot` under a unit, since an option hangs below its group anchor) and
  hands it to the factory. Nothing in `src/contexts/armylist/model/` derives an obligation from the catalogue any
  more, so a seam that recruits without a report creates a bare selection.
- Whether a category section appears is two report answers, both on the force's slots: the
  `categoryAnchor`'s `isHidden` (hidden plus nothing selected → no section) and whether any
  `occupied`/`offerAnchor`/`mandatoryPhantom` slot names the category as its `primaryCategoryId`
  (none and nothing selected → a rule keyword, no section). A hand-built `capabilities` fixture
  that omits either used to make the whole section vanish; since Issue 0170
  `SlotIndex.fromMaps` rejects such a slot outright.
- Profiles and rule texts of a card, its chips and the play view all come from one place —
  `capability.infoElements` (`kind: 'profile' | 'rule'`) — so the chip filter ("this upgrade is
  already in a table") matches the table by profile **id**. A component that resolves its slot
  from the report's `slots` index also accepts a directly handed `capability`; pass it
  down to `UnitUpgradesChips`/`UnitRulesChips`, or the chips find no table and stop filtering.
- A component test that hand-builds a `capabilities` Map must carry `isHidden`,
  `isIndependentSubUnit` and `primaryCategoryId` on every slot — `SlotIndex.fromMaps` (through
  `createEmptyRosterReport`/the harnesses) throws otherwise, instead of letting a missing field read
  as `false` and silently change what renders (a sub-unit loses its card, a checklist becomes a
  unit list). Give every slot of the fixture the fields its screen reads.
- The repo language is mixed by intent: docs, issues and commit messages in German, code and
  identifiers in English.
