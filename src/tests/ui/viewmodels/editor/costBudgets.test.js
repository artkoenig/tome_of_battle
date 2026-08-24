import { describe, it, expect } from 'vitest';

import { costBudgetTextsOf, hasExceededCostBudget } from '../../../../ui/viewmodels/editor/costBudgets';

/**
 * Die Kosten-Budgets eines Slots sind ein reiner Lookup auf den Bericht
 * (ADR-0034): gemessen und gedeckelt hat die Engine, hier wird abgelesen.
 */

const SYSTEM = { costTypes: [{ id: 'pts', name: 'pts' }] };

const limit = (overrides) => ({
  kind: 'max', measure: 'costSum', costTypeId: 'pts',
  current: 12, bound: 50, satisfied: true,
  ...overrides,
});

describe('costBudgetTextsOf', () => {
  it('benennt jede kostenbezogene Höchstgrenze mit Stand, Grenze und Kostenart', () => {
    expect(costBudgetTextsOf({ costLimits: [limit()] }, SYSTEM)).toEqual(['12 / 50 pts']);
  });

  it('lässt ein Mindestmaß und eine nicht kostenbezogene Grenze weg', () => {
    const capability = {
      costLimits: [limit({ kind: 'min' }), limit({ measure: 'count' })],
    };
    expect(costBudgetTextsOf(capability, SYSTEM)).toEqual([]);
  });

  it('bleibt ohne Slot und ohne Grenzen leer', () => {
    expect(costBudgetTextsOf(undefined, SYSTEM)).toEqual([]);
    expect(costBudgetTextsOf({ costLimits: [] }, SYSTEM)).toEqual([]);
  });
});

describe('hasExceededCostBudget', () => {
  it('meldet ein gerissenes Budget, so wie die Engine es sagt', () => {
    expect(hasExceededCostBudget({ costLimits: [limit({ satisfied: false })] })).toBe(true);
  });

  it('meldet ein Budget genau am Anschlag nicht als Fehler', () => {
    expect(hasExceededCostBudget({ costLimits: [limit({ current: 50 })] })).toBe(false);
    expect(hasExceededCostBudget(null)).toBe(false);
  });
});
