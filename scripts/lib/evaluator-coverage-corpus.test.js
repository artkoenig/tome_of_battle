import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll } from 'vitest';

import {
  WHFB6_DEFINITIVE_DIR,
  WHFB6_DIR,
  TESTING_DIR,
  COVERED_CELLS_PATH,
  WORKLIST_PATH,
  loadCorpus,
  loadManifests,
  computeWorklist,
} from './evaluator-coverage-corpus.js';
import { extractCells } from './evaluator-coverage-cells.js';

// Integration level: this file parses the real, frozen fixture corpus
// (about 2s) instead of synthetic XML — the module-level extraction rules
// themselves are pinned in evaluator-coverage-cells.test.js.
const RULE_KINDS = ['constraint', 'condition', 'conditionGroup', 'modifier', 'modifierGroup', 'repeat', 'repeatList'];

let corpus;
let inventory;

beforeAll(() => {
  corpus = loadCorpus([WHFB6_DEFINITIVE_DIR, WHFB6_DIR]);
  inventory = extractCells(corpus.sources);
});

function totalOccurrencesByKind(cells, kind) {
  return cells.filter(c => c.key.startsWith(`${kind}|`)).reduce((sum, c) => sum + c.occurrences, 0);
}

// ── Case 21 ───────────────────────────────────────────────────────────────
describe('loadCorpus — static walk of both fixture sets', () => {
  it('returns exactly nine catalogue/game-system files, excludes each README.md, and reports no parsererror', () => {
    expect(corpus.failures).toEqual([]);
    expect(corpus.sources).toHaveLength(9);

    const definitiveFiles = corpus.sources.filter(s => s.file.includes('whfb6-definitive'));
    const whfb6Files = corpus.sources.filter(s => !s.file.includes('whfb6-definitive'));
    expect(definitiveFiles).toHaveLength(5);
    expect(whfb6Files).toHaveLength(4);

    expect(corpus.sources.some(s => s.file.toLowerCase().endsWith('readme.md'))).toBe(false);
  });
});

// ── Case 22 ───────────────────────────────────────────────────────────────
describe('extractCells over the real corpus — occurrence totals match a plain tag count', () => {
  // These totals come from `grep -o '<constraint ' -r <both fixture dirs> | wc -l`
  // and friends, run against the frozen fixtures during research. The
  // fixtures are frozen, so a mismatch is a real extraction bug and the grep
  // is the arbiter — re-run it before touching the extraction if this fails.
  it.each([
    ['constraint', 5290],
    ['condition', 1739],
    ['conditionGroup', 261],
    ['modifier', 1762],
    ['modifierGroup', 109],
    ['repeat', 214],
  ])('totals %s occurrences to %i', (kind, expected) => {
    expect(totalOccurrencesByKind(inventory.cells, kind)).toBe(expected);
  });
});

// ── Case 23 ───────────────────────────────────────────────────────────────
describe('extractCells over the real corpus — known landmark cells', () => {
  it('contains conditionGroup|not|nested with 2 occurrences (Vampire Counts)', () => {
    const cell = inventory.cells.find(c => c.key === 'conditionGroup|not|nested');
    expect(cell).toBeDefined();
    expect(cell.occurrences).toBe(2);
  });

  it('contains a condition|greaterThanOrEqualTo|... cell with 1 occurrence', () => {
    const cell = inventory.cells.find(c => c.key.startsWith('condition|greaterThanOrEqualTo|'));
    expect(cell).toBeDefined();
    expect(cell.occurrences).toBe(1);
  });

  it('contains a modifier|...|unresolvedTarget cell', () => {
    const cell = inventory.cells.find(c => c.key.startsWith('modifier|') && c.key.endsWith('|unresolvedTarget'));
    expect(cell).toBeDefined();
  });

  it('contains at least one cell of each of the seven kinds', () => {
    const presentKinds = new Set(inventory.cells.map(c => c.key.split('|')[0]));
    for (const kind of RULE_KINDS) {
      expect(presentKinds, `no cell of kind ${kind}`).toContain(kind);
    }
  });
});

// ── Cases 24–26 ───────────────────────────────────────────────────────────
describe('docs/testing/worklist.json — drift guard against the committed file', () => {
  it('deep-equals the worklist recomputed from the corpus, the manifests, and covered-cells.json', () => {
    const manifests = loadManifests(TESTING_DIR);
    const coveredRecord = JSON.parse(readFileSync(COVERED_CELLS_PATH, 'utf-8'));
    const recomputed = computeWorklist({ cells: inventory.cells, index: inventory.index, manifests, coveredRecord });
    const committed = JSON.parse(readFileSync(WORKLIST_PATH, 'utf-8'));

    expect(recomputed).toEqual(committed);
  });

  it('keeps totals internally consistent: covered + uncovered === cells, and cells.length === totals.uncovered', () => {
    const committed = JSON.parse(readFileSync(WORKLIST_PATH, 'utf-8'));

    expect(committed.totals.covered + committed.totals.uncovered).toBe(committed.totals.cells);
    expect(committed.cells).toHaveLength(committed.totals.uncovered);
  });

  it('orders cells deterministically by occurrences descending then key ascending, on every recomputation', () => {
    const manifests = loadManifests(TESTING_DIR);
    const coveredRecord = JSON.parse(readFileSync(COVERED_CELLS_PATH, 'utf-8'));

    const first = computeWorklist({ cells: inventory.cells, index: inventory.index, manifests, coveredRecord });
    const second = computeWorklist({ cells: inventory.cells, index: inventory.index, manifests, coveredRecord });

    expect(first).toEqual(second);

    for (let i = 1; i < first.cells.length; i += 1) {
      const prev = first.cells[i - 1];
      const curr = first.cells[i];
      const orderedCorrectly =
        prev.occurrences > curr.occurrences ||
        (prev.occurrences === curr.occurrences && prev.key <= curr.key);
      expect(orderedCorrectly, `cell ${i} (${curr.key}) is out of order after ${prev.key}`).toBe(true);
    }
  });
});
