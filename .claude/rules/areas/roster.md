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
  (`optionsCollector.js` — membership and order, no visibility), the cost-type labels and the
  counting/modifier machinery that only `queryEngine.js`/`selectionFactory.js` still feed on.
  Evaluation is **not** part of it: violations, availability, costs, profiles, visibility and the
  static entry classification all come from the report (ADR-0034).
- `src/roster/` is **structural only** — it never judges a roster (ADR 0011). A rule check that
  creeps in here duplicates the evaluator and will drift from it.
- Gone with Issue 0157, do not resurrect: `entryVisibility.js`, `profileCollector.js`,
  `armyWideSelectors.js`, `listRules.js`, and `rosterCounter.js`'s `getOptionDisplayCost` /
  `calculateRosterCosts` / `getExtraResourceTotals`. Their answers live in `src/evaluation/`
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
- `src/roster/` still holds a legacy `no-circular` warning (`modifierEvaluator → queryEngine →
  rosterCounter`). It is a warning by design; do not add a second one.
