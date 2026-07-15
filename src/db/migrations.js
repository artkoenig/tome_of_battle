import { saveSystem } from './database';
import { processImportedData } from '../parser/xmlParser';

/**
 * Runs automatic database migrations and updates parsed system structures
 * whenever parser updates are deployed. This only re-processes already-stored
 * data (rawXmls) — it never performs a network request, so a failed fetch
 * elsewhere in the app is never reported through `failures`.
 * @param {Array} systems - The list of currently loaded systems from IndexedDB
 * @returns {Promise<{systems: Array, failures: Array<{id: string, name: string}>}>}
 *   `systems` is the migrated list (systems whose re-processing failed keep their
 *   old, unmigrated data); `failures` names the systems that failed.
 */
export async function runSystemMigrations(systems) {
  const migratedSystems = [];
  const failures = [];

  for (const sys of systems) {
    if (sys.rawXmls && sys.rawXmls.gst && sys.rawXmls.gst.length > 0) {
      try {
        const reParsed = processImportedData(sys.rawXmls.gst, sys.rawXmls.cat || []);
        // Preserve rawXmls
        reParsed.rawXmls = sys.rawXmls;

        // Save back to IndexedDB
        await saveSystem(reParsed);
        migratedSystems.push(reParsed);

      } catch (e) {
        console.error(`Failed to auto-migrate system ${sys.name}:`, e);
        migratedSystems.push(sys);
        failures.push({ id: sys.id, name: sys.name });
      }
    } else {
      migratedSystems.push(sys);
    }
  }

  return { systems: migratedSystems, failures };
}
