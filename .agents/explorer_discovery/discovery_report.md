# Tome of Battle: Codebase Discovery and Analysis Report

## 1. Executive Summary

This report presents a comprehensive discovery and analysis of the `army_builder` application, a tabletop roster creator named "Tome of Battle." 

Key findings of this analysis:
* **Architecture:** The application is built on React, Vite, and IndexedDB. It parses standard BattleScribe XML data files (`.gst` and `.cat`) using a custom DOM-based XML parser and stores them locally.
* **Monoliths & UI-Coupling:** Several React components (`PlayMode.jsx`, `SelectionConfigurator.jsx`, `RosterEditor.jsx`) are highly monolithic, carrying heavy responsibilities such as rule solvers and parsing logic mixed directly into the rendering lifecycle.
* **Rule R4 Violations:** We identified **critical violations of Rule R4** in `PlayMode.jsx`, `RosterEditor.jsx`, and `SelectionConfigurator.jsx`. Substrings in German and English (e.g., `'armor'`, `'shield'`, `'reittier'`, `'rüstung'`) are used as keys/keywords to determine profiles, upgrades, and to calculate combat stats (armour saves and ward saves).
* **Test Gaps:** While the core validation solver (`validator.js`) has a test file with 22 test cases, there is **zero coverage** for the custom XML parser, ZIP extractor, state management hooks (`useRoster.js`), IndexedDB handlers, and UI components.
* **Dead Code:** A few dead assets (`react.svg`, `vite.svg`, `hero.png`, `icons.svg`), a dead stylesheet (`src/App.css`), and several unused imports were detected.

---

## 2. Codebase Architecture & Structure

The folder structure of the project is organized as follows:

```
/Users/artkoenig/Workspace/army_builder/
├── dist/                          # Production build output
├── public/                        # Static public assets
│   ├── favicon.svg                # Application shortcut icon (used)
│   └── icons.svg                  # Unused public icon assets
├── scripts/                       # Local Python automation scripts
│   ├── github_issue_agent.py
│   ├── implement_issue_agent.py
│   └── ux_self_correction.py
├── src/                           # Main React Application source code
│   ├── assets/                    # React/Vite/Hero assets (unused)
│   │   ├── hero.png
│   │   ├── react.svg
│   │   └── vite.svg
│   ├── components/                # React UI Components
│   │   ├── Importer.jsx           # BSData librarians importing page
│   │   ├── PlayMode.jsx           # Roster play mode interactive sheet
│   │   ├── RosterEditor.jsx       # Custom army list designer page
│   │   ├── editor/                # Sub-components for RosterEditor
│   │   │   ├── BottomSheet.jsx
│   │   │   ├── CategoryUnitAdder.jsx
│   │   │   ├── RosterSidebar.jsx
│   │   │   └── SelectionConfigurator.jsx
│   │   └── importer/              # Sub-components for Importer
│   │       └── SystemEditorView.jsx
│   ├── db/                        # IndexedDB client data store
│   │   ├── database.js            # Operations for systems & rosters
│   │   └── migrations.js          # Auto-migrations for data schemes
│   ├── hooks/                     # Custom React hooks
│   │   ├── DebugContext.jsx       # Show/hide ID debugging context
│   │   └── useRoster.js           # Core state hook for army roster
│   ├── parser/                    # Parsing algorithms
│   │   ├── pdfRulesExtractor.js   # Vision-AI matching & XML patching
│   │   ├── xmlParser.js           # BattleScribe GST/CAT XML reader
│   │   └── zipExtractor.js        # File extractor from ZIP archives
│   ├── solver/                    # Roster logic & tests
│   │   ├── debug_ui.js            # Puppeteer-based E2E UI script
│   │   ├── validator.js           # Roster rule checking engine
│   │   └── validator.test.js      # Core unit test suite
│   ├── App.css                    # Dead stylesheet (unused)
│   ├── App.jsx                    # Routing and layout component
│   ├── index.css                  # Main app stylesheet
│   └── main.jsx                   # Application mounting point
├── index.html                     # HTML root page template
├── package.json                   # Project scripts and dependencies
├── vite.config.js                 # Bundler settings
└── README.md
```

