import { t as translate } from '../i18n/i18nStore';

/**
 * Die Meldungen der Import-Hülle (ADR-0038), aus `useImporter.js`
 * herausgeschnitten (Issue 0176). Reine Ableitungen: sie nehmen das Ergebnis
 * eines Imports und ergeben den Wortlaut, den der Bildschirm zeigt.
 *
 * Hier ist das frühere `components/importer/importMessages.js` aufgegangen.
 */

// Trennzeichen sind Zeichensetzung, kein übersetzbarer Wortlaut.
const ITEM_SEPARATOR = '; ';
const REFERENCE_SEPARATOR = ', ';

export const quoteCatalogueName = (value) => `„${value}"`;

/**
 * Nennt jeden fehlenden Bibliothekskatalog samt der Kataloge, die ihn
 * brauchen, damit der Nutzer genau weiß, was er ergänzen muss.
 * @param {{ id: string, name: string, requiredBy: string[] }[]} missingDependencies
 */
export function buildMissingLibraryDependencyMessage(missingDependencies, t = translate) {
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
 * Die Bestätigung nach dem Speichern eines Systems, für beide Importwege
 * gleich. Sind Kataloge am Parsen gescheitert, meldet sie den Import als
 * unvollständig statt eine Vollständigkeit zu bestätigen, die der gespeicherte
 * Stand nicht hat.
 * @param {object} system das gespeicherte System.
 * @param {import('../../platform/battlescribe/xmlParser').CatalogueParseFailure[]} [failedCatalogues]
 */
export function buildImportSuccessMessage(system, failedCatalogues = [], t = translate) {
  const importedCount = system.catalogues?.length ?? 0;
  if (failedCatalogues.length === 0) {
    return t('importer.importSuccess.complete', { name: system.name, count: importedCount });
  }
  return t('importer.importSuccess.incomplete', {
    name: system.name,
    importedCount,
    expectedCount: importedCount + failedCatalogues.length,
  });
}

/**
 * Nennt jeden Katalog, der nicht geparst werden konnte, damit die
 * Unvollständigkeit im Moment ihres Entstehens sichtbar ist.
 * @param {import('../../platform/battlescribe/xmlParser').CatalogueParseFailure[]} failedCatalogues
 */
export function buildFailedCatalogueMessage(failedCatalogues, t = translate) {
  const details = failedCatalogues
    .map((failure) => `${quoteCatalogueName(failure.fileName)} (${failure.message})`)
    .join(ITEM_SEPARATOR);
  return `${t('importer.failedCatalogues.headline')} ${details}. ${t('importer.failedCatalogues.consequence')}`;
}
