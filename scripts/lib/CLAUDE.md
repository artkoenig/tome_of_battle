# scripts/lib — suite doc

Unit and integration tests for the library modules behind `scripts/*.js`
CLI tools. Framework: vitest (`environment: 'jsdom'`, `globals: true`, see
`vitest.config.js`). Run the whole directory: `npx vitest run scripts/lib`;
run a single file: `npx vitest run scripts/lib/<file>.test.js`.

## Conventions

- Named imports from `vitest` (`describe, it, expect`); the module under test
  imported relatively (`./module.js`).
- `DOMParser` is a global in every test here — the jsdom environment provides
  it, the same primitive the evaluator's own XML reader uses. No test needs
  its own jsdom setup (`evaluator-measurement.test.js` sets `globalThis.DOMParser`
  explicitly; that predates the global config and is not a pattern to copy).
- Nothing here is faked or mocked beyond in-memory fixtures/synthetic XML: the
  modules are pure, and where a test reads real files (a corpus, a committed
  generated file) it reads them for real — see `generate-schema-module.test.js`
  for the drift-guard shape (regenerate, compare to the committed output).
- A file whose tests run against tiny synthetic input is a plain unit test; a
  file whose tests parse the real, frozen fixture corpus
  (`src/evaluator/__fixtures__/whfb6-definitive/`, `src/__fixtures__/whfb6/`)
  is integration level and says so in its top comment — keep the synthetic
  cases in the unit file and the corpus-backed ones in the integration file,
  as `evaluator-coverage-cells.test.js` / `evaluator-coverage-corpus.test.js`
  do, so a change to the classification rules doesn't force a ~2s corpus
  parse on every unit-level run.
- German comments appear in older files here; write new ones in English.

## Evaluator coverage inventory (`evaluator-coverage-cells.js` / `evaluator-coverage-corpus.js`)

Backs `scripts/evaluator-coverage-inventory.js`. Classifies every occurring
rule-construct (`constraint`, `condition`, `conditionGroup`, `modifier`,
`modifierGroup`, `repeat`, `repeatList`) into a pipe-delimited cell key, e.g.
`constraint|max|selectionCount|parent|s=true|ics=false|icf=false|pct=false` or
`conditionGroup|not|nested`. `evaluator-coverage-cells.test.js` pins the
per-construct classification rules against tiny synthetic `<catalogue>` XML
strings built inline per test (helper: `source(xml, file)` wraps
`new DOMParser().parseFromString(...)` with a fake file path).
`evaluator-coverage-corpus.test.js` parses the real fixture corpus once in a
`beforeAll` and checks it against plain-tag-count totals — re-run the grep, not
the extraction, if a total ever disagrees, since the fixtures are frozen:

```
grep -rhoE '<modifierGroup[ />]' src/evaluator/__fixtures__/whfb6-definitive src/__fixtures__/whfb6 | wc -l
```

The character class matters: a trailing-space pattern (`grep -o '<constraint '
-r <fixture dirs> | wc -l`) undercounts attribute-less elements — measured on
the frozen corpus, `modifierGroup` reads 109 instead of 121 with the
trailing-space form, `repeats` reads 0 instead of 243. Use the `[ />]`
character-class form above (substituting the tag name) for every kind, the
same form `evaluator-coverage-corpus.test.js` itself uses.

It also checks the corpus against the committed `docs/testing/worklist.json` /
`docs/testing/covered-cells.json` (drift guard: recompute and deep-equal the
committed file, the same shape as `generate-schema-module.test.js`'s SSOT
guard). It also carries the `loadCoverageRecords` failure-path tests:
temp-directory cases (`mkdtempSync`, cleaned up in `afterEach`) that feed it a
malformed or missing `covered-cells.json` and a malformed or scenario-less
manifest sub-directory, asserting it reports failures instead of throwing.
Those belong here rather than in a file of their own because they exercise the
same module's file-system-facing surface as the drift guard, even though they
read temp directories instead of the corpus.

`evaluator-coverage-corpus.js` also exports `loadCoverageRecords`, a wrapper
around `loadManifests` and the covered-cells loader that collects both their
failures into one list instead of throwing on a malformed JSON file.

`extractCells`'s `index` is file-keyed (`Map<file, Map<constraintId,
cellKey>>`), not a flat `constraintId -> cellKey` map: the same constraint id
can occur in two files with different attributes (e.g. one fixture set's
`.gst` vs. the other's, at different `scope`s), and the two occurrences must
stay distinguishable. `coveredKeysFromManifests` resolves each roster's
evidence against `roster.dataset ?? manifest.dataset` (the
`{ gameSystem, catalogues }` shape `docs/testing/*/scenario.json` already
carries) — it looks the id up only in the files that dataset names, never
across the whole corpus, so a scenario running against one fixture set's file
can never wrongly credit the other set's cell of the same id.

Case → file mapping for a new construct or classification rule: synthetic,
rule-level assertions go in `evaluator-coverage-cells.test.js`; real-corpus
totals, landmark cells, the `worklist.json`/`covered-cells.json` drift guard,
and the `loadCoverageRecords` temp-directory failure-path cases go in
`evaluator-coverage-corpus.test.js`.
