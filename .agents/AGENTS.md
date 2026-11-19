# Agent rules

## What this is

"Tome of Battle" — a React + Vite PWA for building and playing tabletop army lists
from **Battlescribe** data files (`.cat`/`.gst` XML). Client-only: no backend, all
data in IndexedDB.

Read relevant documentation under `docs/` first, then the code.
The rules of an army list are data, not code: every limit, every conditional upgrade, every points budget
is XML inside the catalogs, and this codebase only reads and evaluates it. A question about
what an army list may contain has no answer in `src/` — `docs/battlescribe-data-format.md`
outranks the ADRs, and both outrank anything the code seems to imply.

This file is a symlink target: the real file is `.agents/AGENTS.md`. Edit it there.

## Rules

`.claude/rules/*.md`, one topic per file — start with `forge.md` (how work is
tracked, run and checked). `.claude/rules/areas/<area>.md` carries what is true of
one directory only and loads by itself when an agent reads a file under its
`paths:` glob.

## Commands

Checks run through the forge wrappers (`forge-test`, `forge-lint`, `forge-typecheck`,
`forge-build`) — see `.claude/rules/forge.md` for what each covers. Everything else:

```bash
npm run dev     # Vite dev server
npm run knip    # dead code / unused exports & deps (warn-only, outside the wrappers)
```

Area notes name the scripts that belong to their directory (screenshots, the
evaluator effort measurement, the Puppeteer app E2E).

All tests must pass before a task counts as done, with one recorded exception: the
red scenarios pinned in `docs/testing/campaign-state.json`.
