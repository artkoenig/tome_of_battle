# Project: Army Builder App PDF Cleanup & Architecture Review

## Architecture
- React / Vite frontend with local IndexedDB storage.
- Custom Battlescribe XML catalog parser and validation engine.
- Developer debug mode for manually searching and editing XML entries.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Discovery & Review | Explore the codebase, identify PDF features & components, verify current state of `architecture_review.md` | None | DONE |
| 2 | PDF Cleanup | Extract catalogEditor.js; delete SystemEditorView.jsx and pdfRulesExtractor.js; update Importer.jsx, App.jsx, DebugEntryEditorModal.jsx, and validator.test.js | M1 | DONE |
| 3 | Verification | Run full test suite (`npm test`), verify build (`npm run build`), and verify app startup | M2 | DONE |
| 4 | Final Reporting | Write the final `handoff.md` and notify the parent orchestrator | M3 | IN_PROGRESS |

## Interface Contracts
### `src/parser/catalogEditor.js`
- `updateRawXml(system, entryId, type, localName, localCosts, localConstraints, localCharacteristics, localDescription)`: Edits raw XML data of the catalog/GST.
- `searchEditableEntries(system, query)`: Searches for entries matching a string query.
- `findExactEntryById(system, id)`: Searches for an entry by its ID.
