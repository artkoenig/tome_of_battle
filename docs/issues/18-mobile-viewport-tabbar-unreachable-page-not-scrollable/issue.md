Status: resolved
Type: fix
Blocked by: None

## Description
# PRD: Mobile viewport – tab bar unreachable / page not scrollable

## Problem Statement / Bug Description
On mobile (reported on Firefox for Android), the app content is taller than the
visible viewport and the page cannot be scrolled, so the bottom tab bar
(`.mobile-bottom-nav`, Heerlager / Bibliothekar) sits below the visible area and
is completely unreachable. The user reported: "die seite lässt sich nicht
scrollen, tabbar ist nicht erreichbar." It reproduces on the empty "Heerlager"
roster dashboard state ("Die Waffenkammern sind leer") but the cause is in the
shared app shell, not that screen.

Expected behavior: on any mobile browser, whether or not the browser's URL/tool
bar is currently showing, the app shell fits the genuinely visible viewport —
the header stays at the top, the content area scrolls internally when it is too
tall, and the bottom tab bar remains pinned within the visible area and always
reachable.

## Root Cause (confirmed by live E2E investigation)
This is a residual of issue
`17-mobile-viewport-duckduckgo`. That issue introduced a `visualViewport`-driven
CSS custom property (`--app-vh`) and made `#root` consume it as its **`height`**
source (`height: var(--app-vh, 100dvh)`), so the shell is sized to the real
visible height. However, `#root` also inherits `min-height: 100vh` from its
base (non-media-queried) rule, and the mobile `@media (max-width: 900px)` block
never resets it.

`min-height` wins over `height` whenever it is larger. `100vh` is the CSS
*large viewport* (the toolbar-retracted height). So whenever a mobile browser's
toolbar is showing, the genuinely visible height (`--app-vh`) is smaller than
`100vh`, and `min-height: 100vh` forces `#root` back up to the large-viewport
height — taller than what is visible. Its bottom (where the tab bar is the last
flex child) is pushed below the fold. Because `html`, `body`, and `#root` are all
`overflow: hidden` on mobile, nothing can scroll to bring the tab bar into view,
and the toolbar never collapses (collapsing requires a scroll that cannot
happen). Firefox for Android surfaces this because its toolbar stays visible on a
non-scrollable page; the defect is fundamentally browser-agnostic.

Why issue 17's fix did not catch this: its E2E seam resized the viewport *taller*
(simulating the toolbar collapsing) before asserting the tab bar was visible, so
it only ever verified the toolbar-collapsed state — exactly the state in which
`100vh` equals the visible height and the bug is masked. The toolbar-showing
state (visible height < `100vh`) was never asserted.

Verification performed during investigation (real browser, measured live):
- With `--app-vh` simulating a visible height of 702px, `#root` stayed 812px
  because its computed `min-height` was 812px (`100vh`) and overrode
  `height: 702px`; the tab bar landed entirely below the 702px visible area.
- At a genuine 375×560 viewport (no vh/visible discrepancy), `#root` equalled the
  visible height, `.app-content` scrolled correctly (scrollHeight 518 vs
  clientHeight 439), and the tab bar was pinned and reachable — proving the flex
  shell itself is sound and only the residual `min-height: 100vh` breaks it.

## Solution
1. In the mobile `@media (max-width: 900px)` `#root` rule in `src/index.css`,
   stop the inherited desktop `min-height: 100vh` from exceeding the visible
   height. Mirror the existing `height` cascade so `min-height` uses the same
   ascending-precedence source (static `vh`, then `dvh` fallback, then the
   JS-tracked `--app-vh` as primary) — e.g.
   `min-height: 100vh; min-height: 100dvh; min-height: var(--app-vh, 100dvh)`.
   The intent, however implemented, is that `#root`'s effective height must never
   exceed the genuinely visible viewport height. Keep the existing
   `height: var(--app-vh, 100dvh)` and `overflow: hidden` as-is.
2. Leave `.app-content` (flex:1, `overflow-y: auto`), `.mobile-bottom-nav`
   (`position: relative`, last flex child) and the `overflow: hidden` app-shell
   strategy unchanged — investigation confirmed the shell scrolls and pins the
   nav correctly once `#root` tracks the visible height; the fix targets only the
   `#root` height-source root cause, consistent with issue 17.
3. Secondary, independent defect on the same screen: the empty-state action row
   in the roster dashboard ("Liste importieren" + "Erste Armeeliste ausheben") is
   a `nowrap` flex row rendered with an inline style and no CSS class, so the
   mobile stylesheet cannot make it responsive. On narrow viewports the two
   side-by-side buttons overflow horizontally (the right button and the centered
   title/paragraph are clipped). Give that row a CSS class and allow it to wrap
   (`flex-wrap: wrap`), matching the existing `.roster-actions` convention.
   Verified live: wrapping removes ~28px of horizontal overflow and pulls all
   content back inside the viewport.

