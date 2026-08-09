# src/evaluator — test suite conventions

Vitest. Run the whole suite alone: `npx vitest run src/evaluator` (this also
runs the manifest-driven E2E runner `e2e.testcatalog.test.js` over the
scenarios under `docs/testing/`). Run one file alone:
`npx vitest run src/evaluator/<file>.test.js`.

## Facade under test

A test for a rule of the engine's observable behaviour drives the public facade
— `prepareDataset` + `evaluate` from `./evaluator.js` — over a small synthetic
catalogue XML string built inline in the test file, while tests that pin one
module's internal contract (`query.matrix.test.js`, `fixpoint.test.js`,
`resolver.test.js`, `countIndex.*.test.js`) import that module directly. Never the real WHFB6 fixtures for a unit-level rule; those back
the E2E scenarios under `docs/testing/` instead. A file-local `evaluate`
helper wraps the two-stage call:

```js
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}
```

`globalThis.DOMParser` is installed from jsdom at the top of every file that
parses catalogue XML — files that touch no XML (`budget.test.js`,
`rounding.test.js`, `causes.test.js`) need it not (the engine's own XML reader
needs this browser primitive under Node):

```js
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
```

A test that evaluates a synthetic catalogue asserts
`expect(report.diagnostics).toEqual([])` before its own expectations, so a
broken fixture fails loudly instead of masquerading as a missing-behaviour
failure.

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

No shared fixture module: each `describe` block builds its own minimal
catalogue XML string, isolating the one rule under test. A shared WHFB6-style
fixture would make a failure ambiguous — which of a dozen categories broke?
Reuse the `entryLink` + `sharedSelectionEntries`/`sharedSelectionEntryGroups`
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
modules — nothing here is mocked. Only `DOMParser` is supplied by jsdom
because the engine expects the browser primitive and the suite runs under
Node.
