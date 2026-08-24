/**
 * The file-system side of the static coverage inventory — **not production
 * code**.
 *
 * Walks the two frozen fixture corpora, reads the E2E scenario manifests, and
 * assembles the worklist that `docs/testing/worklist.json` holds. The
 * classification itself lives in `scripts/lib/evaluator-coverage-cells.js`,
 * which stays pure so the extraction rules can be pinned on synthetic XML.
 *
 * Only `.cat`/`.gst` text is read: no roster, no evaluation, no import from
 * `src/domain/evaluator/` (ADR 0030, ADR 0033).
 *
 * `DOMParser` is expected as a global — the vitest jsdom environment supplies
 * it, and `scripts/evaluator-coverage-inventory.js` installs jsdom's before
 * calling in. Nothing here touches it at import time.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  coveredKeysFromManifests,
  diffCells,
  keysFromCoveredRecord,
  parserErrorMessage,
  sortCells,
} from './evaluator-coverage-cells.js';

const currentFilePath = fileURLToPath(import.meta.url);

/** Repo root, derived from this module so a run does not depend on the cwd. */
export const REPO_ROOT = resolve(dirname(currentFilePath), '..', '..');

/** The frozen "definitive edition" corpus the evaluator E2E scenarios run on. */
export const WHFB6_DEFINITIVE_DIR = resolve(REPO_ROOT, 'src', 'domain', 'evaluator', '__fixtures__', 'whfb6-definitive');

/** The frozen upstream-form corpus that also feeds the app E2E harness. */
export const WHFB6_DIR = resolve(REPO_ROOT, 'src', 'tests', '__fixtures__', 'whfb6');

/** Both corpora, in the order the inventory walks them. */
export const CORPUS_DIRS = Object.freeze([WHFB6_DEFINITIVE_DIR, WHFB6_DIR]);

/** Where the E2E scenarios and the two coverage records live. */
export const TESTING_DIR = resolve(REPO_ROOT, 'docs', 'testing');

/** The manual covered-cells record, maintained by hand and by the closure loop. */
export const COVERED_CELLS_PATH = resolve(TESTING_DIR, 'covered-cells.json');

/** The generated worklist, committed and guarded against drift. */
export const WORKLIST_PATH = resolve(TESTING_DIR, 'worklist.json');

/** The script that writes the worklist, named inside the generated file. */
export const GENERATED_BY = 'scripts/evaluator-coverage-inventory.js';

/** Schema version of both JSON records. */
export const SCHEMA_VERSION = 1;

/** File name of a scenario's manifest. */
const MANIFEST_FILE = 'scenario.json';

const CATALOGUE_EXTENSIONS = ['.cat', '.gst'];
const XML_CONTENT_TYPE = 'application/xml';

/**
 * A repo-relative, POSIX-separated path, so the generated JSON is stable
 * across machines and platforms.
 * @param {string} absolutePath
 * @returns {string}
 */
export function repoRelative(absolutePath) {
  return relative(REPO_ROOT, absolutePath).split(sep).join('/');
}

/**
 * The path a failure entry names: repo-relative for anything inside the repo,
 * and the absolute path for anything outside it — a `../../tmp/...` chain
 * would name a temp directory worse than the path it was given.
 * @param {string} absolutePath
 * @returns {string}
 */
function failurePath(absolutePath) {
  const relativePath = relative(REPO_ROOT, absolutePath);
  return relativePath.startsWith('..') ? absolutePath : relativePath.split(sep).join('/');
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isCatalogueFile(name) {
  return CATALOGUE_EXTENSIONS.some(extension => name.toLowerCase().endsWith(extension));
}

/**
 * Reads and parses every `.cat`/`.gst` of the given directories.
 *
 * Each directory also carries a `README.md`, which is skipped by the
 * extension filter. Entries are sorted so the walk order — and with it the
 * order of the examples recorded per cell — is deterministic.
 *
 * @param {string[]} [dirs] absolute directory paths; defaults to both corpora
 * @returns {{ sources: Array<{ file: string, doc: Document }>, failures: Array<{ file: string, message: string }> }}
 */
export function loadCorpus(dirs = [...CORPUS_DIRS]) {
  /** @type {Array<{ file: string, doc: Document }>} */
  const sources = [];
  /** @type {Array<{ file: string, message: string }>} */
  const failures = [];

  for (const dir of dirs) {
    /** @type {string[]} */
    let names;
    try {
      names = readdirSync(dir).filter(isCatalogueFile).sort();
    } catch (error) {
      failures.push({ file: repoRelative(dir), message: `corpus directory unreadable: ${String(error)}` });
      continue;
    }
    for (const name of names) {
      const absolutePath = join(dir, name);
      const file = repoRelative(absolutePath);
      try {
        const doc = new DOMParser().parseFromString(readFileSync(absolutePath, 'utf-8'), XML_CONTENT_TYPE);
        const message = parserErrorMessage(doc);
        if (message === null) sources.push({ file, doc });
        else failures.push({ file, message });
      } catch (error) {
        failures.push({ file, message: String(error) });
      }
    }
  }

  return { sources, failures };
}

/**
 * Reads every scenario manifest under `docs/testing/`.
 *
 * The directory also holds loose files (`constraint-matrix.md` and the two
 * coverage records); only sub-directories carrying a `scenario.json` count, the
 * same rule the manifest-driven E2E runner applies.
 *
 * @param {string} [testingDir]
 * @returns {Array<{ dir: string } & Record<string, any>>} each manifest with
 *   its repo-relative directory as `dir`, which is the evidence a derived
 *   coverage entry carries.
 */
export function loadManifests(testingDir = TESTING_DIR) {
  /** @type {Array<{ dir: string } & Record<string, any>>} */
  const manifests = [];
  const entries = readdirSync(testingDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  for (const name of entries) {
    const manifestPath = join(testingDir, name, MANIFEST_FILE);
    /** @type {string} */
    let text;
    try {
      text = readFileSync(manifestPath, 'utf-8');
    } catch {
      continue;
    }
    try {
      manifests.push({ ...JSON.parse(text), dir: repoRelative(join(testingDir, name)) });
    } catch (error) {
      throw new Error(`unreadable manifest ${repoRelative(manifestPath)}: ${String(error)}`);
    }
  }

  return manifests;
}

/**
 * Reads the manual covered-cells record. A missing file is an empty record —
 * the loop starts before anyone has waived anything.
 * @param {string} [path]
 * @returns {{ schemaVersion: number, cells: Array<{ key: string, evidence?: any, rationale?: string }> }}
 */
export function loadCoveredRecord(path = COVERED_CELLS_PATH) {
  /** @type {string} */
  let text;
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return { schemaVersion: SCHEMA_VERSION, cells: [] };
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`unreadable covered-cells record ${repoRelative(path)}: ${String(error)}`);
  }
}

