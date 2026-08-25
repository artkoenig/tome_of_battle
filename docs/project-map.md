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

**Cut by subject, not by technology.** Since issue 0186 `src/` is cut into bounded
contexts ([ADR 0042](adr/0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md)), and the
old technology drawers `src/domain/` and `src/data/` are gone. The layer direction of
[ADR 0037](adr/0037-schichtenarchitektur-ui-fachlogik-daten.md) survives it: `UI →
contexts → platform`, with `shared/` below everything and `src/tests/` beside it. The
arrow is the *allowed* dependency direction; a reach back is forbidden.

| Layer | Directories | Responsibility |
|---|---|---|
| UI | `src/ui/components/`, `src/ui/viewmodels/`, `src/ui/styles/`, `src/ui/i18n/`, `src/ui/constants/` | Presentation and interaction |
| Contexts | `src/contexts/armylist/`, `src/contexts/ruleengine/`, `src/contexts/catalog/`, `src/contexts/rulebook/` | The four bounded contexts: write model, evaluation and its read model, catalogue library, rule-text index. No context imports another (`kontext-kein-fremder-kontext`) |
| Ports | `src/contexts/armylist/ports/storagePort.js`, `src/contexts/catalog/ports/catalogRepository.js` | The **only** two modules under `src/contexts/` that may name `src/platform/` (`kontext-nicht-auf-plattform`). Pure re-export, no logic |
| Platform | `src/platform/persistence/`, `src/platform/battlescribe/` | Infrastructure: IndexedDB, import, catalogue decomposition. Reachable from a context only through a port |
| Shared kernel | `src/shared/rostermodel/types.js`, `src/shared/battlescribe/battlescribeSchema.generated.js`, `src/shared/events/dataEvents.js` | Vocabulary every layer shares and nothing depends back on: the list model typedefs, the vendored XSD enums and the data-change event bus (Issue 0186) |
| Tests | `src/tests/` | Every `*.test.*`/`*.spec.*` file under `src`, mirroring the subtree it tests, plus shared test setup (`test-utils/`) and sample catalogs (`__fixtures__/`) |

Issue 0179 had dissolved the first `src/shared/` — a catch-all for what belonged to no
layer — and moved `constants/views.js` to `src/ui/constants/` and
`test-utils/`/`__fixtures__/` to `src/tests/`. Issue 0186 reintroduces `src/shared/` with a
narrower meaning: the shared kernels of the cut by subject, three leaf modules that import
nothing and that every layer may read (`rostermodel/types.js`,
`battlescribe/battlescribeSchema.generated.js`, `events/dataEvents.js`). The cast rule
`shared-haengt-an-nichts` keeps its fan-out at zero. Only the entry point `src/main.jsx`
and its `src/index.css` stay at the root of `src/`.

`src/contexts/*/application/` is the single address through which the UI reaches data — the
old `domain/services/` facade (ADR 0037/0040), now split by subject between `armylist`
and `catalog`, and reaching the platform only through the two ports. The 23 rules in `.cast/rules.json` measure every direction of the cut:
`ui-nicht-auf-daten`, `plattform-kein-rueckgriff`, `fachlogik-kein-rueckgriff` and
`keine-i18n-unter-ui` for the layering, `kontext-kein-fremder-kontext`,
`kontext-nicht-auf-plattform`, `shared-haengt-an-nichts`, `evaluator-nur-ueber-fassade`,
`lesemodell-nur-ueber-fassade` and `nur-die-acl-ruft-die-engine` for the cut by subject.
Since the port from dependency-cruiser to cast
([ADR 0041](adr/0041-cast-als-strukturpruefer.md)) every rule is `error`: `npm run cast`
names what it finds and fails the gate.

