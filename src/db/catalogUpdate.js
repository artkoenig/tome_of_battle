import { processImportedData } from '../parser/xmlParser';

// The catalog data lives in a fork of the upstream BattleScribe repository and is
// fetched at runtime over raw.githubusercontent.com, which answers with CORS
// (access-control-allow-origin: *) and gzip. See ADR 0014. The index's own
// `fileUrl` fields are deliberately not used; the raw URL is constructed here so the
// update path stays independent of how the index was generated.
const CATALOG_REPO_RAW_BASE_URL =
  'https://raw.githubusercontent.com/artkoenig/Warhammer-Fantasy-6th-edition/master/';
export const CATALOG_INDEX_URL = `${CATALOG_REPO_RAW_BASE_URL}catpkg.json`;

// catpkg `type` values as emitted by BSData/publish-catpkg (lower case).
const FILE_TYPE_GAME_SYSTEM = 'gamesystem';
const FILE_TYPE_CATALOGUE = 'catalogue';
const GAME_SYSTEM_FILE_EXTENSION = '.gst';
const CATALOGUE_FILE_EXTENSION = '.cat';

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

function rawFileName(indexEntry) {
  const extension =
    normalizedType(indexEntry) === FILE_TYPE_GAME_SYSTEM
      ? GAME_SYSTEM_FILE_EXTENSION
      : CATALOGUE_FILE_EXTENSION;
  return `${indexEntry.name}${extension}`;
}

export function buildRawFileUrl(fileName) {
  return `${CATALOG_REPO_RAW_BASE_URL}${encodeURIComponent(fileName)}`;
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

async function downloadOutdatedRawXmls(rawXmls, outdatedFiles, fetchText) {
  let gst = [...(rawXmls?.gst ?? [])];
  let cat = [...(rawXmls?.cat ?? [])];

  for (const file of outdatedFiles) {
    const content = await fetchText(buildRawFileUrl(file.fileName));
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
 * dependency is injected so the whole path is testable without a network. Returns
 * the freshly parsed, updated system on success, or null when no update applies or
 * the update fails (fetch error, unparsable remote data) — in which case the caller
 * keeps the stored system untouched. Never throws and never surfaces anything to the
 * user: a failed catalog refresh is invisible by design (the catalog is a cache).
 */
export async function updateSystemFromCatalogIndex(system, index, fetchText) {
  if (!index) return null;

  try {
    const outdatedFiles = findOutdatedCatalogFiles(index, system);
    if (outdatedFiles.length === 0) return null;

    const rawXmls = await downloadOutdatedRawXmls(system.rawXmls, outdatedFiles, fetchText);
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

let catalogIndexCache = new WeakMap();

/**
 * Clear the in-memory catalog index cache. Only needed in tests between cases;
 * in production the cache lives for the page session and is harmless.
 */
export function clearCatalogIndexCache() {
  // WeakMap has no clear() — the reference is held by the module; reassign.
  catalogIndexCache = new WeakMap();
}

/**
 * Fetches and parses the catpkg index. Returns null on any failure (offline,
 * rate-limit, GitHub outage, malformed JSON) so an unreachable index leaves the app
 * working on stored data without any user-facing error. When no fetcher is injected,
 * catalog updates are skipped entirely. The result is cached per fetchText function
 * (WeakMap) so that the same caller never sends redundant requests.
 */
export async function loadCatalogIndex(fetchText, indexUrl = CATALOG_INDEX_URL) {
  if (!fetchText) return null;
  if (catalogIndexCache.has(fetchText)) {
    return catalogIndexCache.get(fetchText);
  }
  try {
    const indexText = await fetchText(indexUrl);
    const index = JSON.parse(indexText);
    catalogIndexCache.set(fetchText, index);
    return index;
  } catch (error) {
    console.warn('Catalog index unavailable; keeping stored catalog data:', error);
    catalogIndexCache.set(fetchText, null);
    return null;
  }
}