/**
 * Reads both coverage records and reports an unreadable one as a failure
 * instead of throwing, in the same `{ file, message }` shape `loadCorpus`
 * produces. A caller that folds these into its failure list therefore exits
 * with the operational code instead of crashing with a stack trace.
 *
 * Both loads always run, so one bad run reports both problems at once. A
 * broken record falls back to "nothing read" rather than "nothing covered":
 * the failure is what stops the caller from writing a worklist off it.
 *
 * @param {{ testingDir?: string, coveredCellsPath?: string }} [options]
 * @returns {{ manifests: Array<{ dir: string } & Record<string, any>>,
 *             coveredRecord: { schemaVersion: number, cells: Array<{ key: string, evidence?: any, rationale?: string }> },
 *             failures: Array<{ file: string, message: string }> }}
 */
export function loadCoverageRecords({ testingDir = TESTING_DIR, coveredCellsPath = COVERED_CELLS_PATH } = {}) {
  /** @type {Array<{ file: string, message: string }>} */
  const failures = [];

  /** @type {Array<{ dir: string } & Record<string, any>>} */
  let manifests = [];
  try {
    manifests = loadManifests(testingDir);
  } catch (error) {
    failures.push({ file: failurePath(testingDir), message: String(error) });
  }

  /** @type {{ schemaVersion: number, cells: Array<{ key: string, evidence?: any, rationale?: string }> }} */
  let coveredRecord = { schemaVersion: SCHEMA_VERSION, cells: [] };
  try {
    coveredRecord = loadCoveredRecord(coveredCellsPath);
  } catch (error) {
    failures.push({ file: failurePath(coveredCellsPath), message: String(error) });
  }

  return { manifests, coveredRecord, failures };
}

/**
 * Unions the two coverage sources and reports the split, including the two
 * guards that warn but never fail: keys the corpus no longer holds, and
 * manifest ids that resolve to no cell.
 *
 * @param {{ cells: any[], index: Map<string, Map<string, string>>, manifests: any[], coveredRecord: any }} input
 * @returns {{ covered: any[], uncovered: any[], stale: string[],
 *             unmatched: Array<{ id: string, evidence: string, reason: string }>,
 *             fromManifests: Array<{ key: string, id: string, evidence: string }>, fromRecord: string[] }}
 */
export function computeCoverage({ cells, index, manifests, coveredRecord }) {
  const derived = coveredKeysFromManifests(manifests, index);
  const fromRecord = keysFromCoveredRecord(coveredRecord);
  const coveredKeys = [...new Set([...derived.matched.map(entry => entry.key), ...fromRecord])];
  const { covered, uncovered, stale } = diffCells(cells, coveredKeys);
  return {
    covered,
    uncovered,
    stale,
    unmatched: derived.unmatched,
    fromManifests: derived.matched,
    fromRecord,
  };
}

/**
 * Builds the committed worklist: the uncovered cells, heaviest first.
 *
 * The result carries no timestamp and no run id on purpose — a generated file
 * that changed on every run would dirty the working tree forever and make the
 * drift guard impossible.
 *
 * @param {{ cells: any[], index: Map<string, Map<string, string>>, manifests: any[], coveredRecord: any }} input
 * @returns {{ schemaVersion: number, generatedBy: string, corpus: string[],
 *             totals: { cells: number, covered: number, uncovered: number }, cells: any[] }}
 */
export function computeWorklist({ cells, index, manifests, coveredRecord }) {
  const { covered, uncovered } = computeCoverage({ cells, index, manifests, coveredRecord });
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: GENERATED_BY,
    corpus: CORPUS_DIRS.map(repoRelative),
    totals: { cells: cells.length, covered: covered.length, uncovered: uncovered.length },
    cells: sortCells(uncovered),
  };
}
