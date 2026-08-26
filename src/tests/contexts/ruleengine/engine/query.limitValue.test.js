/**
 * Auflösung des `LIMIT_VALUE`-Feldes im Query-Primitiv (`query.js`, Main-Issue 70,
 * Slice 02; Force-Rahmen seit Issue 0147). Eine `limit::<id>`-Regel liest die
 * **eingestellte** Kostengrenze aus dem `RosterBudget` — nicht die verplante
 * Summe aus dem Zaehlindex. Ein `.ros` deklariert sein Budget nur an der
 * Roster-Wurzel; der Scope `roster` UND der Scope `force` loesen deshalb
 * denselben Wert auf, sofern der Force-Rahmen am Knoten aufloesbar ist (ein
 * nicht-`null` `forceRoot`). Ein unaufloesbares Budget liefert nicht still `0`,
 * sondern den {@link UNRESOLVED_BUDGET}-Sentinel samt Diagnose — das gilt
 * weiterhin fuer: eine nicht budgetierte Kostenart, einen Scope, den das Feld
 * gar nicht kennt (weder `roster` noch `force`), und einen `force`-Scope, dessen
 * Rahmen der Query nicht aufloesen kann.
 */

import { describe, it, expect } from 'vitest';
import { query, createQueryContext } from '../../../../contexts/ruleengine/engine/query.js';
import {
  limitValueField,
  costSumField,
  ScopeKeyword,
  UNRESOLVED_BUDGET,
  DiagnosticKind,
  BudgetLimitUnresolvedReason,
} from '../../../../contexts/ruleengine/engine/model.js';
import { createRosterBudget } from '../../../../contexts/ruleengine/engine/rosterBudget.js';

const POINTS = 'pts-id';
const POINTS_LIMIT = 2000;

/** Ein Index, dessen Lesen fehlschlaegt — belegt, dass `LIMIT_VALUE` ihn nie anfasst. */
const forbiddenIndex = {
  get() {
    throw new Error('LIMIT_VALUE darf den Zaehlindex nicht lesen');
  },
};

/**
 * Ein Query-Kontext ueber dem gegebenen Budget; der Zaehlindex ist gesperrt.
 * `forceRoot` waehlt, ob der Knoten einen aufloesbaren Force-Rahmen kennt: kein
 * `forceRoot`-Schluessel (Vorgabe) baut denselben Wurzelknoten wie bisher,
 * `forceRoot: null` einen Knoten mit unaufloesbarem Force-Rahmen, jeder andere
 * Wert einen Knoten mit aufloesbarem Force-Rahmen.
 */
