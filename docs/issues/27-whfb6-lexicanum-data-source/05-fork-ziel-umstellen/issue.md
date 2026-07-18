Status: resolved
Type: feature
Blocked by: [01, 02, 04]

## Description
Die App bezieht Katalogdaten zur Laufzeit von einem fest verdrahteten Fork-Ziel (`CATALOG_REPO_RAW_BASE_URL` in `src/db/catalogUpdate.js`). Dieses Issue stellt das Ziel vom bisherigen Ergofarg-Fork auf den neuen, eigenen Fork von lexicanum-imperialis/Warhammer-Fantasy-Battles-6th-Definitive-edition um (siehe [ADR-0017](../../../adr/0017-lexicanum-katalog-fork-mit-eigener-revision-ci.md)).

**Konkretes Ziel:** `CATALOG_REPO_RAW_BASE_URL` wird auf `https://raw.githubusercontent.com/artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition/main/` gesetzt (Fork unter dem artkoenig-Account, Default-Branch `main` wie beim Upstream). Der abgeleitete `CATALOG_INDEX_URL` (`${base}catpkg.json`) bleibt strukturell unverändert.

**Manuelle Voraussetzung außerhalb dieses Issues:** Der Ziel-Fork muss unter dem entsprechenden GitHub-Account existieren, die in Issue 04 gelieferte CI (Revision-Bump + `catpkg.json`-Generierung) muss dort aktiv sein und mindestens einen erfolgreichen Sync-Lauf hinter sich haben. Das kann kein Issue-Implementer selbst herstellen — dieses Issue liefert und testet die App-seitige Umstellung (per Mocks), die Live-Verifikation gegen den echten Fork erfolgt danach manuell.

## Acceptance Criteria
- [ ] `CATALOG_REPO_RAW_BASE_URL` verweist auf den neuen Fork statt auf den Ergofarg-Fork.
- [ ] Der Revision-Vergleichsmechanismus („higher wins") und alle vier `REVISION_STATE`-Fälle (`NEW`, `CURRENT`, `OUTDATED`, `AHEAD`) funktionieren unverändert gegen die neue Quelle (verifiziert mit gemockten Responses, die dem neuen `catpkg.json`-Format entsprechen).
- [ ] Bereits importierte Systeme aus der alten Ergofarg-Quelle (andere `gameSystemId`) bleiben nach der Umstellung unverändert nutzbar und werden nicht gelöscht oder überschrieben.
- [ ] `catalogUpdate.test.js` deckt die neue URL/Basis ab; bestehende Tests, die die alte URL fest annehmen, sind aktualisiert.
- [ ] Notiert: manuelle Live-Verifikation gegen den echten neuen Fork nach dessen Einrichtung ist nicht Teil der automatisierten Tests dieses Issues.

## Comments
- CATALOG_REPO_RAW_BASE_URL auf den neuen Lexicanum-Fork (artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition@main) umgestellt; CATALOG_INDEX_URL bleibt strukturell (${base}catpkg.json). catalogUpdate.test.js aktualisiert: buildRawFileUrl-Assertion auf neue Basis, neue CATALOG_INDEX_URL-Assertion, benannte FORK_RAW_BASE_URL-Konstante. Revision-Vergleich/REVISION_STATE-Faelle sind URL-agnostisch und bleiben gruen (18 Tests). Manuelle Live-Verifikation gegen den echten Fork ist bewusst nicht Teil der automatisierten Tests.
