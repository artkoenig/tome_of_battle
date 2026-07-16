import { saveSystem } from './database';
import { processImportedData } from '../parser/xmlParser';
import {
  loadCatalogIndex,
  updateSystemFromCatalogIndex,
  CATALOG_INDEX_URL,
} from './catalogUpdate';

function hasStoredXml(system) {
  return Boolean(system.rawXmls?.gst?.length);
}

/**
 * Re-parses a system's stored raw XML with the current parser and persists it. This
 * applies parser updates to already-stored data and never touches the network, so
 * a re-processing failure here is a genuine problem with the user's stored system.
 */
async function reprocessStoredSystem(system) {
  const reParsed = processImportedData(system.rawXmls.gst, system.rawXmls.cat || []);
  reParsed.rawXmls = system.rawXmls;
  await saveSystem(reParsed);
  return reParsed;
}

/**
 * Runs automatic database migrations at app start. For each stored system it first
 * attempts a silent catalog update from the fork index (`fetchText` injected for
 * testability): an outdated system is refreshed to the newer revision without asking.
 * A failed or unavailable update is invisible to the user — the stored data is kept
 * and merely re-parsed with the current parser instead.
 *
 * Only a failed *re-processing* of an already-stored system is reported via
 * `failures`; a failed catalog *fetch* never is. When no `fetchText` is injected,
 * catalog updates are skipped and only local re-processing runs.
 *
 * @param {Array} systems - The list of currently loaded systems from IndexedDB.
 * @param {(url: string) => Promise<string>} [fetchText] - Network fetcher for catalog
 *   resources (index JSON and .cat/.gst text). Omit to disable network updates.
 * @param {string} [indexUrl] - Override for the catpkg index URL (tests).
 * @returns {Promise<{systems: Array, failures: Array<{id: string, name: string}>}>}
 */
export async function runSystemMigrations(systems, fetchText = null, indexUrl = CATALOG_INDEX_URL) {
  const catalogIndex = await loadCatalogIndex(fetchText, indexUrl);
  const migratedSystems = [];
  const failures = [];

  for (const system of systems) {
    if (!hasStoredXml(system)) {
      migratedSystems.push(system);
      continue;
    }

    const updatedSystem = await updateSystemFromCatalogIndex(system, catalogIndex, fetchText);
    if (updatedSystem) {
      await saveSystem(updatedSystem);
      migratedSystems.push(updatedSystem);
      continue;
    }

    try {
      migratedSystems.push(await reprocessStoredSystem(system));
    } catch (error) {
      console.error(`Failed to auto-migrate system ${system.name}:`, error);
      migratedSystems.push(system);
      failures.push({ id: system.id, name: system.name });
    }
  }

  return { systems: migratedSystems, failures };
}
