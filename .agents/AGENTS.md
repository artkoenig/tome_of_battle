# Custom Agent Rules

## What this is

"Tome of Battle" — a React + Vite PWA for building and playing tabletop army lists from **Battlescribe** data files (`.cat`/`.gst` XML). It's a client-only app: no backend, all data lives in IndexedDB.

## Architecture Guidelines (ADRs)

All core architecture, database, styling, testing, and deployment guidelines are documented in **[docs/adr/](docs/adr/)** (see the index [README.md](docs/adr/README.md)).
- **CRITICAL:** You **MUST** read and adhere to the relevant ADR files under `docs/adr/` before starting any development or modifying code in this repository.

## BSData documentation (read before starting work)

- **CRITICAL:** Every agent — the main session and every subagent — **MUST** read the bsdata documentation **[docs/battlescribe-data-format.md](docs/battlescribe-data-format.md)** before taking up its work. It is the canonical reference to the Battlescribe data format for this project; the [BSData catalogue-development wiki](docs/bsdata-catalogue-development-wiki/) submodule is its upstream source.
- **Precedence:** The bsdata documentation takes precedence over the ADRs. Where the two contradict each other, the bsdata documentation is right and the ADR is out of date — follow the bsdata documentation and flag the ADR for correction.

## Commands

```bash
npm run dev              # Vite dev server
npm run build             # Production build (also injects a fresh SW cache version)
npm run lint               # oxlint
npm run knip               # dead code / unused exports & deps, cross-file (warn-only)
npm run depcruise            # dependency-graph rules: layering, solver facade, cycles, orphans (warn-only); evaluator⇄solver-Trennung (ADR 0030) blockiert (error)
npm run analyze              # knip + dependency-cruiser together
npm run typecheck           # tsc --noEmit: prüft JSDoc-Typen im Produktivcode (checkJs), Tests ausgenommen
npm test                     # vitest run (unit/component tests) + node src/solver/ui.test.js (puppeteer E2E)
npx vitest run <path>          # run a single test file
npx vitest run -t "<name>"       # run tests matching a name
node scripts/generate_screenshots.js   # screenshots of every main view (desktop + mobile) -> .screenshots/
node scripts/measure-evaluator.js        # Aufwandsmessung der Reinraum-Engine an echten Katalogdaten (kein Produktivcode); Exitcode 1, wenn die 100-ms-Schwelle gerissen wird
node scripts/measure-evaluator-browser.js  # dieselbe Messung im echten Browser (Puppeteer) neben dem jsdom-Lauf — misst die Verzerrung durch jsdoms XML-Leser
```

- All unit tests must pass before a task is considered done.
- On macOS, `browser_subagent`/`open_browser_url` don't work — use `node scripts/generate_screenshots.js`, which runs offline against the frozen fixture and needs no catalog data in the repo. For a one-off investigation, build a throwaway script on the shared harness (`scripts/lib/e2e-harness.js`); it also offers a browser console log, a DOM dump and a headed browser. On Linux/cloud, `/browser` and `browser_subagent` work normally (see [ADR 0006](file:///Users/artkoenig/Workspace/army_builder/docs/adr/0006-testing-and-automation.md)).
- After any UI-visible change, take a screenshot of the affected view and send it to the user as confirmation (skip this when running on the user's local machine).

## Agent skills

### Issue tracker
This project runs the [Metis](https://github.com/artkoenig/metis) workflow. Work
is tracked as local markdown issues under `docs/issues/`, one file per issue,
named `NNN-<slug>.md` and shaped by `docs/issues/TEMPLATE.md`. The frontmatter
carries the facts — `status` (`backlog | active | waiting | done`), `branch`,
`pr` — and the filled sections are the progress. One issue = one branch = one
pull request; there are no child issues, and a change too big to land whole
gets a task list inside its own file.

The rulebook itself arrives as `~/.claude/CLAUDE.md`, installed by the
SessionStart hook in `.claude/hooks/`. There is no tracker script and no skill
guarding status transitions — edit the file.

Everything resolved before the switch stays in the predecessor's form:
directories `NN-<slug>/issue.md` with a `Status:` line. Those are history —
read them for context, never revive one.

### E2E test cases for the evaluator
When the maintainer asks to create an E2E test case for the Reinraum evaluator
(`src/evaluator/`), the work is **delegated to the `e2e-testcase-author`
black-box subagent** — it is not done in the main conversation. The agent
authors scenarios (`.ros` + `README.md` + `scenario.json`) under `docs/testing/`
solely from the catalog data, never from the engine source, so the tests
challenge the engine instead of mirroring it. It does **not** write the
manifest-driven runner or any `.test.js`.

See `docs/agents/e2e-testcase-author.md` for the role, the read allow-list, the
manifest contract, and the boundary to the runner; the architecture decision is
[ADR 0033](docs/adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md).

## Version bump before merging an issue
Before an issue that changes what a user can see — a fix or a new feature — is
merged, propose a version bump. Never for pure refactoring or chores; they have
no user-facing release reason:

1. Read the current version from `package.json` on the issue's branch.
2. Suggest the next version: patch bump for a fix, minor bump for a feature
   (`node scripts/release.js patch` / `minor` computes this).
3. Ask the user to confirm the suggestion, supply their own version, or leave
   the version unchanged.
4. If confirmed: run `node scripts/release.js <patch|minor|X.Y.Z>` to update
   `package.json`, then commit it on the issue's branch, before
   pushing and opening (or updating) the PR. The squash-merge then carries the
   version bump into `main` together with the rest of the change, in the same
   commit — no separate commit or push to `main` is ever needed for this.

After the PR is merged, the `.github/workflows/tag-on-version-bump.yml`
workflow tags the resulting `main` commit `v<version>` automatically — it
detects the `package.json` version change on the push to `main` and pushes
the tag itself, using its own `GITHUB_TOKEN`. No agent action is needed for
this step anymore (see ADR 0019 and ADR 0007): a manual `git push
origin v<version>` from the agent is no longer part of this flow, since a
direct tag push from a Cloud Session's Git relay is unreliable (HTTP 403,
independent of GitHub repo settings — see ADR 0019).

