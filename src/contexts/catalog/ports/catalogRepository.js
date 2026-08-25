/**
 * Katalog-Repository-Port des Kontexts `catalog`.
 *
 * Die einzige Stelle unter `src/contexts/catalog/`, die `src/platform/` kennen darf
 * (Regel `kontext-nicht-auf-plattform`). Die Anwendungsschicht lädt, importiert und
 * aktualisiert Systeme ausschließlich über diesen Port — sowohl die Persistenz
 * (`platform/persistence/*`) als auch der Battlescribe-Zugriff
 * (`platform/battlescribe/*`) liegen dahinter. Reine Weiterleitung: hier steht keine
 * Logik, nur die Liste dessen, was der Kontext vom Katalogspeicher braucht.
 */
export {
  getAllSystems,
  getSystem,
  deleteSystem,
} from '../../../platform/persistence/database';
export {
  completeSystemImport,
  SYSTEM_IMPORT_STATUS,
} from '../../../platform/persistence/systemImport';
export { loadAvailableSystemsFromSources } from '../../../platform/persistence/catalogSourceIndex';
export {
  fetchCatalogText,
  buildRawFileUrl,
  deriveRevisionState,
  REVISION_STATE,
} from '../../../platform/persistence/catalogUpdate';
export { runSystemMigrations } from '../../../platform/persistence/migrations';
export {
  catalogueDirectoryFromIndex,
  catalogueDirectoryFromLinks,
} from '../../../platform/battlescribe/libraryDependencies';
export { extractZipFiles } from '../../../platform/battlescribe/zipExtractor';
