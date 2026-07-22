/**
 * Reine Verdichtung der Testabdeckung je Modul (ohne Dateizugriff, damit sie
 * testbar bleibt). Eingabe ist der Inhalt einer `coverage-final.json` im
 * Istanbul-Format, wie ihn `vitest --coverage.reporter=json` erzeugt.
 *
 * Istanbul zaehlt pro Datei drei Groessen: Anweisungen (`s`), Branches (`b`) und
 * Funktionen (`f`). Jeder Eintrag ist die Trefferzahl; alles > 0 gilt als
 * abgedeckt. Fuer den Bericht interessiert nicht die einzelne Datei, sondern das
 * Modul -- also das Verzeichnis, in dem sie liegt.
 */

const FULLY_COVERED_PERCENT = 100;
const PERCENT_DECIMALS = 1;

/**
 * @typedef {object} CoverageMetric
 * @property {number} covered
 * @property {number} total
 * @property {number} percent  Anteil in Prozent; bei `total === 0` per Definition 100.
 */

/**
 * @typedef {object} ModuleCoverage
 * @property {string} module      Verzeichnis relativ zur Projektwurzel.
 * @property {number} fileCount
 * @property {CoverageMetric} statements
 * @property {CoverageMetric} branches
 * @property {CoverageMetric} functions
 */

/**
 * Verdichtet `coverage-final.json` zu Kennwerten je Modul.
 *
 * @param {Record<string, object>} coverageFinal
 * @param {{ rootPath?: string }} [options]
 *   `rootPath` ist das Projektverzeichnis, das aus den absoluten Pfaden der
 *   Coverage-Datei entfernt wird, damit die Modulnamen maschinenunabhaengig sind.
 * @returns {ModuleCoverage[]}  nach Modulnamen sortiert
 */
export function aggregateCoverage(coverageFinal, { rootPath = '' } = {}) {
  /** @type {Map<string, { fileCount: number, statements: number[], branches: number[], functions: number[] }>} */
  const byModule = new Map();

  for (const [filePath, fileCoverage] of Object.entries(coverageFinal ?? {})) {
    const moduleName = moduleFromPath(filePath, rootPath);
    const bucket = byModule.get(moduleName) ?? {
      fileCount: 0,
      statements: [0, 0],
      branches: [0, 0],
      functions: [0, 0],
    };

    bucket.fileCount += 1;
    addCounts(bucket.statements, countHits(fileCoverage?.s));
    addCounts(bucket.branches, countHits(flattenBranchHits(fileCoverage?.b)));
    addCounts(bucket.functions, countHits(fileCoverage?.f));
    byModule.set(moduleName, bucket);
  }

  return [...byModule.entries()]
    .map(([moduleName, bucket]) => ({
      module: moduleName,
      fileCount: bucket.fileCount,
      statements: toMetric(bucket.statements),
      branches: toMetric(bucket.branches),
      functions: toMetric(bucket.functions),
    }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

/**
 * Modulname einer Datei: ihr Verzeichnis, relativ zur Projektwurzel.
 *
 * @param {string} filePath
 * @param {string} [rootPath]
 * @returns {string}
 */
export function moduleFromPath(filePath, rootPath = '') {
  const relative = stripRoot(filePath.replace(/\\/g, '/'), rootPath.replace(/\\/g, '/'));
  const lastSeparator = relative.lastIndexOf('/');
  return lastSeparator === -1 ? '.' : relative.slice(0, lastSeparator);
}

function stripRoot(filePath, rootPath) {
  if (rootPath === '') return filePath.replace(/^\/+/, '');
  const normalizedRoot = rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
  return filePath.startsWith(normalizedRoot) ? filePath.slice(normalizedRoot.length) : filePath.replace(/^\/+/, '');
}

/** Branch-Trefferzahlen liegen je Branch als Array vor und werden hier eingeebnet. */
function flattenBranchHits(branchHits) {
  return Object.values(branchHits ?? {}).flat();
}

/** @returns {[covered: number, total: number]} */
function countHits(hits) {
  const values = Array.isArray(hits) ? hits : Object.values(hits ?? {});
  const covered = values.filter((hitCount) => hitCount > 0).length;
  return [covered, values.length];
}

function addCounts(target, [covered, total]) {
  target[0] += covered;
  target[1] += total;
}

/** @returns {CoverageMetric} */
function toMetric([covered, total]) {
  return { covered, total, percent: toPercent(covered, total) };
}

/**
 * Anteil in Prozent. Eine Datei ohne Branches hat per Definition volle
 * Branch-Abdeckung -- ohne diesen Sonderfall entstuende eine 0/0-Division.
 */
function toPercent(covered, total) {
  if (total === 0) return FULLY_COVERED_PERCENT;
  return Number(((covered / total) * FULLY_COVERED_PERCENT).toFixed(PERCENT_DECIMALS));
}
