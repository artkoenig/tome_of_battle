# forge

- `/forge:issue` writes issues and starts runs. Never implement an issue by hand.
- Checks run through `forge-test`, `forge-lint`, `forge-typecheck`, `forge-build`. Each answers `0`
  or `1`; escalate with `--failing`, then `--detail <id>`.
- Raw runners are rewritten or refused.
- Issue storage: `.claude/skills/issue-backend/SKILL.md`.
- Project knowledge: `.claude/rules/*.md`, committed, one topic per file.
- What is true of one directory only: `.claude/rules/areas/<area>.md`, under a `paths:` glob. It
  loads when a file it matches is read, so it costs nothing until an agent works there.

## What the wrappers cover here

- `forge-test` = `npx vitest run` — unit, component and the evaluator's manifest-driven E2E.
  `forge-test --run <pattern>` passes the pattern straight to vitest, so it filters by path or
  filename (`forge-test --run src/domain/evaluator`); pass `-t "<name>"` as the pattern to filter by
  test name.
- `forge-lint` = `npm run lint && npm run cast`. oxlint's many warnings do not fail it, but
  cast's structural rules do: `npm run cast` is `cast-check`, and every rule in
  `.cast/rules.json` is `error` (ADR 0041) — a forbidden edge names its file and line and fails
  the gate. oxlint's `no-restricted-imports` mirrors the Reinraum boundary and the evaluator
  facade on top of that. cast is a Claude Code plugin and not on npm, but it is plain Node with
  no dependencies, so CI obtains it by a shallow clone of `artkoenig/ai-blacksmith` — the check
  runs in the lint workflow and the status-report workflow as well as locally and in every agent
  run.
- `npm run knip` is warn-only and deliberately outside the wrappers.
- The Puppeteer app E2E (`node e2e/ui.test.js`, part of `npm test`) is **not** in `forge-test`:
  it is slow and browser-bound. Run it by hand when a change touches `src/ui/components/` or
  `e2e/`.

## Before an issue is merged

A change a user can see (fix or feature) needs a version bump. Never for refactoring or chores —
they have no release reason. Propose the next version (patch for a fix, minor for a feature) and
let the user confirm, override it, or decline; then `node scripts/release.js <patch|minor|X.Y.Z>`,
committed on the issue's branch before the PR, so the squash-merge carries it into `main`. The tag
is pushed by `.github/workflows/tag-on-version-bump.yml`, never by an agent — a tag push from a
Cloud Session's Git relay fails with HTTP 403 (ADR 0019).
