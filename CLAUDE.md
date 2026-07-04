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
npm run debug-ui             # node scripts/debug_ui.js — scripted puppeteer debugging session
```

- `src/solver/ui.test.js` is excluded from the vitest run (see `vitest.config.js`) and executed separately by `npm test`. It packs `public/catalogs/whfb6/*.cat|*.gst` into a zip with JSZip, boots a Vite server on port 5175, and drives it with Puppeteer — a full import→build→play E2E smoke test.
- All unit tests must pass before a task is considered done.
- On macOS, `browser_subagent`/`open_browser_url` don't work for manual UI checks — use the Puppeteer scripts in `scripts/` (e.g. `node scripts/generate_screenshots.js`) instead. On Linux/cloud, `/browser` and `browser_subagent` work normally.
- After any UI-visible change, take a Puppeteer screenshot of the affected view (before/after or just the result) and send it to the user as confirmation — but only when the user is not working locally at their own machine (e.g. a remote/cloud session such as claude.ai/code web or mobile), since in that case they can't otherwise see the running app themselves. Skip this when the session runs on the user's local machine — they can check the UI themselves there. **Always actually send the screenshot files to the user (via SendUserFile) for verification BEFORE deleting/cleaning up any generated screenshot or repro artifacts — never just describe them in text and then remove them.**

## Architecture

### Data flow: Battlescribe → IndexedDB → Roster state

1. **Import**: `Importer.jsx` → `src/parser/zipExtractor.js` unzips a `.bsz`/zip of catalogs, `src/parser/xmlParser.js` parses the raw `.cat`/`.gst` XML into a "system" object (catalogues, category/force entries, cost types, profiles, rules, constraints, modifiers, entry links, etc.).
2. **Storage**: `src/db/database.js` wraps IndexedDB with two object stores: `systems` (parsed game systems) and `rosters` (user army lists). No ORM — plain promise-wrapped `IDBRequest` calls. Treat this file as the only place that touches IndexedDB directly (repository pattern); components/hooks should go through it or through hooks built on top of it.
3. **Migrations**: `src/db/migrations.js` runs `runSystemMigrations` on every system loaded at app start (in `App.jsx`) to backfill/upgrade older stored system objects.
4. **Roster state**: `src/hooks/useRoster.js` is the central state manager for one roster being edited. It builds the `Selection` tree from catalog entries, mutates it immutably, and on every change **debounces (150ms) autosave to IndexedDB plus a recompute of costs/validation** via `src/solver/validator.js`; pending saves are flushed on unmount, so no explicit save step is required (a manual `save()` exists too). The selected selection is tracked by ID and derived from the roster tree via `useMemo` — never hold direct node object references in state.
5. **Play state**: `src/hooks/usePlayState.js` manages transient game-mode state (round, VP, CP, per-model wounds) layered on top of a roster.

### Data model (`src/types.js`, JSDoc typedefs only — no TS)

`Roster` → `Force[]` → `Selection[]` (recursive tree, a `Selection` can contain child `Selection`s). A `Selection` references its catalog definition via `entryLinkId` XOR `selectionEntryId`, not by embedding the definition — the definition is re-resolved from the `system` object at read time via `resolveEntry`/`findEntryInSystem` (`src/solver/catalogResolver.js`). `catalogueId` context must be threaded through whenever resolving entries/profiles/rules, since the same target ID can mean different things in different catalogues/detachments.

### The "solver" (`src/solver/`) — core rules engine, framework-agnostic

- `catalogResolver.js` — resolves entry links / selection entries against a system, across catalogues.
- `modifierEvaluator.js` — evaluates Battlescribe `condition`/`conditionGroup`/`modifier` constructs (used to adjust constraint values dynamically).
- `optionsCollector.js` — recursively collects available profiles/rules/options for a unit, respecting nesting (e.g. an upgrade's own sub-options only become selectable once the parent upgrade is actually chosen).
- `rosterCounter.js` — computes selection/category/force counts and point costs across a roster.
- `rulesEvaluator.js` — special rule text/keyword evaluation.
- `rosterValidator.js` — constraint validation of a whole roster (`validateRoster`), split into named check steps (cost limit, per-force category limits, entry constraints, group constraints).
- `profileCollector.js` — `collectUnitProfilesAndRules`: recursively collects the effective profiles/rules of a unit and applies characteristic modifiers.
- `rosterSync.js` — re-syncs stored roster selections (names/costs) with a re-imported system.
- `forceEntries.js` — force entry (detachment) lookup helpers.
- `entryVisibility.js` — evaluates the effective `hidden` state of entries/category links (incl. `field="hidden"` modifiers).
- `systemQuirks.js` — declarative per-game-system special cases (keyed by `.gst` system ID), e.g. category max inheritance or general-entry IDs. New catalog quirks belong here as data, never as `if` branches in solver logic.
- `validator.js` — pure facade; re-exports everything above. This is the module the rest of the app imports from.
- The standalone Puppeteer/Node tools (`generate_screenshots.js`, `debug_ui.js`, `stress_m3.js`, `ux_*_walkthrough.js`, etc.) live in `scripts/`; only `ui.test.js` (the E2E) remains in `src/solver/`.

### Battlescribe domain rules (non-obvious, see `docs/battlescribe-data-format.md` for the full data-format reference — add new discoveries there)

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
- **Versioning + changelog** (pure logic in `scripts/versioning.js`, shared by two consumers via `resolveVersion`; deploy is on **Vercel**, which builds on every push):
  - `versionPlugin` in `vite.config.js` is **read-only** — it never creates or pushes tags. At `vite build` it derives the semver version and writes `changelog.json`; in dev it serves `/changelog.json` live. Building `main` → next **minor** release (`vX.(Y+1).0`), or the tag already on HEAD if this commit was released; any other branch → current version + commit hash as build metadata (`vX.Y.Z+<shorthash>`). **Major** is only ever set manually. Notes = commit subjects since the base release tag up to HEAD. On Vercel it best-effort `git fetch --tags --unshallow`es first (shallow clone has no tags).
  - `scripts/tag-release.js` (run by `.github/workflows/tag-release.yml` on push to `main`) is the **only** thing that creates + pushes release tags — it's the one place with push credentials. It's idempotent (skips if HEAD is already tagged). `AUTO_TAG_NO_PUSH=1` keeps the tag local (tests).
  - Because both use `resolveVersion` and the plugin reuses an existing HEAD tag instead of re-bumping, Vercel and the CI tagger always agree on the version regardless of ordering. The update toast fetches `changelog.json` fresh (cache-busted) and shows "what's new".
  - **Commit messages ARE the release notes.** Since notes = commit subjects since the last release tag, every commit subject on `main` shows up verbatim in the end-user "what's new" toast. Write subjects for end users, not developers: describe the user-visible change in plain language (ideally German, matching the UI), no internal jargon, file names, or ticket refs. E.g. prefer "Einheiten lassen sich jetzt per Drag & Drop umsortieren" over "refactor: move sort handler into useRoster".

### Reference data

- `public/catalogs/whfb6/` contains real Warhammer Fantasy Battle 6th Edition Battlescribe catalog files (from the community BSData-style repo) used as the sample/test dataset for imports and the E2E test.
