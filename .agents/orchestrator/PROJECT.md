# Project: Tome of Battle — Roster Builder Refactoring

## Architecture
The application uses React, Vite, and IndexedDB to manage warhammer-like rosters parsed from BattleScribe XML files.
We are decoupling the business/gameplay rules solver from the UI rendering layer, centralizing matching constants to resolve Rule R4 violations, and increasing test coverage.

## Code Layout
- `src/components/` - React UI components (`PlayMode.jsx`, `RosterEditor.jsx`).
- `src/solver/` - Pure logic engines and test files (`validator.js`, `rulesEvaluator.js`).
- `src/parser/` - XML/ZIP parsers.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Cleanup & Constants Setup | Delete dead assets/imports; create `src/solver/constants.js` | none | DONE |
| 2 | Extract rulesEvaluator | Move saves calculations and rules parsing out of `PlayMode.jsx` into `src/solver/rulesEvaluator.js` | M1 | DONE |
| 3 | Add rulesEvaluator Tests | Write unit tests for rulesEvaluator in `src/solver/rulesEvaluator.test.js` | M2 | DONE |
| 4 | Resolve Remaining R4 Violations | Refactor `SelectionConfigurator.jsx` and `RosterEditor.jsx` to use constants/structures | M1, M2 | DONE |
| 5 | E2E & Final Verification | Run all tests (unit + Puppeteer UI debug) and static checks | M1, M2, M3, M4 | DONE |

## Interface Contracts
### `src/solver/rulesEvaluator.js`
- `getArmourSave(profiles, selectionName, catalogueName)`: returns `number` (e.g. 4 for 4+ save).
- `getWardSave(profiles, selectionName, catalogueName)`: returns `number` (e.g. 5 for 5+ save).
- `extractModelProfiles(profiles)`: filters list of profiles to include only unit models/creatures.
- `extractUpgradeProfiles(profiles)`: filters list of profiles to include only upgrades/magic items/weapons.
