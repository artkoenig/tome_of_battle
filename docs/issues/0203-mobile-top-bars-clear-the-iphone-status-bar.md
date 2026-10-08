---
status: backlog
branch:
pr:
---

# Keep the mobile builder and play top bars clear of the iPhone status bar

## Goal

On an iPhone running the installed PWA, the top bars of the roster builder and of play mode — including their back buttons — sit below the system status bar and can be tapped, because each of them reserves the top safe-area inset the same way the app header already does.

## Acceptance criteria

- AC1: On the mobile layout, the roster builder's top bar pads its top edge by its existing spacing plus `env(safe-area-inset-top)`, so its back button is no longer covered by the status bar. | verify: forge-test --run safe-area-top-bars
- AC2: On the mobile layout, the play mode header pads its top edge by its existing spacing plus `env(safe-area-inset-top)`, so its back button is no longer covered by the status bar. | verify: forge-test --run safe-area-top-bars
- AC3: A Vitest test named `safe-area-top-bars` reads the stylesheets and fails when either of the two bars loses the top safe-area inset in its mobile rule. | verify: forge-test --run safe-area-top-bars
- AC4: Where the inset is 0 (desktop, Android, headless browsers), both bars keep their current spacing and look unchanged. | verify: forge-test
- AC5: The styling ADR's safe-area section names every element that reserves the top inset, not only the app header.
- AC6: Checked by hand on an iPhone (installed PWA): the back buttons in the builder and in play mode are fully visible below the status bar and respond to a tap.

## Out of scope

- The bottom safe-area inset (home indicator) for the bottom navigation, the floating action button and toasts.
- The app header, which already reserves the top inset.
- The `viewport-fit=cover` and `black-translucent` status-bar meta settings and the PWA manifest.
- A Puppeteer E2E for the safe area — headless Chrome reports the inset as 0, and an earlier one was removed as flaky.
