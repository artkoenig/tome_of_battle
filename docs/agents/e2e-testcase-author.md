# E2E test-case author: the black-box scenario writer

End-to-end test cases for the Reinraum evaluator (`src/evaluator/`) are authored
by a dedicated **black-box** subagent, `e2e-testcase-author`
(`.claude/agents/e2e-testcase-author.md`). This document describes what that
agent does, why it is deliberately blind to the engine, and how its output plugs
into the manifest-driven runner. The architectural decision behind it is
[ADR 0033](../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md).

## When it runs

Whenever a new evaluator rule needs an E2E fixture — for example after a new
engine rule is added or a bug is fixed — the work of writing the scenario is
**delegated to `e2e-testcase-author`**, not done in the main conversation. The
agent is given the domain rule to pin down (in plain language) and a slug for the
new scenario directory. It never runs code and never talks to the user; it reads,
it writes scenario files, and it hands back a short summary.

## Why black-box

The agent is **blind to the evaluator's implementation** on purpose. It derives
what a scenario should assert from the Battlescribe **data** and its **format
specification**, never from the engine code. If an author peeks at
`src/evaluator/*.js`, they write a test that mirrors whatever the engine
currently does — cementing its bugs as "expected" — instead of a test that pins
the behavior the catalog data actually demands. Keeping the author independent of
the engine is what lets the test genuinely challenge the engine rather than echo
it.

## Allowed sources (the read allow-list)

The agent may read **exclusively**:

1. **The data-format specification** — `docs/battlescribe-data-format.md`.
2. **The vendored schema and its ADRs** — `src/parser/schema/Catalogue.xsd` and
   the domain ADRs `0003`, `0011`, `0016`, `0031`.
3. **The real catalog fixtures** — everything under
   `src/evaluator/__fixtures__/whfb6-definitive/` (the `.gst`/`.cat` XML the
   runner loads). This is catalog **data**, not engine code.
4. **Existing scenarios** as the format template — everything under
   `docs/testing/**`.

### Forbidden sources

The exclusion is an allow-list, not a blanket "never touch `src/`" rule — the
catalog data itself lives under `src/`. Concretely, the agent must **never** read
any part of `src/` **except** the catalog fixtures above, and in particular
**never `src/evaluator/*.js`** (the engine, its facade, its query/join layers, or
any other evaluator/app source). It has no Bash tool, so the read allow-list
cannot be bypassed via the shell. If a question feels answerable only by reading
engine code, that is the signal it is about to infer an expectation from the
implementation — it answers from the catalog XML and the format spec instead, or
stops and reports the gap.

## The deliverable — three artifacts per scenario

For each rule, the agent produces a complete scenario under
`docs/testing/<scenario>/` that the runner discovers and executes on its own:

1. **Minimal `.ros` roster(s)** under `rosters/` — the smallest rosters that make
   the constraint fire (and that legally satisfy it), using the real roster shape
   verified in existing scenarios.
2. **The scenario `README.md`** — the derived rules with their catalog-data
   evidence, a per-roster catalog, and a "Verifizierte Bausteine" table of the
   element ids relied on, in the German style of
   `docs/testing/vampire-bloodlines/README.md`.
3. **The machine-readable manifest `scenario.json`** — the single source of truth
   the runner consumes (contract below).

The agent does **not** write the runner and does **not** write any `.test.js`:
those touch source and belong to the engine side, not to authorship. Its output
is data and prose only.

## The manifest contract (`scenario.json`)

The manifest is the machine-readable expectation, fillable from the catalog data
alone. Its authoritative shape lives in the header doc-comment of
[`src/evaluator/e2e.testcatalog.test.js`](../../src/evaluator/e2e.testcatalog.test.js)
and in `docs/testing/vampire-bloodlines/scenario.json`. In outline:

```json
{
  "schemaVersion": 1,
  "name": "<scenario>",
  "description": "<plain-language summary>",
  "dataset": {
    "gameSystem": "<repo-root-relative path to the .gst>",
    "catalogues": ["<repo-root-relative path to a .cat>", "..."]
  },
  "rosters": [
    {
      "file": "rosters/<name>.ros",
      "description": "<plain-language summary of this roster's state>",
      "dataset": { "...": "OPTIONAL per-roster override of the scenario dataset" },
      "expect": {
        "firing": [
          { "limitId": "<constraint-id>", "actual": 0, "bound": 1, "count": 2 }
        ],
        "absent": ["<constraint-id>", "..."],
        "diagnostics": {
          "present": [{ "kind": "<DiagnosticKind>", "targetId": "<id>", "minCount": 1 }],
          "absent": [{ "kind": "<DiagnosticKind>", "targetId": "<id>" }]
        }
      }
    }
  ]
}
```

Key points of the contract:

- **Dataset paths** are repo-root-relative; `catalogues` is ordered and must
  include every `.cat` the rosters need (including those pulled in via
  `catalogueLink`, e.g. the shared Mercenaries dependency).
- **Roster-level `dataset` override** — a roster may declare its own `dataset`
  (same shape) to check the *same* build against a *different* set, e.g. **without**
  the Mercenaries dependency, to prove a "missing dependency" diagnostic.
- **`expect.firing`** lists limit-ids that MUST fire, each with `actual`/`bound`.
  Optional `count` requires the limit to fire *exactly* that many times (one anchor
  per contingent, §7.7).
- **`expect.absent`** lists limit-ids that MUST NOT fire.
- **`expect.diagnostics`** (optional) asserts over `report.diagnostics`: `present`
  requires diagnostics of a given `DiagnosticKind` (optionally narrowed by
  `targetId`/`defId`, with a `minCount`), `absent` forbids them.
- The expectation is **selective, not exhaustive**: beyond the ids/kinds named,
  it makes no claim. Other army-build diagnoses (general/core requirements, points
  limits) may additionally occur without breaking a case.

Both `actual` and `bound` are derived from the catalog XML and the roster the
agent built — `bound` is the constraint's `value`, `actual` is what the roster's
structure produces under the constraint's scope — **never** from an engine run or
its source.

## How the runner consumes the manifests

The two halves fit together at runtime, with no shared code between author and
engine beyond the manifest:

1. The runner `src/evaluator/e2e.testcatalog.test.js` scans `docs/testing/` and
   picks up every subdirectory that carries a `scenario.json`.
2. For each roster in a manifest it loads the declared `dataset` (the roster-level
   override, else the scenario dataset), parses the `.ros`, and calls the public
   facade `evaluate`.
3. It checks the resulting report's `violations` against `expect.firing` /
   `expect.absent` and its `diagnostics` against `expect.diagnostics`, generating
   one dynamic test case per roster.

So the author declares *what* each roster should assert (in data), and the runner
supplies *how* it is executed and checked (in code) — the two never see each
other's internals, which is exactly the independence the black-box premise buys.

## Companion catalog and consistency

Every scenario is also summarised in non-technical language in the
[Testkatalog](../testkatalog-evaluator-e2e.md). Catalog and scenario stock are
kept identical **by hand** — there is deliberately no generator and no CI gate
(see the catalog's "Pflege-Regel" and ADR 0006). Whoever adds, renames, or removes
a scenario or roster updates the catalog in the same step.
