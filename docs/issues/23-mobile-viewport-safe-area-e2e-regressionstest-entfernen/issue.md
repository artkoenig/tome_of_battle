Status: resolved
Type: chore
Blocked by: None

## Description
`runViewportSafeAreaTests` in `src/solver/ui.test.js` (E2E-Check "E2E
(Puppeteer, nur main)") schlug in PR #67 mit einem Timeout fehl
(`page.waitForSelector('.desktop-nav-actions', { timeout: 15000 })` nach
Katalog-Upload). Ein Rerun mit identischem Code war sofort grün (44s statt
Timeout bei 15s) — reiner CI-Timing-Flake, keine echte Regression.

Der Test wurde in drei früheren Commits eingeführt, um konkrete Mobile-Bugs
(DuckDuckGo-Adressleiste) abzusichern:
- `82dfe8a` Fix mobile viewport safe-area and visible-height on DuckDuckGo
- `8dd4039` Fix empty-state top clipped on short mobile viewports
- `3b585ca` fix(mobile): keep #root within the visible viewport so the tab
  bar stays reachable

Empfehlung war, statt Löschen nur das 15s-Timeout zu erhöhen, um die
Regressionsabsicherung zu behalten. Auf explizite Nutzeranfrage wird der Test
trotzdem vollständig entfernt — die drei oben genannten Mobile-Bugs sind
damit ab jetzt nicht mehr automatisiert regressionsgeschützt.

## Acceptance Criteria
- [ ] `runViewportSafeAreaTests` sowie die nur von ihr genutzten Helfer
      (`assertElementWithinVisibleViewport`, `assertContentTopReachable`,
      `assertShellFitsVisibleHeight`, `assertNoHorizontalOverflow`,
      Viewport-Konstanten `MOBILE_CHROME_VISIBLE_VIEWPORT`,
      `MOBILE_CHROME_COLLAPSED_VIEWPORT`, `EMPTY_STATE_OVERFLOW_VIEWPORT`,
      `NARROW_PHONE_VIEWPORT`, `SIMULATED_TOOLBAR_HEIGHT_PX`,
      `VIEWPORT_BOUNDS_TOLERANCE_PX`) werden aus `src/solver/ui.test.js`
      entfernt — nur falls sie von keinem anderen verbleibenden Test dort
      mehr verwendet werden.
- [ ] Der Aufruf `await runViewportSafeAreaTests();` in der Haupt-`run()`-
      Funktion wird entfernt.
- [ ] Restliche E2E-Tests in derselben Datei bleiben unverändert funktionsfähig.
- [ ] `node src/solver/ui.test.js` läuft weiterhin erfolgreich durch (ohne den
      entfernten Testteil).

## Comments
- runViewportSafeAreaTests, seine vier Helper (assertElementWithinVisibleViewport, assertContentTopReachable, assertShellFitsVisibleHeight, assertNoHorizontalOverflow) und die zugehörigen Viewport-Konstanten wurden entfernt (nur in dieser Funktion verwendet, per grep bestätigt). Aufruf in run() entfernt. node --check sauber. Lokaler E2E-Lauf in dieser Sandbox nicht aussagekräftig (Netzwerk-Resets/Vite-Timeouts, environmentbedingt) - Verifikation läuft über GitHub Actions CI. npx vitest run: 647/647 grün.
