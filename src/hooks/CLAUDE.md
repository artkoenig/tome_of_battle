# src/hooks — suite doc

Unit tests for the app's React hooks — `useRoster` (the roster read/write hook
and its wiring to the evaluator, ADR-0022/0034), `useRosterList`,
`useAppData`, `useAppNavigation`, `usePlayState`, `usePwaLifecycle`,
`useRuleUrl`, `useToast`, `useUndoableState`, `useViewportHeight`. Framework:
vitest + `@testing-library/react` (`renderHook`, `act`), plain
`describe`/`it`. Run the whole directory: `forge-test --run src/hooks`; a single
file: `forge-test --run src/hooks/<file>.test.js`.

## Conventions

- Test titles (the `describe`/`it` strings) are English in this directory
  (unlike `src/roster`/`src/evaluator`, which use German) — follow the
  sibling `useRoster.*.test.js` files. Code comments are English.
- A `useRoster` file that drives the hook through the **production seam** —
  real catalogue XML, unmocked `resolveEntry`/`createSelectionFromDef`, the
  real `useEvaluation` — loads its fixture with `fs.readFileSync` +
  `processImportedData` and builds the fresh roster with `buildRoster`
  (`src/utils/createRoster.js`); nothing about the roster or the catalogue is
  hand-built. See `useRoster.costedMandatoryAutoAdd.test.js` (synthetic
  catalogue built to a real entry's exact shape) and
  `useRoster.nestedMandatoryGroups.test.js` (a real fixture catalogue, read
  from `src/evaluator/__fixtures__/whfb6-definitive/`) for the two shapes this
  takes: synthetic-but-shape-faithful where the point is one rule in
  isolation, real fixture data where the point is a named catalogue entry.
- `isFreshRoster` (the hook's fifth argument) gates the automatic mandatory
  list-rule addition (Issue 0138/0140, §9.9) — omit it (or pass `false`) to
  keep that effect out of a case that means to test only `addUnit` or another
  seam in isolation; pass `true` only where the fresh-roster auto-add itself
  is the point.
- `addUnit(entry, categoryId, targetForceId?)` is the hook's own recruitment
  call — the one the recruit dialog makes. A case that measures what
  recruiting produces calls it inside `act(...)` and reads
  `result.current.roster.forces[0].selections`, never a lower-level factory
  call directly (that belongs in `src/roster`).
- Naming: `useX.test.js` for a hook's own unit tests; `useX.<topic>.test.js`
  for a case that isolates one topic through the hook's public surface (e.g.
  `useRoster.mandatoryAutoAdd.test.js`, `useRoster.nestedMandatoryGroups.test.js`).
