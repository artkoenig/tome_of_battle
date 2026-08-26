# Agent rules

## What this is

"Tome of Battle" — a React + Vite PWA for building and playing tabletop army lists
from **Battlescribe** data files (`.cat`/`.gst` XML). Client-only: no backend, all
data in IndexedDB.

This file is a symlink target: the real file is `.agents/AGENTS.md`. Edit it there.

## Required reading, in order of precedence

1. **`docs/battlescribe-data-format.md`** — the canonical Battlescribe format
   reference. **Every** agent, main session and subagent, reads it before taking up
   work. Upstream source: the `docs/bsdata-catalogue-development-wiki/` submodule.
2. **`docs/adr/`** ([index](docs/adr/README.md)) — architecture, database, styling,
   testing and deployment decisions. Read the relevant ones before changing code.
3. **`docs/glossary.md`** — one name per domain term, and the synonym it replaces.
   Read it before naming anything: an identifier that contradicts a row there is a
   defect, and the German prose keeps its own words by decision, not by accident.
4. **`docs/project-map.md`** — where things live. Orientation aid, never evidence.

Where two disagree, the higher one is right and the lower is out of date: follow it
and flag the other for correction.

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
