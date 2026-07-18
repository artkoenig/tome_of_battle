/**
 * Fork-CI tooling for the Lexicanum catalog fork (see ADR-0017).
 *
 * The upstream Lexicanum repository does not maintain BattleScribe's `revision`
 * convention (an added `entryLink` shipped while `revision` stayed `"1"`) and ships
 * no `catpkg.json`. ADR-0014's silent updater keys off exactly that `revision`
 * signal ("higher wins"), so without help no imported system ever notices an update.
 *
 * This module is the fork's own remedy: on every upstream sync it detects, per file,
 * whether content that matters actually changed (not merely the `revision` attribute
 * itself) and, if so, bumps `revision`. It then regenerates `catpkg.json` in the
 * ecosystem format (`id`, `name`, `type`, `revision`, `sourceSha256`) the app already
 * consumes (`src/db/catalogUpdate.js`).
 *
 * Everything here is pure and framework-free; the fs/git wiring lives in the CLI
 * (`generate-catpkg.js`) so this logic stays unit-testable in isolation.
 */
import { createHash } from 'node:crypto';

const CATALOGUE_FILE_EXTENSION = '.cat';
const GAME_SYSTEM_FILE_EXTENSION = '.gst';

/**
 * catpkg `type` values, lower case, exactly as emitted by BSData/publish-catpkg and
 * consumed by the app's updater. Kept in sync with `src/db/catalogUpdate.js`.
 */
export const CATPKG_TYPE = Object.freeze({
  GAME_SYSTEM: 'gamesystem',
  CATALOGUE: 'catalogue',
});

/** The key under which the app's updater reads the per-file descriptors. */
const CATPKG_FILES_KEY = 'repositoryFiles';

/** The root element of a catalog file is either a game system or a catalogue. */
const ROOT_ELEMENT_PATTERN = /<(?:catalogue|gameSystem)\b[^>]*>/;

/**
 * The root `revision` attribute. Anchored on a leading whitespace boundary and
 * case-sensitive so it never matches the sibling `gameSystemRevision` attribute,
 * which carries a capital `R` and denotes a different concept.
 */
const ROOT_REVISION_PATTERN = /(\srevision=")(\d+)(")/;

const HASH_ALGORITHM = 'sha256';
const HASH_ENCODING = 'hex';

/** Returns the root element's opening tag, or throws if the content is not a catalog. */
function readRootTag(content) {
  const match = ROOT_ELEMENT_PATTERN.exec(content);
  if (match === null) {
    throw new Error('Not a catalog file: no <catalogue> or <gameSystem> root element found.');
  }
  return match[0];
}

/** Reads the value of a single-valued attribute from the root element. */
function readRootAttribute(content, attributeName) {
  const rootTag = readRootTag(content);
  const attributePattern = new RegExp(`\\s${attributeName}="([^"]*)"`);
  const match = attributePattern.exec(rootTag);
  if (match === null) {
    throw new Error(`Root element is missing the required "${attributeName}" attribute.`);
  }
  return match[1];
}

/** Reads the numeric root `revision`, or throws if it is absent or malformed. */
export function readRootRevision(content) {
  const rootTag = readRootTag(content);
  const match = ROOT_REVISION_PATTERN.exec(rootTag);
  if (match === null) {
    throw new Error('Root element is missing the required numeric "revision" attribute.');
  }
  return Number.parseInt(match[2], 10);
}

/** Returns `content` with the root `revision` set to `revision`, byte-identical otherwise. */
export function withRootRevision(content, revision) {
  const rootTag = readRootTag(content);
  if (ROOT_REVISION_PATTERN.exec(rootTag) === null) {
    throw new Error('Cannot set revision: root element has no "revision" attribute.');
  }
  const updatedRootTag = rootTag.replace(ROOT_REVISION_PATTERN, `$1${revision}$3`);
  const rootTagStart = content.indexOf(rootTag);
  return content.slice(0, rootTagStart) + updatedRootTag + content.slice(rootTagStart + rootTag.length);
}

/**
 * Whether two catalog versions differ in anything other than the root `revision`.
 * The files are kept byte-identical to upstream (ADR-0014), so normalising only the
 * revision away and comparing the remainder byte-for-byte is the most faithful
 * "did the content actually change?" test — it catches every real edit while ignoring
 * a bare revision difference.
 */
export function contentDiffersIgnoringRevision(previousContent, incomingContent) {
  const placeholderRevision = 0;
  return (
    withRootRevision(previousContent, placeholderRevision) !==
    withRootRevision(incomingContent, placeholderRevision)
  );
}

