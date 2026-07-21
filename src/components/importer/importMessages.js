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

const FAILED_CATALOGUE_MESSAGE = {
  headline: 'Folgende Kataloge konnten nicht gelesen werden und fehlen im importierten System:',
  consequence:
    'Armeelisten dieser Fraktionen lassen sich erst nach einem erneuten, vollständigen Import wieder aufbauen.',
  itemSeparator: '; ',
};

/**
 * The confirmation shown after a system was stored, identical for both import paths. When
 * catalogues failed to parse, it reports the import as incomplete instead of confirming a
 * completeness the stored system does not have — the catalogue count alone would hide the
 * loss, since the failed catalogues are already missing from it.
 *
 * @param {object} system the stored system.
 * @param {import('../../parser/xmlParser').CatalogueParseFailure[]} [failedCatalogues]
 */
export function buildImportSuccessMessage(system, failedCatalogues = []) {
  const importedCount = system.catalogues?.length ?? 0;
  if (failedCatalogues.length === 0) {
    return `Das System "${system.name}" mit ${importedCount} Katalogen wurde erfolgreich importiert!`;
  }
  const expectedCount = importedCount + failedCatalogues.length;
  return `Das System "${system.name}" wurde unvollständig importiert: ${importedCount} von ${expectedCount} Katalogen konnten gelesen werden.`;
}

/**
 * Names every catalogue that failed to parse, so the incompleteness is visible at the
 * moment it happens rather than surfacing later as a broken selection reference.
 *
 * @param {import('../../parser/xmlParser').CatalogueParseFailure[]} failedCatalogues
 */
export function buildFailedCatalogueMessage(failedCatalogues) {
  const { headline, consequence, itemSeparator } = FAILED_CATALOGUE_MESSAGE;
  const details = failedCatalogues
    .map((failure) => `${quoteCatalogueName(failure.fileName)} (${failure.message})`)
    .join(itemSeparator);
  return `${headline} ${details}. ${consequence}`;
}
