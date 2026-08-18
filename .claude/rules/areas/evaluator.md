---
paths:
  - "src/evaluator/**"
  - "docs/testing/**"
---

# Evaluator (Reinraum)

The clean-room rule engine: `evaluate(catalog, roster) → report`, a pure function and the only
production engine. `docs/battlescribe-data-format.md` is the canonical source for what the data
means; it outranks the ADRs where the two disagree.

- `src/evaluator/evaluator.js` is the **only** legal entry point from outside. Importing any other
  file from outside the folder fails `forge-lint` (dependency-cruiser `evaluator-nur-ueber-fassade`,
  oxlint `no-restricted-imports`) — an `error`, not a warning.
- The folder must not import `src/roster/**`, and `src/roster/**` must not import it. Both
  directions are blocking rules. The bridge is `src/evaluation/rosterAdapter.js`.
- `catalogReader.js` is the evaluator's own XML reader, deliberately separate from
  `src/parser/xmlParser.js`. Changing one never implies changing the other.
- A change confined to this folder only needs `forge-test --run src/evaluator` — that covers the
  unit tests and the manifest-driven E2E runner (`e2e.testcatalog.test.js`, `crossCatalog.test.js`)
  over the scenarios in `docs/testing/`. The full suite is not required.
- New E2E scenarios under `docs/testing/` are **not** written here: they are delegated to the
  `e2e-testcase-author` subagent, which reads catalog data only and never the engine source
  (`docs/agents/e2e-testcase-author.md`, ADR 0033). Writing one from the engine source makes the
  test mirror the bug instead of catching it.
- Effort has a budget: `node scripts/measure-evaluator.js` fails over 100 ms on real catalog data.
  A change that widens a traversal needs that number checked.
- Report messages are projected to text elsewhere (`src/i18n/violationMessages.js`); a new
  violation kind is only half-done inside this folder.
