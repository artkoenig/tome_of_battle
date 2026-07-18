Status: resolved
Type: fix
Blocked by: [01]

## Description
Deckt die reinen Attribut-Lese-Lücken #5, #7, #8, #9 aus Main-Issue 19 ab.
Konsumiert die kanonischen Attributnamen aus dem SSOT (Kind-Issue 01).

Der Parser erfasst folgende schema-gültigen Attribute, die heute falsch oder gar
nicht gelesen werden:
- Profil-Typ als `typeId`/`typeName` (statt der nicht existierenden
  `profileTypeId`/`profileTypeName`) → Profil-Typname ist nicht mehr immer null (#5).
- `catalogueLink@importRootEntries` → Library-Import-Semantik vollständig (#7).
- `costType@hidden` → versteckte Kostenarten werden nicht mehr angezeigt (#8).
- `publication@publisherUrl` (statt `website`) → Publisher-URL nicht mehr immer null (#9).

Jedes Attribut wird an einer synthetischen, generischen, schema-gültigen Fixture
nachgewiesen (nicht an WHFB6). Direkt sichtbare Effekte (Profil-Typname
erscheint, versteckte Kostenart verschwindet aus der Anzeige) werden mit
abgedeckt.

## Acceptance Criteria
- [ ] Profil-Typ wird über `typeId`/`typeName` geparst; `typeName` erscheint in der Profil-Anzeige
- [ ] `catalogueLink@importRootEntries` wird geparst und in die Library-Import-Semantik einbezogen
- [ ] `costType@hidden` wird geparst; als hidden markierte Kostenarten werden nicht angezeigt
- [ ] `publication@publisherUrl` wird korrekt geparst (nicht mehr null)
- [ ] Je eine generische, schema-gültige Fixture pro Attribut belegt das Verhalten

## Comments
- Fixed pure attribute-read gaps in xmlParser.js: profile type now read from schema-valid typeId/typeName, catalogueLink@importRootEntries parsed, costType@hidden parsed and hidden cost types filtered out of getExtraResourceTotals display, publication publisherUrl read (was website). Attribute names consumed from the SSOT AttributeName map. One generic schema-valid fixture per attribute in xmlParser.staticAttributes.test.js.
