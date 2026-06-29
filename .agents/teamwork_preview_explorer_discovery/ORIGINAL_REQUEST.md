## 2026-06-29T16:53:15Z
Analyze the army_builder codebase to identify all PDF-related features, UI components, business logic, state/hooks, test suites, and potential unused dependencies that must be removed for the 'PDF Abgleich' (PDF comparison) feature.

Specifically:
1. Locate where 'PDF Abgleich' is integrated in the UI (e.g., upload buttons, views, modals).
2. Trace the data flow and business logic of PDF extraction/matching (e.g. `src/parser/pdfRulesExtractor.js`, components referencing it, hooks, database state, etc.).
3. Identify all tests that cover PDF-related logic.
4. Recommend the exact files, code sections, and lines to delete or modify.
5. Review the existing `architecture_review.md` in the project root. Identify if it covers the requirements (architecture, testability, extensibility of the app) and if it is up to date. Do NOT modify the file, just analyze it.

Write your findings to `discovery_report.md` inside your working directory `.agents/teamwork_preview_explorer_discovery/` and output a handoff message summarizing your findings and the recommended cleanup steps. Your working directory is `/Users/artkoenig/Workspace/army_builder/.agents/teamwork_preview_explorer_discovery/`.
