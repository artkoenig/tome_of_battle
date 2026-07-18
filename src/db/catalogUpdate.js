import { processImportedData } from '../parser/xmlParser';
import { collectSchemaWarnings } from '../parser/importSchemaGate';

// The catalog data lives in forks of the upstream BattleScribe repositories and is
// fetched at runtime over raw.githubusercontent.com, which answers with CORS
// (access-control-allow-origin: *) and gzip. See ADR 0014, ADR 0015 and ADR 0016: two
// forks are run permanently and in parallel as named sources (Ergofarg and Lexicanum),
// each with its own catpkg.json index. The index's own `fileUrl` fields are
// deliberately not used; the raw URL is constructed from the source's `rawBaseUrl` so
// the update path stays independent of how the index was generated.

const CATPKG_INDEX_FILE_NAME = 'catpkg.json';

/**
 * Completes a catalog source descriptor by deriving its index URL from the raw base
 * URL, so the two never drift apart. A source is `{ gameSystemId, rawBaseUrl, indexUrl }`;
 * `gameSystemId` is the stable BattleScribe id that also keys a stored system back to its
 * source (ADR 0016 — no separate database field needed). No display label is carried: a
 * system is shown under its own catalog `name`, so the source is a pure fetch-origin
 * descriptor.
 */
function defineCatalogSource({ gameSystemId, rawBaseUrl }) {
  return Object.freeze({
    gameSystemId,
    rawBaseUrl,
    indexUrl: `${rawBaseUrl}${CATPKG_INDEX_FILE_NAME}`,
  });
}

/**
 * The catalog sources offered in parallel (ADR 0016). Each source maps a stable game
 * system id to the fork the system's files are fetched from. A further source is added by
 * appending an entry here, without touching any branching logic (Open/Closed).
 */
export const CATALOG_SOURCES = Object.freeze([
  defineCatalogSource({
    gameSystemId: '6d8e-38d9-3c69-febf',
    rawBaseUrl: 'https://raw.githubusercontent.com/artkoenig/Warhammer-Fantasy-6th-edition/master/',
  }),
  defineCatalogSource({
    gameSystemId: '0d13-7737-ea86-4662',
    rawBaseUrl:
      'https://raw.githubusercontent.com/artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition/main/',
  }),
]);

/**
 * The catalog source a game system id belongs to, or null when no configured source
 * owns it (e.g. a system the user uploaded from their own files). The lookup is by the
 * system's own `gameSystemId`, which is unique and stable per source (ADR 0016).
 */
export function findCatalogSourceForSystemId(gameSystemId) {
  return CATALOG_SOURCES.find((source) => source.gameSystemId === gameSystemId) ?? null;
}

// catpkg `type` values as emitted by BSData/publish-catpkg (lower case).
const FILE_TYPE_GAME_SYSTEM = 'gamesystem';
const FILE_TYPE_CATALOGUE = 'catalogue';
const GAME_SYSTEM_FILE_EXTENSION = '.gst';
const CATALOGUE_FILE_EXTENSION = '.cat';

/**
 * The four states a catalog file can be in when its available (remote) revision is
 * compared to the locally stored one. Used to annotate the import selection list.
 * Values are stable, language-neutral identifiers — display text lives separately in
 * Importer.jsx, not here.
 */
export const REVISION_STATE = {
  NEW: 'new',
  CURRENT: 'current',
  OUTDATED: 'outdated',
  AHEAD: 'ahead',
};

function normalizedType(indexEntry) {
  return (indexEntry.type || '').toLowerCase();
}

function findIndexEntry(index, type, id) {
  const files = index?.repositoryFiles ?? [];
  return files.find((entry) => normalizedType(entry) === type && entry.id === id) ?? null;
}

/**
 * "Higher wins" — the official BattleScribe update semantics. A remote revision
 * strictly greater than the stored one wins. Stored data without a revision (all
 * data imported before revisions were tracked) counts as outdated.
 */
function isOutdated(remoteRevision, storedRevision) {
  if (typeof remoteRevision !== 'number') return false;
  if (storedRevision === null || storedRevision === undefined) return true;
  return remoteRevision > storedRevision;
}

