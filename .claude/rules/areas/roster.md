---
paths:
  - "src/domain/roster/**"
  - "src/domain/evaluation/**"
  - "src/data/db/**"
---

# Write model, bridge and persistence

`src/domain/roster/` builds and rewrites the selection tree. `src/domain/evaluation/` translates it for the
evaluator. `src/data/db/` persists it in IndexedDB.

- What `src/domain/roster/` still is: catalogue resolution (`catalogResolver.js`), the selection factory
  and sub-selection editing, the tree helpers, catalogue sync, the option **structure** collector
  (`optionsCollector.js` — membership and order, no visibility), the cost-type labels
  (`costTypeLabels.js`), the `.ros` serialization (`rosterSerialization.js`) and the roster
  factory plus its defaults (`createRoster.js`, `rosterDefaults.js`, here since Issue 0169
  dissolved `src/utils/`). Evaluation is **not** part of it, and since Issue 0157 no module here
  performs any: violations, availability, costs, profiles, visibility, the static entry
  classification **and the obligation a raise carries** all come from the report (ADR-0034).
  Nothing in this folder counts a roster, evaluates a modifier or resolves a query any more.
- `src/domain/roster/` is **structural only** — it never judges a roster (ADR 0011). A rule check that
  creeps in here duplicates the evaluator and will drift from it.
- Gone with Issue 0157, do not resurrect: `entryVisibility.js`, `profileCollector.js`,
  `armyWideSelectors.js`, `listRules.js`, `modifierEvaluator.js`, `queryEngine.js`,
  `modifierContext.js`, and with them the whole of `rosterCounter.js` (`getSelectionOwnCosts` /
  `getSelectionTotalCost` / `computeRosterCounts` / `aggregateRosterCategoryCounts`, next to the
  earlier `getOptionDisplayCost` / `calculateRosterCosts` / `getExtraResourceTotals`). What is
  left of that file is `costTypeLabels.js` — the cost-type id and its label, nothing else. Their answers live in `src/domain/evaluation/`
  (`listRuleGroups.js`, `mandatoryListRules.js`, `costDisplays.js`, `slotIndex.js`) reading the
  report. A test that needs a roster cost total uses `evaluateAppRoster(system, roster).costTotals`.
- The report's slot side is **one** value object since Issue 0170: `SlotIndex`
  (`slotIndex.js`) holds `capabilities` + `pathBySelectionId` + `pathByForceId` and carries the
  former `slotLookups.js` functions as methods (plus `slotAt`/`pathOfSelection`/`pathOfForce` and
  `resolvedDefIdOf` beside it). `AppEvaluation` exposes it as `report.slots`; the three maps are no
  longer report fields and nothing passes them around separately.
- `SlotIndex.fromMaps({...})` is the one seam a hand-built fixture goes through, and it
  **validates**: every capability must declare `isHidden`, `isIndependentSubUnit` (booleans) and
  `primaryCategoryId` (string or null) — a missing one used to read as `false` and silently change
  what renders. `fromReport` (production) checks nothing; the engine fills those for every slot.
  Tests reach `fromMaps` through `createEmptyRosterReport` (`src/shared/test-utils/rosterProviders.jsx`),
  which still takes the three maps flat.
- `evaluate` in the evaluator facade has its own identity cache (WeakMap over
  `(prepared, evalRoster)`, `{ measure: true }` bypasses it). It does **not** help the app path:
  `toEvaluatorRoster` builds a fresh `evalRoster` per call, so `evaluationCache.js` stays the seam.
- `src/domain/evaluation/` must not import `src/domain/roster/` (oxlint, `error`). The helper that resolves a
  capability back to its catalogue entry for the write path therefore lives in
  `src/ui/viewmodels/capabilityEntries.js` (`findCapabilityEntry`/`capabilityEntryOf`), not here.
- `getUnitOptions` takes no visibility context any more: it yields raw catalogue structure and the
  caller asks the report whether a slot is hidden.
- No import of `src/domain/evaluator/**` from `src/domain/roster/**`, in either direction; the rule is blocking
  in `forge-lint`. Anything that needs both belongs in `src/domain/evaluation/`.
- `src/domain/roster/index.js` is a convenience barrel, not an enforced facade — do not rely on it to hide
  a module. A re-export nobody imports makes `npm run knip` red; import from the module directly
  and drop the barrel line in the same change.
- The folder is Fachlogik and therefore **translates nothing** (`keine-i18n-unter-ui`, `error`
  since Issue 0169). An error carries `messageKey`/`messageParams` (`MissingSystemError`,
  `RosterFileError` from `src/data/services/rosterTransfer.js`); `describeRosterFileError` in
  `src/ui/hooks/useRosterList.js` is the one place that formulates them. A test here asserts on the
  key, never on German text.
