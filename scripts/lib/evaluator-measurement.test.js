import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import {
  FacadeShape,
  INTERACTIVE_BUDGET_MS,
  TWO_STAGE_PREPARATION_SHARE,
  measureEvaluation,
  median,
  summarizeRuns,
  assessThresholds,
} from './evaluator-measurement.js';
// Die Namen der Abschnitte und der Ankerarten gehoeren der Engine; das
// Messgeraet liest sie von der Fassade, also liest dieser Test sie von dort.
import { MeasuredPhase } from '../../src/evaluator/evaluator.js';
import { AnchorKind } from '../../src/evaluator/model.js';

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
    tree: { total: treeTotal, real: treeTotal, synthetic: 0, byAnchorKind: { [AnchorKind.OCCUPIED]: treeTotal } },
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

    // Die Reihenfolge ist die der Fassade: Vorbereitung, dann die drei Abschnitte
    // der Auswertung — die Vorbereitung faellt im ersten Fassaden-Schritt an.
    expect(Object.keys(measurement.phases)).toEqual(Object.values(MeasuredPhase));
    for (const phase of Object.values(MeasuredPhase)) {
      expect(measurement.phases[phase], `Abschnitt ${phase} fehlt`).toBeGreaterThanOrEqual(0);
    }
    const sum = Object.values(measurement.phases).reduce((total, duration) => total + duration, 0);
    expect(measurement.totalMs).toBeCloseTo(sum, 10);
  });

  it('meldet den Ausgang der Fixpunktschleife, wie die Engine ihn ausweist', () => {
    const measurement = measureEvaluation(DATASET, rosterWithWarriors(MAX_WARRIORS));

    expect(measurement.fixpoint.converged).toBe(true);
    expect(measurement.fixpoint.rounds).toBeGreaterThanOrEqual(1);
    expect(measurement.fixpoint.nonConvergence).toBeNull();
  });

  it('liest die Knotenzahlen des Auswertungsbaums aus der Metadata', () => {
    const measurement = measureEvaluation(DATASET, rosterWithWarriors(MAX_WARRIORS));

    expect(measurement.tree.total).toBe(measurement.tree.real + measurement.tree.synthetic);
    expect(measurement.tree.real).toBeGreaterThan(0);
    // Jede Ankerart ist gefuehrt, auch die im Fall nicht vorkommenden.
    expect(Object.keys(measurement.tree.byAnchorKind).sort()).toEqual(Object.values(AnchorKind).sort());
  });

  it('misst eine echte Auswertung — der Bericht traegt die gerissene Grenze', () => {
    const overTheLimit = MAX_WARRIORS + 1;
    const measurement = measureEvaluation(DATASET, rosterWithWarriors(overTheLimit));

    expect(measurement.report.violations).toHaveLength(1);
    expect(measurement.report.violations[0]).toMatchObject({ limitId: MAX_WARRIORS_LIMIT_ID, actual: overTheLimit, bound: MAX_WARRIORS });
  });
});
