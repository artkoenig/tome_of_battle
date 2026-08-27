# Tome of Battle — building with this library

A dark, gothic tabletop-wargaming design system: obsidian surfaces, burnished
gold, parchment text. Cinzel for headings, Lora for body copy. Build on the
dark surface — there is no light theme, and a component placed on white will
look broken.

## Setup

Load `styles.css`. It is the whole look — brand webfonts first, then the
component cascade — and nothing renders on-brand without it.

Most components need no wrapper: translation is a module-level store that is
already initialised on import, so text resolves on its own.

**One exception.** `RuleChipIcon`, `UnitUpgradesChips`, `UnitRulesChips`,
`OptionGroup`, `UnitSelectionCard` and `ListRuleChecklist` resolve external rule
links through a settings context. Rendered outside `SettingsProvider`, that hook
treats the missing provider as a programming error and **throws**, taking the
whole tree down — not just the icon. Wrap once at the root:

```jsx
<SettingsProvider>
  <App />
</SettingsProvider>
```

`SettingsProvider` ships in the bundle. It hydrates from IndexedDB and falls
back to its documented default when that read fails, so it is safe to mount
anywhere.

## The styling idiom

Custom properties carry the design language; classes are semantic, not
utility-first. Use `var(--*)` for your own layout glue rather than literal
colours or fonts.

| Family | Names |
|---|---|
| Surfaces | `--bg-dark` `--bg-panel` `--bg-card` `--bg-parchment` |
| Borders | `--border-gold` `--border-gold-dim` `--border-dark` |
| Text | `--text-parchment` `--text-gold` `--text-gold-bright` `--text-dim` `--text-dark` |
| Status | `--color-danger` `--color-success` `--color-warning` `--color-info` |
| Status text (on dark) | `--text-danger-readable` `--text-success-readable` `--text-warning-readable` `--text-info-readable` |
| Type | `--font-serif` (Cinzel) `--font-body` (Lora) |
| Type scale | `--fs-display` `--fs-heading` `--fs-subheading` `--fs-ui-title` `--fs-body` `--fs-label` `--fs-micro` |
| Shadow | `--shadow-gold` `--shadow-glow` `--shadow-inset` |

A small class vocabulary exists on top, and it is the whole set — do not invent
neighbours to it:

- **Type**: `text-display` `text-heading` `text-subheading` `text-ui-title`
  `text-body` `text-label` `text-micro` `text-strong`, plus `font-serif`
  `font-body`
- **Status text**: `text-gold` `text-dim` `text-danger` `text-success`
- **Layout**: `flex-row` `flex-col` `flex-between` `push-end` `w-full`
  `no-shrink` `no-margin` `is-hidden` `flex-grow-truncating`, and the fixed
  gaps `gap-6` `gap-8` `gap-10` `gap-12`
- **Surfaces and controls**: `gothic-panel`, `btn` with `btn-primary`
  `btn-danger` `btn-sm`, `badge` with `badge-muted` `badge-danger`
  `badge-success`

Status colour is a text colour here, not a filled background: prefer
`text-danger` and `badge-danger` over a coloured surface.

## Where the truth lives

Read `styles.css` and the files it imports before styling anything — the
cascade is ordered and the numeric filename prefix *is* the cascade position.
Each component's `.prompt.md` carries its own props and usage.

## An idiomatic build

Library components for the parts; tokens and the class vocabulary for your own
glue.

```jsx
<SettingsProvider>
  <section className="gothic-panel flex-col gap-12">
    <h2 className="text-heading font-serif text-gold">Core Units</h2>

    <div className="flex-row flex-between">
      <span className="text-label text-dim">Regiments</span>
      <CategoryCountBadge count={2} min={1} max={3} hasErrors={false} />
    </div>

    <ValidationMessage violation={violation} />

    <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: 12 }}>
      <button type="button" className="btn btn-primary">Begin the muster</button>
    </div>
  </section>
</SettingsProvider>
```
