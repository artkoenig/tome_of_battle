# design-sync notes — tome_of_battle

## What this repo is, for sync purposes

An application, not a component library: no library build, no Storybook, no
`.d.ts`, and every component under `src/ui/components/` is a **default** export.
Three consequences drive the whole config:

- **`.design-sync/entry.jsx` is the design-system entry** (`--entry`). The
  converter's synthesized entry uses `export *`, which does not carry default
  exports, so it would have found almost nothing. The barrel also *is* the
  scope decision: the presentational components, without the app-shell
  containers wired to roster state and IndexedDB.
- **The CSS is imported from that entry**, not wired through `cfg.cssEntry`.
  `src/index.css` is only a 2 KB list of `@import`s with relative paths;
  pointed at as `cssEntry` it is copied verbatim and every one of the 33 area
  stylesheets is left behind — designs then render completely unstyled.
  Importing it from the JS entry makes esbuild follow the chain and emit one
  flattened `_ds_bundle.css` (~65 KB), in the repo's own cascade order.
- **`cfg.dtsPropsFor` is unused but wanted.** The sources are `.jsx` with JSDoc,
  so every emitted `<Name>Props` is `[key: string]: unknown` — honest, but no
  contract for the design agent. Hand-written prop bodies are the standing
  improvement for the next sync; the authored previews carry the real shapes in
  the meantime.

## Fixes this sync had to find

- **`/`-absolute asset URLs.** `26-empty-states.css` uses `url(/skull_shield.png)`
  and `url(/empty_systems.png)`; the app serves those from `public/`, esbuild
  reads the leading slash as the filesystem root and fails the CSS build.
  `.design-sync/tsconfig.sync.json` maps `/*` onto `.design-sync/asset-stubs/*`.
  Stubs rather than the real files on purpose: `empty_systems.png` is 368 KB and
  would be inlined as a data URL into every design's stylesheet, and the rules
  belong to app-shell containers that are not exported anyway.
- **`skull_shield.png` does not exist** anywhere in the repo — that URL is
  dangling in the app itself, not just in the sync. Worth a look independently
  of design-sync.
- **Comments break `cfg.tsconfig`.** The converter strips `//` comments with a
  regex before `JSON.parse`; a `"//": "..."` *key* is mangled by it, the parse
  throws, and the paths plugin silently returns null. Keep that file
  comment-free.
- **Brand fonts.** Cinzel and Lora are loaded by a `<link>` in `index.html`,
  which the design system never sees. They are now self-hosted: 16 woff2 files
  in `.design-sync/fonts/` wired through `cfg.extraFonts`. A remote
  `@import` was tried first and is worse twice over — appended after the cascade
  by `cssEntry` a browser ignores it outright, and even hoisted to line 1 the
  font fetch stalled `page.goto` past its timeout on two cards.
- **`SettingsProvider` is required, and was invisible.** `useRuleUrl` reads it
  via `useSettings`, which throws without a provider — that killed the *whole*
  card, not just the icon, for every chip-bearing component. It is mounted by
  `DesignSurface` and, since consumers need it too, exported from the barrel.
- **A provider must not render into the card root.** `DesignSurface` first
  rendered its `<style>` beside `children`; that gave the root a child even when
  the component rendered nothing, which is exactly the signal the harness reads
  to swap in the floor card. Every null-rendering component was reported blank
  instead. The rules go into `document.head` from a layout effect.
- **Fixed overlays need a stage.** The preview card puts a `transform` on the
  cell, so a `position: fixed` overlay resolves against *that cell*, not the
  viewport, and a content-height cell clips the dialog header. Each overlay
  preview stands on an explicit-height wrapper; `ConfirmationDialog`,
  `BottomSheet`, `GothicTooltip` and `NewRosterModal` additionally use
  `cardMode: single`, which is what silences `[GRID_OVERFLOW]`.

## Findings about the app (not sync problems)

- **`validation-message--<severity>` has no styling.** `ValidationMessage`
  emits `.validation-message` and `.validation-message--error|warning|info`,
  and a test pins that contract — but no stylesheet defines any of the three,
  so error, warning and info render identically. The tokens for it already
  exist (`--text-danger-readable`, `--text-warning-readable`,
  `--text-info-readable`). The previews show the real render rather than
  inventing colour.

## Known render warns

- `[FONT_MISSING] "EB Garamond", "Garamond"` — expected and harmless. Both are
  fallbacks inside `--font-body: 'Lora', 'EB Garamond', Garamond, serif`; Lora
  ships, so neither is ever reached.

## Deliberately out of scope

- `PreviewBadge` — excluded via `componentSrcMap: null`. It renders only on one
  Vercel preview hostname (`src/ui/components/previewHost.js`): deploy chrome,
  not a design-system component.
- The app-shell containers (`RosterEditor`, `RosterDashboard`, `PlayMode`,
  `Importer`, `AppDialogs`, `SettingsDialog`, `RulesIndexDialog`, the
  `Roster*`/`Force*` sections, `SelectionConfigurator`, `CategoryUnitAdder`) —
  not exported. They read roster state and IndexedDB and have no standalone
  design value.

## Floor cards — the standing offer

Seven components ship fully functional with a typographic floor card:
`AutoFillSuggestions`, `ListRuleChecklist`, `OptionGroup`, `UnitCardList`,
`UnitRulesChips`, `UnitSelectionCard`, `UnitUpgradesChips`. All of them hang off
view models (`useUnitCard`, `useOptionGroup`, `useListRuleChecklist`, …) that
read `useRosterReport` / `useRosterCommands` — i.e. a full evaluator report and
IndexedDB-backed commands. Authoring these means building a realistic report
fixture; `src/tests/ui/components/editor/` is the place to mine for one, and
`UnitSelectionCard` is the one worth doing first (`UnitCardList` then follows
for free, since it only maps over it).

## Re-sync risks

- **The font files are a snapshot.** `.design-sync/fonts.css` was generated from
  the Google Fonts query in `index.html`. Change the families or their axes
  there and this file does not follow — regenerate it from the new query.
- **The asset stubs are keyed by filename.** A new `/`-absolute `url()` in any
  stylesheet needs a matching stub in `.design-sync/asset-stubs/`, or the CSS
  build fails. The failure is loud, not silent.
- **The barrel is hand-maintained.** A new presentational component does not
  appear in the design system until it is added to `.design-sync/entry.jsx`
  *and* `componentSrcMap`.
- **Preview fixtures were copied from tests, not imported.** The violation and
  cause shapes in `.design-sync/previews/` mirror the report contract as
  `ValidationMessage.evaluator.test.jsx` builds it. If that contract changes,
  the previews still render — they just stop being true.
- **`DesignSurface` is preview-only but publicly exported**, because
  `cfg.provider` must name a bundle export. It is inert outside a preview card
  (it only appends a stylesheet to `document.head`), but it does show up in
  `window.TomeOfBattle`.
- **Never verified against claude.ai/design itself.** This run had no
  design-system authorization, so nothing was uploaded; the whole bundle was
  verified locally against headless chromium only.

## Environment

- Playwright **1.56.0** — that is the release pinning chromium build `1194`,
  which is what this container caches at `/opt/pw-browsers`. The newest release
  (1.62.1) pins `1234` and fails with `Executable doesn't exist`.
