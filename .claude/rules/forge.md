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
- `forge-typecheck` = `tsc --noEmit` over `src/**` and `scripts/**` (`allowJs`/`checkJs`, so the
  JSDoc annotations are the types). Since Issue 0185 it runs with `strictNullChecks` **and**
  `strictFunctionTypes`: a `@param {Roster|null}` is a promise the gate keeps, and a value that
  can be `null` may not be read unchecked. `strict` stays off because it pulls in
  `noImplicitAny`, and `noImplicitAny` is deliberately still out — 2658 open annotations, a debt
  to be paid folder by folder in its own issue. Write the next file null-safe rather than
  enlarging it. Suppressing a finding is not an option: the tree carries no `@ts-ignore`,
  `@ts-expect-error` or `@ts-nocheck`, and a JSDoc type cast (`/** @type {X} */ (value)`) is for
  an assertion the checker genuinely cannot see — a null check or a clean default is the answer
  everywhere else. Two shapes cause most findings and neither needs a cast: an empty literal in
  an object field or a parameter default falls to `never[]`, and `useState(null)`/`useRef(null)`
  falls to `null` — give the literal a named, `@type`-annotated constant next to the function
  and pass that instead.
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