function contextWithBudget(budget, options = {}) {
  const diagnostics = [];
  const node = 'forceRoot' in options ? { isRoot: true, forceRoot: options.forceRoot } : { isRoot: true };
  const ctx = createQueryContext({
    node,
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

  it('loest im Force-Rahmen auf, wenn der Knoten einen aufloesbaren Force-Wurzelknoten kennt (Issue 0147)', () => {
    // Ein `.ros` deklariert sein Budget nur an der Roster-Wurzel: ein aufloesbarer
    // Force-Rahmen liefert deshalb genau denselben Wert wie der Roster-Rahmen.
    const budget = createRosterBudget([{ costTypeId: POINTS, value: POINTS_LIMIT }]);
    const { ctx, diagnostics } = contextWithBudget(budget, { forceRoot: { isRoot: false } });

    const result = query(ctx, limitValueField(POINTS), ScopeKeyword.FORCE, null, { shared: true });

    expect(result).toBe(POINTS_LIMIT);
    expect(diagnostics).toHaveLength(0);
  });

  it('meldet einen unaufloesbaren Force-Rahmen als eigene Diagnose-Ursache (kein forceRoot am Knoten)', () => {
    // Die Kostenart ist budgetiert; allein der unaufloesbare Rahmen macht das Feld
    // unaufloesbar — belegt, dass das Scheitern am Rahmen liegt, nicht an der Suche.
    const budget = createRosterBudget([{ costTypeId: POINTS, value: POINTS_LIMIT }]);
    const { ctx, diagnostics } = contextWithBudget(budget, { forceRoot: null });

    const result = query(ctx, limitValueField(POINTS), ScopeKeyword.FORCE, null, { shared: true });

    expect(result).toBe(UNRESOLVED_BUDGET);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.UNRESOLVED_BUDGET_LIMIT,
        costTypeId: POINTS,
        reason: BudgetLimitUnresolvedReason.UNRESOLVED_FRAME,
        scope: ScopeKeyword.FORCE,
      }),
    );
  });

  it('meldet einen Scope ungleich roster/force (parent) als UNSUPPORTED_SCOPE statt stiller Umdeutung', () => {
    const budget = createRosterBudget([{ costTypeId: POINTS, value: POINTS_LIMIT }]);
    const { ctx, diagnostics } = contextWithBudget(budget);

    const result = query(ctx, limitValueField(POINTS), ScopeKeyword.PARENT, null, { shared: true });

    expect(result).toBe(UNRESOLVED_BUDGET);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.UNRESOLVED_BUDGET_LIMIT,
        costTypeId: POINTS,
        reason: BudgetLimitUnresolvedReason.UNSUPPORTED_SCOPE,
      }),
    );
  });

  it('meldet einen Scope ungleich roster/force (self) ebenso als UNSUPPORTED_SCOPE — die Regel gilt fuer den Zweig, nicht ein Schluesselwort', () => {
    const budget = createRosterBudget([{ costTypeId: POINTS, value: POINTS_LIMIT }]);
    const { ctx, diagnostics } = contextWithBudget(budget);

    const result = query(ctx, limitValueField(POINTS), ScopeKeyword.SELF, null, { shared: true });

    expect(result).toBe(UNRESOLVED_BUDGET);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.UNRESOLVED_BUDGET_LIMIT,
        costTypeId: POINTS,
        reason: BudgetLimitUnresolvedReason.UNSUPPORTED_SCOPE,
      }),
    );
  });

  it('meldet eine nicht budgetierte Kostenart auch im aufloesbaren Force-Rahmen als NOT_BUDGETED, nicht als unaufloesbaren Rahmen', () => {
    // Pinnt die Reihenfolge der beiden Pruefungen: der Rahmen ist aufloesbar, die
    // Kostenart aber nicht budgetiert — die Diagnose muss NOT_BUDGETED tragen.
    const { ctx, diagnostics } = contextWithBudget(createRosterBudget([]), { forceRoot: { isRoot: false } });

    const result = query(ctx, limitValueField(POINTS), ScopeKeyword.FORCE, null, { shared: true });

    expect(result).toBe(UNRESOLVED_BUDGET);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.UNRESOLVED_BUDGET_LIMIT,
        costTypeId: POINTS,
        reason: BudgetLimitUnresolvedReason.NOT_BUDGETED,
      }),
    );
  });

  it('loest im Force-Rahmen unabhaengig vom shared-Flag auf', () => {
    const budget = createRosterBudget([{ costTypeId: POINTS, value: POINTS_LIMIT }]);
    const { ctx, diagnostics } = contextWithBudget(budget, { forceRoot: { isRoot: false } });

    const result = query(ctx, limitValueField(POINTS), ScopeKeyword.FORCE, null, { shared: false });

    expect(result).toBe(POINTS_LIMIT);
    expect(diagnostics).toHaveLength(0);
  });

  it('ein COST_SUM-Feld bleibt unberuehrt und liest weiter den Zaehlindex', () => {
    const budget = createRosterBudget([{ costTypeId: POINTS, value: POINTS_LIMIT }]);
    const { ctx } = contextWithBudget(budget);

    // COST_SUM fasst den (gesperrten) Index an — der Wurf belegt die Trennung der Pfade.
    expect(() => query(ctx, costSumField(POINTS), ScopeKeyword.ROSTER, null, { shared: true })).toThrow();
  });
});