/**
 * Derives the display state of a catalog file (game system or catalogue) by comparing
 * the available (remote) revision to the locally stored one. The "is it behind?"
 * decision reuses `isOutdated` — the exact "higher wins" comparison the silent updater
 * uses — so there is a single source of truth for that judgement; only the extra
 * new/current/ahead distinction the update path does not need is added on top.
 *
 * @param {number} availableRevision - the revision offered by the fork index.
 * @param {{ revision?: number } | null | undefined} localFile - the locally stored
 *   file (a stored system or catalogue). `null`/`undefined` means it is not stored
 *   locally at all; a stored file without a numeric `revision` is legacy data from
 *   before revision tracking.
 * @returns {typeof REVISION_STATE[keyof typeof REVISION_STATE]}
 */
export function deriveRevisionState(availableRevision, localFile) {
  if (localFile === null || localFile === undefined) return REVISION_STATE.NEW;

  const localRevision = localFile.revision;
  if (isOutdated(availableRevision, localRevision)) return REVISION_STATE.OUTDATED;
  if (typeof localRevision === 'number' && localRevision > availableRevision) {
    return REVISION_STATE.AHEAD;
  }
  return REVISION_STATE.CURRENT;
}

/**
 * The real repository file name to fetch. The index entry's `path` carries it
 * verbatim, because the upstream file name is not derivable from the catalogue's
 * `name` (e.g. name "Chaos Dwarfs" vs file "Chaos Dwarves (6th definitive edition).cat").
 * The name+extension reconstruction remains only as a fallback for a legacy index
 * that predates the `path` field.
 */
function rawFileName(indexEntry) {
  if (indexEntry.path) return indexEntry.path;
  const extension =
    normalizedType(indexEntry) === FILE_TYPE_GAME_SYSTEM
      ? GAME_SYSTEM_FILE_EXTENSION
      : CATALOGUE_FILE_EXTENSION;
  return `${indexEntry.name}${extension}`;
}

export function buildRawFileUrl(rawBaseUrl, fileName) {
  return `${rawBaseUrl}${encodeURIComponent(fileName)}`;
}

/**
 * Pure, network-free comparison. Given a parsed catpkg index and a stored system,
 * returns the descriptors of the files that are outdated and should be re-fetched.
 * Only files the stored system already carries are ever considered, so a user never
 * gains a catalogue they did not import. A system whose id the index does not know
 * stays untouched entirely.
 * @returns {Array<{type: string, fileName: string}>}
 */
export function findOutdatedCatalogFiles(index, system) {
  const gameSystemEntry = findIndexEntry(index, FILE_TYPE_GAME_SYSTEM, system.id);
  if (!gameSystemEntry) return [];

  const outdatedFiles = [];
  if (isOutdated(gameSystemEntry.revision, system.revision)) {
    outdatedFiles.push({ type: FILE_TYPE_GAME_SYSTEM, fileName: rawFileName(gameSystemEntry) });
  }

  for (const catalogue of system.catalogues ?? []) {
    const catalogueEntry = findIndexEntry(index, FILE_TYPE_CATALOGUE, catalogue.id);
    if (catalogueEntry && isOutdated(catalogueEntry.revision, catalogue.revision)) {
      outdatedFiles.push({ type: FILE_TYPE_CATALOGUE, fileName: rawFileName(catalogueEntry) });
    }
  }

  return outdatedFiles;
}

function replaceRawFile(files, fileName, content) {
  const nextFile = { name: fileName, content };
  const existingIndex = files.findIndex((file) => file.name === fileName);
  if (existingIndex === -1) return [...files, nextFile];
  const next = [...files];
  next[existingIndex] = nextFile;
  return next;
}

async function downloadOutdatedRawXmls(rawXmls, outdatedFiles, fetchText, rawBaseUrl) {
  let gst = [...(rawXmls?.gst ?? [])];
  let cat = [...(rawXmls?.cat ?? [])];

  for (const file of outdatedFiles) {
    const content = await fetchText(buildRawFileUrl(rawBaseUrl, file.fileName));
    if (file.type === FILE_TYPE_GAME_SYSTEM) {
      // A system has exactly one game system file; replace it wholesale so the
      // update always takes effect regardless of the stored file's name.
      gst = [{ name: file.fileName, content }];
    } else {
      cat = replaceRawFile(cat, file.fileName, content);
    }
  }

  return { gst, cat };
}

