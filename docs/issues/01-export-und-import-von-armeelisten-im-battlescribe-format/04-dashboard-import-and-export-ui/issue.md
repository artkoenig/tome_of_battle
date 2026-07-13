Status: resolved
Blocked by: 02-zip-compression-and-decompression-jszip, 03-roster-deserialization-from-xml

## Description
Integrate Roster Import and Export features into the dashboard (`src/components/RosterDashboard.jsx` and `src/App.jsx`).
Specifically:
- **Import Button:**
  - Add an "Importieren" button next to "Neue Armeeliste" (New Roster) in the dashboard header.
  - Add an "Importieren" button next to "Erste Armeeliste ausheben" in the dashboard's empty state.
  - Clicking this button triggers a hidden `<input type="file" accept=".ros,.rosz"/>` element.
  - When a file is selected, read it as a Blob, call `decompressRoszToXml` to extract the XML, and then call `importRosterFromXml` (passing the systems).
  - If import is successful:
    - Save the roster to IndexedDB using `saveRoster`.
    - Display a success message.
    - Refresh the dashboard to list the newly imported roster.
  - If import fails due to a missing game system:
    - Display a clear error popup: "Das Spielsystem [SystemName] (ID: [SystemID]) fehlt. Bitte importiere es zuerst im Bibliothekar."
  - If import fails due to parsing error:
    - Display an error popup: "Fehler beim Importieren der Armeeliste. Ungültiges Dateiformat."
- **Export Button:**
  - Add an "Exportieren" button on each roster card in the dashboard grid.
  - When clicked, load the roster and corresponding system, serialize using `exportRosterToXml`, compress to a `.rosz` ZIP Blob using `compressXmlToRosz`, and trigger a browser download for `[Roster_Name].rosz`.

We will also update relevant dashboard and app tests to ensure the UI handles these events properly.

## Acceptance Criteria
- [ ] Dashboard header displays an "Importieren" button.
- [ ] Dashboard empty state displays an "Importieren" button.
- [ ] Selecting a valid `.ros` or `.rosz` file successfully imports the list and saves it locally.
- [ ] Trying to import a roster with a missing game system shows a clear error popup.
- [ ] Roster cards display an "Exportieren" button that downloads a valid `.rosz` file.
- [ ] Integration behaves correctly and is verified by running tests.

## Comments
- Integrated import button and logic on dashboard and empty states, export button on cards, and handled events. Added corresponding unit tests in RosterDashboard.test.jsx.
