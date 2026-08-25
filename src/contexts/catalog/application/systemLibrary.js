import { getAllSystems, getSystem, deleteSystem as removeSystem } from '../ports/catalogRepository';
import { completeSystemImport, SYSTEM_IMPORT_STATUS } from '../ports/catalogRepository';
import { loadAvailableSystemsFromSources } from '../ports/catalogRepository';
import { extractZipFiles } from '../ports/catalogRepository';
import {
  catalogueDirectoryFromIndex,
  catalogueDirectoryFromLinks,
} from '../ports/catalogRepository';
import { fetchCatalogText } from '../ports/catalogRepository';
import { DATA_EVENT, emitDataChange } from '../../../shared/events/dataEvents';

/**
 * Fassade über die installierten Spielsysteme und den Import neuer (ADR-0037).
 *
 * Vertrag:
 * - `loadSystems()` / `loadSystem(id)` lesen den installierten Bestand.
 * - `readSystemArchive(file)` zerlegt ein hochgeladenes `.zip` in seine
 *   `.gst`/`.cat`-Rohtexte, ohne etwas zu speichern.
 * - `importSystem({ gstFiles, catFiles, catalogueDirectory })` parst und
 *   speichert; das Ergebnis ist das unveränderte Ergebnis von
 *   `completeSystemImport` (`status`, `system`, `failedCatalogues`,
 *   `missingDependencies`). Nur ein `IMPORTED` meldet über `dataEvents`.
 * - `deleteSystem(id)` entfernt ein System und meldet den Abschluss.
 * - `loadAvailableSystems()` liest die entfernten Katalogquellen; das ist ein
 *   Netzabruf und ändert nichts, meldet daher auch nichts.
 * - `catalogueDirectoryFromIndex`/`FromLinks` bestimmen, welche Link-Ziele als
 *   vorhanden gelten dürfen, und werden hier nur durchgereicht.
 *
 * Die Übersetzung eines Ergebnisses in eine Meldung bleibt in der Oberfläche —
 * die Datenschicht kennt `src/ui/i18n/` nicht.
 */

export { SYSTEM_IMPORT_STATUS };

/**
 * @returns {Promise<object[]>}
 */
export function loadSystems() {
  return getAllSystems();
}

/**
 * @param {string} id
 * @returns {Promise<object|undefined>}
 */
export function loadSystem(id) {
  return getSystem(id);
}

/**
 * @param {File} file ein `.zip`-Archiv mit `.gst`/`.cat`-Dateien.
 * @returns {Promise<{ gstFiles: object[], catFiles: object[] }>}
 */
export function readSystemArchive(file) {
  return extractZipFiles(file);
}

/**
 * @param {{ gstFiles: object[], catFiles: object[], catalogueDirectory: object }} args
 * @returns {Promise<{ status: string, system?: object, failedCatalogues?: object[], missingDependencies?: object[] }>}
 */
export async function importSystem({ gstFiles, catFiles, catalogueDirectory }) {
  const result = await completeSystemImport({ gstFiles, catFiles, catalogueDirectory });
  if (result.status === SYSTEM_IMPORT_STATUS.IMPORTED) {
    emitDataChange({ type: DATA_EVENT.SYSTEM_IMPORTED, system: result.system });
  }
  return result;
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteSystem(id) {
  await removeSystem(id);
  emitDataChange({ type: DATA_EVENT.SYSTEM_DELETED, systemId: id });
}

/**
 * @param {(url: string) => Promise<string>} [fetchText] nur für Tests; sonst
 *   der Katalog-Abruf der Datenschicht.
 * @returns {Promise<{ systems: object[], anyIndexReachable: boolean }>}
 */
export function loadAvailableSystems(fetchText = fetchCatalogText) {
  return loadAvailableSystemsFromSources(fetchText);
}

export { catalogueDirectoryFromIndex, catalogueDirectoryFromLinks };
