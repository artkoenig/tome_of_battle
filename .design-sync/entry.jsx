// Design-system entry for /design-sync.
//
// The app has no library build: every component under `src/ui/components/` is a
// default export, and the converter's synthesized entry uses `export *`, which
// does not carry defaults. This barrel gives the converter a real entry and, in
// doing so, fixes the exported surface: the presentational components, without
// the app-shell containers that are wired to roster state and IndexedDB.
// The 33 area stylesheets are pulled in through the app's own cascade entry, in
// its own order (the number in each filename IS the cascade position). Importing
// it here makes esbuild follow the `@import` chain and emit one flattened
// `_ds_bundle.css`; pointing `cssEntry` at `src/index.css` instead only copies
// the two-kilobyte import list and ships designs unstyled.
import '../src/index.css';

export { default as GothicTooltip } from '../src/ui/components/GothicTooltip.jsx';
// PreviewBadge is deliberately not exported: it renders only on one Vercel
// preview hostname (`src/ui/components/previewHost.js`) and is deploy chrome
// rather than a design-system component.

export { default as AutoFillSuggestions } from '../src/ui/components/editor/AutoFillSuggestions.jsx';
export { default as BottomSheet } from '../src/ui/components/editor/BottomSheet.jsx';
export { default as CategoryCountBadge } from '../src/ui/components/editor/CategoryCountBadge.jsx';
export { default as ConfirmationDialog } from '../src/ui/components/editor/ConfirmationDialog.jsx';
export { default as ListRuleChecklist } from '../src/ui/components/editor/ListRuleChecklist.jsx';
export { default as NewRosterModal } from '../src/ui/components/editor/NewRosterModal.jsx';
export { default as OptionGroup } from '../src/ui/components/editor/OptionGroup.jsx';
export { default as RuleChipIcon } from '../src/ui/components/editor/RuleChipIcon.jsx';
export { default as UnitCardList } from '../src/ui/components/editor/UnitCardList.jsx';
export { default as UnitSelectionCard } from '../src/ui/components/editor/UnitSelectionCard.jsx';
export { default as ValidationCauses } from '../src/ui/components/editor/ValidationCauses.jsx';
export { default as ValidationMessage } from '../src/ui/components/editor/ValidationMessage.jsx';
export { UnitUpgradesChips, UnitRulesChips } from '../src/ui/components/editor/UnitChips.jsx';

// Exported, not merely imported: the chip-bearing components below throw
// outside this provider, so it is part of the public surface a consumer has to
// mount - not an internal of the preview harness.
import { SettingsProvider } from '../src/ui/viewmodels/SettingsContext.jsx';
export { SettingsProvider };

/**
 * Preview surface, wired as `cfg.provider`.
 *
 * Two jobs.
 *
 * It mounts `SettingsProvider`, which every chip-bearing component needs: the
 * rule-link resolver reads it through `useSettings`, and that hook treats a
 * missing provider as a programming error and throws - taking the whole card
 * down with it, not just the icon. The provider hydrates from IndexedDB and
 * falls back to its documented default when that read fails, which is exactly
 * what happens in a preview. (i18n needs nothing: it is a module-level store,
 * already initialised at import.)
 *
 * It also undoes two assumptions the preview-card harness bakes into every
 * card. Those rules go into `document.head`, deliberately not into the tree:
 * rendered as an element beside `children`, they gave the card root a child
 * even when the component itself rendered nothing, which is exactly the
 * signal the harness reads to decide a component has no preview - so every
 * null-rendering component silently lost its floor card and was reported
 * blank instead. The two assumptions:
 *
 *  - `body{background:#fff}`. This is a dark design system (`--bg-dark`,
 *    `--text-parchment`); on white, gold-on-obsidian components read as washed
 *    out grey and a reviewer cannot tell a styled card from an unstyled one.
 *  - `body{min-height:100vh}`, from the app's own `02-base.css`, which is right
 *    for an app shell and wrong for a card: it padded every per-story capture
 *    with several hundred pixels of empty background.
 *
 * The rules are scoped to the card document, so nothing here reaches a design
 * built with the library - those get `styles.css` and the app's own cascade.
 */
export function DesignSurface({ children }) {
  React.useLayoutEffect(() => {
    const id = 'ds-preview-surface';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      html, body { min-height: 0 !important; }
      body {
        background: var(--bg-dark) !important;
        color: var(--text-parchment);
        font-family: var(--font-body);
        padding: 16px;
      }
      .ds-cell { border-color: var(--border-dark) !important; }
      .ds-cell > h4 { color: var(--text-dim) !important; }
    `;
    document.head.appendChild(style);
  }, []);

  return <SettingsProvider>{children}</SettingsProvider>;
}
