# src/evaluator — suite doc

Vitest. Run the whole suite alone: `npx vitest run src/evaluator` (this also
runs the manifest-driven E2E runner `e2e.testcatalog.test.js` over the
scenarios under `docs/testing/`). Run one file alone:
`npx vitest run src/evaluator/<file>.test.js`.

## Facade under test

A test for a rule of the engine's observable behaviour drives the public facade
— `prepareDataset` + `evaluate` from `./evaluator.js` — while tests that pin one
module's internal contract (`query.matrix.test.js`, `fixpoint.test.js`,
`resolver.test.js`, `countIndex.*.test.js`) import that module directly. A
file-local `evaluate` helper wraps the two-stage call:

```js
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}
```

Default to a small synthetic catalogue XML string built inline in the test
file, because it keeps a failure pointing at the one rule under test. Reach for
the frozen WHFB6 corpus at `src/evaluator/__fixtures__/whfb6-definitive/` when
the rule under test is about a real catalogue's idiom;
`modifiers.setWithRepeat.test.js`, `offer.hiddenGate.test.js`,
`effectiveState.baseHiddenInheritance.test.js`,
`report.authorMessageAnchors.test.js`,
`evaluator.primaryCatalogueFixture.test.js`,
`evaluator.unitAncestorFixture.test.js`,
`evaluator.ergofangForeignMandates.test.js` and
`evaluator.describeDataset.test.js` set that precedent. A corpus-backed test is
integration level and says so in its top comment.

`docs/testing/` holds a different thing: `.ros` rosters plus `scenario.json`,
driven by the manifest runner `e2e.testcatalog.test.js`.

The jsdom environment configured in `vitest.config.js` provides `DOMParser`,
the same primitive the engine's own XML reader takes as a global. A new test
needs no jsdom setup of its own; the header most files here carry predates the
global config and is not a pattern to copy:

```js
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
```

Assert `expect(report.diagnostics).toEqual([])` where a broken fixture would
otherwise be indistinguishable from the missing behaviour you claim to be
testing for. Most files here carry no such assertion, so its absence in a
neighbouring file is not a signal.

## Reading the report

`report.capabilities` is a `Map` keyed by a child-index path (e.g. `"0/1"`),
never by definition id — look a slot up through a local helper, not the map
key:

- occupied (really selected) slot of a definition id:
  `capability.defId === defId && capability.anchorKind === AnchorKind.OCCUPIED`.
- offer anchor (offered, not yet selected) of a definition id:
  `anchorKind === AnchorKind.OFFER_ANCHOR`.
- category anchor of a category id, matched by `targetDefId`, not `defId`:
  `anchorKind === AnchorKind.CATEGORY_ANCHOR && targetDefId === categoryId`.
- mandatory phantom slot (a required entry that is entirely absent from the
  roster): `anchorKind === AnchorKind.MANDATORY_PHANTOM`.

`AnchorKind` and `MessageSeverity` come from `./model.js`.

`report.violations` is a flat list; filter it by `limitId`. Where a shared
limit can report through more than one anchor, assert the firing (at least
one violation, every one carrying the expected `actual`/`bound`) rather than
an exact count — how many anchors a shared limit reports through is report
form, not counting semantics (see `expectFiring` in
`constraints.carrierDescendants.test.js` and
`report.occupancyWithoutLimit.test.js`).

## Fixtures

`src/evaluator/__fixtures__/` holds shared modules — import them, and never
re-implement `.ros` parsing or the report filters in a test file:

- `rosParser.js` — `rosterFromRos`, which translates a Battlescribe `.ros` file
  into the `{ forces: [{ defId, count, children }] }` instance tree the facade
  expects, purely structurally (it carries a force's `catalogueId` through as
  well).
- `e2eReport.js` — the report readers `violationsOf`, `violationOf` and
  `diagnosticsMatching`.
- `whfb6-definitive/` — the frozen WHFB6 corpus: the `.cat` army books plus
  `Warhammer Fantasy Battles (6th definitive edition).gst`.

The catalogue XML of a rule test is built inline in its own `describe` block,
isolating the one rule under test. A shared WHFB6-style catalogue would make a
failure ambiguous — which of a dozen categories broke? Reuse the `entryLink` +
`sharedSelectionEntries`/`sharedSelectionEntryGroups`
pattern for "reached through two different carriers" cases (see
`constraints.carrierDescendants.test.js`, `report.effectiveCategories.test.js`,
`report.occupancyWithoutLimit.test.js`).

## Naming and placement

File name: `<module>.<gap-or-rule>.test.js` for a file that pins one focused
gap or rule (e.g. `report.occupancyWithoutLimit.test.js`); the plain
`<module>.test.js` files hold the base contract of that module. A new case for
an existing rule goes in the file that already pins that rule; a genuinely new
rule gets its own file. `describe` names the rule under test in prose; `it`
names the concrete case and, where it guards a past regression or a boundary,
says so.

## What's real, what's faked

The XML reader, resolver, evaluator and report are the real production
modules — nothing here is mocked. `DOMParser` comes from the jsdom environment
configured in `vitest.config.js`, because the engine expects the browser
primitive and the suite runs under Node.
