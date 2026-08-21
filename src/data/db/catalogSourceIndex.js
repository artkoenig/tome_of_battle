import {
  CATALOG_FILE_TYPE,
  CATALOG_SOURCES,
  listIndexEntriesOfType,
  loadCatalogIndex,
  rawFileName,
} from './catalogUpdate';

/**
 * Turns one parsed catpkg index into the importable game systems it offers. Every game
 * system entry becomes one system whose `catalogues` are all catalogue entries of that
 * index, sorted by name — the index does not associate a catalogue with a single game
 * system, so the whole catalogue set is offered per system (ADR 0014).
 *
 * @param {{ repositoryFiles?: Array<object> } | null | undefined} index a parsed catpkg
 *   index; a missing or malformed one yields an empty list.
 * @returns {Array<{ id: string, name: string, gst: object, catalogues: Array<object> }>}
 */
export function transformIndexToSystems(index) {
  const catalogues = listIndexEntriesOfType(index, CATALOG_FILE_TYPE.CATALOGUE)
    .map(toCatalogFileDescriptor)
    .sort((left, right) => left.name.localeCompare(right.name));

  return listIndexEntriesOfType(index, CATALOG_FILE_TYPE.GAME_SYSTEM).map((gameSystemEntry) => ({
    id: gameSystemEntry.id,
    name: gameSystemEntry.name,
    gst: toCatalogFileDescriptor(gameSystemEntry),
    catalogues,
  }));
}

function toCatalogFileDescriptor(indexEntry) {
  return {
    id: indexEntry.id,
    name: indexEntry.name,
    fileName: rawFileName(indexEntry),
    revision: indexEntry.revision,
  };
}

/**
 * Tags every system parsed from one source's index with that source's `rawBaseUrl`, so
 * the import later fetches its files from the right fork (ADR 0018). No display label is
 * stored or derived: the system is shown under its own catalog `name`, straight from the
 * parsed index.
 */
function withSourceRawBaseUrl(systems, rawBaseUrl) {
  return systems.map((system) => ({ ...system, rawBaseUrl }));
}

/**
 * Loads and merges the available systems of every configured catalog source into one
 * flat list (ADR 0018 — no extra selection step; both systems share the one dropdown).
 * A source whose index is unreachable contributes nothing rather than failing the whole
 * list, so one source being offline never hides the other. `anyIndexReachable` stays
 * true as long as at least one source's index loaded (even if it held no systems), so
 * the caller only reports an outage when every source is unreachable — not when a
 * reachable index is simply empty.
 *
 * @param {(url: string) => Promise<string>} fetchText injected text fetcher, so the whole
 *   path is testable without a network.
 * @returns {Promise<{ systems: Array<object>, anyIndexReachable: boolean }>}
 */
export async function loadAvailableSystemsFromSources(fetchText) {
  const perSource = await Promise.all(
    CATALOG_SOURCES.map(async (source) => {
      const index = await loadCatalogIndex(fetchText, source.indexUrl);
      const systems = index
        ? withSourceRawBaseUrl(transformIndexToSystems(index), source.rawBaseUrl)
        : [];
      return { reachable: index !== null, systems };
    })
  );

  return {
    systems: perSource.flatMap((result) => result.systems),
    anyIndexReachable: perSource.some((result) => result.reachable),
  };
}
