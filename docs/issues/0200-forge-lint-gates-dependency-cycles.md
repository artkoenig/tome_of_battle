---
status: backlog
branch:
pr:
---

# `forge-lint` gates dependency cycles, not just rules

## Goal

Found while verifying the observations of [`docs/ddd-review-2026-08.md`](../ddd-review-2026-08.md),
unrelated to any of its findings.

`npm run cast` is `cast-check` (`package.json:14`), which scans and then runs `cast check`. That
function computes rule violations only — `check(graph, of, rules, baseline)` in the plugin's
`scripts/cast.js:1712-1726` partitions `violations(...)`, counts the `error`-severity ones and
returns `{ code: errors ? 1 : 0 }`. It never calls `cycles()`. `cast report` does know them
(`cast.js:1485-1486` prints `cycles <n>`, `cast plan simulate` prints `cycles a -> b`), but `report`
is not wired into any gate.

**So a dependency cycle can be introduced today with a completely green `forge-lint`.** This is not
hypothetical: while simulating a candidate move of
`src/contexts/armylist/application/rosterSelectionFactory.js` into `model/`, distributing its
exports while keeping the barrel import produced an `index.js → selectionFactory.js` cycle — and the
simulation was the only thing that saw it. `cast plan simulate` catches this for a *planned*
refactoring; nothing catches it for an ordinary edit.

The count is **0 today** (`cast report --root src`: `cycles 0`, `unassigned 0` inside `src/`), which
is the cheapest possible moment to start holding it. A ratchet at 0 costs nothing and never has to
be paid down.

The narrow question for implementation is where the gate belongs. `cast-check` is the plugin's
binary and lives in `artkoenig/ai-blacksmith`, not here; this repository obtains it by shallow clone
in the lint workflow. So either the check is added upstream (right home, slower) or `npm run cast`
grows a second step in this repo that runs `cast report` and fails on a non-zero cycle count (fast,
and duplicates a little). Decide in review — the acceptance criteria below are written so either
answer satisfies them.

No version bump: a gate change is a chore.

## Acceptance criteria

- AC1: A deliberately introduced two-module cycle under `src/` makes `forge-lint` fail. | verify: `bash -c 'printf "import { b } from \x27./__cycB.js\x27;\nexport const a = () => b();\n" > src/shared/__cycA.js; printf "import { a } from \x27./__cycA.js\x27;\nexport const b = () => a();\n" > src/shared/__cycB.js; forge-lint; rc=$?; rm -f src/shared/__cycA.js src/shared/__cycB.js; test $rc -ne 0'`
- AC2: The failure output names the cycle's modules, not just a count. | verify: manual read of the AC1 output during review
- AC3: With the tree as it stands, the gate is green and the cycle count is 0. | verify: `forge-lint`
- AC4: The rule check still behaves exactly as before — a forbidden edge still fails with its file and line. | verify: `bash -c 'printf "import { evaluateAppRoster } from \x27../../ruleengine/readmodel/index.js\x27;\nexport const p = evaluateAppRoster;\n" > src/contexts/armylist/model/__probe.js; forge-lint; rc=$?; rm src/contexts/armylist/model/__probe.js; test $rc -ne 0'`
- AC5: The gate runs in CI as well as locally — the lint workflow and the status-report workflow both cover it. | verify: `bash -c 'grep -q "cast" .github/workflows/*.yml'`
- AC6: Where the check landed and why is recorded, so the next reader does not re-derive it. | verify: `bash -c 'grep -rqi "cycle" .claude/rules/forge.md .claude/rules/areas/contexts.md'`
- AC7: The other gates stay green. | verify: `bash -c 'forge-test && forge-typecheck && forge-build'`

## Out of scope

- Any actual cycle removal. There are none.
- `unassigned` modules. `cast report` lists 5, all outside `src/` (`docs/assets/landing.js`,
  `public/sw.js`, `tools/rules-editor/server.js`, `vite.config.js`, `vitest.config.js`); gating that
  is a separate decision with a separate answer.
- Teaching cast to see external edges or JSDoc type imports. Both are real limitations found during
  the review (see issues 0194 and 0198) and both are upstream plugin work.
- Any change to `.cast/rules.json` or `.cast/layers.json`.

## Open questions

1. Upstream in `artkoenig/ai-blacksmith` (right home, slower, benefits every project) or a second
   step in this repo's `npm run cast` (fast, slightly duplicated)?
2. Should the gate fail on any cycle, or ratchet like `.cast/baseline.json` does for rules? At a
   count of 0 the two are identical today; the answer only matters the first time a cycle is
   genuinely wanted.
