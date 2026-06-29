# Discovery Report: PDF Abgleich Feature Analysis

## Executive Summary
This report analyzes the codebase of the Tabletop army list builder application to locate and document all UI components, business logic, state variables, tests, and dependencies associated with the 'PDF Abgleich' (PDF comparison) feature. The goal is to provide a complete roadmap for the total and clean removal of this feature.

---

## 1. UI Integration of 'PDF Abgleich'
The 'PDF Abgleich' is integrated into the following UI locations:

1. **`src/components/Importer.jsx` (Importer View):**
   - **Line 2: Import of `Bot` icon** from `'lucide-react'`.
   - **Line 8: Import of `SystemEditorView`** from `'./importer/SystemEditorView'`.
   - **Line 19: State variable** `const [editingSystem, setEditingSystem] = useState(null);`.
   - **Lines 134–142: Conditional rendering** of `SystemEditorView` when `editingSystem` is set:
     ```jsx
     if (editingSystem) {
       return (
         <SystemEditorView 
           system={editingSystem} 
           onClose={() => { setEditingSystem(null); loadSystems(); }} 
           onSystemSaved={loadSystems}
         />
       );
     }
     ```
   - **Lines 248–255: KI-Scanner Action Button** in the system list (the `Bot` icon button that sets the `editingSystem` state to trigger the comparison view):
     ```jsx
     <button 
       className="btn-gold btn-sm" 
       onClick={() => { setEditingSystem(sys); setError(null); setSuccessMsg(null); }}
       title="KI-Scanner (PDF Abgleich)"
       style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
     >
       <Bot size={16} />
     </button>
     ```

2. **`src/components/importer/SystemEditorView.jsx` (The PDF Scanner View):**
   - This entire component acts as the user interface for the PDF comparison. It handles loading a PDF file, rendering its pages on a canvas, sending the image data to the Gemini Vision API, displaying discrepancies, and applying XML modifications.
   - It contains state fields such as `pdfFile`, `apiKey`, `selectedCatalogId`, `pageRange`, `isAnalyzing`, `analysisProgress`, `analysisLogs`, and `detectedPatches`.

---

## 2. Business Logic and Data Flow Analysis
The core operations for PDF extraction, comparison, and patching run through `src/parser/pdfRulesExtractor.js` and `SystemEditorView.jsx`:

1. **PDF Rendering and Base64 Parsing (UI Component):**
   - Inside `SystemEditorView.jsx`, `loadPdfJs()` dynamically injects CDN scripts:
     - PDF.js: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js`
     - PDF Worker: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`
   - The PDF file's pages are loaded using PDF.js and drawn onto an offscreen canvas (viewport scale 2.0).
   - The canvas context extracts the image as a Base64 JPEG (`canvas.toDataURL('image/jpeg', 0.85)`).

2. **System Context Compiling:**
   - `getCatalogueContext(system, catalogueId)` compiles selection entries, groups, rules, and profiles of the system's selected catalog into a concise JSON structure to serve as context for the Gemini AI.

3. **Gemini Vision AI Request:**
   - `runVisionAnalysis(apiKey, base64Image, catalogueEntries)` issues a POST request to Google Generative Language API (`gemini-2.5-flash:generateContent`).
   - The AI is prompted to find missing description fields on the page image, mapping them back to database entries with suggested corrections.

4. **Patch Application and XML Serialization:**
   - Discrepancies are returned as a JSON patch array.
   - `findAndMutateJsonPatch(system, patch)` traverses the active system to update fields in memory.
   - `updateRawXml(...)` modifies the raw source XML strings (`rawXmls.cat` or `rawXmls.gst`) using `DOMParser` and `XMLSerializer` to reflect changes permanently on disk/database.

### ⚠️ Decoupling Warning: Manual XML Editing (Debug Mode)
The functions `updateRawXml`, `searchEditableEntries`, and `findExactEntryById` inside `pdfRulesExtractor.js` are also used by the developer Debug Mode (`App.jsx` and `DebugEntryEditorModal.jsx`) for searching and manually editing catalog elements. 
*To cleanly delete the PDF comparison logic without breaking the Debug Mode, these three functions must be extracted and relocated to a new, non-PDF-specific utility file.*

---

## 3. Test Coverage Analysis
The PDF-related business rules are tested inside a single test file:

1. **`src/solver/validator.test.js`:**
   - **Line 4:** Imports `searchEditableEntries` and `findAndMutateJsonPatch` from `../parser/pdfRulesExtractor.js`.
   - **Test 20 (Lines 1188–1214):** Verifies catalog query search logic via `searchEditableEntries` and JSON patch modification via `findAndMutateJsonPatch`.
   - **Test 7 (Lines 600–627):** Verifies raw XML updates via a duplicated test implementation `updateRawXmlTest`.
   