/**
 * Decides the `revision` for a single file on an upstream sync.
 *
 * - A file with no previous version is brand new and passes through untouched.
 * - Unchanged content keeps the higher of the two revisions, so neither an upstream
 *   revision reset nor a re-run against a stale base can ever claw a revision back
 *   down (this also makes the tool idempotent on its own committed output).
 * - Changed content is bumped to one above both the previous and the incoming
 *   revision — strictly greater than anything a client may already hold, which is
 *   exactly what "higher wins" needs to fire.
 *
 * @param {{ previousContent: string | null, incomingContent: string }} params
 * @returns {{ content: string, changed: boolean, revision: number }}
 */
export function resolveRevision({ previousContent, incomingContent }) {
  const incomingRevision = readRootRevision(incomingContent);

  if (previousContent === null || previousContent === undefined) {
    return { content: incomingContent, changed: false, revision: incomingRevision };
  }

  const previousRevision = readRootRevision(previousContent);

  if (!contentDiffersIgnoringRevision(previousContent, incomingContent)) {
    const preservedRevision = Math.max(previousRevision, incomingRevision);
    return {
      content: withRootRevision(incomingContent, preservedRevision),
      changed: false,
      revision: preservedRevision,
    };
  }

  const bumpedRevision = Math.max(previousRevision, incomingRevision) + 1;
  return {
    content: withRootRevision(incomingContent, bumpedRevision),
    changed: true,
    revision: bumpedRevision,
  };
}

/** Maps a catalog file name to its catpkg `type` by extension. */
export function catpkgTypeForFileName(fileName) {
  if (fileName.endsWith(GAME_SYSTEM_FILE_EXTENSION)) return CATPKG_TYPE.GAME_SYSTEM;
  if (fileName.endsWith(CATALOGUE_FILE_EXTENSION)) return CATPKG_TYPE.CATALOGUE;
  throw new Error(
    `Unsupported catalog file "${fileName}": expected a "${CATALOGUE_FILE_EXTENSION}" or "${GAME_SYSTEM_FILE_EXTENSION}" file.`
  );
}

/** Whether a file name denotes a catalog file this tool processes. */
export function isCatalogFileName(fileName) {
  return fileName.endsWith(CATALOGUE_FILE_EXTENSION) || fileName.endsWith(GAME_SYSTEM_FILE_EXTENSION);
}

function sha256Hex(content) {
  return createHash(HASH_ALGORITHM).update(content, 'utf8').digest(HASH_ENCODING);
}

/**
 * Builds one catpkg index entry from a file's final (post-bump) content. The
 * `sourceSha256` describes exactly the bytes that will be served. `path` carries
 * the real repository file name, which the root `name` attribute does not reliably
 * reproduce (upstream names files independently of the catalogue's `name`, e.g.
 * name "Chaos Dwarfs" vs file "Chaos Dwarves (6th definitive edition).cat"); the app
 * fetches by this `path` instead of reconstructing a name from the extension.
 */
export function buildCatpkgEntry({ fileName, content }) {
  return {
    id: readRootAttribute(content, 'id'),
    name: readRootAttribute(content, 'name'),
    path: fileName,
    type: catpkgTypeForFileName(fileName),
    revision: readRootRevision(content),
    sourceSha256: sha256Hex(content),
  };
}

/**
 * Builds the `catpkg.json` index for a set of catalog files, sorted by name for
 * deterministic output. Shape mirrors BSData/publish-catpkg's `repositoryFiles`
 * array, which the app's updater reads.
 *
 * @param {Array<{ fileName: string, content: string }>} files
 */
export function buildCatpkgIndex(files) {
  const entries = files
    .map(buildCatpkgEntry)
    .sort((left, right) => left.name.localeCompare(right.name));
  return { [CATPKG_FILES_KEY]: entries };
}

/**
 * Runs a full sync over a set of incoming catalog files against their previous
 * versions, then builds the catpkg index from the resolved contents. Pure: all fs
 * and git access is injected via `resolvePreviousContent`.
 *
 * @param {object} params
 * @param {Array<{ fileName: string, content: string }>} params.files - incoming files.
 * @param {(fileName: string) => string | null} params.resolvePreviousContent - the
 *   previously committed content of a file, or `null` if it did not exist before.
 * @returns {{
 *   results: Array<{ fileName: string, content: string, changed: boolean, revision: number }>,
 *   catpkgIndex: { repositoryFiles: Array<object> }
 * }}
 */
export function applyCatalogSync({ files, resolvePreviousContent }) {
  const results = files.map(({ fileName, content }) => {
    const previousContent = resolvePreviousContent(fileName);
    const resolved = resolveRevision({ previousContent, incomingContent: content });
    return { fileName, ...resolved };
  });

  const catpkgIndex = buildCatpkgIndex(
    results.map(({ fileName, content }) => ({ fileName, content }))
  );

  return { results, catpkgIndex };
}
