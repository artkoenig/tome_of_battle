Status: resolved
Blocked by: 01-roster-serialization-to-xml, 02-zip-compression-and-decompression-jszip

## Description
Integrate the Roster Export feature into the editor (`src/components/RosterEditor.jsx`).
Specifically:
- **Export Button:**
  - Add an "Exportieren" button to the editor header or action group (next to "Zurück" or "Spielen").
  - When clicked, serialize the active roster using `exportRosterToXml`, compress to a `.rosz` ZIP Blob using `compressXmlToRosz`, and trigger a browser download for `[Roster_Name].rosz`.
  - Use appropriate styling consistent with the app's premium aesthetics.

We will also update `RosterEditor.test.jsx` to verify that the export button is visible and triggers the export download successfully.

## Acceptance Criteria
- [ ] Editor header displays an "Exportieren" button.
- [ ] Clicking the export button correctly serializes and zips the active roster, then triggers a download of the `.rosz` file.
- [ ] Visual styling matches the premium gothic design language.
- [ ] Sibling tests in `RosterEditor.test.jsx` pass.

## Comments
- Integrated export button in the editor header on desktop, linking to the onExportRoster callback. Added corresponding unit tests in RosterEditor.test.jsx.
