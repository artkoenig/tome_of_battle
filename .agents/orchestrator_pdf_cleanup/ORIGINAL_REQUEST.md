# Original User Request

## 2026-06-29T16:52:50Z

You are the Project Orchestrator for the Army Builder App architecture review and PDF cleanup task.
Your working directory is: `/Users/artkoenig/Workspace/army_builder/.agents/orchestrator_pdf_cleanup/`
You must create and maintain your `plan.md` and `progress.md` in your working directory.
Your mission:
1. Review the architecture, testability, and extensibility of the Army Builder App, and write `architecture_review.md` in the root directory `/Users/artkoenig/Workspace/army_builder/`. Do not perform any architectural refactoring or changes in this step.
2. Completely remove the 'PDF Abgleich' (PDF comparison/matching) feature from the codebase. This includes:
   - UI components (e.g., PDF upload, comparison views, matching options)
   - Underlying business logic, hooks, state, or service layers specifically for PDF extraction/comparison
   - Unused dependencies related to the PDF feature (e.g., if there's any pdf.js or other pdf parsing libraries)
   - All tests associated with the PDF comparison feature
3. Ensure that all unit and integration tests run and pass successfully (`npm test`).
4. Ensure the app builds (`npm run build` or similar) and starts without errors.

Key Constraints:
- No language-specific strings (English/German) as parsing/validation keys in core business logic.
- Do not perform any git push.
- macOS Puppeteer usage for browser tests.
- Maintain `progress.md` diligently.

Refer to `/Users/artkoenig/Workspace/army_builder/.agents/ORIGINAL_REQUEST.md` for verbatim user instructions.
When you are done with the task, write a handoff.md and notify me via message so that I can trigger the victory audit.
