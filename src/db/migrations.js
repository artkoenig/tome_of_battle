import { saveSystem } from './database';
import { processImportedData } from '../parser/xmlParser';
import {
  loadCatalogIndex,
  updateSystemFromCatalogIndex,
  findCatalogSourceForSystemId,
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
  // Catalogues that fail to re-parse are deliberately not reported here: this runs
  // unattended at app start, and the same files are re-checked (and named) whenever the
  // user imports or updates the system. Only a failed re-processing of the whole system
  // reaches the user, via the caller's `failures` list.
  const { system: reParsed } = processImportedData(system.rawXmls.gst, system.rawXmls.cat || []);
  reParsed.rawXmls = system.rawXmls;
  await saveSystem(reParsed);
  return reParsed;
}

/**
 * Attempts a silent catalog update for one stored system against the index of its own
 * source (ADR 0018). The source is resolved from the system's `gameSystemId`; a system
 * that belongs to no configured source (e.g. self-uploaded) has no source to update
 * from and returns null so the caller re-parses the stored data instead. The per-source
 * index is loaded via `loadCatalogIndex`, whose cache keys by URL, so several systems of
 * the same source share one fetch.
 */
async function updateStoredSystemFromItsSource(system, fetchText) {
  const source = findCatalogSourceForSystemId(system.id);
  if (!source) return null;

  const catalogIndex = await loadCatalogIndex(fetchText, source.indexUrl);
  return updateSystemFromCatalogIndex(system, catalogIndex, fetchText, source.rawBaseUrl);
}

/**
 * Runs automatic database migrations at app start. For each stored system it first
 * attempts a silent catalog update from its source's fork index (`fetchText` injected
 * for testability): an outdated system is refreshed to the newer revision without
 * asking. Both configured sources are updated symmetrically — each system against its
 * own source (ADR 0018). A failed or unavailable update is invisible to the user — the
 * stored data is kept and merely re-parsed with the current parser instead.
 *
 * Only a failed *re-processing* of an already-stored system is reported via
 * `failures`; a failed catalog *fetch* never is. When no `fetchText` is injected,
 * catalog updates are skipped and only local re-processing runs.
 *
 * @param {Array} systems - The list of currently loaded systems from IndexedDB.
 * @param {(url: string) => Promise<string>} [fetchText] - Network fetcher for catalog
 *   resources (index JSON and .cat/.gst text). Omit to disable network updates.
 * @returns {Promise<{systems: Array, failures: Array<{id: string, name: string}>}>}
 */
export async function runSystemMigrations(systems, fetchText = null) {
  const migratedSystems = [];
  const failures = [];

  for (const system of systems) {
    if (!hasStoredXml(system)) {
      migratedSystems.push(system);
      continue;
    }

    const updatedSystem = await updateStoredSystemFromItsSource(system, fetchText);
    if (updatedSystem) {
      await saveSystem(updatedSystem);
      migratedSystems.push(updatedSystem);
      continue;
    }

    try {
      migratedSystems.push(await reprocessStoredSystem(system));
    } catch (error) {
      // Not console-only: the system is additionally recorded in `failures`, which the
      // caller turns into a user-facing toast.
      console.error(`Failed to auto-migrate system ${system.name}:`, error);
      migratedSystems.push(system);
      failures.push({ id: system.id, name: system.name });
    }
  }

  return { systems: migratedSystems, failures };
}