/**
 * Orchestrates a silent catalog update for a single stored system. The `fetchText`
 * dependency is injected so the whole path is testable without a network, and
 * `rawBaseUrl` selects which source's files to fetch (ADR 0018 — each stored system is
 * refreshed against its own source). The `collectWarnings` schema advisory (ADR 0016,
 * Revision 2026-07-18) is injected likewise and defaults to the real collector: fetched
 * fork data is validated against the vendored XSD, but a schema violation does *not*
 * abort the update — it is logged (reported) and the update proceeds, mirroring the
 * manual import's advisory behaviour. Returns the freshly parsed, updated system on
 * success, or null when no update applies or the update genuinely fails (fetch error,
 * unparsable remote data) — in which case the caller keeps the stored system untouched.
 * Never throws: a failed catalog refresh is invisible by design (the catalog is a cache).
 */
export async function updateSystemFromCatalogIndex(
  system,
  index,
  fetchText,
  rawBaseUrl,
  collectWarnings = collectSchemaWarnings
) {
  if (!index) return null;

  try {
    const outdatedFiles = findOutdatedCatalogFiles(index, system);
    if (outdatedFiles.length === 0) return null;

    const rawXmls = await downloadOutdatedRawXmls(
      system.rawXmls,
      outdatedFiles,
      fetchText,
      rawBaseUrl
    );
    const warnings = await collectWarnings(rawXmls.gst, rawXmls.cat);
    if (warnings.length > 0) {
      console.warn(
        `Schema advisory for silent catalog update of system "${system.name}":`,
        warnings.map((warning) => warning.message)
      );
    }
    const updatedSystem = processImportedData(rawXmls.gst, rawXmls.cat);
    updatedSystem.rawXmls = rawXmls;
    return updatedSystem;
  } catch (error) {
    console.warn(`Silent catalog update skipped for system "${system.name}":`, error);
    return null;
  }
}

/**
 * Default network fetcher for catalog resources — the index JSON or a .cat/.gst
 * text. Injected into the migration pipeline in production; tests pass a fake.
 */
export async function fetchCatalogText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Catalog fetch failed (${response.status}) for ${url}`);
  }
  return response.text();
}

// Keyed first by the fetchText function identity (WeakMap, so a caller's cache is
// released with it) and then by the index URL. Keying by URL as well is essential:
// with several sources sharing one fetchText instance (ADR 0016), a URL-blind cache
// would return the first source's index for every later source (see regression test).
let catalogIndexCache = new WeakMap();

function getCachedIndexByUrl(fetchText) {
  let byUrl = catalogIndexCache.get(fetchText);
  if (!byUrl) {
    byUrl = new Map();
    catalogIndexCache.set(fetchText, byUrl);
  }
  return byUrl;
}

/**
 * Clear the in-memory catalog index cache. Only needed in tests between cases;
 * in production the cache lives for the page session and is harmless.
 */
export function clearCatalogIndexCache() {
  // WeakMap has no clear() — the reference is held by the module; reassign.
  catalogIndexCache = new WeakMap();
}

/**
 * Fetches and parses the catpkg index at `indexUrl`. Returns null on any failure
 * (offline, rate-limit, GitHub outage, malformed JSON) so an unreachable index leaves
 * the app working on stored data without any user-facing error. When no fetcher or no
 * index URL is provided, no request is made and null is returned. The result is cached
 * per fetchText function AND index URL, so repeated loads of the same source are free
 * while different sources stay distinct.
 */
export async function loadCatalogIndex(fetchText, indexUrl) {
  if (!fetchText || !indexUrl) return null;

  const cachedByUrl = getCachedIndexByUrl(fetchText);
  if (cachedByUrl.has(indexUrl)) {
    return cachedByUrl.get(indexUrl);
  }

  try {
    const indexText = await fetchText(indexUrl);
    const index = JSON.parse(indexText);
    cachedByUrl.set(indexUrl, index);
    return index;
  } catch (error) {
    console.warn('Catalog index unavailable; keeping stored catalog data:', error);
    cachedByUrl.set(indexUrl, null);
    return null;
  }
}
