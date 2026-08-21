# src/ui/viewmodels — suite doc

Unit tests for the ViewModel layer (ADR-0038): the screen and overlay ViewModels, the
editor hooks under `editor/`, the roster state node `useRosterState.*`, and the app-level
derivation and state hooks that moved here with Issue 0178 — `useRosterList`, `useAppData`,
`useAppNavigation`, `usePlayState`, `usePwaLifecycle`, `useRuleUrl`, `useToast`,
`useUndoableState` ([ADR 0013](../../../docs/adr/0013-generischer-undo-redo-hook.md)),
`useViewportHeight`, plus the shared `persistenceFailure` helper. Framework: vitest +
`@testing-library/react` (`renderHook`, `act`), plain `describe`/`it`. Run the whole
directory: `forge-test --run src/ui/viewmodels`; a single file:
`forge-test --run src/ui/viewmodels/<file>.test.js`.

## Conventions

- Test titles (the `describe`/`it` strings) are English in this directory
  (unlike `src/domain/roster`/`src/domain/evaluator`, which use German) — follow the
  sibling test files. Code comments are English.
- Naming: `useX.test.js` for a hook's own unit tests; `useX.<topic>.test.js`
  for a case that isolates one topic through the hook's public surface.
- A topic file that drives the **production seam** loads real catalogue XML with
  `fs.readFileSync` + `processImportedData` and builds the roster with `buildRoster`;
  nothing about roster or catalogue is hand-built (`useRosterState.*.test.js` is the
  pattern).
- Every module here has a test file next to it, and no file exceeds 300 lines
  (Issue 0176/0177).
