# Plan: Architecture Review and PDF Cleanup

## Architecture
This project focuses on reviewing the existing codebase of the Army Builder app, generating a comprehensive `architecture_review.md` in the project root, and completely removing the 'PDF Abgleich' (PDF comparison) feature.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Discovery & Review | Explore the codebase, identify PDF features & components, verify current state of `architecture_review.md` | None | DONE |
| 2 | PDF Cleanup | Completely remove PDF UI components, business logic, hooks, state, unused assets, and tests | M1 | DONE |
| 3 | Verification | Run full test suite (`npm test`), verify build (`npm run build`), and verify app startup | M2 | DONE |
| 4 | Final Reporting | Write the final `handoff.md` and notify the parent orchestrator | M3 | IN_PROGRESS |

## Interface Contracts
- None (refactoring-free codebase cleanup and analysis).
