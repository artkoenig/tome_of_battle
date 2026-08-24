---
paths:
  - "src/tests/**"
---

# tests

Every `*.test.*`/`*.spec.*` file under `src` lives here, mirroring the layer subtree it moved out
of (`src/domain/evaluator/foo.test.js` → `src/tests/domain/evaluator/foo.test.js`). Non-test
helpers (fixtures, `__fixtures__/`, test-utils) stay colocated with the source they belong to and
did not move.

- Data fixtures may stay under `src/<layer>/**/__fixtures__/`, but an executable helper module
  (one that other files `import`) may not: cast scans `__fixtures__/` — dependency-cruiser used to
  exclude it — so a production or `scripts/` module importing one is a blocking
  `evaluator-nur-ueber-fassade` violation. Executable test helpers belong in
  `src/tests/test-utils/` (`rosParser.js`, `e2eReport.js` live there for that reason), and
  `scripts/` reaches them as `../../src/tests/test-utils/<name>.js`.
- A test that used `__dirname`/`path.resolve(__dirname, …)` to read a *sibling source file* needed
  its path fixed on the move — the test moved one level deeper (`src/<layer>/…` →
  `src/tests/<layer>/…`) but the file it reads did not. Grep `__dirname` here before trusting a
  relative read.
- Fixture directories referenced via `path.resolve('src/…')`/`join(process.cwd(), 'src/…')`
  (repo-root-relative, not `__dirname`-relative) needed no change: `process.cwd()` at test run
  time is the repo root regardless of where the test file itself lives.
- Every relative `import`/`from`/`require()`/`import()`/`vi.mock()`/`vi.importActual()`/
  `vi.doMock()` specifier in a moved test needed re-relativizing against the new location — the
  target module didn't move, only the test did, so the path grew one `../` plus the return trip
  through the original layer subtree.
- `forge-test`'s full run is flaky under this sandbox on a handful of the slowest, real-catalog
  tests (WHFB6 fixture parses, the `e2e.testcatalog` manifest run): a different test times out at
  the default 5000ms on almost every run, but re-running the same test alone or the file alone
  always passes. Treat a lone timeout in an otherwise-green full run as environment contention,
  not a regression — rerun the specific file with `forge-test --run <path>` to confirm.
