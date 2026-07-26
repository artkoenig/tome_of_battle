import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import {
  MeasuredPhase,
  FacadeShape,
  INTERACTIVE_BUDGET_MS,
  TWO_STAGE_PREPARATION_SHARE,
  measureEvaluation,
  describeTree,
  reportFingerprint,
  assertMatchesFacade,
  median,
  summarizeRuns,
  assessThresholds,
} from './evaluator-measurement.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den Evaluator-Tests).
// Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Minimaler synthetischer Katalog ────────────────────────────────────────────
// Nur fuer die Modultests des Messgeraets. Die *Messung selbst* laeuft nie gegen
// einen solchen Miniaturkatalog, sondern gegen echte Katalogdaten
// (`scripts/measure-evaluator.js`) — hier geht es allein darum, dass das Geraet
// misst, was es zu messen behauptet.
const WARRIOR_DEF_ID = 'entry-warrior';
const MAX_WARRIORS_LIMIT_ID = 'max-warriors';
const MAX_WARRIORS = 1;
const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-measure" name="Measurement Catalogue">
    <selectionEntries>
      <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
        <constraints>
          <constraint id="${MAX_WARRIORS_LIMIT_ID}" type="max" value="${MAX_WARRIORS}" field="selections" scope="roster"/>
        </constraints>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const DATASET = { catalogues: [CATALOGUE_XML] };

/** Ein Roster mit `count` Kriegern — bei `count > 1` reisst die MAX-Grenze. */
function rosterWithWarriors(count) {
  return { forces: [{ defId: WARRIOR_DEF_ID, count, children: [] }] };
}

/** Ein Lauf-Ergebnis, wie {@link summarizeRuns} es erwartet. */
function run({ preparation, iterated = 0, postPass = 0, constraints = 0, treeTotal = 2, rounds = 1 }) {
  const phases = {
    [MeasuredPhase.PREPARATION]: preparation,
    [MeasuredPhase.ITERATED_EVALUATION]: iterated,
    [MeasuredPhase.POST_PASS]: postPass,
    [MeasuredPhase.CONSTRAINTS_AND_REPORT]: constraints,
  };
  return {
    phases,
    totalMs: Object.values(phases).reduce((sum, duration) => sum + duration, 0),
    tree: { total: treeTotal, real: treeTotal, synthetic: 0, syntheticByDefinitionKind: new Map() },
    fixpoint: { rounds, converged: true },
  };
}

describe('median', () => {
  it('liefert bei ungerader Anzahl den mittleren Wert, unabhaengig von der Eingabereihenfolge', () => {
    expect(median([7, 1, 3])).toBe(3);
  });

  it('liefert bei gerader Anzahl das Mittel der beiden mittleren Werte', () => {
    expect(median([1, 3, 5, 11])).toBe(4);
  });

  it('laesst einen einzelnen Ausreisser das Ergebnis nicht verschieben', () => {
    expect(median([10, 10, 10, 10, 1000])).toBe(10);
  });

  it('wirft bei leerer Messreihe statt still etwas zu erfinden', () => {
    expect(() => median([])).toThrow(/leeren Messreihe/);
  });
});

describe('describeTree', () => {
  /** Baut einen Knoten der Form, die die Join-Schicht erzeugt. */
  function node(children, { isPhantom = false, kind = 'entry' } = {}) {
    return { children, isPhantom, def: { kind } };
  }

  it('zaehlt reale und synthetische Knoten getrennt und laesst die Wurzel aus', () => {
    const root = {
      children: [node([node([], { isPhantom: true, kind: 'group' })]), node([], { isPhantom: true, kind: 'categoryLink' })],
    };

    const tree = describeTree(root);

    expect(tree).toMatchObject({ total: 3, real: 1, synthetic: 2 });
  });

  it('schluesselt die synthetischen Knoten nach ihrer Definitionsart auf', () => {
    const root = {
      children: [
        node([], { isPhantom: true, kind: 'group' }),
        node([], { isPhantom: true, kind: 'group' }),
        node([], { isPhantom: true, kind: 'categoryLink' }),
      ],
    };

    expect([...describeTree(root).syntheticByDefinitionKind.entries()]).toEqual([
      ['group', 2],
      ['categoryLink', 1],
    ]);
  });
});

describe('reportFingerprint', () => {
  it('ist unabhaengig von der Reihenfolge der Verletzungen', () => {
    const first = { limitId: 'a', anchor: { defId: 'x' }, actual: 2, bound: 1 };
    const second = { limitId: 'b', anchor: { defId: 'y' }, actual: 3, bound: 1 };
    const capabilities = new Map();

    expect(reportFingerprint({ violations: [first, second], capabilities, diagnostics: [] })).toBe(
      reportFingerprint({ violations: [second, first], capabilities, diagnostics: [] }),
    );
  });

  it('unterscheidet Berichte, die sich im Ist-Wert einer Verletzung unterscheiden', () => {
    const capabilities = new Map();
    const withTwo = { violations: [{ limitId: 'a', anchor: { defId: 'x' }, actual: 2, bound: 1 }], capabilities, diagnostics: [] };
    const withThree = { violations: [{ limitId: 'a', anchor: { defId: 'x' }, actual: 3, bound: 1 }], capabilities, diagnostics: [] };

    expect(reportFingerprint(withTwo)).not.toBe(reportFingerprint(withThree));
  });
});

