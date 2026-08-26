---
status: backlog
branch:
pr:
---

# React leaves the rule engine's read model

## Goal

Finding T5 of [`docs/ddd-review-2026-08.md`](../ddd-review-2026-08.md), **with a different measure
than the review proposes**. `src/contexts/ruleengine/readmodel/useEvaluation.js:37` and
`src/contexts/ruleengine/readmodel/rosterReport.js:14` both `import { useMemo } from 'react'`. They
are the only two modules under `src/contexts/`, `src/platform/`, `src/shared/` that name React, and
neither uses anything but `useMemo` — no state, no effect, no subscription, nothing that depends on
React's render lifecycle. A bounded context depends on the UI framework for a service it already
provides itself.

**The review's rationale was half wrong and its measure was wrong twice; do not follow it.** The
read model *is* usable outside React today — `evaluateAppRoster` is on the door at
`readmodel/index.js:14` and `unresolvedSelectionsOf`, the only thing `rosterReport.js` adds, at
`:23`; the `.ros` export path the review cited as a victim (`useRosterList.js:10,38,248`) already
imports from the facade, not from `acl/`. Moving the hooks into `src/ui/viewmodels/` would put the
report bundle *in* the UI layer and make the complaint true. And the proposed cast rule
`kontexte -> react` **is not expressible**: `cast check` skips every edge whose
`resolution !== 'module'` and a bare `react` import resolves to `external`, so naming the specifier
does not help either.

**The sharpened finding is that both hooks are redundant.** `evaluateAppRoster` is already memoised
by WeakMap over `(system, roster)` (`acl/evaluationCache.js:82,138-157`) and returns a frozen shared
constant for the empty case (`:90-96`), so `useEvaluation.js:51` buys nothing beyond two
`WeakMap.get` calls per render — its own file header says the WeakMap layer survives a view change
that "throws every `useMemo` away". `rosterReport.js` genuinely needs a cache (`unresolvedSelectionsOf`
returns a fresh `[]`, and the spread at `:46` builds a fresh object), but a WeakMap keyed on the
evaluation object gives the same guarantee and a **stronger** one: shared across mounts instead of
per-instance.

So: delete `useEvaluation.js`; turn `rosterReport.js` into a pure `rosterReportOf(system, roster)`
cached in a `WeakMap<AppEvaluation, RosterReport>` (the evaluation object is unique per
`(system, roster)`, and the one shared key `EMPTY_RESULT` always yields an empty
`unresolvedSelections`, so sharing that entry is correct). React leaves the context and **nothing
moves** — the modules stay put, so their mirrored tests stay put too. Only two production call
sites change: `usePlayRoster.js:4,97` → `evaluateAppRoster`, `useRosterState.js:30,84` →
`rosterReportOf`. The name follows the folder's `…Of` convention and `docs/glossary.md`'s `report`
row, so no glossary change.

**The gate is `.oxlintrc.json`, and it has a trap that must be handled deliberately.** oxlint's
later override *replaces* the earlier `no-restricted-imports` config for the same file rather than
merging it (measured on oxlint 1.80.0 against probe files). A contexts-wide react block placed
**before** the `src/contexts/ruleengine/**` block does not fire for `readmodel/` — precisely the
folder this issue is about; placed **after** it, the react ban fires everywhere but the existing
`armylist/model -> ruleengine` and `ruleengine -> armylist` bans silently stop firing. The `paths`
entry must therefore be added to **each** existing contexts override *and* one new contexts-wide
block inserted for the folders none of them match. `no-restricted-imports` is `error`, so
`npm run lint` exits non-zero and it is a real gate; `.oxlintrc.json` turns the rule off for
`src/**/*.test.js(x)`, so tests are unaffected. Add the source-reading guard test as well, the same
belt-and-braces the repo already uses for a boundary cast cannot see
(`src/tests/ui/catalogVocabulary.test.js`).

No version bump: nothing a user can see changes.

## Acceptance criteria

