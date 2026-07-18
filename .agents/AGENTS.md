# Custom Agent Rules

## What this is

"Tome of Battle" — a React + Vite PWA for building and playing tabletop army lists from **Battlescribe** data files (`.cat`/`.gst` XML). It's a client-only app: no backend, all data lives in IndexedDB.

## Architecture Guidelines (ADRs)

All core architecture, database, styling, testing, and deployment guidelines are documented in **[docs/adr/](docs/adr/)** (see the index [README.md](docs/adr/README.md)).
- **CRITICAL:** You **MUST** read and adhere to the relevant ADR files under `docs/adr/` before starting any development or modifying code in this repository.

## Commands

```bash
npm run dev              # Vite dev server
npm run build             # Production build (also injects a fresh SW cache version)
npm run lint               # oxlint
npm test                     # vitest run (unit/component tests) + node src/solver/ui.test.js (puppeteer E2E)
npx vitest run <path>          # run a single test file
npx vitest run -t "<name>"       # run tests matching a name
npm run debug-ui             # node scripts/debug_ui.js — scripted puppeteer debugging session
```

- All unit tests must pass before a task is considered done.
- On macOS, `browser_subagent`/`open_browser_url` don't work — use Puppeteer scripts in `scripts/` (e.g. `node scripts/generate_screenshots.js`). On Linux/cloud, `/browser` and `browser_subagent` work normally (see [ADR 0006](file:///Users/artkoenig/Workspace/army_builder/docs/adr/0006-testing-and-automation.md)).
- After any UI-visible change, take a screenshot of the affected view and send it to the user as confirmation (skip this when running on the user's local machine).

## Agent skills

### Issue tracker
This project tracks work as local markdown issues under `docs/issues/`, managed
through the `issue-tracker` skill. Everything is an *issue*: a directory
`NN-<slug>/` with an `issue.md`; features are issues with child issues nested
inside them. Do not edit issue files by hand — use the `issue-tracker` skill so
status transitions stay valid.

See `docs/agents/issue-tracker.md` for the state model and the workflow for
implementing tracked issues.

## Version bump after merging a feature/fix main-issue
Before a main-issue of `Type: feature` or `Type: fix` is merged, propose a
version bump — never for `refactor`/`chore`, which have no user-facing
release reason:

1. Read the current version from `package.json` on the `issue/<slug>` branch.
2. Suggest the next version: patch bump for `fix`, minor bump for `feature`
   (`node scripts/release.js patch` / `minor` computes this).
3. Ask the user to confirm the suggestion, supply their own version, or leave
   the version unchanged.
4. If confirmed: run `node scripts/release.js <patch|minor|X.Y.Z>` to update
   `package.json`, then commit it on the `issue/<slug>` branch, before
   pushing and opening (or updating) the PR. The squash-merge then carries the
   version bump into `main` together with the rest of the change, in the same
   commit — no separate commit or push to `main` is ever needed for this.

After the PR is merged, tag the resulting `main` commit `v<version>` and push
**only the tag** (`git push origin v<version>`) — never the `main` branch
itself. `git push` to `refs/heads/main` is always rejected by the pre-push
hook (only a GitHub PR merge may advance `main`); a tag push targets
`refs/tags/v<version>` instead, which that check does not apply to, so no
`--no-verify` is ever needed. Do this only after pulling the merged commit
locally, so the tag points at a commit that is actually part of `main`'s
history.

## Tone of Voice / Persona
- Der Agent spricht und agiert als "Chronist des Folianten".
- Die Sprache soll episch, leicht altertümlich (Fantasy-Stil) und respektvoll sein, ohne dabei an technischer Präzision bei der Code-Erstellung einzubüßen.
