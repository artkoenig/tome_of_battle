import { saveSystem } from './database';
import { processImportedData } from '../parser/xmlParser';

/**
 * Runs automatic database migrations and updates parsed system structures 
 * whenever parser updates are deployed.
 * @param {Array} systems - The list of currently loaded systems from IndexedDB
 * @returns {Promise<Array>} - The migrated and updated list of systems
 */
export async function runSystemMigrations(systems) {
  let updatedAny = false;
  const migratedSystems = [];

  for (const sys of systems) {
    if (sys.rawXmls && sys.rawXmls.gst && sys.rawXmls.gst.length > 0) {
      try {
        const reParsed = processImportedData(sys.rawXmls.gst, sys.rawXmls.cat || []);
        // Preserve rawXmls
        reParsed.rawXmls = sys.rawXmls;
        
        // Save back to IndexedDB
        await saveSystem(reParsed);
        migratedSystems.push(reParsed);
        updatedAny = true;

      } catch (e) {
        console.error(`Failed to auto-migrate system ${sys.name}:`, e);
        migratedSystems.push(sys);
      }
    } else {
      migratedSystems.push(sys);
    }
  }

  return migratedSystems;
}
