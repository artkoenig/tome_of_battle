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
  filename (`forge-test --run src/evaluator`); pass `-t "<name>"` as the pattern to filter by
  test name.
- `forge-lint` = `npm run lint && npm run depcruise`. oxlint's many warnings do not fail it;
  the blocking dependency-cruiser rules (Reinraum boundary, evaluator facade) do.
- `npm run knip` is warn-only and deliberately outside the wrappers.
- The Puppeteer app E2E (`node e2e/ui.test.js`, part of `npm test`) is **not** in `forge-test`:
  it is slow and browser-bound. Run it by hand when a change touches `src/components/` or
  `e2e/`.

## Before an issue is merged

A change a user can see (fix or feature) needs a version bump: `node scripts/release.js
<patch|minor|X.Y.Z>`, committed on the issue's branch before the PR. Never for refactoring or
chores. The tag is pushed by `.github/workflows/tag-on-version-bump.yml`, never by an agent.
