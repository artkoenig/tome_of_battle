/**
 * Die **Wurzelangebote** eines Katalogs: die Einträge, die das Kontingent selbst
 * anbieten darf.
 *
 * Ein Katalog trennt zwei Arten von Pools (siehe
 * `docs/battlescribe-data-format.md`, „Wurzelangebote und Bibliothek"):
 *
 * - `catalogue.selectionEntries` und `catalogue.entryLinks` stehen auf der
 *   Wurzelebene des Katalogs — das sind seine Angebote an die Armeeliste.
 * - `catalogue.sharedSelectionEntries` (ebenso `sharedSelectionEntryGroups`,
 *   `sharedRules`, `sharedProfiles`) sind reine **Bibliothek**: Ziele von
 *   `entryLink`s. Sie werden erst dort wählbar, wo ein Link sie einbindet — z. B.
 *   „Pure of Heart" im Hochelfen-Katalog, das ausschließlich aus der
 *   Honours-Gruppe eines Helden verlinkt wird.
 *
 * Ein geteilter Eintrag ist deshalb nur dann ein Wurzelangebot, wenn ein
 * `entryLink` auf der Katalogwurzel ihn einbindet — dann steht er hier über
 * genau diesen Link.
 *
 * @param {object} [catalogue] der Katalog, dessen Wurzelangebote gesucht sind.
 * @returns {object[]} die Wurzel-Einträge und -Links, in Katalogreihenfolge.
 */
export function collectRootOfferEntries(catalogue) {
  if (!catalogue) return [];
  return [
    ...(catalogue.selectionEntries || []),
    ...(catalogue.entryLinks || []),
  ];
}
