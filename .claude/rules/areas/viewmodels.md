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
  its `{ report, roster }` pair. Both hooks throw when no provider is above them — that is the
  contract, not a convenience.
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
  `createEmptyRosterReport`, `createNoopRosterCommands`) so a component still renders in isolation.
  Extend the empty report there when the report gains a field.
