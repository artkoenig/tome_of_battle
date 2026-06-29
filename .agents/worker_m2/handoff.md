# Handoff Report — Milestone 2: Extract rulesEvaluator

## 1. Observation
- File `src/components/PlayMode.jsx` originally contained UI-coupled saves calculation and profile extraction methods at lines 112-120 (`getUnitProfilesAndRules`), 146-155 (`getUpgradeDescription`), 160-279 (`getArmourSave`), and 282-361 (`getWardSave`).
- File `src/solver/constants.js` contains central keyword lists such as `SAVE_SHIELD_KEYWORDS`, `SAVE_FULL_PLATE_KEYWORDS`, etc., which are required to avoid hardcoding strings.
- Command `npm run build` compiled 73 modules successfully:
  ```
  transforming...✓ 73 modules transformed.
  rendering chunks...
  computing gzip size...
  dist/index.html                   0.82 kB │ gzip:   0.45 kB
  dist/assets/index-C-f0Bj-N.css   25.21 kB │ gzip:   5.03 kB
  dist/assets/index-B3OG-k_Z.js   404.78 kB │ gzip: 117.70 kB
  ```
- Command `npm test` runs `node src/solver/validator.test.js && node src/solver/rulesEvaluator.test.js` and outputs:
  ```
  ALL TESTS SUCCESSFUL!
  ```
  for both suites, covering all 22 validator tests and 5 new rulesEvaluator tests.

## 2. Logic Chain
- To decouple rule evaluation from the React UI component, we created `src/solver/rulesEvaluator.js` to host the pure game logic functions as defined in the interface contract of `PROJECT.md`.
- To satisfy Rule R4, we imported constants from `src/solver/constants.js` into `src/solver/rulesEvaluator.js`, and used them for all scans (shield, plate armour, heavy/light armour, mounts, barding, cavalry, ward saves, blessings).
- We updated `PlayMode.jsx` to call `extractModelProfiles` and `extractUpgradeProfiles` to filter profiles.
- To keep rulesEvaluator pure and independent of React/system states, we added a helper `collectSavesData` in `PlayMode.jsx` to gather and format selection/sub-selection profiles, rules, and names, passing this collection to the evaluator.
- We added unit tests in `src/solver/rulesEvaluator.test.js` to ensure the new functions are fully covered and integrated them into `package.json`'s test script.

## 3. Caveats
- The UI handles the presentation format (``${save}+`` or `"Kein"`) locally via wrapper functions, while `rulesEvaluator` handles the numeric rules-based calculations. This keeps the evaluator decoupled and returns pure numbers as per `PROJECT.md` contracts.

## 4. Conclusion
- Milestone 2 is fully complete. The pure logic functions `getArmourSave`, `getWardSave`, `extractModelProfiles`, and `extractUpgradeProfiles` are successfully decoupled, utilize centralized constants, build cleanly, and pass all tests.

## 5. Verification Method
1. Run `npm test` in the root workspace. Expect:
   - Validator tests (1-22) all output `PASSED` and `ALL TESTS SUCCESSFUL!`.
   - Rules evaluator tests (1-5) all output `PASSED` and `ALL RULES EVALUATOR TESTS SUCCESSFUL!`.
2. Run `npm run build`. Expect a clean client production build without compiler or module resolution errors.
3. Check `src/solver/rulesEvaluator.js` to verify it uses `constants.js` imports for keyword matching instead of hardcoded English/German strings.
