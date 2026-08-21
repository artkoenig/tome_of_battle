# Project Map

## How to use this map

This page orients any agent — main session or subagent — at the start of a
task: where things live, and which deeper document to read for the how and
why. It is not a tutorial and not a substitute for the required reading in
[`AGENTS.md`](../CLAUDE.md) (the ADRs, `battlescribe-data-format.md`). Where
this map and a linked ADR or deep doc disagree, the linked doc is right and
this map is out of date — follow the linked doc and flag the map for
correction.

## Root layout

- **`.agents/AGENTS.md`** (symlinked as `CLAUDE.md` at the repo root) — the
  agent entry point: required reading, the one command block, and pointers
  into `.claude/rules/` for everything else.
- **`.claude/rules/`** — the project's working rules, one topic per file.
  `areas/<area>.md` carries what is true of one directory only and loads on a
  `paths:` glob when an agent reads a file it matches.
- **`README.md`** — contributor-facing (English): features, getting started,
  an Architecture section covering the write model and the evaluator, the
  data model, tech stack.
- **`docs/`** — all reference documentation; see below.
- **`src/`** — the application; see below.
- **`e2e/`, `scripts/`** — see [Testing layers](#testing-layers) and
  [`scripts/`](#scripts--automation-not-app-code) below.
- **`tools/`, `public/`** — auxiliary tooling and static assets, not covered
  further here.

## `src/` — subsystem boundaries

**The three layers.** The subsystems below group into three layers, `UI → Fachlogik →
Daten` ([ADR 0037](adr/0037-schichtenarchitektur-ui-fachlogik-daten.md)). The arrow is
the *allowed* dependency direction: a higher layer may import a lower one, a reach back
from low to high is forbidden.

| Layer | Directories | Responsibility |
|---|---|---|
| UI | `src/ui/components/`, `src/ui/viewmodels/`, `src/ui/contexts/`, `src/ui/styles/`, `src/ui/i18n/` (and `src/ui/hooks/`) | Presentation and interaction |
| Fachlogik | `src/domain/evaluator/`, `src/domain/evaluation/`, `src/domain/roster/` | Evaluation, write model, translation between the two |
| Daten | `src/data/services/`, `src/data/db/`, `src/data/parser/`, `src/data/rules/` | Persistence, import, catalogue decomposition |

Since issue 0171 the directories carry the layer names: every subsystem lives under
`src/ui/`, `src/domain/` or `src/data/`. What belongs to no layer — `src/shared/constants/`,
`src/shared/types.js`, `src/shared/test-utils/`, `src/shared/__fixtures__/` — sits under
`src/shared/`; only the entry point `src/main.jsx` and its `src/index.css` stay at the root
of `src/`.

`src/data/services/` is the single address through which the UI reaches data. Four rules in
`.dependency-cruiser.cjs` (`ui-nicht-auf-daten`, `daten-kein-rueckgriff`,
`fachlogik-kein-rueckgriff`, `keine-i18n-unter-ui`) measure the direction. They start as
`warn` and are pulled to `error` as each phase (issues 0161–0171) removes its
violations; `ui-nicht-auf-daten` is `error` since issue 0167 moved the 14 direct
UI → data edges onto the facade, and `fachlogik-kein-rueckgriff` plus
`keine-i18n-unter-ui` since issue 0169. `src/utils/` belonged to no layer and is
dissolved: every file of it now sits in the layer it belongs to.

| Folder | Responsibility |
|---|---|
| `src/data/services/` | The data facade (ADR 0037): `rosterStore.js`, `systemLibrary.js`, `settings.js`, `catalogRevisions.js`, `rosterTransfer.js`, plus the one change channel `dataEvents.js`. Every writing call announces its completion there; `src/ui/hooks/useAppData.js` is the single place that subscribes. |
| `src/data/parser/` | Imports uploaded `.cat`/`.gst`/`.zip` files: `zipExtractor.js`, `xmlParser.js`, advisory XSD validation (`schemaValidator.js`, [ADR 0016](adr/0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md)), `catalogEditor.js`. Has its own XML reader — separate from the evaluator's, a common source of confusion. |
| `src/data/db/` | IndexedDB persistence (`database.js`: stores `systems`/`rosters`/`settings`), migrations, catalog fork fetch (`catalogUpdate.js`, [ADR 0014](adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md)/[0017](adr/0017-lexicanum-katalog-fork-mit-eigener-revision-ci.md)/[0018](adr/0018-katalog-mehrquellenbetrieb-ergofarg-und-lexicanum-parallel.md)); see [ADR 0002](adr/0002-data-flow-and-indexeddb-storage.md). |
| `src/domain/roster/` | The app's **write model**: builds, resolves and rewrites the selection tree (`selectionFactory.js`, `rosterTree.js`, `catalogResolver.js`, `rosterSync.js`, `rosterSerialization.js` — the `.ros` XML export/import —, `createRoster.js`, `rosterDefaults.js`, ...). Structural only — it does not judge a roster ([ADR 0011](adr/0011-roster-referenzmodell-und-serialisierungs-adapter.md)). Barrel `index.js` is convenience only, not an enforced facade. |
| `src/domain/evaluator/` | The "Reinraum" (clean-room) rule-evaluation engine — a pure function `evaluate(catalog, roster) → report`. The **only** production engine, successor to the deleted, faulty `src/solver/` ([ADR 0029](adr/0029-zentrale-query-engine-fuer-constraint-auswertung.md) → [0030](adr/0030-zweite-eigenstaendige-auswertungs-engine.md)). Deep reference: [`evaluator-architecture.md`](evaluator-architecture.md). Its own XML reader (`catalogReader.js`) is intentionally separate from `src/data/parser/`'s. |
| `src/domain/evaluation/` | The bridge between the two: `rosterAdapter.js` translates the IndexedDB roster into the evaluator's input, `evaluationCache.js` memoizes the one `evaluateAppRoster` seam, `useEvaluation.js` is the hook the editor and play mode both use. |
| `src/ui/components/` | React UI: `Importer`, `RosterDashboard`, `RosterEditor`, `PlayMode`, dialogs; subfolders `editor/`, `importer/`, `play/`. Most `.jsx` files are paired 1:1 with a `.test.jsx`. |
| `src/ui/hooks/` | Focused, independently-testable hooks: `usePlayState`, `useAppData`, `useAppNavigation`, `useUndoableState` ([ADR 0013](adr/0013-generischer-undo-redo-hook.md)), `useRuleUrl`, `useToast`, ... |
| `src/ui/contexts/` | Only `SettingsContext.jsx` (whfb6 rule-linking toggle, [ADR 0015](adr/0015-settings-context-fuer-whfb6-verlinkung.md)). |
| `src/data/rules/` | `rules-index.json` (generated by `scripts/generate-rules-index.js`) plus lookup/synonym matching to 6th.whfb.app rule pages ([ADR 0012](adr/0012-integration-externer-regeltexte-6th-whfb-app.md)). |
| `src/ui/i18n/` | Home-grown i18n, no library ([ADR 0026](adr/0026-i18n-eigenloesung-json-und-intl-ohne-library.md)): `i18nStore.js`, `translate.js`, `locales/{de,en}.json`, `violationMessages.js` for evaluator report projection. |
| `src/shared/constants/` | Only `views.js`. |
| `src/ui/styles/` | 33 numbered CSS layer files loaded in cascade order ([ADR 0004](adr/0004-styling-conventions.md) §6). |
| `src/shared/test-utils/`, `src/shared/__fixtures__/` | Shared test setup and sample catalogs (`generic/`, `whfb6/`, `whfb6-lexicanum/`). |

**The Reinraum boundary.** `src/domain/evaluator/` and `src/domain/roster/` must not import
each other in either direction, and `src/domain/evaluator/evaluator.js` is the only
legal external entry point into the evaluator. Both rules are
**machine-enforced**, not just documented, as blocking `error` rules in
`.dependency-cruiser.cjs` (`evaluator-keine-roster-abhaengigkeit`,
`roster-keine-evaluator-abhaengigkeit`, `evaluator-nur-ueber-fassade`) and
matching `no-restricted-imports` patterns in `.oxlintrc.json`. `npm run
depcruise` / `npm run lint` catch a violation immediately.

## `docs/` — the doc tree

- **`adr/`** — Architecture Decision Records, required reading before any
  development ([`AGENTS.md`](../CLAUDE.md)). See [`adr/README.md`](adr/README.md)
  for the full index; the [cluster overview](#adr-clusters-quick-index-by-topic)
  below groups them by topic.
- **`../.claude/agents/`** — subagent role contracts (currently just
  `.claude/agents/e2e-testcase-author.md`: what it may
  read, what it must produce, why it's kept blind to the evaluator source).
- **`PRD-*.md`** — product requirement docs for specific larger features
  (undo/redo, catalog updates & roster compatibility, roster serialization
  adapter, the rules-URL editor).
- **`battlescribe-data-format.md`** — the canonical BattleScribe file-format
  reference for this project, required reading before any work
  ([`AGENTS.md`](../CLAUDE.md)). Curated from real catalog files plus the
  wiki below.
- **`bsdata-catalogue-development-wiki/`** — git submodule of the upstream
  [BSData catalogue-development wiki](https://github.com/BSData/catalogue-development/wiki)
  (`git submodule update --init --recursive` to populate it if empty,
  `--remote` to refresh). Pages: `Home`, `Getting-Started`,
  `Data-structure-overview` (the element-by-element format walkthrough — the
  direct upstream source for `battlescribe-data-format.md`),
  `Data-Author-Guide`, `Data-Admin-Guide`, `Common-Catalogue-Patterns`,
  `Collective-Entries`, `Catalogue-Guidelines`, `Forking-Guide`,
  `Joining-Repository`, `Hosting-repositories`, `Code-of-Conduct`. Treat it
  as raw upstream community documentation; `battlescribe-data-format.md` is
  this project's own curated, project-specific distillation of it — read
  that first, fall back to the wiki only for something it doesn't cover.
- **`evaluator-architecture.md`** — the reference architecture for
  `src/domain/evaluator/` (pipeline stages, invariants); what
  [ADR 0030](adr/0030-zweite-eigenstaendige-auswertungs-engine.md) implements.
- **`battlescribe-ui-renderer-audit.md`** — audit of how the UI renders
  BattleScribe content.
- **`testkatalog-evaluator-e2e.md`** — the evaluator's E2E test-catalog
  documentation; read together with [Testing layers](#testing-layers) below.
- **`issues/`** — the local issue tracker. See the "Issue tracker" section
  of [`AGENTS.md`](../CLAUDE.md) for the convention (`NNN-slug.md` with
  frontmatter) — not repeated here since it would drift.
- **`status/index.html`** — generated project-state report
  ("Zustandsbericht"), rebuilt on every push to `main` by
  `scripts/project-state/`, published via GitHub Pages
  ([ADR 0025](adr/0025-pages-quelle-auf-github-actions-mit-jekyll-build.md)).
  Never hand-edit it.
- **`testing/`** — evaluator E2E scenario fixtures, one subfolder per
  scenario (`README.md` + `scenario.json` + `rosters/*.ros`), read by
  `src/domain/evaluator/e2e.testcatalog.test.js`. Authored exclusively by the
  `e2e-testcase-author` subagent — see [Testing layers](#testing-layers).
- **`assets/`** — images/CSS/JS backing the landing page and the status
  report.

## Testing layers

Three layers, easy to conflate:

1. **Component/unit tests** — co-located `*.test.js`/`*.test.jsx` next to
   the source they cover, run via Vitest.
2. **Evaluator E2E** — `src/domain/evaluator/e2e.testcatalog.test.js` (plus
   `crossCatalog.test.js`) dynamically discovers scenarios under
   `docs/testing/`. Scenarios are authored **only** by the
   `e2e-testcase-author` subagent, from catalog data alone, never from
   evaluator source — see `.claude/agents/e2e-testcase-author.md`
   and [ADR 0033](adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md).
   If a change touches only `src/domain/evaluator/`, this plus its unit tests are
   all you need to run (`forge-test --run src/domain/evaluator`).
3. **App E2E** — `e2e/ui.test.js` (Puppeteer smoke test over the real UI,
   `data-testid` selectors) and `e2e/pwa.test.js` (manifest/icon file
   checks), sharing the harness `scripts/lib/e2e-harness.js`. Part of
   `npm test`.

## `scripts/` — automation, not app code

- **Codegen**: `generate-schema-module.js` (vendored `Catalogue.xsd` →
  `src/data/parser/schema/battlescribeSchema.generated.js`),
  `generate-rules-index.js` (→ `src/data/rules/rules-index.json`),
  `rules-crawler.js`.
- **Release**: `release.js`, `versioning.js`, `deployEnv.js`.
- **Screenshots**: `generate_screenshots.js` (offline, every main view),
  `generate_showcase_screenshots.js` (curated landing-page shots),
  `generate_pwa_icons.js`.
- **Evaluator measurement** (not production code): `measure-evaluator.js` /
  `measure-evaluator-browser.js` — performance against real catalog data,
  jsdom vs. real browser.
- **`scripts/project-state/`** — generates `docs/status/index.html`
  (complexity, coverage, quality gates, dependency graph, issue-tracker
  aggregation).
- **`scripts/catalog-fork/`** — CI tooling that runs **inside the external
  Lexicanum catalog fork repo**, not this one. Easy to mistake for local
  tooling.
- **`scripts/lib/`** — shared infra (`e2e-harness.js`, used by both
  `e2e/ui.test.js` and `generate_screenshots.js`).

See the Scripts table in [`README.md`](../README.md) for the full npm-script
list.

## ADR clusters (quick index by topic)

Full titles and status live in [`adr/README.md`](adr/README.md) — this is
only a topic map to help you find the right one:

- **Process**: 0001
- **Data flow, storage & deployment**: 0002, 0008, 0014, 0017, 0018, 0020, 0021, 0025
- **Domain rules & data model**: 0003, 0011, 0012, 0016
- **UI/UX & performance**: 0004, 0005, 0010, 0013, 0015
- **Testing, CI & release**: 0006, 0007, 0009, 0019, 0024
- **i18n & author messages**: 0026, 0027, 0028
- **Evaluator engine ("Reinraum")**: 0029 (superseded by 0030/0034), 0030–0036
- **Superseded/historical**: 0022 (→0035), 0023 (the old solver facade — the engine it described was deleted)

New ADR → add its number to the matching cluster (or open a new one). Keep
full titles out of this list; they live only in `adr/README.md`.

## Keeping this map fresh

No generator, no CI gate — this is a hand-maintained page, same as
`testkatalog-evaluator-e2e.md`. Update it in the same PR when a top-level
folder under `src/` or `docs/` appears, disappears, or changes purpose, or a
new ADR cluster forms. It is deliberately allowed to lag reality a little:
per [How to use this map](#how-to-use-this-map), a linked deep doc or ADR
always wins over this page, so a stale map misdirects at worst — it never
misleads about what's actually true.
