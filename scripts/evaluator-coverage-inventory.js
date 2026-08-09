/**
 * Static coverage inventory of the evaluator's catalogue rule constructs —
 * **not production code**.
 *
 *   node scripts/evaluator-coverage-inventory.js
 *
 * Reads the two frozen fixture corpora as plain XML, classifies every
 * `constraint`, `condition`, `conditionGroup`, `modifier`, `modifierGroup`,
 * `repeat` and `repeats` occurrence into a cell, subtracts the cells the
 * existing E2E scenario manifests already pin and the ones
 * `docs/testing/covered-cells.json` records by hand, and writes the remainder
 * to `docs/testing/worklist.json`.
 *
 * No roster is loaded and the engine is never called: the inventory is
 * data-first and stays independent of what it is meant to measure (ADR 0033).
 *
 * ── Exit codes ───────────────────────────────────────────────────────────────
 *   0  the worklist is empty — every occurring cell is covered or waived
 *   1  the worklist is not empty; this is the normal outcome while the
 *      coverage campaign is still running, not a failure of this script
 *   2  an operational failure: a corpus directory missing, a `parsererror`,
 *      an unreadable JSON record
 *
 * Because a non-empty worklist exits 1, this script is deliberately not one of
 * the repository's check commands. The drift guard in
 * `scripts/lib/evaluator-coverage-corpus.test.js` covers the same ground
 * without a permanently red gate.
 */
import { writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

import { extractCells, exitCodeFor } from './lib/evaluator-coverage-cells.js';
import {
  CORPUS_DIRS,
  WORKLIST_PATH,
  computeCoverage,
  computeWorklist,
  loadCorpus,
  loadCoveredRecord,
  loadManifests,
  repoRelative,
} from './lib/evaluator-coverage-corpus.js';

// The corpus is read with the platform primitive `DOMParser`; in Node jsdom
// provides it — the same seam `scripts/measure-evaluator.js` uses.
globalThis.DOMParser = new JSDOM().window.DOMParser;

/** Exit code for an operational failure, as opposed to open coverage work. */
const OPERATIONAL_FAILURE = 2;

/** How many uncovered cells the summary lists before it stops. */
const TOP_UNCOVERED = 15;

/**
 * Counts cells and occurrences per construct family.
 * @param {Array<{ kind: string, occurrences: number }>} cells
 * @returns {Map<string, { cells: number, occurrences: number }>}
 */
function tallyByKind(cells) {
  /** @type {Map<string, { cells: number, occurrences: number }>} */
  const tally = new Map();
  for (const cell of cells) {
    const entry = tally.get(cell.kind) ?? { cells: 0, occurrences: 0 };
    entry.cells += 1;
    entry.occurrences += cell.occurrences;
    tally.set(cell.kind, entry);
  }
  return tally;
}

function main() {
  const corpus = loadCorpus([...CORPUS_DIRS]);
  const inventory = extractCells(corpus.sources);
  const failures = [...corpus.failures, ...inventory.failures];
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAILURE ${failure.file}: ${failure.message}`);
    process.exitCode = OPERATIONAL_FAILURE;
    return;
  }

  const manifests = loadManifests();
  const coveredRecord = loadCoveredRecord();
  const coverage = computeCoverage({
    cells: inventory.cells,
    index: inventory.index,
    manifests,
    coveredRecord,
  });
  const worklist = computeWorklist({
    cells: inventory.cells,
    index: inventory.index,
    manifests,
    coveredRecord,
  });

  writeFileSync(WORKLIST_PATH, `${JSON.stringify(worklist, null, 2)}\n`, 'utf-8');

  console.log(`Corpus: ${corpus.sources.length} files, ${manifests.length} scenario manifests`);
  console.log('');
  console.log('Cells by kind (cells / occurrences):');
  for (const [kind, entry] of [...tallyByKind(inventory.cells)].sort()) {
    console.log(`  ${kind.padEnd(16)} ${String(entry.cells).padStart(4)} / ${entry.occurrences}`);
  }
  console.log('');
  console.log(`Cells total          ${worklist.totals.cells}`);
  console.log(`  covered by manifest derivation  ${new Set(coverage.fromManifests.map(e => e.key)).size}`);
  console.log(`  covered by manual record        ${coverage.fromRecord.length}`);
  console.log(`  covered (distinct cells)        ${worklist.totals.covered}`);
  console.log(`  uncovered                       ${worklist.totals.uncovered}`);

  for (const key of coverage.stale) console.warn(`WARNING stale covered key, no longer in the corpus: ${key}`);
  for (const entry of coverage.unmatched) {
    console.warn(`WARNING manifest id matches no constraint: ${entry.id} (${entry.evidence})`);
  }

  console.log('');
  console.log(`Top uncovered cells (of ${worklist.cells.length}), written to ${repoRelative(WORKLIST_PATH)}:`);
  for (const cell of worklist.cells.slice(0, TOP_UNCOVERED)) {
    console.log(`  ${String(cell.occurrences).padStart(5)}x  ${cell.key}`);
  }

  process.exitCode = exitCodeFor(worklist.cells);
}

main();