describe('assessThresholds', () => {
  it('haelt die interaktive Obergrenze knapp darunter ein und reisst sie genau darauf', () => {
    expect(assessThresholds({ totalMs: INTERACTIVE_BUDGET_MS - 1, preparationShare: 0 }).withinInteractiveBudget).toBe(true);
    expect(assessThresholds({ totalMs: INTERACTIVE_BUDGET_MS, preparationShare: 0 }).withinInteractiveBudget).toBe(false);
  });

  it('empfiehlt die zweistufige Fassade erst oberhalb des Vorbereitungsanteils, nicht schon darauf', () => {
    expect(assessThresholds({ totalMs: 1, preparationShare: TWO_STAGE_PREPARATION_SHARE }).facadeShape).toBe(
      FacadeShape.SINGLE_STAGE,
    );
    expect(assessThresholds({ totalMs: 1, preparationShare: TWO_STAGE_PREPARATION_SHARE + 0.01 }).facadeShape).toBe(
      FacadeShape.TWO_STAGE,
    );
  });
});

describe('summarizeRuns', () => {
  it('bildet je Abschnitt den Median und leitet den Vorbereitungsanteil daraus ab', () => {
    const summary = summarizeRuns([
      run({ preparation: 30, iterated: 10 }),
      run({ preparation: 10, iterated: 10 }),
      run({ preparation: 90, iterated: 10 }),
    ]);

    expect(summary.phases[MeasuredPhase.PREPARATION]).toBe(30);
    expect(summary.phases[MeasuredPhase.ITERATED_EVALUATION]).toBe(10);
    expect(summary.totalMs).toBe(40);
    expect(summary.preparationShare).toBeCloseTo(0.75);
    expect(summary.repetitions).toBe(3);
  });

  it('uebernimmt die ergebnisseitigen Kennzahlen unveraendert, weil sie nicht streuen', () => {
    const summary = summarizeRuns([run({ preparation: 5, treeTotal: 9, rounds: 3 }), run({ preparation: 7, treeTotal: 9, rounds: 3 })]);

    expect(summary.tree.total).toBe(9);
    expect(summary.fixpoint).toEqual({ rounds: 3, converged: true });
  });

  it('wirft, wenn zwei Laeufe desselben Falls verschiedene Ergebnisse liefern', () => {
    expect(() => summarizeRuns([run({ preparation: 5, treeTotal: 9 }), run({ preparation: 5, treeTotal: 8 })])).toThrow(
      /verschiedene Ergebnisse/,
    );
  });

  it('wirft ohne einen einzigen Lauf', () => {
    expect(() => summarizeRuns([])).toThrow(/mindestens einen Lauf/);
  });
});

describe('measureEvaluation', () => {
  it('weist alle vier Abschnitte aus und summiert sie zur Gesamtdauer', () => {
    const measurement = measureEvaluation(DATASET, rosterWithWarriors(MAX_WARRIORS + 1));

    for (const phase of Object.values(MeasuredPhase)) {
      expect(measurement.phases[phase], `Abschnitt ${phase} fehlt`).toBeGreaterThanOrEqual(0);
    }
    const sum = Object.values(measurement.phases).reduce((total, duration) => total + duration, 0);
    expect(measurement.totalMs).toBeCloseTo(sum, 10);
  });

  it('meldet den Ausgang der Fixpunktschleife', () => {
    const measurement = measureEvaluation(DATASET, rosterWithWarriors(MAX_WARRIORS));

    expect(measurement.fixpoint.converged).toBe(true);
    expect(measurement.fixpoint.rounds).toBeGreaterThanOrEqual(1);
  });

  it('zaehlt die Knoten des Auswertungsbaums', () => {
    const measurement = measureEvaluation(DATASET, rosterWithWarriors(MAX_WARRIORS));

    expect(measurement.tree.total).toBe(measurement.tree.real + measurement.tree.synthetic);
    expect(measurement.tree.real).toBeGreaterThan(0);
  });

  it('liefert denselben Bericht wie die Fassade — sonst misst das Verfahren eine andere Pipeline', () => {
    const overTheLimit = MAX_WARRIORS + 1;
    const measurement = measureEvaluation(DATASET, rosterWithWarriors(overTheLimit));

    expect(measurement.report.violations).toHaveLength(1);
    expect(measurement.report.violations[0]).toMatchObject({ limitId: MAX_WARRIORS_LIMIT_ID, actual: overTheLimit, bound: MAX_WARRIORS });
    expect(() => assertMatchesFacade(DATASET, rosterWithWarriors(overTheLimit), measurement.report)).not.toThrow();
  });
});

describe('assertMatchesFacade', () => {
  it('wirft mit einem Hinweis auf die Fassade, wenn der Bericht abweicht', () => {
    const foreignReport = { violations: [], capabilities: new Map(), diagnostics: [] };

    expect(() => assertMatchesFacade(DATASET, rosterWithWarriors(MAX_WARRIORS + 1), foreignReport)).toThrow(
      /weicht von der Fassade/,
    );
  });
});
