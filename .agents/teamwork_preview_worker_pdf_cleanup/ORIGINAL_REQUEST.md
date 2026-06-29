## 2026-06-29T16:55:40Z

You are the worker agent responsible for completely removing the 'PDF Abgleich' (PDF comparison) feature from the army_builder codebase.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your tasks are:
1. Create `src/parser/catalogEditor.js` and extract the following developer debug helper functions from `src/parser/pdfRulesExtractor.js`:
   - `updateRawXml`
   - `searchEditableEntries`
   - `findExactEntryById`
   Make sure any required DOM / XML classes (e.g. `DOMParser`, `XMLSerializer`) are available (in jsdom/browser environment).

2. Delete `src/components/importer/SystemEditorView.jsx` and `src/parser/pdfRulesExtractor.js` from the repository.

3. Modify `src/components/Importer.jsx` to:
   - Remove `Bot` from the `lucide-react` import.
   - Remove `SystemEditorView` import.
   - Remove the `editingSystem` state declaration.
   - Remove the conditional rendering for `SystemEditorView`.
   - Remove the KI-Scanner `button` (with the `Bot` icon) from the system list rendering.

4. Modify `src/App.jsx` to import `findExactEntryById` and `searchEditableEntries` from `./parser/catalogEditor` instead of `./parser/pdfRulesExtractor`.

5. Modify `src/components/editor/DebugEntryEditorModal.jsx` to import `updateRawXml` from `../../parser/catalogEditor` instead of `../../parser/pdfRulesExtractor`.

6. Modify `src/solver/validator.test.js` to:
   - Import `searchEditableEntries` from `../parser/catalogEditor.js` instead of `../parser/pdfRulesExtractor.js`.
   - Remove imports/testing for `findAndMutateJsonPatch`.
   - In Test 20, remove testing for `findAndMutateJsonPatch` and retain only searching tests (`searchResultsGst`, `searchResultsCat`, `searchResultsById`).

7. Run `npm test` and verify that all tests pass.

8. Run `npm run build` and ensure the application builds successfully without errors.

Write a complete report of the actions taken and the test/build output results to `cleanup_report.md` inside your working directory `.agents/teamwork_preview_worker_pdf_cleanup/`. Your working directory is `/Users/artkoenig/Workspace/army_builder/.agents/teamwork_preview_worker_pdf_cleanup/`.