### Component Data Flow & Communication
1. **Importing:** Users upload a ZIP file containing `.gst` (Game System) and `.cat` (Catalogue) XMLs via `Importer.jsx`.
2. **Extraction & Parsing:** `zipExtractor.js` decompresses the files. `xmlParser.js` parses XML contents into structured JSON documents.
3. **Persistence:** The parsed structures are saved in IndexedDB (`database.js`).
4. **Editing:** In `RosterEditor.jsx`, the custom hook `useRoster.js` orchestrates roster mutation state. For every change, `validator.js` performs cost summation, force category calculations, and group constraint checkups.
5. **Play Mode:** `PlayMode.jsx` loads the final roster into an interactive UI and adds health counters. It extracts rules and calculates armour/ward saves on the fly.

---

## 3. Monolithic Component Analysis

We identified three primary monolithic components in the UI layers that carry too much logic and need to be decoupled:

### 1. `src/components/PlayMode.jsx` (~788 lines)
* **Responsibilities:** 
  1. Manages UI page layout, quick searches, round trackers, VP/CP counters, and wounds.
  2. Extracts profiles and rules from nested selections.
  3. Parses names and rules using string matching to compute combat characteristics.
* **Problem:** Rule evaluation is mixed directly into layout rendering. Armour saves (`getArmourSave` at line 144) and ward saves (`getWardSave` at line 266) are complex functions that should be isolated into the solver logic layer (`src/solver/`) so they can be unit-tested.

### 2. `src/components/editor/SelectionConfigurator.jsx` (~953 lines)
* **Responsibilities:**
  1. Structures all nested upgrades, options, and magic items.
  2. Evaluates options constraints inline.
  3. Group list options, handles counters, triggers state updates.
* **Problem:** This component is overly large and does too much manual rendering of nested bottom sheets, checkboxes, and buttons. Parts of it should be broken down into sub-components (e.g. `UpgradeGroup.jsx` or `OptionRow.jsx`).

### 3. `src/components/RosterEditor.jsx` (~642 lines)
* **Responsibilities:**
  1. Renders the main builder panel layout.
  2. Triggers notifications, handles tooltip coordinates, models modal views.
  3. Groups unit listings by category and renders categories.
* **Problem:** Roster editing and presentation elements are combined. The layout rendering would benefit from extracting individual panels (e.g. general error list, individual unit card rows, tooltips) into smaller files.

---

## 4. Test Suite & Coverage Analysis

### Current Status
* Run command: `npm test` maps to `node src/solver/validator.test.js`.
* Tested files: Only `src/solver/validator.js` is covered, using a custom test runner in `validator.test.js` containing 22 tests.
* E2E tests: `src/solver/debug_ui.js` executes end-to-end tests using Puppeteer, but it has to be run manually and is not integrated into `npm test`.

### Gaps in Test Coverage
1. **Parsers:**
   * `xmlParser.js` contains complex DOM-based parsing logic but has no dedicated unit tests.
   * `zipExtractor.js` lacks tests for handling ZIP decompression and filtering system files.
   * `pdfRulesExtractor.js` lacks tests for range strings parsing (`parsePageNumbers`) and string query searches.
2. **State Management Hooks:**
   * `useRoster.js` is the heart of the builder's state. It has no unit tests. If roster mutation logic changes (such as collective selections adding or subselection increments), it could break the builder silently.
3. **Database & Migrations:**
   * `database.js` and `migrations.js` are not tested. Database schema updates or migrations could fail, causing existing user rosters to become corrupt.
4. **Gameplay Rules Logic:**
   * The armour and ward save calculation logic residing inside `PlayMode.jsx` is completely untested.

---

## 5. Violations of Rule R4 (Substrings as Keys)

Rule R4 states: *"Es sollen keine (Sub)Strings auf Englisch oder Deutsch als Schlüssel für das Parsen oder Validieren in der Geschäftslogik verwendet werden"* (No substrings in English or German should be used as keys for parsing or validating in the business logic).

