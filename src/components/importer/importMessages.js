// User-facing texts of the import screen. They live next to the Importer's presentation
// rather than in the data layer, which reports the import outcome as structured data. The
// wording itself is resolved through the translation function `t` (ADR 0026); this module
// only assembles the structured parts (catalogue names, counts) around it.

import { t } from '../../i18n/i18nStore';

// Separators are punctuation, not translatable wording, so they stay as constants.
const ITEM_SEPARATOR = '; ';
const REFERENCE_SEPARATOR = ', ';

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
  const requiredByLabel = t('importer.missingDeps.requiredBy');
  const details = missingDependencies
    .map((dependency) => {
      const quotedName = quoteCatalogueName(dependency.name);
      if (dependency.requiredBy.length === 0) return quotedName;
      const references = dependency.requiredBy.map(quoteCatalogueName).join(REFERENCE_SEPARATOR);
      return `${quotedName} (${requiredByLabel} ${references})`;
    })
    .join(ITEM_SEPARATOR);
  return `${t('importer.missingDeps.headline')} ${t('importer.missingDeps.instruction')} ${details}.`;
}

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
    return t('importer.importSuccess.complete', { name: system.name, count: importedCount });
  }
  const expectedCount = importedCount + failedCatalogues.length;
  return t('importer.importSuccess.incomplete', {
    name: system.name,
    importedCount,
    expectedCount,
  });
}

/**
 * Names every catalogue that failed to parse, so the incompleteness is visible at the
 * moment it happens rather than surfacing later as a broken selection reference.
 *
 * @param {import('../../parser/xmlParser').CatalogueParseFailure[]} failedCatalogues
 */
export function buildFailedCatalogueMessage(failedCatalogues) {
  const details = failedCatalogues
    .map((failure) => `${quoteCatalogueName(failure.fileName)} (${failure.message})`)
    .join(ITEM_SEPARATOR);
  return `${t('importer.failedCatalogues.headline')} ${details}. ${t('importer.failedCatalogues.consequence')}`;
}
