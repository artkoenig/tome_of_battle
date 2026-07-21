// A catalogueLink pulls shared entries from another (library) catalogue into the
// referencing one. Importing a dataset that keeps the referencing catalogue but omits its
// link target would silently drop those shared entries on the next roster resolution, so
// every import path guards against it.

/**
 * A catalogue directory answers, for one unresolved catalogueLink target, which catalogue
 * the user could still add — or `null` when the target is nothing the user can supply, in
 * which case the missing link is not actionable and stays unreported.
 *
 * @callback CatalogueDirectory
 * @param {string} targetId the catalogueLink's target id.
 * @param {{ targetId?: string, name?: string }} catalogueLink the link itself.
 * @returns {{ id: string, name?: string } | null}
 */

/**
 * The directory of a bundle import: the catalog index bounds exactly which catalogues the
 * user could have selected. A link target the index does not know at all is broken
 * upstream and no selection can fix it, so it is not reported.
 *
 * @param {{ id: string, name?: string }[]} availableCatalogues
 * @returns {CatalogueDirectory}
 */
export function catalogueDirectoryFromIndex(availableCatalogues) {
  const catalogueById = new Map((availableCatalogues ?? []).map((catalogue) => [catalogue.id, catalogue]));
  return (targetId) => catalogueById.get(targetId) ?? null;
}

/**
 * The directory of an uploaded archive: no index bounds the catalogue set, so every
 * unresolved link target counts as a catalogue the user could add to their archive. Its
 * name is taken from the link itself, which is the only description available offline.
 *
 * @returns {CatalogueDirectory}
 */
export function catalogueDirectoryFromLinks() {
  return (targetId, catalogueLink) => ({ id: targetId, name: catalogueLink?.name });
}

/**
 * Finds catalogueLinks in the imported catalogues whose target is missing from the import
 * itself but could be supplied by the user, as judged by the given `catalogueDirectory`.
 * Such a target is a shared (library) catalogue the referencing catalogue depends on;
 * importing without it yields a silently incomplete dataset.
 *
 * @param {{ id: string, name?: string, catalogueLinks?: { targetId?: string, name?: string }[] }[]} importedCatalogues
 *   the fully parsed catalogues that the import would store (their catalogueLinks are read).
 * @param {CatalogueDirectory} catalogueDirectory resolves an unresolved target to an
 *   addable catalogue, or null.
 * @returns {{ id: string, name: string, requiredBy: string[] }[]} one entry per missing
 *   dependency, deduplicated by target id.
 */
export function findMissingLibraryDependencies(importedCatalogues, catalogueDirectory) {
  const catalogues = importedCatalogues ?? [];
  const importedCatalogueIds = new Set(catalogues.map((catalogue) => catalogue.id));
  const missingDependencyById = new Map();

  for (const importedCatalogue of catalogues) {
    for (const catalogueLink of importedCatalogue.catalogueLinks ?? []) {
      const targetId = catalogueLink.targetId;
      if (!targetId || importedCatalogueIds.has(targetId)) continue;

      const addableTarget = catalogueDirectory(targetId, catalogueLink);
      if (!addableTarget) continue;

      const dependency = missingDependencyById.get(targetId) ?? {
        id: targetId,
        name: addableTarget.name ?? catalogueLink.name ?? targetId,
        requiredBy: [],
      };
      const referencingName = importedCatalogue.name ?? importedCatalogue.id;
      if (referencingName && !dependency.requiredBy.includes(referencingName)) {
        dependency.requiredBy.push(referencingName);
      }
      missingDependencyById.set(targetId, dependency);
    }
  }

  return [...missingDependencyById.values()];
}
