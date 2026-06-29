# Test Plan - Tome of Battle

This document outlines the test cases and testing strategy for the Army Builder business logic and UI components.

## 1. Business Logic (`src/solver`)

### A. Validator Logic (`validator.js`)
- **Cost Summation**: Verify that total point costs are correctly summed for the roster, taking into account individual unit selections, model upgrades, and sub-selections.
- **Roster Limits**: Ensure a validation error is reported if the roster exceeds the user-configured points limit.
- **Category Limits (Min/Max)**: Validate min/max counts of selections per category (e.g., minimum 1 Troop, maximum 2 HQ).
- **Group Constraints / Selectability**: Validate nested group constraints (e.g., maximum 50 points of Magic Items per character) and test option selectability.
- **Unique Items**: Ensure unique magic items can only be chosen once army-wide.
- **Condition Groups & Modifiers**: Verify condition groups (AND, OR, NOT) evaluate correctly, modifying limits or costs dynamically depending on roster state (e.g., maximum character limit changes under certain points limits).
- **Repeats**: Test repeating modifiers that increment limits or costs dynamically based on other selections.

### B. Rules Evaluator Logic (`rulesEvaluator.js`)
- **Profile Extraction**: Ensure model profiles and upgrade profiles are correctly filtered out from generic characteristics/rules.
- **Armour Saves**: Validate Armour Save calculations, evaluating full plate, heavy/light armour, shields, and mount/barding bonuses.
- **Ward Saves**: Check that ward saves are correctly extracted from rule descriptions (supporting both English "5+ ward save" and German "Rettungswurf von 4+").
- **Blessings**: Verify that blessings (e.g., Blessing of the Lady for Bretonnia) are correctly identified and applied.

### C. Options Collector Logic (`optionsCollector.js`)
- **Hierarchical Collection**: Ensure available choices are collected correctly down the selection tree.
- **Unselected vs Selected**: Verify options collector doesn't recurse into options nested inside unselected upgrades.
- **Group Links**: Confirm that entry links of type `selectionEntryGroup` are correctly parsed and options inside them are collected under the appropriate group name.

## 2. Parser & XML Logic (`src/parser`)

### A. XML Parser (`xmlParser.js`)
- **Game System XML Parsing**: Verify that `.gst` files are successfully parsed into standard JavaScript game system objects, extracting cost types, category entries, and force entries with constraints/modifiers.
- **Catalogue XML Parsing**: Verify that `.cat` files are parsed, resolving selection entries, entry links, shared entries, profiles, rules, and group limits.

### B. ZIP Extractor (`zipExtractor.js`)
- **Extraction & Loading**: Verify that a compressed zip file of catalogs is successfully extracted in-memory, extracting `.cat` and `.gst` files and feeding them to the XML parser.

## 3. UI Components (`src/components`)

### A. Core UI Flows
- **App Load**: Verify the app loads without crash, showing the dashboard with option to upload a catalog zip.
- **Roster Creation Modal**: Verify that users can open the creation modal, set roster name and points limit, and select a force organization type.
- **CategoryUnitAdder Popover**: Check that clicking a category (e.g., HQ) opens the popover, shows available units, and allows adding them to the roster.
- **Validation Error Panels**: Check that real-time validation error alerts are visible in the editor sidebar if the roster is invalid.

### B. Mobile Layout & Responsiveness
- **Mobile Viewport (375x812)**:
  - Verify that the layout changes to mobile mode with responsive columns.
  - Verify that a mobile-specific status bar is visible showing points total and validation status.
  - Verify that clicking the mobile status bar opens/reveals the validation error panel modal/overlay.
