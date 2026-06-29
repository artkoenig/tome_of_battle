## 2026-06-29T09:58:22Z
You are a teamwork_preview_worker.
Your workspace is /Users/artkoenig/Workspace/army_builder.
Your working directory is /Users/artkoenig/Workspace/army_builder/.agents/teamwork_preview_worker_implement_tests.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission is to implement the test plan and missing tests as requested by the user, and ensure everything runs successfully via `npm test` with exit code 0.

Tasks:
1. Create `test_plan.md` in the project root. Outline the test cases for business logic (`src/solver`) and UI components (`src/components`).
   It must cover:
   - Validator logic (costs, limits, constraints, unique items, repeats, condition groups)
   - Rules Evaluator logic (saves, ward saves, blessings, model vs upgrade profiles)
   - Options Collector logic (hierarchical collection, unselected vs selected, group links)
   - XML Parser and ZIP Extractor logic
   - UI Components (App load, Roster Creation modal, CategoryUnitAdder popover, mobile status bar and mobile responsive layout, validation error panels)

2. Add `vitest` to `package.json`'s devDependencies, and run `npm install` to install it.

3. Clean up the unused duplicate file `src/solver/optionsExtractor.js`.

4. Implement missing unit tests for `src/parser/zipExtractor.js` and `src/parser/xmlParser.js` in a new file `src/solver/parser.test.js`.
   - Test XML parsing with mock XML strings.
   - Test ZIP extraction using a mock ZIP generated in memory using JSZip.

5. Implement UI tests in `src/solver/ui.test.js` using Puppeteer.
   - The script should pack `./catalogs/whfb6/` files into a temporary ZIP file using JSZip.
   - It should start the Vite dev server programmatically (e.g. via `child_process.spawn`) on port 5175.
   - It should launch headless Puppeteer, navigate to the app, upload the generated ZIP file, verify the system is imported.
   - It should return to the dashboard, create a new roster with limits.
   - It should add units using the `CategoryUnitAdder` popover.
   - It should verify validation errors are shown.
   - It should change viewport to mobile (375x812), verify that the mobile status bar/layout works correctly, click it, and verify that the validation error panel is visible.
   - It must clean up by killing the Vite dev server process and closing the browser.
   - It must exit with code 0 on success, and code 1 on failure.

6. Configure `npm test` script in `package.json` to execute:
   - `node src/solver/validator.test.js`
   - `node src/solver/rulesEvaluator.test.js`
   - `node src/solver/optionsCollector.test.js`
   - `npx vitest run src/solver/collective.test.js`
   - `node src/solver/parser.test.js`
   - `node src/solver/ui.test.js`
   Ensure all of them execute sequentially, and if any fail, `npm test` fails (exits with non-zero).

7. Run `npm test` to verify everything works and passes, and document the outputs in your handoff report.
