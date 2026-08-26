# src/contexts/armylist/model — suite doc

Unit tests for the app's write model (ADR 0022/0023): the selection factory,
sub-selection editing, the tree helpers, catalogue resolution (`resolveEntry`/
`findEntryInSystem`), catalogue sync, and the cost-type labels in `costTypeLabels.js`. Anything the
report answers (costs, visibility, profiles, list rules, entry classification
and **which members a raise creates**) is **not** tested here — it lives in `src/contexts/ruleengine/`
and the evaluator engine below it. Framework: vitest, plain `describe`/`it`. Run the whole
directory: `forge-test --run src/contexts/armylist/model`; a single file: `forge-test --run src/contexts/armylist/model/<file>.test.js`.

## Conventions

- Test titles (the `describe`/`it` strings) are German; explanatory code
  comments are English (older files carry German comments — write new ones in
  English).
- Nothing is mocked here beyond a stub `resolveEntry` a file builds itself
  (see `makeResolver` in `selectionFactory.test.js`, `createSystem` +
  `resolveEntry` from `catalogResolver.js`)
  — resolving links/entries by id against an inline fixture, never a mock of
  the module under test or of a sibling module.
- A catalogue fixture is a generic, schema-shaped object literal built inline
  per file or per case (ADR-0003) — `selectionEntries`/`entryLinks`/
  `selectionEntryGroups` with the same field names the real `.cat`/`.gst`
  parser produces. Real catalogue data (the engine's `__fixtures__/
  whfb6-definitive/`, `src/tests/__fixtures__/whfb6/`) is read only where the point
  of the case is that real data, not a schema shape — see
  `src/ui/viewmodels/useRosterState.nestedMandatoryGroups.test.js` (a `src/ui/viewmodels` file, but
  the pattern for loading a fixture `.gst`/`.cat` and parsing it for real is
  the one to follow: `fs.readFileSync` + `processImportedData`, never a mock
  of the parser).
- A group can nest another group (`selectionEntryGroup.selectionEntryGroups`)
  at any depth — the real shape of e.g. `Wizard Level` inside `Magic` inside
  `Zacharias the Everliving`. A case that pins depth-independent behaviour
  builds that nesting explicitly rather than flattening it, and names the real
  entry it mirrors in a comment where it does.
- Which members a mandatory group contributes is no longer decided here: the
  report answers it (`capability.raiseMembers`), and the rule is pinned in
  the engine's `costProjection.raiseMembers.test.js` (Issue 0157). What
  belongs in `selectionFactory.test.js` is the other half — that a reported id
  finds its catalogue object, through groups and group links, in any depth.
  The estimate a user sees before raising is the report's `raiseCosts` from
  the same walk; that it agrees with the raised selection's `totalCosts` is
  pinned in
  `src/tests/ui/viewmodels/useRosterState.raiseCostAgreement.test.js`.
- A case that needs a cost total reads `evaluateAppRoster(system, roster)` —
  `costTotals` roster-wide, `totalCosts`/`raiseCosts` per slot. There is no
  cost arithmetic left in this directory to call.
- Naming: `<module>.test.js` for a module's own unit tests;
  `<module>.<topic>.test.js` for a case that isolates one topic (e.g.
  `costTypeLabels.costTypeSelection.test.js`,
  `selectionMembers.test.js`). A case belongs in the file whose
  module owns the rule it pins.
- A case that pins existing, already-correct behaviour as a regression guard
  reads as a plain assertion beside the new cases — no `KONTROLLE:` marker is
  in use in this directory (unlike the evaluator engine); the surrounding
  `describe` title says what changed and what did not.
