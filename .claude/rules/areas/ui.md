---
paths:
  - "src/components/**"
  - "src/hooks/**"
  - "src/styles/**"
  - "src/i18n/**"
---

# UI, hooks, styles, i18n

- Most `.jsx` files are paired 1:1 with a `.test.jsx` next to them. A new component without its
  pair is an incomplete change.
- Styling is 33 numbered CSS layer files under `src/styles/`, loaded in cascade order (ADR 0004
  §6). Put a rule in the layer its number describes; a component-local style that fights the
  cascade is the usual cause of a "mysteriously overridden" property.
- Text never appears literally in a component: it goes through `src/i18n/` (own solution, no
  library, ADR 0026) with entries in both `locales/de.json` and `locales/en.json`. A missing `en`
  key does not fail a test — it fails silently for the user.
- The Puppeteer app E2E (`node e2e/ui.test.js`) is outside `forge-test`. Run it by hand for a
  change here; it is what catches a view that no longer renders.
- After a user-visible change, take a screenshot of the affected view and send it to the user:
  `node scripts/generate_screenshots.js` runs offline against the frozen fixture and needs no
  catalog data.
- The repo language is mixed by intent: docs, issues and commit messages in German, code and
  identifiers in English. `CONTEXT.md` fixes the terms this project uses in a narrow sense.
