---
status: backlog
branch:
pr:
---

# Harden the landing page and the status page for mobile devices

## Goal

On a phone, the landing page (`docs/`) and the generated project-status page
(`scripts/project-state/`) no longer zoom on an accidental double tap, no longer
have their font boosted by iOS in landscape, and are usable with a thumb:
every control is reachable and large enough to hit, nothing is hidden behind a
hover, the hero fits the visible viewport, and the page does not ship megabytes
of image for a 36-pixel logo. Pinch zoom stays available on both pages — the
double tap is what gets suppressed, not the user's ability to magnify (WCAG
1.4.4).

## Acceptance criteria

- AC1: The landing page suppresses double-tap zoom and iOS landscape font boosting, and its viewport meta still permits pinch zoom. | verify: `grep -qE 'touch-action:[[:space:]]*manipulation' docs/assets/landing.css && grep -qE 'text-size-adjust:[[:space:]]*100%' docs/assets/landing.css && ! grep -qE 'user-scalable|maximum-scale' docs/index.html`
- AC2: The primary navigation is reachable below 768px instead of being hidden without a replacement. | verify: `! tr -d '\n' < docs/assets/landing.css | grep -qE '\.nav-links[^{]*\{[^}]*display:[[:space:]]*none'`
- AC3: The DE/EN language buttons present a touch target of at least 44px in both dimensions. | verify: `grep -A8 'lang-toggle-btn' docs/assets/landing.css | grep -qE 'min-(height|width):[[:space:]]*(44px|2\.75rem)'`
- AC4: The hero sizes itself to the visible viewport, not to `100vh`, so a mobile URL bar cannot push the fold off-screen. | verify: `grep -qE 'min-height:[[:space:]]*100(d|s)vh' docs/assets/landing.css`
- AC5: Every landing-page image carries intrinsic `width` and `height` so nothing shifts while loading, and the three showcase screenshots load lazily. | verify: `t=$(grep -c '<img' docs/index.html); [ "$(grep -cE '<img[^>]*[^-]width=' docs/index.html)" = "$t" ] && [ "$(grep -cE '<img[^>]*height=' docs/index.html)" = "$t" ] && [ "$(grep -cE '<img[^>]*loading="lazy"' docs/index.html)" -ge 3 ]`
- AC6: The logo bitmap the landing page loads is at most 50 KB, down from 2 MB for a 36px rendering. | verify: `[ "$(stat -c%s docs/assets/pwa-icon.png)" -le 51200 ]`
- AC7: The landing page honours `prefers-reduced-motion: reduce` for its smooth scrolling and animations. | verify: `grep -q 'prefers-reduced-motion' docs/assets/landing.css`
- AC8: The landing page head carries a `theme-color`, an `apple-touch-icon` and a preconnect for the web font it loads, so the font is not discovered serially through a render-blocking `@import`. | verify: `grep -q 'name="theme-color"' docs/index.html && grep -q 'apple-touch-icon' docs/index.html && grep -q 'rel="preconnect"' docs/index.html`
- AC9: The status page suppresses double-tap zoom the same way, and its viewport meta still permits pinch zoom. | verify: `grep -qE 'touch-action:[[:space:]]*manipulation' scripts/project-state/renderReport.js && ! grep -qE 'user-scalable|maximum-scale' scripts/project-state/renderReport.js`
- AC10: The gate and vial tooltips, today revealed only on `:hover`, open on a touch device without any JavaScript. | verify: `grep -q 'focus-within' scripts/project-state/renderReport.js && grep -q 'tabindex' scripts/project-state/renderReport.js`
- AC11: Those tooltips wrap instead of being clipped on a narrow viewport. | verify: `grep -A40 '@media (max-width: 30rem)' scripts/project-state/renderReport.js | grep -q 'tooltip'`
- AC12: The status page honours `prefers-reduced-motion: reduce` for its rune pulse and bubble animations. | verify: `grep -q 'prefers-reduced-motion' scripts/project-state/renderReport.js`
- AC13: The status page's tabs, back link and disclosure rows present a touch target of at least 44px, including below the 30rem breakpoint where they are currently shrunk further. | verify: `grep -qE 'min-height:[[:space:]]*(44px|2\.75rem)' scripts/project-state/renderReport.js`
- AC14: The new status-page behaviour is pinned by the report's own tests and the suite is green. | verify: `grep -q 'touch-action' scripts/project-state/renderReport.test.js && forge-test --run scripts/project-state`
- AC15: The report stylesheet carries no rules for a table it never emits, and its doc comments no longer describe behaviour the file does not have (wide-table wrapping, a light/dark split, "loads no web font"). | verify: `! grep -q 'table-scroll' scripts/project-state/renderReport.js`

## Out of scope

- The React application under `src/` and its own `index.html` — its viewport tag and its
  visible-viewport handling stay as they are.
- `tools/rules-editor/`.
- Disabling pinch zoom. Neither page may gain `user-scalable=no` or a `maximum-scale`
  below 5; AC1 and AC9 assert their absence.
- JavaScript on the status page. `renderReport.test.js` forbids `<script>` and `<link>`
  in the emitted document, and that stays true — every status-page fix is CSS or markup.
- Re-encoding `battlefield_hero_bg.jpg` (880 KB) and `status_bg.jpg` (851 KB). No image
  tooling is installed and `status_bg.jpg` is pinned by a test; their weight is recorded
  here as known, not fixed.
- The web font both pages load, and the palette and background the report tests pin.
