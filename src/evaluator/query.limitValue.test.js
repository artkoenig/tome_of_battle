/**
 * Auflösung des `LIMIT_VALUE`-Feldes im Query-Primitiv (`query.js`, Main-Issue 70,
 * Slice 02). Eine `limit::<id>`-Regel liest die **eingestellte** Kostengrenze aus
 * dem `RosterBudget` — nicht die verplante Summe aus dem Zaehlindex. Ein
 * unaufloesbares Budget liefert nicht still `0`, sondern den
 * {@link UNRESOLVED_BUDGET}-Sentinel samt Diagnose; ein Scope ungleich `roster`
 * ebenso.
 */

import { describe, it, expect } from 'vitest';
import { query, createQueryContext } from './query.js';
import {
  limitValueField,
  costSumField,
  ScopeKeyword,
  UNRESOLVED_BUDGET,
  DiagnosticKind,
  BudgetLimitUnresolvedReason,
} from './model.js';
import { createRosterBudget } from './rosterBudget.js';

const POINTS = 'pts-id';
const POINTS_LIMIT = 2000;

/** Ein Index, dessen Lesen fehlschlaegt — belegt, dass `LIMIT_VALUE` ihn nie anfasst. */
const forbiddenIndex = {
  get() {
    throw new Error('LIMIT_VALUE darf den Zaehlindex nicht lesen');
  },
};

/** Ein Query-Kontext ueber dem gegebenen Budget; der Zaehlindex ist gesperrt. */
function contextWithBudget(budget) {
  const diagnostics = [];
  const ctx = createQueryContext({
    node: { isRoot: true },
    root: { isRoot: true },
    index: forbiddenIndex,
    categoryIds: new Set(),
    diagnostics,
    budget,
  });
  return { ctx, diagnostics };
}

describe('query LIMIT_VALUE: eingestellte Grenze aus dem Budget', () => {
  it('liefert die eingestellte Grenze der Kostenart, ohne den Zaehlindex zu lesen', () => {
    const budget = createRosterBudget([{ costTypeId: POINTS, value: POINTS_LIMIT }]);
    const { ctx, diagnostics } = contextWithBudget(budget);

    const result = query(ctx, limitValueField(POINTS), ScopeKeyword.ROSTER, null, { shared: true });

    expect(result).toBe(POINTS_LIMIT);
    expect(diagnostics).toHaveLength(0);
  });

  it('ignoriert die Ziel-ID (childId) — die Grenze ist roster-weit je Kostenart', () => {
    const budget = createRosterBudget([{ costTypeId: POINTS, value: POINTS_LIMIT }]);
    const { ctx } = contextWithBudget(budget);

    // childId="any" (wie in den echten Daten) darf die Auflösung nicht stoeren.
    expect(query(ctx, limitValueField(POINTS), ScopeKeyword.ROSTER, 'any', { shared: true })).toBe(POINTS_LIMIT);
  });

  it('meldet eine nicht budgetierte Kostenart als UNRESOLVED_BUDGET_LIMIT statt 0', () => {
    const { ctx, diagnostics } = contextWithBudget(createRosterBudget([]));

    const result = query(ctx, limitValueField(POINTS), ScopeKeyword.ROSTER, null, { shared: true });

    expect(result).toBe(UNRESOLVED_BUDGET);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.UNRESOLVED_BUDGET_LIMIT,
        costTypeId: POINTS,
        reason: BudgetLimitUnresolvedReason.NOT_BUDGETED,
      }),
    );
  });

  it('meldet einen Scope ungleich roster als Diagnose statt stiller Umdeutung', () => {
    // Die Kostenart ist budgetiert; allein der abweichende Scope macht das Feld unaufloesbar.
    const budget = createRosterBudget([{ costTypeId: POINTS, value: POINTS_LIMIT }]);
    const { ctx, diagnostics } = contextWithBudget(budget);

    const result = query(ctx, limitValueField(POINTS), ScopeKeyword.FORCE, null, { shared: true });

    expect(result).toBe(UNRESOLVED_BUDGET);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.UNRESOLVED_BUDGET_LIMIT,
        costTypeId: POINTS,
        reason: BudgetLimitUnresolvedReason.NON_ROSTER_SCOPE,
      }),
    );
  });

  it('ein COST_SUM-Feld bleibt unberuehrt und liest weiter den Zaehlindex', () => {
    const budget = createRosterBudget([{ costTypeId: POINTS, value: POINTS_LIMIT }]);
    const { ctx } = contextWithBudget(budget);

    // COST_SUM fasst den (gesperrten) Index an — der Wurf belegt die Trennung der Pfade.
    expect(() => query(ctx, costSumField(POINTS), ScopeKeyword.ROSTER, null, { shared: true })).toThrow();
  });
});
