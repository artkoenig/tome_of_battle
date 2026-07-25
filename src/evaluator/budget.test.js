/**
 * Isolierte Tests der Regel „Armee zu teuer" (`budget.js`, Main-Issue 68,
 * Slice 03). Der Zaehlindex wird durch einen schlanken Fake ersetzt, damit die
 * Regel unabhaengig von der Baum-/Index-Pipeline geprueft werden kann: sie liest
 * die verplante Summe je Kostenart am ROSTER-Rahmen und vergleicht sie gegen die
 * eingestellte Grenze.
 */

import { describe, it, expect } from 'vitest';
import { evaluateRosterBudget } from './budget.js';
import {
  scopeKey,
  ScopeKeyword,
  rosterBudgetLimitId,
  ROSTER_BUDGET_ANCHOR_ID,
  ROSTER_BUDGET_ANCHOR_NAME,
} from './model.js';
import { createRosterBudget } from './rosterBudget.js';

const POINTS = 'points-cost-type';
const MANA = 'mana-cost-type';

/**
 * Ein Zaehlindex-Fake, der die uebergebenen verplanten Summen je Kostenart nur
 * am ROSTER-Rahmen (`scopeKey(ROSTER, null)`) mit den Gesamt-Flags liefert — genau
 * der eine Zugriff, den die Budget-Regel macht. Jeder andere Zugriff liefert
 * einen leeren Zaehler, sodass ein falscher Rahmen im Test sichtbar 0 laese.
 */
function indexWithRosterSums(costSumsByType) {
  const rosterKey = scopeKey(ScopeKeyword.ROSTER, null);
  return {
    get(key, includeChildSelections, includeChildForces) {
      const isWholeRoster = key === rosterKey && includeChildSelections && includeChildForces;
      const costSums = isWholeRoster
        ? new Map(Object.entries(costSumsByType))
        : new Map();
      return { selectionCount: 0, costSums };
    },
  };
}

describe('evaluateRosterBudget — Regel „Armee zu teuer"', () => {
  it('meldet eine roster-weite Verletzung, wenn die Summe die Grenze uebersteigt', () => {
    const index = indexWithRosterSums({ [POINTS]: 2200 });
    const budget = createRosterBudget([{ costTypeId: POINTS, value: 2000 }]);

    const violations = evaluateRosterBudget(index, budget);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual({
      limit: { id: rosterBudgetLimitId(POINTS) },
      anchor: { def: { id: ROSTER_BUDGET_ANCHOR_ID, name: ROSTER_BUDGET_ANCHOR_NAME } },
      actual: 2200,
      bound: 2000,
      satisfied: false,
      delta: 2000 - 2200,
    });
  });

  it('meldet keine Verletzung genau auf der Grenze (kein Ueberschreiten)', () => {
    const index = indexWithRosterSums({ [POINTS]: 2000 });
    const budget = createRosterBudget([{ costTypeId: POINTS, value: 2000 }]);

    expect(evaluateRosterBudget(index, budget)).toHaveLength(0);
  });

  it('meldet keine Verletzung unter der Grenze', () => {
    const index = indexWithRosterSums({ [POINTS]: 1500 });
    const budget = createRosterBudget([{ costTypeId: POINTS, value: 2000 }]);

    expect(evaluateRosterBudget(index, budget)).toHaveLength(0);
  });

  it('prueft jede Kostenart gegen ihre eigene Grenze (mehrere Grenzen)', () => {
    // Punkte ueberschritten (2200 > 2000), Mana innerhalb (40 <= 50).
    const index = indexWithRosterSums({ [POINTS]: 2200, [MANA]: 40 });
    const budget = createRosterBudget([
      { costTypeId: POINTS, value: 2000 },
      { costTypeId: MANA, value: 50 },
    ]);

    const violations = evaluateRosterBudget(index, budget);

    expect(violations).toHaveLength(1);
    expect(violations[0].limit.id).toBe(rosterBudgetLimitId(POINTS));
    expect(violations[0].actual).toBe(2200);
    expect(violations[0].bound).toBe(2000);
  });

  it('meldet eine Verletzung je ueberschrittener Kostenart', () => {
    const index = indexWithRosterSums({ [POINTS]: 2200, [MANA]: 60 });
    const budget = createRosterBudget([
      { costTypeId: POINTS, value: 2000 },
      { costTypeId: MANA, value: 50 },
    ]);

    const violations = evaluateRosterBudget(index, budget);

    expect(violations).toHaveLength(2);
    expect(violations.map(violation => violation.limit.id)).toEqual([
      rosterBudgetLimitId(POINTS),
      rosterBudgetLimitId(MANA),
    ]);
  });

  it('nimmt eine nicht verplante, aber budgetierte Kostenart als Summe 0 (keine Verletzung)', () => {
    const index = indexWithRosterSums({}); // niemand traegt Punkte
    const budget = createRosterBudget([{ costTypeId: POINTS, value: 2000 }]);

    expect(evaluateRosterBudget(index, budget)).toHaveLength(0);
  });

  it('meldet nichts fuer ein leeres Budget (keine eingestellten Grenzen)', () => {
    const index = indexWithRosterSums({ [POINTS]: 9999 });
    const budget = createRosterBudget();

    expect(evaluateRosterBudget(index, budget)).toHaveLength(0);
  });
});