## User Stories / Requirements
1. As a mobile user (Firefox for Android and any mobile browser) on the empty
   Heerlager screen, I want to reach the bottom tab bar, so that I can navigate
   between Heerlager and Bibliothekar even while the browser toolbar is showing.
2. As a mobile user, I want tall content to scroll within the content area while
   the header and tab bar stay fixed, so that nothing is stuck off-screen.
3. As a mobile user on a narrow phone, I want the empty-state action buttons to
   stay fully within the screen (no horizontal clipping).
4. As a user on any other mobile browser, I want this fix to introduce no
   regression to the existing (already-working) mobile layout.

## Technical Decisions
- Affected Modules: `src/index.css` (mobile media-query rule for `#root`; a small
  addition for the empty-state action row), the roster dashboard empty-state
  markup (add a class to the currently class-less action `<div>`), and the
  Puppeteer E2E seam (`src/solver/ui.test.js`) for the regression guard.
- Architectural notes:
  - Stays within the existing 900px mobile breakpoint convention (ADR 0004) and
    the "static vh/dvh fallback, JS-driven `--app-vh` primary" viewport-height
    convention that issue 17 documented in ADR 0004 ("Mobile Viewport-Höhe &
    Safe-Area"). The `min-height` fix simply extends that same convention to the
    property that was missed.
  - Observed but out of scope: `#root`'s `min-height: 100vh` lives in the base,
    non-media-queried rule and only exists for the desktop layout; the cleaner
    long-term shape is to scope it to desktop. The targeted mobile override is
    chosen to stay minimal and symmetric with how `height` is already overridden
    in the same block.
- API Contracts / Data Models: none — purely presentational/layout change.

## Testing Decisions
- Modules to Test: `#root` / `.app-content` / `.mobile-bottom-nav` rendered
  layout under a mobile viewport where the visible height is smaller than `100vh`;
  the empty-state action row's wrapping behavior on a narrow viewport.
- Test Interfaces (Seams):
  1. Puppeteer E2E (`src/solver/ui.test.js`, existing seam per ADR 0006): at a
     small mobile viewport, drive `--app-vh` to a value smaller than the layout
     `100vh` (the toolbar-showing state), then assert `#root`'s bounding height
     does not exceed the visible height and `.mobile-bottom-nav`'s bounding box
     lies fully within the visible viewport. This is precisely the state issue
     17's seam skipped.
  2. A narrow-viewport check that the roster-dashboard empty state produces no
     horizontal overflow (`documentElement.scrollWidth <= clientWidth`, or the
     action row's right edge within the viewport).
- Acceptance also requires manual, one-time verification on a real device
  running Firefox for Android before this main-issue's PR is merged, performed by
  the user; recorded as a comment on this issue once done.

## Out of Scope
- The other `vh`/`dvh` consumers in `src/index.css` not in this bug path (modals,
  toasts, desktop-only rules, `.empty-state-wrapper` — already handled by issue
  17).
- Refactoring `#root`'s base `min-height: 100vh` into a desktop-scoped rule
  (noted above as the cleaner long-term shape, but kept out to stay minimal).
- Any change to `.mobile-bottom-nav`'s positioning strategy or the
  `overflow: hidden` app-shell approach.
- Fixing browser toolbar behavior itself — the fix works around it via the
  visible-height source, not by changing the browser.

## Acceptance Criteria
- [ ] On a mobile viewport where the visible height is smaller than `100vh`
      (browser toolbar showing), `#root`'s effective height equals the visible
      viewport height and does not exceed it.
- [ ] On that same viewport, `.mobile-bottom-nav` is fully within the visible
      area and reachable (its bottom edge ≤ the visible viewport height).
- [ ] Tall content in the empty Heerlager state scrolls within `.app-content`
      while the header and tab bar stay fixed.
- [ ] The roster-dashboard empty state produces no horizontal overflow on narrow
      mobile viewports (down to 320px); the action buttons stay fully visible.
- [ ] No regression to the existing mobile layout on other browsers.
- [ ] Automated E2E regression guard asserts the tab bar is reachable in the
      toolbar-showing state (visible height < `100vh`).
- [ ] Manual verification on a real Firefox-for-Android device recorded as a
      comment before PR merge.

## Comments
- Verifikation: Standards PASS (oxlint 0 Errors; nur vorbestehende Warnings außerhalb Scope). Tests GREEN (vitest 414 passed/2 skipped; Puppeteer-E2E inkl. neuer Regressions-Guards: #root bleibt bei sichtbarer Hoehe < 100vh innerhalb der sichtbaren Flaeche und Tab-Bar erreichbar; .empty-state-actions ohne Horizontal-Overflow bei 320px). Root cause per Live-Messung bestaetigt: ohne Fix #root=812 bei sichtbaren 702 (Tab-Bar unter dem Fold), mit Fix #root=702. Manuelle Geraeteverifikation auf Firefox Android steht vor PR-Merge noch aus.
