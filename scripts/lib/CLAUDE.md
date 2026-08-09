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
`beforeAll` and checks it against plain-tag-count totals (`grep -o '<constraint '
-r <fixture dirs> | wc -l`, etc. — re-run the grep, not the extraction, if a
total ever disagrees, since the fixtures are frozen) and against the committed
`docs/testing/worklist.json` / `docs/testing/covered-cells.json` (drift guard:
recompute and deep-equal the committed file, the same shape as
`generate-schema-module.test.js`'s SSOT guard).

Case → file mapping for a new construct or classification rule: synthetic,
rule-level assertions go in `evaluator-coverage-cells.test.js`; real-corpus
totals, landmark cells, and the `worklist.json`/`covered-cells.json` drift
guard go in `evaluator-coverage-corpus.test.js`.
