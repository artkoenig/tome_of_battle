import { saveSystem } from './database';
import { processImportedData } from '../parser/xmlParser';
import { PARSER_VERSION } from '../parser/parserVersion';
import {
  loadCatalogIndex,
  updateSystemFromCatalogIndex,
  findCatalogSourceForSystemId,
} from './catalogUpdate';

function hasStoredXml(system) {
  return Boolean(system.rawXmls?.gst?.length);
}

/**
 * Whether a stored system was produced by a parser older than the current one.
 *
 * This is the whole point of the marker (Issue 0168): without it every migration
 * run re-parsed every stored catalogue — megabytes of XML — and handed the app a
 * brand-new system object, which invalidated the identity-keyed evaluation cache
 * (`src/contexts/ruleengine/acl/evaluationCache.js`) along the way. A system stored before the
 * marker existed carries no `parserVersion`, differs from the current one and is
 * therefore re-parsed exactly once; the write that follows stamps the marker, so
 * the next start leaves it alone.
 *
 * @param {{ parserVersion?: number }} system
 * @returns {boolean}
 */
function isStaleParse(system) {
  return system.parserVersion !== PARSER_VERSION;
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
 * stored data is kept and, **only if it was parsed by an older parser**
 * (`parserVersion`, Issue 0168), re-parsed with the current one instead. A system
 * already at the current parser stand is passed through untouched, object identity
 * included.
 *
 * Only a failed *re-processing* of an already-stored system is reported via
 * `failures`; a failed catalog *fetch* never is. When no `fetchText` is injected,
 * catalog updates are skipped and only local re-processing runs.
 *
 * @param {Array} systems - The list of currently loaded systems from IndexedDB.
 * @param {((url: string) => Promise<string>)|null} [fetchText] - Network fetcher for catalog
 *   resources (index JSON and .cat/.gst text). Omit to disable network updates.
 * @returns {Promise<{systems: Array, failures: Array<{id: string, name: string}>,
 *   unrecoverable: Array<{id: string, name: string}>}>} `unrecoverable` fuehrt die
 *   Systeme, denen das rohe Katalog-XML fehlt und die es auch nicht nachruesten
 *   konnten — sie sind ohne Neuimport nicht mehr auswertbar (Issue 0121).
 */
export async function runSystemMigrations(systems, fetchText = null) {
  const migratedSystems = [];
  const failures = [];
  const unrecoverable = [];

  for (const system of systems) {
    // Ein System ohne gespeichertes XML stammt aus einer Version vor 1.8.2. Seit
    // Issue 0121 beurteilt die Engine ein Roster aus den rohen Katalogdateien —
    // ein solches System haette also keine Bewertung, keine Verfuegbarkeit und
    // keine Kosten mehr. Der Weg zurueck ist die Quelle: ein Update von dort
    // bringt die Dateien mit und ruestet `rawXmls` nach. Gelingt das nicht (kein
    // konfigurierter Ursprung, kein Netz), bleibt das System wie es ist und
    // wird dem Aufrufer als nachruestbeduerftig gemeldet.
    if (!hasStoredXml(system)) {
      const recovered = await updateStoredSystemFromItsSource(system, fetchText).catch(() => null);
      if (recovered && hasStoredXml(recovered)) {
        await saveSystem(recovered);
        migratedSystems.push(recovered);
        continue;
      }
      migratedSystems.push(system);
      unrecoverable.push({ id: system.id, name: system.name });
      continue;
    }

    const updatedSystem = await updateStoredSystemFromItsSource(system, fetchText);
    if (updatedSystem) {
      await saveSystem(updatedSystem);
      migratedSystems.push(updatedSystem);
      continue;
    }

    // Ein System, das der aktuelle Parser erzeugt hat, ist bereits aktuell: kein
    // Neu-Parse, kein Schreibvorgang, und — entscheidend — dieselbe
    // Objektidentitaet, damit der Auswertungs-Cache weiter trifft.
    if (!isStaleParse(system)) {
      migratedSystems.push(system);
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

  return { systems: migratedSystems, failures, unrecoverable };
}