| Folder | Responsibility |
|---|---|
| `src/contexts/armylist/application/` | The list-side data facade (ADR 0037, reclassified from Daten to Fachlogik by ADR 0040): `rosterStore.js`, `settings.js`, `rosterTransfer.js`. Reaches IndexedDB only through `../ports/storagePort.js`. Seit Issue 0188 liegen hier auch die Schreib-Anwendungsfaelle des Editors — `raiseUnit.js`, `removeUnit.js`, `copyUnit.js`, `renameRoster.js`, `subSelectionUseCases.js` und `rosterSelectionFactory.js`: reine Funktionen vom Roster auf das Roster, `system` und `report.slots` werden hereingereicht. |
| `src/contexts/catalog/application/` | The catalogue-side data facade: `systemLibrary.js`, `catalogRevisions.js` — import, library listing and the catalog fork revision state. Reaches persistence and the Battlescribe reader only through `../ports/catalogRepository.js`. The one change channel, `dataEvents.js`, is a shared kernel under `src/shared/events/` since issue 0186. Every writing call announces its completion there; `src/ui/viewmodels/useAppData.js` is the single place that subscribes. |
| `src/platform/battlescribe/` | Imports uploaded `.cat`/`.gst`/`.zip` files: `zipExtractor.js`, `xmlParser.js`, advisory XSD validation (`schemaValidator.js`, [ADR 0016](adr/0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md)), `catalogEditor.js`. Has its own XML reader — separate from the evaluator's, a common source of confusion. |
| `src/platform/persistence/` | IndexedDB persistence (`database.js`: stores `systems`/`rosters`/`settings`), migrations, catalog fork fetch (`catalogUpdate.js`, [ADR 0014](adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md)/[0017](adr/0017-lexicanum-katalog-fork-mit-eigener-revision-ci.md)/[0018](adr/0018-katalog-mehrquellenbetrieb-ergofarg-und-lexicanum-parallel.md)); see [ADR 0002](adr/0002-data-flow-and-indexeddb-storage.md). |
| `src/contexts/armylist/model/` | The app's **write model**: builds, resolves and rewrites the selection tree (`selectionFactory.js`, `rosterTree.js`, `catalogResolver.js`, `rosterSync.js`, `rosterSerialization.js` — the `.ros` XML export/import —, `createRoster.js`, `rosterDefaults.js`, ...). Structural only — it does not judge a roster ([ADR 0011](adr/0011-roster-referenzmodell-und-serialisierungs-adapter.md)). Barrel `index.js` is convenience only, not an enforced facade. |
| `src/contexts/ruleengine/engine/` | The "Reinraum" (clean-room) rule-evaluation engine — a pure function `evaluate(catalog, roster) → report`. The **only** production engine, successor to the deleted, faulty `src/solver/` ([ADR 0029](adr/0029-zentrale-query-engine-fuer-constraint-auswertung.md) → [0030](adr/0030-zweite-eigenstaendige-auswertungs-engine.md)). Deep reference: [`evaluator-architecture.md`](evaluator-architecture.md). Its own XML reader (`catalogReader.js`) is intentionally separate from `src/platform/battlescribe/`'s. |
| `src/contexts/ruleengine/acl/`, `readmodel/` | The bridge between the two, behind the one door `readmodel/index.js` (issue 0186): `acl/rosterAdapter.js` translates the IndexedDB roster into the evaluator's input, `evaluationCache.js` memoizes the one `evaluateAppRoster` seam, `useEvaluation.js` is the hook the editor and play mode both use. |
| `src/ui/components/` | React UI: `Importer`, `RosterDashboard`, `RosterEditor`, `PlayMode`, dialogs; subfolders `editor/`, `importer/`, `play/`. Most `.jsx` files are paired 1:1 with a `.test.jsx`. |
| `src/ui/viewmodels/` | The ViewModel layer ([ADR 0038](adr/0038-custom-hooks-als-viewmodel-je-ui-baustein.md)): one ViewModel per screen, overlay and editor leaf (`editor/`), the roster state node (`useRosterState.js`), the two roster contexts and `SettingsContext.jsx` (whfb6 rule-linking toggle, [ADR 0015](adr/0015-settings-context-fuer-whfb6-verlinkung.md)), plus the app-level hooks `usePlayState`, `useAppData`, `useAppNavigation`, `useUndoableState` ([ADR 0013](adr/0013-generischer-undo-redo-hook.md)), `useRuleUrl`, `useToast`, `useRosterList`, `usePwaLifecycle`, `useViewportHeight`. Since Issue 0178 the layer has one directory. |
| `src/contexts/rulebook/` | `rules-index.json` (generated by `scripts/generate-rules-index.js`) plus lookup/synonym matching to 6th.whfb.app rule pages ([ADR 0012](adr/0012-integration-externer-regeltexte-6th-whfb-app.md)). Reclassified from Daten to Fachlogik by ADR 0040. |
| `src/ui/i18n/` | Home-grown i18n, no library ([ADR 0026](adr/0026-i18n-eigenloesung-json-und-intl-ohne-library.md)): `i18nStore.js`, `translate.js`, `locales/{de,en}.json`, `violationMessages.js` for evaluator report projection. |
| `src/ui/constants/` | Only `views.js` (moved from `src/shared/constants/` by issue 0179). |
| `src/ui/styles/` | 33 numbered CSS layer files loaded in cascade order ([ADR 0004](adr/0004-styling-conventions.md) §6). |
| `src/tests/` | Every relocated `*.test.*`/`*.spec.*` file, mirroring its original layer subtree, plus `test-utils/` and `__fixtures__/` (shared test setup and sample catalogs — `generic/`, `whfb6/`, `whfb6-lexicanum/`; both moved from `src/shared/` by issue 0179). |

