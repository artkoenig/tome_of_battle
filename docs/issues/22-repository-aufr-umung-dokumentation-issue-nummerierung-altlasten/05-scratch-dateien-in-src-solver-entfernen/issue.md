Status: resolved
Type: chore
Blocked by: None

## Description
Drei Dateien in `src/solver/` sind Debug-/Scratch-Altlasten ohne Produktbezug:

- `debugBigUns.js` — nirgends importiert, referenziert einen nicht mehr
  existierenden Pfad (`./catalogs/...`, seit ADR-0014 extern ausgelagert).
- `screenshot_fonts.js` — funktionsloser Puppeteer-Stub, nirgends
  referenziert.
- `test_maneaters_scratch.test.js` — läuft bei jedem `npm test` mit (nicht in
  `vitest.config.js` ausgeschlossen), enthält aber keine echte Assertion, nur
  `console.log`-Debug-Ausgaben.

## Acceptance Criteria
- [ ] Alle drei Dateien sind gelöscht
- [ ] `npm test` läuft weiterhin grün (keine anderen Tests hingen an diesen
      Dateien)

## Comments
- Removed three scratch/debug files from src/solver/ (debugBigUns.js, screenshot_fonts.js, test_maneaters_scratch.test.js). npm test remains green (61 files, 646 tests + UI E2E).