We discovered multiple violations of this rule. Substrings are hardcoded to categorize items, filter profiles, and calculate stats based on text strings in XML data.

### Occurrences of Rule R4 Violations

#### 1. Profile Filtering in `src/components/PlayMode.jsx` (Lines 99-100)
To separate character/model profiles from equipment rules, the code uses hardcoded string lists:
```javascript
97:     const modelProfiles = profiles.filter(p => {
98:       const typeLower = p.profileTypeName?.toLowerCase() || '';
99:       return ['profile', 'profil', 'unit', 'einheit', 'creature', 'kreatur', 'monster', 'charakteristik', 'charakterwerte', 'mount', 'reittier'].some(t => typeLower.includes(t)) && 
100:              !['magic item', 'equipment', 'ausrüstung', 'magic weapon', 'armour', 'rüstung', 'weapon', 'waffe', 'virtue', 'talisman', 'item', 'special rule', 'banner', 'standarte', 'runes', 'runen'].some(t => typeLower.includes(t));
101:     });
```

#### 2. Upgrade Classification in `src/components/PlayMode.jsx` (Line 133)
To identify rule descriptions for upgrades and magic items:
```javascript
131:       p.profiles.forEach(p => {
132:         const typeLower = p.profileTypeName?.toLowerCase() || '';
133:         if (['magic item', 'weapon', 'armour', 'enchanted item', 'arcane item', 'talisman', 'magic weapon', 'magic armour', 'virtue', 'runes', 'special rule', 'gegenstand', 'virtues', 'tugend'].some(t => typeLower.includes(t))) {
```

#### 3. Armour Save Calculation in `src/components/PlayMode.jsx` (Lines 160-184)
Calculating armour saves is performed by checking naming attributes:
```javascript
159:       // Shields
160:       if (t.includes('shield') || t.includes('schild')) {
161:         hasShield = true;
162:       }
163:       
164:       // Armours
165:       if (t.includes('full plate') || t.includes('plattenrüstung') || t.includes('gromril') || t.includes('chaos armour') || t.includes('chaos-rüstung')) {
166:         armourValue = Math.min(armourValue, 4);
167:       } else if (t.includes('heavy armour') || t.includes('schwere rüstung')) {
168:         armourValue = Math.min(armourValue, 5);
169:       } else if (t.includes('light armour') || t.includes('leichte rüstung')) {
170:         armourValue = Math.min(armourValue, 6);
171:       }
172: 
173:       // Mounts (cavalry mount types in 6th edition)
174:       if (t.includes('horse') || t.includes('steed') || ... ) {
...
182:       if (t.includes('barded') || t.includes('barding') || t.includes('harnisch') || ... ) {
```

#### 4. Cavalry Classification in `src/components/PlayMode.jsx` (Lines 194, 213)
Detecting mounted status based on profile type strings:
```javascript
194:         if (p.profileTypeName?.toLowerCase().includes('cavalry') || p.profileTypeName?.toLowerCase().includes('kavallerie')) {
```

#### 5. Ward Save Regex Matching in `src/components/PlayMode.jsx` (Lines 280, 289, 298)
Parsing ward saves by running regular expressions against German/English text:
```javascript
280:       const m1 = t.match(/(\d)\+\s*(?:ward save|rettungswurf|rettung)/);
...
289:       const m2 = t.match(/(?:ward save|rettungswurf|rettung)\s*(?:of|von)?\s*(\d)\+/);
...
298:       if (t.includes('blessing of the lady') || t.includes('segen der herrin') || t.includes('grail vow') || t.includes('gralsgelübde') || t.includes('segen')) {
```

#### 6. Upgrade Details Classification in `src/components/RosterEditor.jsx` (Line 76) & `SelectionConfigurator.jsx` (Line 83)
Checking whether to display stats for custom items:
```javascript
82:         const typeLower = p.profileTypeName?.toLowerCase() || '';
83:         if (typeLower.includes('weapon') || typeLower.includes('magic') || typeLower.includes('items') || typeLower.includes('rüstung') || typeLower.includes('waffe')) {
```

