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
