import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';

import {
  WHFB6_DEFINITIVE_DIR,
  WHFB6_DIR,
  TESTING_DIR,
  COVERED_CELLS_PATH,
  WORKLIST_PATH,
  loadCorpus,
  loadManifests,
  computeWorklist,
  loadCoverageRecords,
} from './evaluator-coverage-corpus.js';
import { extractCells, coveredKeysFromManifests, diffCells, keysFromCoveredRecord } from './evaluator-coverage-cells.js';

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
  // These totals come from `grep -rhoE '<constraint[ />]' <both fixture dirs>
  // | wc -l` and friends, run against the frozen fixtures during research. The
  // character class matters: a trailing-space pattern misses attribute-less
  // elements such as `<modifierGroup>`. The fixtures are frozen, so a mismatch
  // is a real extraction bug and the grep is the arbiter — re-run it before
  // touching the extraction if this fails.
  it.each([
    ['constraint', 5290],
    ['condition', 1739],
    ['conditionGroup', 261],
    ['modifier', 1762],
    ['modifierGroup', 121],
    ['repeat', 214],
    // (C2, round 3 correction) repeatList reads 213 under the corrected
    // character-class grep (`<repeats[ />]`); a trailing-space pattern misses
    // the attribute-less `<repeats>` tag the same way it misses
    // `<modifierGroup>`. totalOccurrencesByKind keys off the cell-key prefix,
    // so this counts every `repeatList|...` cell, not the `<repeat>` tag.
    ['repeatList', 213],
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
    // (B3, round 3 correction) pins the exact totals once per-fixture-set
    // evidence resolution is in place: the force/roster swap of the
    // duplicated id 1077-7379-f142-f382 (B1/B2) is a wash on the totals even
    // though the specific covered/uncovered cell each resolves to changes.
    // Issue 0147, unit-test-track round: the campaign's last open cell
    // (repeat|selectionCount|parent|child=any|repeats=1|s=true|ics=false|icf=false|roundUp=false|pct=false)
    // is covered by src/evaluator/modifiers.repeatParentAny.test.js, so cells
    // stays 105 (the corpus is frozen) and covered/uncovered move to 105/0.
    expect(recomputed.totals).toEqual({ cells: 105, covered: 105, uncovered: 0 });
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

// ── Cases B1/B2 (round 3 correction — per-fixture-set evidence resolution) ─
// The real corpus's landmark case of a duplicated constraint id:
// 1077-7379-f142-f382 occurs once as scope "force" in the definitive .gst
// (exercised by three real scenarios' expect.firing[].limitId) and once as
// scope "roster" in the other fixture set's .gst (exercised by nothing).
// Evidence for the id must land on the cell the firing scenarios' dataset
// actually names, not on whichever of the two the flat id-keyed index used
// to remember.
describe('worklist — the duplicated-id landmark resolves to the dataset-correct cell', () => {
  it('does not list the definitive set\'s force-scope cell of 1077-7379-f142-f382 as uncovered (B1)', () => {
    const manifests = loadManifests(TESTING_DIR);
    const coveredRecord = JSON.parse(readFileSync(COVERED_CELLS_PATH, 'utf-8'));
    const recomputed = computeWorklist({ cells: inventory.cells, index: inventory.index, manifests, coveredRecord });

    const key = 'constraint|min|selectionCount|force|s=true|ics=true|icf=true|pct=false';
    expect(recomputed.cells.some(c => c.key === key)).toBe(false);
  });

  it('keeps the other set\'s roster-scope cell of the same id a separate cell, in that .gst alone (B2)', () => {
    // The two scopes of 1077-7379-f142-f382 are two cells, and each is
    // credited only by a scenario whose dataset names its own fixture set —
    // the roster-scope one by docs/testing/roster-min-general-armywide, the
    // force-scope one by the three definitive-set scenarios. What this pins is
    // that separation, not whether either happens to be covered right now:
    // the coverage campaign closes cells over time, so an assertion on the
    // uncovered list would go stale by design.
    const key = 'constraint|min|selectionCount|roster|s=true|ics=true|icf=true|pct=false';
    const cell = inventory.cells.find(c => c.key === key);

    expect(cell).toBeDefined();
    expect(cell.occurrences).toBe(1);
    expect(cell.files).toEqual({ 'src/__fixtures__/whfb6/Warhammer Fantasy Battle 6th edition.gst': 1 });

    const manifests = loadManifests(TESTING_DIR);
    const coveredRecord = JSON.parse(readFileSync(COVERED_CELLS_PATH, 'utf-8'));
    const recomputed = computeWorklist({ cells: inventory.cells, index: inventory.index, manifests, coveredRecord });
    expect(recomputed.cells.some(c => c.key === key)).toBe(false);
  });
});

// ── Case B4 (round 3 correction) ────────────────────────────────────────────
describe('coveredKeysFromManifests / diffCells over the real corpus — covered and uncovered partition every cell exactly once', () => {
  it('sums covered and uncovered to the full inventory size, with no key in both (B4)', () => {
    const manifests = loadManifests(TESTING_DIR);
    const coveredRecord = JSON.parse(readFileSync(COVERED_CELLS_PATH, 'utf-8'));
    const { matched } = coveredKeysFromManifests(manifests, inventory.index);
    const coveredKeys = [...new Set([...matched.map(m => m.key), ...keysFromCoveredRecord(coveredRecord)])];

    const { covered, uncovered } = diffCells(inventory.cells, coveredKeys);

    expect(covered.length + uncovered.length).toBe(inventory.cells.length);
    const uncoveredKeySet = new Set(uncovered.map(c => c.key));
    for (const cell of covered) {
      expect(uncoveredKeySet.has(cell.key)).toBe(false);
    }
  });
});

// ── Case B5 (round 3 correction) ────────────────────────────────────────────
describe('coveredKeysFromManifests over the real corpus and manifests — resolution failures', () => {
  it('reports zero outside-dataset entries and exactly the five known unknown-id ids (B5)', () => {
    const manifests = loadManifests(TESTING_DIR);
    const { unmatched } = coveredKeysFromManifests(manifests, inventory.index);

    const outsideDataset = unmatched.filter(u => u.reason === 'outside-dataset');
    const unknownIds = new Set(unmatched.filter(u => u.reason === 'unknown-id').map(u => u.id));

    expect(outsideDataset).toEqual([]);
    // The two budget:: ids are the runner's synthetic roster-budget limits, one
    // per cost type a scenario budgets — they name no corpus constraint by
    // construction, and a new one appears whenever a scenario budgets a further
    // cost type (here: Casting Dice).
    expect(unknownIds).toEqual(
      new Set([
        '02cd-cabf-7e25-2b09',
        'd96c-c95f-8224-7c87',
        'budget::ecfa-8486-4f6c-c249',
        'budget::fcec-2340-6368-a2ba',
        // The Orcs-and-Goblins "Swedish Comp System" modifiers address this id
        // and nothing in the corpus defines it. modifier-unresolved-target-inert
        // names it in expect.absent on purpose — that a dangling target never
        // reaches the report is the very thing the scenario pins, so this entry
        // is expected here and is not a wrong limitId.
        'ce6e-afde-2ed1-aac2',
        // Same shape in the Vampire Counts catalogue: the two Lord categoryLinks
        // of the special armies carry a bare `set 1` on this id, which nothing
        // defines. set-unresolved-target-inert-lord-slot names it in
        // expect.absent for the same reason as the id above.
        'a59d-2ddb-429c-1aca',
      ]),
    );
  });
});

// ── Case 27 (round 2 correction, Finding 1 — repeat flags) ─────────────────
describe('extractCells over the real corpus — repeat cell count once shared/includeChildSelections/includeChildForces separate cells', () => {
  it('yields exactly 11 distinct repeat| cells (R7)', () => {
    const repeatCells = inventory.cells.filter(c => c.key.startsWith('repeat|'));
    expect(repeatCells).toHaveLength(11);
  });
});

// ── Case 28 (round 2 correction, Finding 1) ─────────────────────────────────
describe('extractCells over the real corpus — landmark flagged repeat cells (R8)', () => {
  it('contains repeat|selectionCount|parent|child=model|repeats=1|s=true|ics=true|icf=false|roundUp=false|pct=false with 16 occurrences', () => {
    const cell = inventory.cells.find(
      c => c.key === 'repeat|selectionCount|parent|child=model|repeats=1|s=true|ics=true|icf=false|roundUp=false|pct=false',
    );
    expect(cell).toBeDefined();
    expect(cell.occurrences).toBe(16);
  });

  it('contains repeat|selectionCount|roster|child=id|repeats=1|s=true|ics=true|icf=true|roundUp=false|pct=false with 12 occurrences', () => {
    const cell = inventory.cells.find(
      c => c.key === 'repeat|selectionCount|roster|child=id|repeats=1|s=true|ics=true|icf=true|roundUp=false|pct=false',
    );
    expect(cell).toBeDefined();
    expect(cell.occurrences).toBe(12);
  });
});

// ── Cases 29–34 (round 2 correction, Finding 2 — exit code for an unreadable
// JSON record) ───────────────────────────────────────────────────────────
// No acceptance criterion covers this; it is the script's own documented
// contract that `main()` reports a broken record instead of crashing or
// silently ignoring it. Driven entirely against temporary directories so no
// committed file is ever corrupted by a test run.
describe('loadCoverageRecords — reports a broken covered-cells.json or scenario.json instead of throwing', () => {
  let workDir;
  let testingDir;
  let coveredCellsPath;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'coverage-records-'));
    testingDir = join(workDir, 'testing');
    coveredCellsPath = join(workDir, 'covered-cells.json');
    mkdirSync(testingDir);
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  // ── Case 29 ──
  it('reports a malformed covered-cells.json as one failure naming its path, without throwing, and falls back to the empty record (E1)', () => {
    writeFileSync(coveredCellsPath, '{ not json');

    const records = loadCoverageRecords({ testingDir, coveredCellsPath });

    expect(records.failures).toHaveLength(1);
    expect(records.failures[0].file).toBe(coveredCellsPath);
    expect(records.coveredRecord).toEqual({ schemaVersion: 1, cells: [] });
  });

  // ── Case 30 ──
  it('reports a malformed scenario.json as one failure, without throwing, and drops that scenario from manifests (E2)', () => {
    const scenarioDir = join(testingDir, 'broken-scenario');
    mkdirSync(scenarioDir);
    writeFileSync(join(scenarioDir, 'scenario.json'), '{ not json');

    const records = loadCoverageRecords({ testingDir, coveredCellsPath });

    expect(records.failures).toHaveLength(1);
    expect(records.manifests.some(m => m.dir === scenarioDir)).toBe(false);
  });

  // ── Case 31 ──
  it('reports two failures when both covered-cells.json and a scenario.json are malformed at once (E3)', () => {
    writeFileSync(coveredCellsPath, '{ not json');
    const scenarioDir = join(testingDir, 'broken-scenario');
    mkdirSync(scenarioDir);
    writeFileSync(join(scenarioDir, 'scenario.json'), '{ not json');

    const records = loadCoverageRecords({ testingDir, coveredCellsPath });

    expect(records.failures).toHaveLength(2);
  });

  // ── Case 32 ──
  it('treats a missing covered-cells.json as no failure, falling back to the empty record (E4)', () => {
    const records = loadCoverageRecords({ testingDir, coveredCellsPath });

    expect(records.failures).toEqual([]);
    expect(records.coveredRecord).toEqual({ schemaVersion: 1, cells: [] });
  });

  // ── Case 33 ──
  it('skips a manifest sub-directory with no scenario.json without a failure (E5)', () => {
    const emptyDir = join(testingDir, 'no-scenario-here');
    mkdirSync(emptyDir);
    writeFileSync(join(emptyDir, 'README.md'), '# not a scenario');

    const records = loadCoverageRecords({ testingDir, coveredCellsPath });

    expect(records.failures).toEqual([]);
  });

  // ── Case 34 ──
  it('reads the real fixture corpus manifests and covered-cells.json without any failure on the happy path (E6)', () => {
    const records = loadCoverageRecords();

    expect(records.failures).toEqual([]);
    expect(records.manifests.length).toBeGreaterThan(0);
    expect(records.coveredRecord.cells.length).toBeGreaterThan(0);
  });
});
