# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Tome of Battle" — a React + Vite PWA for building and playing tabletop army lists from **Battlescribe** data files (`.cat`/`.gst` XML). It's a client-only app: no backend, all data (imported game systems and user rosters) lives in the browser's IndexedDB.

## Commands

```bash
npm run dev              # Vite dev server
npm run build             # Production build (also injects a fresh SW cache version, see vite.config.js)
npm run lint               # oxlint
npm test                     # vitest run (unit/component tests) + node src/solver/ui.test.js (puppeteer E2E)
npx vitest run <path>          # run a single test file
npx vitest run -t "<name>"       # run tests matching a name
npm run debug-ui             # node src/solver/debug_ui.js — scripted puppeteer debugging session
npm run ux-correct            # python scripts/ux_self_correction.py
```

- `src/solver/ui.test.js` is excluded from the vitest run (see `vitest.config.js`) and executed separately by `npm test`. It packs `catalogs/whfb6/*.cat|*.gst` into a zip with JSZip, boots a Vite server on port 5175, and drives it with Puppeteer — a full import→build→play E2E smoke test.
- All unit tests must pass before a task is considered done.
- On macOS, `browser_subagent`/`open_browser_url` don't work for manual UI checks — use the Puppeteer scripts in `src/solver/` (e.g. `node src/solver/generate_screenshots.js`) instead. On Linux/cloud, `/browser` and `browser_subagent` work normally.

## Architecture

### Data flow: Battlescribe → IndexedDB → Roster state

1. **Import**: `Importer.jsx` → `src/parser/zipExtractor.js` unzips a `.bsz`/zip of catalogs, `src/parser/xmlParser.js` parses the raw `.cat`/`.gst` XML into a "system" object (catalogues, category/force entries, cost types, profiles, rules, constraints, modifiers, entry links, etc.).
2. **Storage**: `src/db/database.js` wraps IndexedDB with two object stores: `systems` (parsed game systems) and `rosters` (user army lists). No ORM — plain promise-wrapped `IDBRequest` calls. Treat this file as the only place that touches IndexedDB directly (repository pattern); components/hooks should go through it or through hooks built on top of it.
3. **Migrations**: `src/db/migrations.js` runs `runSystemMigrations` on every system loaded at app start (in `App.jsx`) to backfill/upgrade older stored system objects.
4. **Roster state**: `src/hooks/useRoster.js` is the central state manager for one roster being edited. It builds the `Selection` tree from catalog entries, mutates it immutably, and on every change: debounces (150ms) a recompute of costs/validation via `src/solver/validator.js`, and **autosaves to IndexedDB immediately** (no explicit save step required, though a manual `save()` exists too).
5. **Play state**: `src/hooks/usePlayState.js` manages transient game-mode state (round, VP, CP, per-model wounds) layered on top of a roster.

### Data model (`src/types.js`, JSDoc typedefs only — no TS)

`Roster` → `Force[]` → `Selection[]` (recursive tree, a `Selection` can contain child `Selection`s). A `Selection` references its catalog definition via `entryLinkId` XOR `selectionEntryId`, not by embedding the definition — the definition is re-resolved from the `system` object at read time via `resolveEntry`/`findEntryInSystem` (`src/solver/catalogResolver.js`). `catalogueId` context must be threaded through whenever resolving entries/profiles/rules, since the same target ID can mean different things in different catalogues/detachments.

### The "solver" (`src/solver/`) — core rules engine, framework-agnostic