There are no other E2E or unit tests targeting `pdfRulesExtractor.js` or `SystemEditorView.jsx`.

---

## 4. Recommended Cleanup and Deletion Projections

To completely remove the PDF Abgleich feature while maintaining the manual debug editing system, the following actions must be executed:

### File Deletions
1. **Delete** `src/components/importer/SystemEditorView.jsx` entirely.
2. **Delete** `src/parser/pdfRulesExtractor.js` (after extracting the debug helpers).

### File Creations
1. **Create** `src/parser/catalogEditor.js` and move the non-PDF debug helpers from `pdfRulesExtractor.js` into it:
   - `updateRawXml(...)`
   - `searchEditableEntries(...)`
   - `findExactEntryById(...)`

### File Modifications
1. **`src/components/Importer.jsx`**:
   - **Line 2:** Remove `Bot` from the `lucide-react` import.
   - **Line 8:** Remove `import SystemEditorView from './importer/SystemEditorView';`.
   - **Line 19:** Remove the `editingSystem` state declaration.
   - **Lines 134–142:** Remove the conditional rendering block for `SystemEditorView`.
   - **Lines 248–255:** Remove the `button` component rendering the Bot icon.

2. **`src/App.jsx`**:
   - **Line 11:** Update the import statement:
     ```javascript
     // Before
     import { findExactEntryById, searchEditableEntries } from './parser/pdfRulesExtractor';
     // After
     import { findExactEntryById, searchEditableEntries } from './parser/catalogEditor';
     ```

3. **`src/components/editor/DebugEntryEditorModal.jsx`**:
   - **Line 4:** Update the import statement:
     ```javascript
     // Before
     import { updateRawXml } from '../../parser/pdfRulesExtractor';
     // After
     import { updateRawXml } from '../../parser/catalogEditor';
     ```

4. **`src/solver/validator.test.js`**:
   - **Line 4:** Update the import statement:
     ```javascript
     // Before
     import { searchEditableEntries, findAndMutateJsonPatch } from '../parser/pdfRulesExtractor.js';
     // After
     import { searchEditableEntries } from '../parser/catalogEditor.js';
     ```
   - **Lines 1188–1214 (Test 20):** Remove the parts of Test 20 that test `findAndMutateJsonPatch`. Retain only the query search tests (`searchResultsGst`, `searchResultsCat`, `searchResultsById`) to verify catalog searching.
     ```javascript
     // Propose changing Test 20 to:
     const searchResultsGst = searchEditableEntries(testGstSystem, 'Bolter');
     const searchResultsCat = searchEditableEntries(testGstSystem, 'Knighthood');
     const searchResultsById = searchEditableEntries(testGstSystem, 'gst-prof-1');

     const searchGstSuccess = searchResultsGst.length === 1 && searchResultsGst[0].id === 'gst-rule-1';
     const searchCatSuccess = searchResultsCat.length === 1 && searchResultsCat[0].id === 'cat-rule-1';
     const searchByIdSuccess = searchResultsById.length === 1 && searchResultsById[0].id === 'gst-prof-1';

     const test20Success = searchGstSuccess && searchCatSuccess && searchByIdSuccess;
     console.log('Test 20 - GST Searching: ', test20Success ? 'PASSED' : 'FAILED');
     ```

---

## 5. Review of `architecture_review.md`

`architecture_review.md` was reviewed and analyzed in detail.
- **Completeness**: Yes, it covers all requirements comprehensively:
  - **Architecture**: Includes a complete module dependency graph, detailed breakdown of files exceeding 400 LOC (including `pdfRulesExtractor.js` and `SystemEditorView.jsx`), and a sequence diagram of catalog import/validation flow.
  - **Testability**: Evaluates current test coverage, identifies critical untested paths (e.g. `useRoster.js`, `migrations.js`), outlines a test infrastructure unification proposal under Vitest, and analyzes hard-to-test patterns.
  - **Extensibility**: Explores specific extension scenarios (adding Warhammer 40k, custom rules, tournament exports) and lists all points of tight coupling to Battlescribe data structure elements.
- **Up-to-date status**: The report is **fully up-to-date**. File line counts mentioned in the report (e.g. `validator.js` at 803 LOC, `SelectionConfigurator.jsx` at 767 LOC, `PlayMode.jsx` at 690 LOC, `pdfRulesExtractor.js` at 594 LOC, `SystemEditorView.jsx` at 424 LOC) correspond perfectly with the current repository structure within ±1 line.
