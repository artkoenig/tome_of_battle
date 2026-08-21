# src/ui/hooks — suite doc

Unit tests for the app's React hooks — `useRosterList`, `useAppData`, `useAppNavigation`, `usePlayState`, `usePwaLifecycle`,
`useRuleUrl`, `useToast`, `useUndoableState`, `useViewportHeight`. Framework:
vitest + `@testing-library/react` (`renderHook`, `act`), plain
`describe`/`it`. Run the whole directory: `forge-test --run src/ui/hooks`; a single
file: `forge-test --run src/ui/hooks/<file>.test.js`.

## Conventions

- Test titles (the `describe`/`it` strings) are English in this directory
  (unlike `src/domain/roster`/`src/domain/evaluator`, which use German) — follow the
  sibling test files. Code comments are English.
- Naming: `useX.test.js` for a hook's own unit tests; `useX.<topic>.test.js`
  for a case that isolates one topic through the hook's public surface.
- The roster state node and everything that drives it through the production
  seam live in `src/ui/viewmodels/` (`useRosterState.*.test.js`), not here.
