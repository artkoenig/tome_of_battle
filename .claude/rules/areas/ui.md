---
paths:
  - "src/components/**"
  - "src/hooks/**"
  - "src/styles/**"
  - "src/i18n/**"
---

# UI, hooks, styles, i18n

- Most `.jsx` files are paired 1:1 with a `.test.jsx` next to them. A new component without its
  pair is an incomplete change.
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
