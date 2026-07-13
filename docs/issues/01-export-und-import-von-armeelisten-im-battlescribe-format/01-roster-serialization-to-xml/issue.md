Status: resolved
Blocked by: None

## Description
Implement the XML serialization logic to turn an internal Roster object and its active game System object into a BattleScribe-compatible `.ros` XML string.
The output XML must use the namespace `http://www.battlescribe.net/schema/rosterSchema` on the root `<roster>` element.
Specifically:
- Root `<roster>` needs attributes: `id`, `name`, `gameSystemId`, `gameSystemRevision`, `gameSystemName`, `battleScribeVersion="2.03"`.
- `<costs>` contains `<cost name="..." typeId="..." value="..."/>` representing the total roster costs.
- `<forces>` contains `<force>` elements.
- Each `<force>` needs: `id`, `name`, `entryId`, `catalogueId`, `catalogueRevision`, `catalogueName`. It contains:
  - `<publications/>` (empty)
  - `<categories/>` (empty or list of categories from selections)
  - `<selections>` containing `<selection>` elements (recursive).
- Each `<selection>` needs: `id`, `name`, `entryId`, `entryLinkId` (if selected via an entryLink), `number`, `type` (e.g. "unit", "model", "upgrade"), `collective`. It contains:
  - `<costs>` with `<cost>` child elements for that selection's points.
  - `<selections>` for nested selections.

We will put this serialization function inside `src/utils/rosterSerialization.js` under the name `exportRosterToXml(roster, system)`.

## Acceptance Criteria
- [ ] `exportRosterToXml(roster, system)` produces a valid XML string.
- [ ] Root `<roster>` has correct namespace `http://www.battlescribe.net/schema/rosterSchema` and version attributes.
- [ ] Total roster costs are calculated and serialized under `<costs>`.
- [ ] Forces and selections are recursively serialized with correct attributes (`id`, `name`, `entryId`, `entryLinkId`, `number`, `type`).
- [ ] All unit tests in `src/utils/rosterSerialization.test.js` for serialization pass.

## Comments
- Implemented exportRosterToXml and serializeSelection recursive helper in src/utils/rosterSerialization.js, fully verified via unit tests.
