Status: resolved
Blocked by: 01-roster-serialization-to-xml

## Description
Implement the XML deserialization logic to parse a Battlescribe `.ros` XML string into our internal Roster object.
Specifically:
- Implement `importRosterFromXml(xmlText, systems)`:
  - Parses the XML using `DOMParser`.
  - Verifies that the root element is `<roster>` and uses the correct namespace.
  - Extracts the `gameSystemId` and `catalogueId` from the roster/force elements.
  - Verifies that a game system with `id === gameSystemId` is present in the `systems` array. If not, throws an error with the name and ID of the missing system (so the UI can guide the user).
  - Recursively maps `<force>` and `<selection>` XML nodes into the internal `Force` and `Selection` objects:
    - Generates new unique IDs (using `crypto.randomUUID()`) for the roster, each force, and each selection. This ensures imported rosters do not clash with existing local rosters.
    - Extracts `name`, `number`, `type`, `collective`, and points/costs.
    - For `entryId` and `entryLinkId` in selection nodes, maps them to `selectionEntryId` and `entryLinkId` respectively.
  - Returns the reconstructed internal `Roster` object.

We will put this deserialization function inside `src/utils/rosterSerialization.js`.

## Acceptance Criteria
- [ ] `importRosterFromXml(xmlText, systems)` successfully parses a valid Battlescribe XML string and returns an internal `Roster` object.
- [ ] The importer throws a clear, descriptive error if the corresponding Game System ID is missing from `systems`.
- [ ] All elements (roster, forces, selections) receive fresh unique UUIDs upon import to avoid local database key clashes.
- [ ] Hierarchical selection structures and attributes (`name`, `number`, `costs`, `type`, `collective`) are parsed and restored correctly.
- [ ] All unit tests in `src/utils/rosterSerialization.test.js` for XML parsing pass.

## Comments
- Implemented importRosterFromXml, parseSelectionNode and custom MissingSystemError class in src/utils/rosterSerialization.js, verified with unit tests.
