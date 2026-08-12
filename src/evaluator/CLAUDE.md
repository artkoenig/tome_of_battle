# src/evaluator — suite doc

Unit and layer tests for the Reinraum evaluator engine (ADR 0030). Framework:
vitest, plain `describe`/`it`, German titles. Run the whole directory:
`npx vitest run src/evaluator`; a single file: `npx vitest run
src/evaluator/<file>.test.js`. The same directory also holds the
manifest-driven black-box E2E runner (`e2e.testcatalog.test.js`,
`crossCatalog.test.js`) over the scenarios committed under `docs/testing/` —
that runner and its scenarios are a separate authorship track (see
`docs/agents/e2e-testcase-author.md`, ADR 0033) and not part of what this doc
covers.

## Conventions

- A file that parses XML installs `globalThis.DOMParser = new
  JSDOM().window.DOMParser` at module top — the engine's own XML reader needs
  this primitive under Node. Most do (76 of the 88 test files here); the rest
  build their structures directly and need no parser.
- Drive the engine only through its public facade: `prepareDataset` +
  `evaluate` from `./evaluator.js` (re-exported from `./datasetPreparation.js`
  and the evaluation entry point). A layer test that needs an intermediate
  structure builds it explicitly instead — `PreparedDataset.contentsOf(...)`,
  `buildEvalTree`, `attachOfferAnchors`, `buildIndex`,
  `createBaseEffectiveState` — see `offer.test.js` and
  `countIndex.syntheticAnchors.test.js` for the pattern. Assert against the
  returned report (`report.capabilities`, `report.violations`) or the tree/
  index the layer call returns; never against internal engine state no public
  path reaches.
- Nothing is mocked or stubbed anywhere in this suite. A file's catalogue is
  either a minimal synthetic XML template string built inline (the default —
  isolates one rule per case) or, where the point is real catalogue data, read
  from the frozen fixtures at `src/evaluator/__fixtures__/whfb6-definitive`
  via `readFileSync` (memoise `prepareDataset(...)` across a file's cases when
  it parses a real fixture — see the `preparedVampireCounts`/
  `vampireCountsDataset` pattern in `offer.hiddenGate.test.js` and
  `effectiveState.baseHiddenInheritance.test.js` — the fixture parse dominates
  runtime and a shared suite run can hit the 5 s test timeout without it).
- A corpus-invariant check parses a fixture's raw XML itself, with `new
  DOMParser().parseFromString(xml, 'text/xml')` at the top of the file, to
  derive its own expectation from the catalogue data — never from an engine
  module other than the facade. This is a different use of `DOMParser` than
  the module-top `globalThis.DOMParser` install: the file's own parse builds
  the check's expectation, the facade's internal parse (through
  `prepareDataset`) builds what is asserted against. See
  `evaluator.corpusLinkLocalChildren.test.js` (Issue 0150) for the pattern:
  index every element with an `id` from the fixture documents, derive the
  occurrences from that index at module top level (cheap — only the engine's
  own `prepareDataset` needs the `beforeAll` memoisation), and read the
  report through the same `capabilities` path-schema every other real-fixture
  file uses (`evaluate`'s JSDoc, `evaluator.js`).
- Naming: `<module>.test.js` for a module's own unit tests;
  `<module>.<topic>.test.js` for a layer test that isolates one topic through
  the module's public surface (e.g. `countIndex.costSumCarrierFrame.test.js`,
  `offer.hiddenGate.test.js`). A case belongs in the file whose module owns
  the rule it pins, at the narrowest layer that can observe the rule — reach
  for the full facade (`evaluate`) only when the rule is about the report
  shape itself or needs a real fixture; reach for the tree/index layer calls
  when the rule is internal to that layer's contract (e.g. "no synthetic
  anchor is ever counted").
- Each `it()` pins one rule; a synthetic catalogue is usually built inline per
  case (see the `MANDATORY_OPTION_ID` case in `offer.test.js`) or via a small
  per-file catalogue-factory helper reused across a file's cases (see
  `catalogueWith` in `offer.hiddenGate.test.js`, `heroCatalogue` in
  `countIndex.costSumCarrierFrame.test.js`). Prefer the factory once three or
  more cases share the same skeleton.
- A case that pins existing, already-correct behaviour as a regression guard
  is marked `KONTROLLE:` (or `PIN (heute gruen)` in a code comment) in its
  title — it is expected to pass already; that is the point of it.
- Test titles (the `describe`/`it` strings) are German throughout; a new case
  keeps that convention, to read next to its siblings. Explanatory code
  comments are a mix of older German and newer English; write new ones in
  English.