- AC1: No module under `src/contexts/`, `src/platform/`, `src/shared/` imports React. | verify: `bash -c '! grep -rqn "from .react" src/contexts/ src/platform/ src/shared/'`
- AC2: `useEvaluation.js` is gone; `readmodel/index.js` exports `rosterReportOf` and `evaluateAppRoster` and nothing React-shaped. | verify: `bash -c 'test ! -e src/contexts/ruleengine/readmodel/useEvaluation.js && grep -q rosterReportOf src/contexts/ruleengine/readmodel/index.js && ! grep -q "export { use" src/contexts/ruleengine/readmodel/index.js'`
- AC3: The gate fails when React comes back **in `readmodel/`** — the folder a naive override would shadow. | verify: `bash -c 'printf "import { useMemo } from \x27react\x27;\nexport const p = useMemo;\n" > src/contexts/ruleengine/readmodel/__reactProbe.js; npm run lint; rc=$?; rm src/contexts/ruleengine/readmodel/__reactProbe.js; test $rc -ne 0'`
- AC4: The gate also fails in a context none of the specific overrides match. | verify: `bash -c 'printf "import { useMemo } from \x27react\x27;\nexport const p = useMemo;\n" > src/contexts/catalog/__reactProbe.js; npm run lint; rc=$?; rm src/contexts/catalog/__reactProbe.js; test $rc -ne 0'`
- AC5: The pre-existing boundary bans still fire after the `.oxlintrc.json` edit — this guards the override-replacement trap. | verify: `bash -c 'printf "import { evaluateAppRoster } from \x27../../ruleengine/readmodel/index.js\x27;\nexport const p = evaluateAppRoster;\n" > src/contexts/armylist/model/__probe.js; npm run lint; rc=$?; rm src/contexts/armylist/model/__probe.js; test $rc -ne 0'`
- AC6: The source-reading second gate exists and is green. | verify: `forge-test --run src/tests/contexts/frameworkFreedom`
- AC7: The report bundle is identity-stable per `(system, roster)` across separate calls, not merely across rerenders. | verify: `forge-test --run src/tests/contexts/ruleengine/rosterReport`
- AC8: The evaluation cache contract is unchanged — one `prepareDataset` per system, one report per pair, frozen empty result, corrected slot and force paths. | verify: `forge-test --run src/tests/contexts/ruleengine`
- AC9: Editor and play mode still work off the report, in the suite and in the real app. | verify: `bash -c 'forge-test --run src/tests/ui && node e2e/ui.test.js'`
- AC10: Whole suite, lint (incl. cast) and types. | verify: `bash -c 'forge-test && forge-lint && forge-typecheck'`
- AC11: No dead export left behind. | verify: `npm run knip`
- AC12: The rules and the project map name the survivors, not the deleted hooks. | verify: `bash -c '! grep -rqn "useRosterReportModel\|readmodel/useEvaluation" .claude/ docs/project-map.md'`

## Out of scope

- The stale path in `docs/adr/0002-data-flow-and-indexeddb-storage.md:30`
  (`src/domain/evaluation/useEvaluation.js`, two renames out of date). Flag it; it belongs to the
  documentation-corrections issue.
- Historic issue records under `docs/issues/` — they are a record, left as written.
- The `useMemo`s in `src/ui/viewmodels/` — they are in the right layer.
- Any change to what the report *contains*.
- Teaching cast to see external edges (an upstream plugin change).

## Open questions

1. `rosterReportOf` returns one object to every caller for a given evaluation, where the hook
   returned one per mount. Nothing mutates a report today and `evaluateAppRoster`'s result was
   already shared this way, but it is a real widening. `Object.freeze` on the bundle is cheap —
   worth it?
2. After the rename nothing stops a future edit from reimplementing memoisation by hand inside
   `rosterReportOf`, and `react/rules-of-hooks` no longer applies because the name does not start
   with `use`. AC1/AC3 cover the import only. Accepted?
3. `src/tests/ui/components/PlayMode.ruleLinks.test.jsx:69-77` mocks
   `readmodel/useEvaluation`; it must be repointed at `acl/evaluationCache` (not at the door, which
   would blank `costLimitTypeIdOf` and `extraResourceTotalsOf`). Check whether `describeSystem`
   needs stubbing there too.
