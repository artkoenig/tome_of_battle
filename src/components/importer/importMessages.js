// User-facing texts of the import screen. They live next to the Importer's presentation
// rather than in the data layer, which reports the import outcome as structured data.

const MISSING_LIBRARY_DEPENDENCY_MESSAGE = {
  headline: 'Import abgebrochen: Ein ausgewählter Katalog verweist auf einen nicht ausgewählten Bibliothekskatalog.',
  instruction: 'Bitte wähle folgende Kataloge zusätzlich aus, um einen vollständigen Import sicherzustellen:',
  requiredByLabel: 'benötigt von',
  itemSeparator: '; ',
  referenceSeparator: ', ',
};

function quoteCatalogueName(value) {
  return `„${value}"`;
}

/**
 * Names every library catalogue the import is missing, together with the catalogues that
 * depend on it, so the user knows exactly what to add.
 *
 * @param {{ id: string, name: string, requiredBy: string[] }[]} missingDependencies
 */
export function buildMissingLibraryDependencyMessage(missingDependencies) {
  const { headline, instruction, requiredByLabel, itemSeparator, referenceSeparator } =
    MISSING_LIBRARY_DEPENDENCY_MESSAGE;
  const details = missingDependencies
    .map((dependency) => {
      const quotedName = quoteCatalogueName(dependency.name);
      if (dependency.requiredBy.length === 0) return quotedName;
      const references = dependency.requiredBy.map(quoteCatalogueName).join(referenceSeparator);
      return `${quotedName} (${requiredByLabel} ${references})`;
    })
    .join(itemSeparator);
  return `${headline} ${instruction} ${details}.`;
}

/**
 * The confirmation shown after a system was stored, identical for both import paths.
 */
export function buildImportSuccessMessage(system) {
  const catalogueCount = system.catalogues?.length ?? 0;
  return `Das System "${system.name}" mit ${catalogueCount} Katalogen wurde erfolgreich importiert!`;
}