#### 7. General-Commander Flag in `src/components/editor/SelectionConfigurator.jsx` (Lines 350-354)
Setting ordering priority based on "General" matching:
```javascript
350:     return nameLower === 'general' || 
351:            nameLower === 'armeegeneral' || 
352:            nameLower === 'army general' || 
353:            nameLower.includes('warlord') || 
354:            nameLower === 'general der armee' ||
```

---

## 6. Dead Code & Unused Dependencies

We scanned the project code and identified several unused resources and dead imports:

### Dead Files (Unused)
* `src/App.css`: A layout styling sheet that is not imported or referenced anywhere in `src/` (the application exclusively relies on `src/index.css`).

### Unused Assets
* `src/assets/react.svg`
* `src/assets/vite.svg`
* `src/assets/hero.png`
* `public/icons.svg`

### Unused Imports in React Files
* `src/components/RosterEditor.jsx`: `Shield` and `BookOpen` are imported from `lucide-react` (line 2) but are never rendered.
* `src/components/PlayMode.jsx`: `Shield` (line 3) and `findEntryInCatalogue` (line 7) are imported but never used.

### Package Dependencies Check (`package.json`)
All direct dependencies in `package.json` are currently used:
* `jszip` is required by `zipExtractor.js` and `Importer.jsx`.
* `lucide-react` is used throughout the UI.
* `react` and `react-dom` are standard.
* `jsdom` and `puppeteer` are utilized in the test suite and E2E debugger respectively.

---

## 7. Refactoring Strategy & Action Plan

To fix these structural issues, decoupled designs, and Rule R4 violations, we propose the following refactoring steps:

### Phase 1: Decoupling Rule Calculations
1. **Create `src/solver/rulesEvaluator.js`**: Move rule extraction, armour save calculations (`getArmourSave`), and ward save calculations (`getWardSave`) out of `PlayMode.jsx` into this new pure JS logic file.
2. **Centralize String Dictionaries**: To address Rule R4, create `src/solver/constants.js`. Centralize all keyword dictionaries.
3. **Decouple Matching Keys**: Replace direct `includes(...)` checks with configurable token lists imported from `constants.js` or identify profile types using standardized structure attributes (e.g. checking if characteristic names include combat statistics like `WS`/`BS`/`S`/`T` to identify model profiles).

### Phase 2: Structural Clean-up
1. **Remove Unused Files & Assets**: Delete `src/App.css`, `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`, and `public/icons.svg`.
2. **Clean Imports**: Remove the unused imports in `PlayMode.jsx` and `RosterEditor.jsx`.
3. **Decouple SelectionConfigurator**: Extract components like `GeneralItemSelector` or `OptionGroup` to reduce `SelectionConfigurator.jsx` size and complexity.

### Proposed Directory Layout after Refactoring:

```
src/
├── components/
│   ├── editor/
│   │   ├── bottomsheet/
│   │   └── configurator/          # Decoupled SelectionConfigurator parts
│   └── ...
├── parser/
│   └── ...
├── solver/
│   ├── constants.js               # CENTRALIZED CONSTANTS / LOOKUP DICTIONARIES
│   ├── rulesEvaluator.js          # EXTRACTED GAMEPLAY RULES SOLVER
│   ├── rulesEvaluator.test.js     # NEW TEST FILE FOR SAVES & WEAPONS LOGIC
│   ├── validator.js
│   └── validator.test.js
```

---

## 8. Verification Plan

Any changes made during refactoring must be verified using the following plan:

1. **Unit Testing:**
   * Execute `npm test` after each phase. The existing 22 tests must pass successfully.
   * Write new tests in `src/solver/rulesEvaluator.test.js` to cover the extracted armour save and ward save calculations under various conditions (e.g., standard mount, barded mount, shield, full plate, heavy/light armour, ward saves, blessing rule).
2. **End-to-End Testing:**
   * Run the local Vite dev server.
   * Run `node src/solver/debug_ui.js` locally to run the automated Puppeteer script. Ensure it completes successfully and outputs screenshots/logs indicating all steps pass without errors.
3. **Static Linting:**
   * Run `npm run lint` (`oxlint`) to verify that the refactored code has no syntactic errors or imports issues.
