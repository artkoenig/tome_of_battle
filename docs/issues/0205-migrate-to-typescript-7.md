---
status: backlog
branch:
pr:
---

# Migrate to TypeScript 7

## Goal

`forge-typecheck` runs on TypeScript 7 and the project-state report still works. Two changes in TypeScript 7 block this today. (1) JSDoc `{object}` and `{Object}` are no longer read as `any` but as an empty object type, so 299 findings appear (252× TS2339, 28× TS2345, 16× TS2322, 3× TS2694). Most of them are in `src/contexts/ruleengine` (96), `src/ui/viewmodels` (65) and `scripts/` (~66), the rest are spread over `src/ui/components`, `src/contexts/armylist`, `src/ui/i18n`, `src/platform` and `src/contexts/catalog`. Each of these annotations gets its real type: a named `@typedef` or an existing type from `src/shared/rostermodel/types.js`. A cast is not a fix (see `.claude/rules/forge.md`). (2) The `typescript@7` npm package exports only `version` and `versionMajorMinor`, with no compiler API. `scripts/project-state/tsSource.js`, `functions.js` and `complexity.js` parse sources with `ts.createSourceFile` and walk `ts.Node`/`ts.SourceFile`. Without that API, 21 tests in `scripts/project-state/*.test.js` fail and the status-report workflow would break at runtime. That parsing needs a source that still exists under TypeScript 7, and the choice is recorded as an ADR.

## Acceptance criteria

- AC1: `package.json` pins `typescript` to a 7.x version, and `forge-typecheck` passes with `strictNullChecks` and `strictFunctionTypes` as today. | verify: forge-typecheck
- AC2: No JSDoc annotation in `src/**` or `scripts/**` uses bare `object` or `Object` where the value's shape is known. The fix adds no `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`, and no new JSDoc type casts. | verify: forge-lint
- AC3: `scripts/project-state/` parses JS/JSX without the TypeScript 7 package's (absent) compiler API. Examples: a pinned `typescript@6` under an npm alias, or another parser. All `scripts/project-state/*.test.js` pass. | verify: forge-test --run scripts/project-state
- AC4: `node scripts/project-state/generate.js <out>` still writes the report with LOC, cyclomatic complexity and long-function findings. | verify: node scripts/project-state/generate.js /tmp/status-check.html
- AC5: An ADR in `docs/adr/` records which parser the project-state report uses, and why, now that `typescript` no longer ships a compiler API.
- AC6: The `typescript` `<7` rule that issue 0204 added to `renovate.json` is removed.
- AC7: The full suite is green. | verify: forge-test

## Out of scope

- Turning on `strict` or `noImplicitAny` (separate debt, see `.claude/rules/forge.md`).
- The LSP bridge setup in `.claude/rules/lsp.md` beyond what the TypeScript version bump itself requires.
- Other dependency upgrades from the Renovate PR.
