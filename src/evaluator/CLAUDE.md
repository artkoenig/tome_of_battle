# Evaluator test suite

Unit and integration tests for the Reinraum evaluator (`src/evaluator/`), plus
the manifest-driven E2E runner over `docs/testing/`. Run just this suite:

```bash
npx vitest run src/evaluator
```

Run a single file: `npx vitest run src/evaluator/<file>.test.js`.

## Layout and naming

One test file per production file (`resolver.js` → `resolver.test.js`), plus
narrower `<module>.<topic>.test.js` files for a single behaviour that would
otherwise clutter the main file (e.g. `resolver.immutability.test.js`,
`evaluator.rosterContract.test.js`). Put a new case in the file matching the
module it exercises, or start a `<module>.<topic>.test.js` file when the case
is a distinct concern with its own fixture prose. Name `it(...)` blocks with a
short case id when the surrounding suite doc or issue calls one out (`R1`,
`B2`) followed by a plain-language sentence of what the case demands.

Comment headers and prose are German, matching the surrounding codebase.

## Two test levels, both real engine code, no mocks

- **Resolver level** — `parseCatalogue` (`catalogReader.js`) then
  `resolveCatalogue` (`resolver.js`), asserting on the resolved graph directly
  (`resolved.lookup(id)`, `.modifiers[i].conditions[i]`, `.repeats[i]`,
  `.target`, `.witnessDefinition`, `.diagnostics`). No roster, no evaluation.
- **Whole-engine level** — the public two-stage facade:
  `evaluate(prepareDataset({ catalogues: [xml] }), roster)`. Roster objects are
  `{ forces: [{ defId, count, children }] }`, recursively for nested
  selections. A `.ros`-file variant goes through `rosterFromRos` from
  `./__fixtures__/rosParser.js`, written into an `mkdtempSync` dir and removed
  in `afterAll` (see `evaluator.rosterContract.test.js`).

Every file bootstraps JSDOM at module scope before importing engine code that
parses XML:

```js
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
```

Catalogues are template-literal XML strings with ids hoisted into `const`s
(one per referenced definition), built minimally for the rule under test —
add constraints/forces/etc. only where the case needs them, so an unrelated
mandatory-phantom or diagnostic doesn't show up as noise in the report.

## Reading the report shape

`report.capabilities` is a `Map<path, capability>`; filter its values by
`capability.defId` to find a slot (see `report.test.js`, `slotByDefId`).
Relevant capability fields: `effectiveMin`, `effectiveMax`, `current`,
`headroom`, `isBlocked`, `isMandatoryUnmet`, `isHidden`, `authorMessages`,
`anchorKind`, `targetDefId`. `report.violations` entries carry `limitId`,
`actual`, `bound`, `anchor: { defId, path, ... }`. `report.diagnostics` entries
carry `kind` plus kind-specific fields (`defId`, `scope`, ...). Read the exact
shape off `report.test.js` and `evaluator.rosterContract.test.js` rather than
guessing field names.

## The E2E manifest runner (`e2e.testcatalog.test.js`)

Discovers every `docs/testing/<scenario>/scenario.json` at runtime and
evaluates its declared rosters through the same public `evaluate` facade,
asserting `violations` and `diagnostics` against the manifest. Scenarios
(`.ros` + `README.md` + `scenario.json`) are authored by the
`e2e-testcase-author` subagent from catalog data alone (ADR 0033) — this
suite's tests never author or edit anything under `docs/testing/`; that
directory is a separate authoring boundary.
