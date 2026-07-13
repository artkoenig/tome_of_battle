Status: resolved
Blocked by: None

## Description
# PRD: Roster Export & Import in BattleScribe Format

### Problem Statement
The user wants to allow exporting and importing of army lists (rosters) to/from the local workspace. The format must be compatible with BattleScribe and New Recruit (`.ros` or `.rosz` files). Currently, rosters are only saved in the local browser database (IndexedDB), and there is no way to share lists, back them up, or import lists created in other editors.

### Solution
Implement an uncompressed XML serializer/deserializer for the BattleScribe `.ros` roster format, combined with a ZIP layer using `JSZip` to support `.rosz` files. Incorporate import/export entry points into the dashboard and editor UI.

### User Stories / Requirements
1. **As a player**, I want to export my army list as a `.rosz` file from the dashboard or the editor, so that I can open it in BattleScribe, New Recruit, or other compatible viewers/tools.
2. **As a player**, I want to import a `.ros` or `.rosz` file on the dashboard, so that I can load my existing lists into Tome of Battle.
3. **As a player**, I want the app to prevent importing a roster if the underlying Game System is missing, and instead guide me to import the game system first.
4. **As a player**, I want imported rosters to receive new unique IDs so they don't overwrite my existing rosters by accident.

### Technical Decisions
- **Affected Modules:**
  - UI: `src/components/RosterDashboard.jsx`, `src/components/RosterEditor.jsx`
  - Database: `src/db/database.js`
  - Utility/Serialization: [NEW] `src/utils/rosterSerialization.js`
- **Technical Clarifications / Architectural Decisions:**
  - Roster XML format uses namespace `http://www.battlescribe.net/schema/rosterSchema` and conforms to Battlescribe's tags (`<roster>`, `<forces>`, `<force>`, `<selections>`, `<selection>`, `<costs>`, `<cost>`).
  - `.rosz` is a standard zip archive containing a single `.ros` XML file.
  - Generating and extracting zip archives is done using `jszip` (already in dependencies).
  - Validation and cost calculations will run automatically upon import using `calculateRosterCosts` and `validateRoster`.
- **API Contracts / Data Models:**
  - `exportRosterToRosz(roster, system)` -> triggers download of `[RosterName].rosz`.
  - `importRosterFromRosz(fileBlob, systems)` -> processes zip, parses XML, maps to internal Roster schema, persists in IndexedDB.

### Testing Decisions
- **Modules to Test:**
  - `src/utils/rosterSerialization.js`
- **Test Interfaces (Seams):**
  - Unit tests in `src/utils/rosterSerialization.test.js` validating serialization to XML, deserialization from XML, zipping/unzipping, validation handling on import, and missing system validation.

### Out of Scope
- Custom name/notes preservation (Tome of Battle does not support these attributes on selections).
- Exporting to other formats (e.g., PDF or raw HTML).

## Acceptance Criteria
- [ ] Users can export any local roster as a `.rosz` file from the dashboard.
- [ ] Users can export the active roster as a `.rosz` file from the editor.
- [ ] Users can import a `.ros` or `.rosz` file from the dashboard.
- [ ] The app blocks imports of rosters with missing game systems and displays a helpful error.
- [ ] Imported rosters get newly generated unique IDs and are immediately validated (showing correct points/errors).
- [ ] All unit tests for serialization and zipping pass successfully.

## Comments
