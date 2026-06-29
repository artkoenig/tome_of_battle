# Progress - Roster Builder Refactoring Milestone 2

Last visited: 2026-06-29T06:45:00Z

## Status
- Extract saves calculations and rules parsing logic from `PlayMode.jsx` to `rulesEvaluator.js`: **Completed**
- Satisfy Rule R4 (no hardcoded strings, use constants): **Completed**
- Update imports and callers in `PlayMode.jsx`: **Completed**
- Run Vite production build and tests: **Completed**
- Write comprehensive unit tests for rulesEvaluator: **Completed**
- All 22 validator tests + 5 new rulesEvaluator tests passing: **Completed**

## Steps Done
1. Inspected saves calculation and rules parsing in `PlayMode.jsx`.
2. Created a pure logic solver file `src/solver/rulesEvaluator.js`.
3. Integrated constants from `src/solver/constants.js` to ensure no hardcoded string keys or values are used.
4. Exported all required functions: `getArmourSave`, `getWardSave`, `extractModelProfiles`, `extractUpgradeProfiles`, and helper `hasBlessing`.
5. Updated `PlayMode.jsx` to import and call these functions.
6. Created `src/solver/rulesEvaluator.test.js` and updated `package.json` test script to run both test suites.
7. Verified compilation via `npm run build` and tests via `npm test`.
