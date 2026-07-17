Status: resolved
Type: fix
Blocked by: None

## Description
# PRD: Mobile Viewport DuckDuckGo

## Problem Statement / Bug Description
On mobile, when opening the app for the first time in the DuckDuckGo browser app, the top part of the page (the app header) is cut off / partially covered. After importing catalog data (the first game system), the bottom tab bar (`.mobile-bottom-nav`) does not appear, even though it should become visible once `systems.length > 0`.

Expected behavior: the header is fully visible and unobstructed on first load, and the bottom tab bar is fully visible within the viewport immediately after the first catalog import, on DuckDuckGo mobile as well as other mobile browsers.

Root cause (static analysis, to be confirmed by the automated E2E seam and by manual on-device verification before merge): the mobile layout (`@media (max-width: 900px)` in `src/index.css`) sizes `#root` via `height: 100vh; height: 100dvh` combined with `overflow: hidden` on `html`, `body`, and `#root`, with no JS-side fallback for viewport height. DuckDuckGo's in-app browser is known to report `100vh`/`100dvh` inconsistently as its own toolbar chrome shows/hides, so the computed height of `#root` can exceed the real visible viewport. Because scrolling is disabled (`overflow: hidden`) at that level, content beyond the mismatch is clipped rather than scrollable — pushing the header (top) out of view on load, and pushing `.mobile-bottom-nav`, the last flex child of `#root`, below the visible area after the layout grows (post-import). Separately, the first-launch empty-state screen (`.empty-state-wrapper`) uses a plain `100vh` with no `dvh` fallback at all — a second, distinct contributor. The `index.html` viewport meta tag also lacks `viewport-fit=cover`, so `env(safe-area-inset-top)` is unavailable and the header has no top-safe-area handling; three existing `safe-area-inset-bottom` usages in `src/index.css` are currently inert for the same reason.

## Solution
1. Add `viewport-fit=cover` to the viewport meta tag in `index.html`, and add `env(safe-area-inset-top)` handling to `.app-header` (this also activates the three existing, currently-inert `env(safe-area-inset-bottom)` usages elsewhere in `src/index.css` — intentional, as they were written assuming this was already active).
2. Add a `dvh` fallback to `.empty-state-wrapper`'s mobile rule (currently plain `100vh` only), matching the pattern `#root` already partially has.
3. Introduce a JS-side viewport-height fallback: a `visualViewport`-based hook/utility that keeps a CSS custom property (`--app-vh`) in sync with the real visible viewport height, and have `#root` and `.empty-state-wrapper` consume that custom property as their primary height source (with the existing `vh`/`dvh` CSS rules remaining as a static fallback for environments without `visualViewport` support). This directly addresses DuckDuckGo's unreliable `dvh` reporting rather than relying on CSS viewport units alone.
4. Leave `.mobile-bottom-nav` positioning (`position: relative`, last flex child of `#root`) and `.in-builder-mode .app-header { display: none }` unchanged — the fix targets the height-source root cause, not the nav's positioning strategy or the builder-mode header-hiding behavior, neither of which is implicated by the reported symptoms.
5. Scope is limited to the two `vh` consumers in the direct bug path (`#root`, `.empty-state-wrapper`); the other nine `vh`/`dvh` consumers found in `src/index.css` (modals, toasts, desktop-only rules) show no reported symptoms and are out of scope.

## User Stories / Requirements
1. As a mobile user opening the app for the first time in DuckDuckGo, I want the header to be fully visible and unobstructed, in order to see the app's branding and controls immediately.
2. As a mobile user who just imported their first catalog in DuckDuckGo, I want the bottom tab bar to be visible immediately, in order to navigate between Heerlager and Bibliothekar.
3. As a user on any other mobile browser, I want this fix to introduce no regression to the existing (already-working) mobile layout.

## Technical Decisions
- Affected Modules: `index.html` (viewport meta), `src/index.css` (mobile media query rules for `#root`, `.app-header`, `.empty-state-wrapper`), a new viewport-height hook/utility under `src/hooks/`.
- Technical Clarifications / Architectural Decisions:
  - `viewport-fit=cover` + `env(safe-area-inset-top/bottom)` is the standard, MDN-documented approach for PWA safe-area handling and is adopted as the top-safe-area strategy going forward.
  - A `visualViewport`-driven CSS custom property is the chosen robust height source over relying on `dvh` alone, given DuckDuckGo's documented inconsistency; `dvh`/`vh` CSS remains as a static fallback, not a replacement.
  - Stays within the existing 900px mobile breakpoint convention (ADR 0004); no new breakpoint introduced.
- API Contracts / Data Models: None — purely presentational/layout change, no data model impact.

## Testing Decisions
- Modules to Test: `#root`/`.app-header`/`.empty-state-wrapper`/`.mobile-bottom-nav` rendered layout under mobile viewport conditions; the new viewport-height hook/utility in isolation.
- Test Interfaces (Seams):
  1. Puppeteer E2E (`src/solver/ui.test.js`, existing seam per ADR 0006): set a small mobile viewport (browser chrome "visible"), load the app, assert `.app-header`'s bounding box is fully within the visible viewport; then resize the viewport taller at runtime (simulating DuckDuckGo's chrome collapsing on scroll), import a catalog, and assert `.mobile-bottom-nav`'s bounding box is fully within the visible viewport.
  2. Unit test for the new `visualViewport`-based hook/utility (e.g. `src/hooks/useViewportHeight.js`): mock `window.visualViewport` resize events and assert the CSS custom property is updated with the correct value, independent of full browser rendering.
- Acceptance also requires manual, one-time verification on a real device running DuckDuckGo (iOS or Android) before this main-issue's PR is merged, performed by the user; to be recorded as a comment on this issue once done.

## Out of Scope
- The other nine `vh`/`dvh` consumers in `src/index.css` not in the direct bug path (modals, toasts, desktop-only rules).
- Any change to `.mobile-bottom-nav`'s positioning strategy (`position: relative` stays as-is).
- Any change to `.in-builder-mode .app-header { display: none }` (builder/play-mode header hiding is unaffected — this bug only manifests before `in-builder-mode` is ever active).
- Fixing `dvh` support/behavior in DuckDuckGo itself (out of the app's control) — the fix works around it via a JS fallback, not by changing browser behavior.

## Acceptance Criteria
- [ ]

## Comments
- Vier-Achsen-Verifikation (testing skill) abgeschlossen: Standards PASS (0 blockierend, 7 vorbestehende Findings außerhalb Scope), Spezifikation 0 blockierend, Tests GREEN (142 Testdateien/1640 Tests inkl. Puppeteer-E2E), Docs 1 Finding behoben (ADR 0004 um Abschnitt 'Mobile Viewport-Höhe & Safe-Area' ergänzt). Manuelle DuckDuckGo-Geräteverifikation steht vor PR-Merge noch aus.
