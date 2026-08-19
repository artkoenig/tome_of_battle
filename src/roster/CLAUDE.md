# src/roster — suite doc

Unit tests for the app's write model (ADR 0022/0023): the selection factory,
sub-selection editing, the tree helpers, catalogue resolution (`resolveEntry`/
`findEntryInSystem`), catalogue sync, and the display-cost helpers in
`rosterCounter.js`. Framework: vitest, plain `describe`/`it`. Run the whole
directory: `npx vitest run src/roster`; a single file: `npx vitest run
src/roster/<file>.test.js`.

## Conventions

- Test titles (the `describe`/`it` strings) are German; explanatory code
  comments are English (older files carry German comments — write new ones in
  English).
- Nothing is mocked here beyond a stub `resolveEntry` a file builds itself
  (see `makeResolver` in `selectionFactory.test.js`, `createSystem` +
  `resolveEntry` from `catalogResolver.js` in `rosterCounter.mandatoryGroupDefault.test.js`)
  — resolving links/entries by id against an inline fixture, never a mock of
  the module under test or of a sibling module.
- `listRules.js` has both styles, in separate files: `listRules.test.js` and
  `listRules.mandatoryState.test.js` mock `./catalogResolver.js` and
  `./entryVisibility.js` file-wide (older style, established first);
  `listRules.mandatoryPredicate.test.js` and `listRules.sharedOnlyLock.test.js`
  drive the same functions against a real, inline `{ id, catalogues: [{ id,
  selectionEntries, entryLinks, sharedSelectionEntries,
  sharedSelectionEntryGroups }] }` system with both collaborators unmocked. A
  new case joins whichever style its file already uses; it never mixes the two
  in one file (a mocked collector would decide the outcome instead of the
  production code it is meant to test).
- A catalogue fixture is a generic, schema-shaped object literal built inline
  per file or per case (ADR-0003) — `selectionEntries`/`entryLinks`/
  `selectionEntryGroups` with the same field names the real `.cat`/`.gst`
  parser produces. Real catalogue data (`src/evaluator/__fixtures__/
  whfb6-definitive/`, `src/__fixtures__/whfb6/`) is read only where the point
  of the case is that real data, not a schema shape — see
  `src/hooks/useRoster.nestedMandatoryGroups.test.js` (a `src/hooks` file, but
  the pattern for loading a fixture `.gst`/`.cat` and parsing it for real is
  the one to follow: `fs.readFileSync` + `processImportedData`, never a mock
  of the parser).
- A group can nest another group (`selectionEntryGroup.selectionEntryGroups`)
  at any depth — the real shape of e.g. `Wizard Level` inside `Magic` inside
  `Zacharias the Everliving`. A case that pins depth-independent behaviour
  builds that nesting explicitly rather than flattening it, and names the real
  entry it mirrors in a comment where it does.
- `createSelectionFromDef` (`selectionFactory.js`) and `getOptionDisplayCost`
  (`rosterCounter.js`) share one rule for which option a mandatory group
  contributes (SSOT, ADR-0022, `selectionMembers.js`'s `resolveGroupDefaultMember`):
  a test that pins a group's mandatory-population shape belongs in
  `selectionFactory.test.js`; a test that pins the estimate shown before
  recruiting belongs in `rosterCounter.mandatoryGroupDefault.test.js`, and
  where a case is about the two staying in agreement, it recruits through
  `createSelectionFromDef` and compares against `getSelectionTotalCost` of the
  result, not against a hand-computed number.
- Naming: `<module>.test.js` for a module's own unit tests;
  `<module>.<topic>.test.js` for a case that isolates one topic (e.g.
  `rosterCounter.mandatoryGroupDefault.test.js`,
  `selectionFactory.effectiveMin.test.js`). A case belongs in the file whose
  module owns the rule it pins.
- A case that pins existing, already-correct behaviour as a regression guard
  reads as a plain assertion beside the new cases — no `KONTROLLE:` marker is
  in use in this directory (unlike `src/evaluator/`); the surrounding
  `describe` title says what changed and what did not.
