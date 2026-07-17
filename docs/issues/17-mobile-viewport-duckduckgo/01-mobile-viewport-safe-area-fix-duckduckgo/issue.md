Status: resolved
Type: fix
Blocked by: None

## Description
Full scope of main-issue `17-mobile-viewport-duckduckgo` (PRD in its `## Description`), implemented as one slice rather than split further, per explicit user request.

On mobile (`@media (max-width: 900px)`), fix the app header being cut off/obscured on first load and `.mobile-bottom-nav` not being visible after the first catalog import, both observed in the DuckDuckGo mobile browser:

1. Add `viewport-fit=cover` to the viewport meta tag in `index.html`.
2. Add `env(safe-area-inset-top)` handling to `.app-header` in `src/index.css`.
3. Add a `dvh` fallback to `.empty-state-wrapper`'s mobile rule (currently plain `100vh` only).
4. Introduce a `visualViewport`-based hook/utility (e.g. `src/hooks/useViewportHeight.js`) that keeps a CSS custom property (`--app-vh`) in sync with the real visible viewport height; have `#root` and `.empty-state-wrapper` consume it as their primary height source, with existing `vh`/`dvh` CSS rules remaining as a static fallback.
5. Leave `.mobile-bottom-nav` positioning (`position: relative`) and `.in-builder-mode .app-header { display: none }` unchanged — out of scope, not implicated by the reported symptoms.
6. Do not touch the other nine `vh`/`dvh` consumers in `src/index.css` outside the direct bug path (modals, toasts, desktop-only rules) — out of scope.

Note: adding `viewport-fit=cover` also activates three existing, currently-inert `env(safe-area-inset-bottom)` usages elsewhere in `src/index.css` — intentional side effect, not a regression.

## Acceptance Criteria
- [ ] `index.html` viewport meta tag includes `viewport-fit=cover`.
- [ ] `.app-header` has `env(safe-area-inset-top)` handling; the three existing `env(safe-area-inset-bottom)` usages remain functionally intact.
- [ ] `.empty-state-wrapper`'s mobile rule has a `dvh` fallback alongside its `100vh` value.
- [ ] A `visualViewport`-based hook/utility exists, sets a CSS custom property reflecting real visible viewport height, and is consumed by `#root` and `.empty-state-wrapper` as primary height source; static `vh`/`dvh` CSS remains as fallback.
- [ ] Unit test for the hook/utility: mocks `window.visualViewport` resize events, asserts correct custom-property updates.
- [ ] Puppeteer E2E test added to `src/solver/ui.test.js`: small mobile viewport (chrome "visible") on load asserts `.app-header` bounding box fully within visible viewport; runtime resize to taller viewport (chrome "collapsed") + catalog import asserts `.mobile-bottom-nav` bounding box fully within visible viewport.
- [ ] `.mobile-bottom-nav` positioning and `.in-builder-mode .app-header` hiding are unchanged.
- [ ] No changes to the nine out-of-scope `vh`/`dvh` consumers.
- [ ] Manual verification on a real device running DuckDuckGo, performed by the user before merge, recorded as a comment on this issue.

## Comments
- Added viewport-fit=cover, safe-area-inset-top padding on .app-header, dvh fallback and a JS-driven --app-vh (new useViewportHeight hook) as the primary height source for mobile #root and .empty-state-wrapper. Covered by a hook unit test and a Puppeteer E2E asserting header/bottom-nav stay within the visible viewport. Note: the real-device DuckDuckGo verification (last acceptance criterion) is a pre-merge manual step reserved for the user and is still open.
- Nachtrag: E2E-Reproduktion auf echtem Gerät (DuckDuckGo) zeigte, dass 'oberer Teil abgeschnitten' eine ZWEITE, unabhängige Ursache hat, die der erste Fix (Header-Safe-Area + --app-vh) nicht abdeckte: .empty-state-wrapper ist ein Flex-Item im scrollenden .app-content und wurde per flex-shrink unter seine Inhaltshöhe gestaucht; align-items:center zentrierte den zu hohen Empty-State-Inhalt und schob dessen Oberkante (Buch-Bild + Titel 'Willkommen bei Tome of Battle') über den erreichbaren Scroll-Anfang -> abgeschnitten. Fix: flex-shrink:0 auf .empty-state-wrapper (index.css). Der bestehende Puppeteer-Bounding-Box-Test war blind dafür; neue Assertion assertContentTopReachable prüft jetzt, dass Bild- und Titel-Oberkante nicht über dem Scroll-Anfang liegen (per Negativ-Test verifiziert: schlägt ohne Fix fehl).