- `catalogResolver.js` — resolves entry links / selection entries against a system, across catalogues.
- `modifierEvaluator.js` — evaluates Battlescribe `condition`/`conditionGroup`/`modifier` constructs (used to adjust constraint values dynamically).
- `optionsCollector.js` — recursively collects available profiles/rules/options for a unit, respecting nesting (e.g. an upgrade's own sub-options only become selectable once the parent upgrade is actually chosen).
- `rosterCounter.js` — computes selection/category/force counts and point costs across a roster.
- `rulesEvaluator.js` — special rule text/keyword evaluation.
- `validator.js` — top-level orchestrator; re-exports the above and exposes `validateRoster`, `calculateRosterCosts`, `resolveEntry`, `syncRosterSelectionsWithSystem`. This is the module the rest of the app imports from.
- Scripts here that aren't `*.test.js` (`generate_screenshots.js`, `debug_ui.js`, `stress_m3.js`, `ux_desktop_walkthrough.js`, etc.) are standalone Puppeteer/Node tools, not part of the app bundle.

### Battlescribe domain rules (non-obvious, see `.agents/validation_insights.md` for the full living log — add new discoveries there)

- **No hardcoded language strings** as parsing/validation keys (no English/German substrings like `"General"`), except the literal computation of Armour Save / Ward Save (`AS`/`WS`). Battlescribe relations must be resolved via `categoryLinks`/IDs, never by name-matching.
- **No army-specific logic** — all validation/rules logic must be generic across game systems and catalogues.
- Category `primary="true"` is the one used to bucket a selection in the roster UI; `primary="false"` categories are invisible tag-like keywords for validation only (e.g. "who can take a mount"). Never group the UI by hardcoded category names.
- Constraints with scope `force` must be counted **per-detachment**, not army-wide; scope `parent` constraints must compare resolved **target IDs**, not `entryLinkId`s (different links can point at the same target).
- `child.number * parent.number` must always be multiplied through for costs/constraint counts, regardless of the `collective` flag — `collective` only affects how the UI *displays* stacked instances, not the underlying math.
- `max="1"` selection groups are mutually-exclusive choices (radio-button semantics), not "at most 1 of a countable thing."
- Optional upgrades (no `min > 0`) must not have their profiles/rules auto-accumulated onto the parent unit until the player actually selects them.
- `Saving Throw Modifier` characteristic values can mean either a fixed base save (`4+`) or an additive modifier (`-1`/`+1`); regex-distinguish them and avoid double-dipping when an item's name-based keyword bonus already grants the same effect.

### UI structure

- `App.jsx` is a single-page view switcher (`rosters` / `importer` / `builder` / `play`) with no router; it also owns PWA install/update-prompt handling and the global "debug ID" click-to-edit feature (click a `.debug-id-badge` to open `DebugEntryEditorModal` via `findExactEntryById`/`searchEditableEntries` in `src/parser/catalogEditor.js`).
- `src/components/editor/` — roster-building UI (`SelectionConfigurator`, `OptionGroup`, `UnitSelectionCard`, `CategoryUnitAdder`, `RosterSidebar`, `BottomSheet`, `NewRosterModal`, debug tooling).
- `src/components/play/` — play-mode UI (e.g. `PlayUnitDetails`).
- Debug mode is toggled via `src/hooks/DebugContext.jsx` and only exposed when running on localhost/private IPs.
- Keep local helper functions (e.g. `getSelectedUpgrades`) inside the component that uses them rather than centralizing in `RosterEditor.jsx`, to avoid monolithic files.

### Styling conventions

- No ad-hoc inline `style={{...}}` props in JSX for layout/color/typography — use existing global/utility CSS classes (`src/index.css`) instead.
- Use the semantic typography classes (`.text-display`, `.text-heading`, `.text-subheading`, `.text-ui-title`, `.text-body`, `.text-label`, `.text-micro`) and their `--fs-*` variables rather than one-off font sizes; they already handle desktop/mobile via media queries.
- Responsive breakpoint is **900px**: above it, detail info (e.g. equipment profiles) shows via hover tooltip (`gothic-tooltip`); at or below it, use the `BottomSheet` modal instead.

### PWA / service worker

- `vite.config.js` has a custom `swVersionPlugin` that rewrites `CACHE_NAME` in the built `sw.js` with a fresh build ID on every `vite build`, so browsers reliably detect updates (otherwise `sw.js` never changes and `updatefound` never fires). Install-prompt and update-toast handling live in `App.jsx`.

### Reference data

- `catalogs/whfb6/` contains real Warhammer Fantasy Battle 6th Edition Battlescribe catalog files (from the community BSData-style repo) used as the sample/test dataset for imports and the E2E test.