- `rosterSerialization.js` reads the report (`evaluateAppRoster`) for names and costs and only
  produces/consumes XML **text**. Packing and unpacking the `.rosz` archive is file I/O and lives
  in `src/data/services/rosterTransfer.js` (`readRosterText`/`buildRosterFile`); the two are composed
  in `useRosterList.js`, because the data layer may not reach back into this one.
- A UI behaviour model does not belong here: `classifyGroupItem`/`classifyStandaloneOption` moved
  to `src/ui/viewmodels/editor/selectionBehavior.js` with Issue 0169. The catalogue-side answers to
  the same questions live once, in the report (`src/domain/evaluator/groupBehavior.js`).
- Gone with Issue 0169 as well, do not resurrect: `battlescribeConstants.js` (`isCostField`,
  `isEntryScope`, `isSharedQuery`, `isRosterLimitField` — scope/shared reading is the evaluator's),
  `someSelectionInSubtree`/`countSelectionsInSubtree` und `effectiveCountOf` in `rosterTree.js`,
  `findEntryInCatalogue` in `catalogResolver.js` (Auflösung geht immer über `findEntryInSystem`
  mit der Katalog-Id als Kontext, ADR 0032), and the profile
  extractors beside `groupProfilesByType`. `rulesEvaluator.js` is now `profileGrouping.js` — the
  name says what it does, and nothing in it evaluates.
- `evaluateAppRoster` in `src/domain/evaluation/` is the single memoized seam; adding a second call path
  into the evaluator silently defeats `evaluationCache.js`.
- `evaluationCache.js` caches on **three** levels, all WeakMaps over object identity: the prepared
  dataset per system object, the description per prepared dataset, and the whole report per
  `(system, roster)` pair. So anything that hands the app a *new* system object — a re-parse, a
  catalog update, a fresh read from IndexedDB — throws all three away. That is why the start
  migration must not re-parse a system it has no reason to re-parse.
- A stored system carries `parserVersion` (`src/data/parser/parserVersion.js`), stamped by
  `processImportedData`, i.e. on every path into the DB: file import, bundle import, catalog
  update. `runSystemMigrations` re-parses only where the marker differs from `PARSER_VERSION`, and
  passes an up-to-date system through **by identity**. Change what `src/data/parser/` makes of the same
  XML and you must raise `PARSER_VERSION` — otherwise users keep the old parse forever. A system
  from before the marker has none, differs, and is re-parsed exactly once.
- A change to the persisted shape in `src/data/db/database.js` needs a migration — existing users carry
  their IndexedDB across releases (ADR 0002).
- The only automatic, choice-free write into a roster is `useRoster.js`'s fresh-roster effect over
  `findMissingMandatoryListRules` (`src/domain/evaluation/`, report-driven) — gated on `isFreshRoster`,
  ohne Undo-Schritt. Alles, was dort hineingerät, erscheint für den Nutzer aus dem Nichts auf
  Kontingent-Ebene. Der Bericht hängt die **Wurzel-Pflicht-Phantome an die Wurzel, nicht ans
  Kontingent** — ein Leser, der nur `childSlotsOf(forcePath)` fragt, sieht genau die §9.9-Regeln
  nicht, um die es geht.
- Anzeige-Felder, die `src/domain/evaluation/` aus dem Bericht ableitet, sieht keine der grossen Suiten:
  die Evaluator-E2E prueft den Bericht, nicht seine Uebersetzung. `listRuleGroups.js` (`checked`,
  `mandatory`, `isContainer`, `isBinary` fuer `ListRuleChecklist.jsx`) haengt allein an
  `listRuleGroups.test.js` mit handgebauter `capabilities`-Map. Wer hier ein Feld ergaenzt,
  behauptet es dort - sonst faellt es in der Oberflaeche lautlos aus, bei gruener Suite.
- What a raise creates is the report's answer, not the catalogue's: `capability.raiseMembers`
  (`defId`/`targetDefId`/`count`/nested `members`) comes from the same walk as `raiseCosts`
  (`costProjection.js`), so the price and the tree it prices cannot diverge. `selectionFactory.js`
  only **resolves** those ids against the catalogue — through groups and group links, in any
  depth (`selectionMembers.js`'s `findMemberDefById`). A recruit path without a report (a test
  system with no `rawXmls`) therefore creates a bare selection; that is the contract, not a bug.
- The reading of "which children must this slot create" moved, it did not change: the recruited
  tree is the same for all 208 units of the fixture corpus, pinned by
  `src/domain/evaluation/recruitTree.frozenCorpus.test.js` against a frozen dump of the pre-0157 factory.
  A group without a `min` still obliges nothing (even where a member declares one), a `min` a link
  inherits from its shared target obliges nothing, and a **hidden** obligation is created like any
  other. The corpus therefore still shows ~73 unfulfilled obligations on 32 cards after a recruit
  (`SelectionConfigurator.mandatoryObligation.fixtureSweep.test.jsx`) — closing that gap is a
  user-visible change and needs its own issue.
