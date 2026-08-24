---
paths:
  - "scripts/project-state/**"
---

# scripts/project-state

The state-report generator (`generate.js`) and its pure modules (`gates.js`, `graph.js`,
`buildReportModel.js`, `renderReport.js`, `coverage.js`, `complexity.js`, `functions.js`,
`issues.js`, `loc.js`, `tsSource.js`), each with its own `*.test.js`.

- `GATE_DEFINITIONS` in `gates.js` is the single source of the quality-gate ids, labels and
  displayed commands (`lint`, `knip`, `cast`, `typecheck`, `unit-tests`, `maintainability`). The
  structure gate is `cast` (`cast check --root .`), not `depcruise` — dependency-cruiser was
  removed in Issue 0180. Renaming or adding a gate id here means updating every test fixture that
  keys a `gateRuns`/`runs` object by gate id (`gates.test.js`, `buildReportModel.test.js`,
  `renderReport.test.js`) — `buildGateStates`/`buildReportModel` default to the real
  `GATE_DEFINITIONS`, so a stale id in a fixture silently produces `undefined` instead of a gate.
- `generate.js` resolves the `cast` binary the same way `forge-lint` does:
  `command -v cast`, else `${CLAUDE_PLUGIN_ROOT}/bin/cast` (see `.claude/rules/areas/cast.md`).
  The resolution snippet lives once as `CAST_RESOLVE_SNIPPET` and is reused for both the `cast`
  gate override and the separate `cast scan` call.
- The import graph is read via `cast scan --root .` (`CAST_GRAPH=<tmp path>` pins where it writes
  the graph file, then the run reads that file back), not via a gate's stdout — `cast check`
  (the gate) and `cast scan` (the graph source) are two different invocations, unlike the old
  single dependency-cruiser call that produced both a verdict and the JSON graph at once.
- `graph.js`'s `buildImportGraph`/`findCycles`/`findLayerViolations` are pure and tested, but
  `generate.js` does not currently wire their output into `buildReportModel` — the scanned graph
  text is fetched and returned from `executeGates()` but stays unused downstream. This predates
  Issue 0180 and is not this area's bug to fix on sight.
- The worktree this generator runs in needs its own `node_modules` (`npm ci`) and a resolvable
  `cast` binary — git worktrees do not inherit either from the main checkout.
