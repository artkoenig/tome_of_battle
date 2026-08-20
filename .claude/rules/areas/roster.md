---
paths:
  - "src/roster/**"
  - "src/evaluation/**"
  - "src/db/**"
---

# Write model, bridge and persistence

`src/roster/` builds and rewrites the selection tree. `src/evaluation/` translates it for the
evaluator. `src/db/` persists it in IndexedDB.

- What `src/roster/` still is: catalogue resolution (`catalogResolver.js`), the selection factory
  and sub-selection editing, the tree helpers, catalogue sync, the option **structure** collector
  (`optionsCollector.js` — membership and order, no visibility) and the cost-type labels
  (`costTypeLabels.js`). Evaluation is **not** part of it, and since Issue 0157 no module here
  performs any: violations, availability, costs, profiles, visibility, the static entry
  classification **and the obligation a raise carries** all come from the report (ADR-0034).
  Nothing in this folder counts a roster, evaluates a modifier or resolves a query any more.
- `src/roster/` is **structural only** — it never judges a roster (ADR 0011). A rule check that
  creeps in here duplicates the evaluator and will drift from it.
- Gone with Issue 0157, do not resurrect: `entryVisibility.js`, `profileCollector.js`,
  `armyWideSelectors.js`, `listRules.js`, `modifierEvaluator.js`, `queryEngine.js`,
  `modifierContext.js`, and with them the whole of `rosterCounter.js` (`getSelectionOwnCosts` /
  `getSelectionTotalCost` / `computeRosterCounts` / `aggregateRosterCategoryCounts`, next to the
  earlier `getOptionDisplayCost` / `calculateRosterCosts` / `getExtraResourceTotals`). What is
  left of that file is `costTypeLabels.js` — the cost-type id and its label, nothing else. Their answers live in `src/evaluation/`
  (`listRuleGroups.js`, `mandatoryListRules.js`, `costDisplays.js`, `slotLookups.js`) reading the
  report. A test that needs a roster cost total uses `evaluateAppRoster(system, roster).costTotals`.
- `getUnitOptions` takes no visibility context any more: it yields raw catalogue structure and the
  caller asks the report whether a slot is hidden.
- No import of `src/evaluator/**` from `src/roster/**`, in either direction; the rule is blocking
  in `forge-lint`. Anything that needs both belongs in `src/evaluation/`.
- `src/roster/index.js` is a convenience barrel, not an enforced facade — do not rely on it to hide
  a module.
- `evaluateAppRoster` in `src/evaluation/` is the single memoized seam; adding a second call path
  into the evaluator silently defeats `evaluationCache.js`.
- A change to the persisted shape in `src/db/database.js` needs a migration — existing users carry
  their IndexedDB across releases (ADR 0002).
- The only automatic, choice-free write into a roster is `useRoster.js`'s fresh-roster effect over
  `findMissingMandatoryListRules` (`src/evaluation/`, report-driven) — gated on `isFreshRoster`,
  ohne Undo-Schritt. Alles, was dort hineingerät, erscheint für den Nutzer aus dem Nichts auf
  Kontingent-Ebene. Der Bericht hängt die **Wurzel-Pflicht-Phantome an die Wurzel, nicht ans
  Kontingent** — ein Leser, der nur `childSlotsOf(forcePath)` fragt, sieht genau die §9.9-Regeln
  nicht, um die es geht.
- Anzeige-Felder, die `src/evaluation/` aus dem Bericht ableitet, sieht keine der grossen Suiten:
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
- The reading of "which children must this slot create" changed with it, and two shapes it now
  covers were previously wrong here: a member with its own `min` inside a group without one is
  mandatory (this is what left the corpus with ~73 unfulfilled obligations after a recruit), and
  a **hidden** obligation is none — its MIN limit is not validated, so the raise neither creates
  nor prices it.