**The Reinraum boundary.** `src/contexts/ruleengine/engine/` and `src/contexts/armylist/model/` must not import
each other in either direction, and `src/contexts/ruleengine/evaluator.js` is the only
legal external entry point into the evaluator. Both rules are
**machine-enforced**, not just documented: as blocking `no-restricted-imports`
patterns in `.oxlintrc.json`, and as the cast rules
`evaluator-keine-roster-abhaengigkeit`, `roster-keine-evaluator-abhaengigkeit`
and `evaluator-nur-ueber-fassade` in `.cast/rules.json`, which are `error` since
Issue 0181 ([ADR 0041](adr/0041-cast-als-strukturpruefer.md)). `npm run lint`
fails on a violation, and so does `npm run cast`, which names it with its file
and its line.

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
  `src/contexts/ruleengine/engine/` (pipeline stages, invariants); what
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
  `src/tests/contexts/ruleengine/engine/e2e.testcatalog.test.js`. Authored exclusively by the
  `e2e-testcase-author` subagent — see [Testing layers](#testing-layers).
- **`assets/`** — images/CSS/JS backing the landing page and the status
  report.

## Testing layers

Three layers, easy to conflate:

1. **Component/unit tests** — `*.test.js`/`*.test.jsx` under `src/tests/`, mirroring the
   layer subtree of the source they cover (issue 0179), run via Vitest.
2. **Evaluator E2E** — `src/tests/contexts/ruleengine/engine/e2e.testcatalog.test.js` (plus
   `crossCatalog.test.js`) dynamically discovers scenarios under
   `docs/testing/`. Scenarios are authored **only** by the
   `e2e-testcase-author` subagent, from catalog data alone, never from
   evaluator source — see `.claude/agents/e2e-testcase-author.md`
   and [ADR 0033](adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md).
   If a change touches only `src/contexts/ruleengine/engine/`, this plus its unit tests are
   all you need to run (`forge-test --run src/contexts/ruleengine/engine`).
3. **App E2E** — `e2e/ui.test.js` (Puppeteer smoke test over the real UI,
   `data-testid` selectors) and `e2e/pwa.test.js` (manifest/icon file
   checks), sharing the harness `scripts/lib/e2e-harness.js`. Part of
   `npm test`.

## `scripts/` — automation, not app code

- **Codegen**: `generate-schema-module.js` (vendored `Catalogue.xsd` →
  `src/shared/battlescribe/battlescribeSchema.generated.js`),
  `generate-rules-index.js` (→ `src/contexts/rulebook/rules-index.json`),
  `rules-crawler.js`.
- **Release**: `release.js`, `versioning.js`, `deployEnv.js`.
- **Screenshots**: `generate_screenshots.js` (offline, every main view),
  `generate_showcase_screenshots.js` (curated landing-page shots),
  `generate_pwa_icons.js`.
- **Evaluator measurement** (not production code): `measure-evaluator.js` /
  `measure-evaluator-browser.js` — performance against real catalog data,
  jsdom vs. real browser.
- **`scripts/project-state/`** — generates the status report (`.report/index.html` locally, `/status` on Pages; never committed)
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
