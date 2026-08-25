# scripts/lib — suite doc

Unit and integration tests for the library modules behind `scripts/*.js`
CLI tools. Framework: vitest (`environment: 'jsdom'`, `globals: true`, see
`vitest.config.js`). Run the whole directory: `forge-test --run scripts/lib`;
run a single file: `forge-test --run scripts/lib/<file>.test.js`.

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
  (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`, `src/tests/__fixtures__/whfb6/`)
  is integration level and says so in its top comment — keep the synthetic
  cases in the unit file and the corpus-backed ones in the integration file,
  as `evaluator-coverage-cells.test.js` / `evaluator-coverage-corpus.test.js`
  do, so a change to the classification rules doesn't force a ~11 s corpus
  parse (the full corpus — eighteen files since issue 0153 — measured under
  plain node with jsdom) on every unit-level run. That is also why the corpus
  test's `beforeAll`
  carries an explicit 120 s timeout: the parse alone blows vitest's 10 s hook
  default.
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
grep -rhoE '<modifierGroup[ />]' src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive src/tests/__fixtures__/whfb6 | wc -l
```

Issue 0148, increment 2 re-baselined every corpus figure in this doc and in
`evaluator-coverage-corpus.test.js` for the seventeen-file corpus; issue 0153
re-baselined them again for the **eighteen-file** corpus (the thirteen
`whfb6-definitive` files plus the five `whfb6` ones), when `High Elves (6th
definitive edition).cat` joined for one scenario. Adding a book to a fixture
directory moves every figure here — it is not an inert copy.

The character class matters: a trailing-space pattern (`grep -o '<constraint '
-r <fixture dirs> | wc -l`) undercounts attribute-less elements — measured on
the frozen eighteen-file corpus, `modifierGroup` reads 384 instead of 426 with
the trailing-space form, and `repeats` reads 0 instead of 510. Use the `[ />]`
character-class form above (substituting the tag name)
for every kind, the same form `evaluator-coverage-corpus.test.js` itself uses.

It also checks the corpus against the committed `docs/testing/worklist.json` /
`docs/testing/covered-cells.json` (drift guard: recompute and deep-equal the
committed file, the same shape as `generate-schema-module.test.js`'s SSOT
guard). Of the worklist totals only the **cell count** is asserted as a
number — that is a property of the frozen corpus. The covered/uncovered split
is deliberately not pinned: the coverage campaign moves it with every cell it
closes, and the deep-equal against the committed file already catches a
forgotten regeneration. It also carries the `loadCoverageRecords` failure-path tests:
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
