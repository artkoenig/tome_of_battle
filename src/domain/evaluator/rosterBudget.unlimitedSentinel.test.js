/**
 * Issue 0096: Der Roster-Kostengrenzen-Sentinel `-1` bedeutet **„unbegrenzt"**
 * (`docs/battlescribe-data-format.md` §5.3 — dieselbe Konvention wie
 * `defaultCostLimit`, die der Katalog-Leser bereits ueber
 * {@link unlimitedFromSentinel} deutet: **genau** `-1`, kein anderer negativer
 * Wert). Der Roster-Pfad muss ihn genauso deuten:
 *
 * 1. Die Budget-Regel „Armee zu teuer" (`budget.js`) meldet fuer eine auf `-1`
 *    eingestellte Kostenart **keine** Verletzung — egal wie teuer die Armee ist.
 * 2. `limit::<costTypeId>` (`query.js`) behandelt eine auf `-1` eingestellte
 *    Kostenart wie eine **nicht budgetierte**: fail-closed mit
 *    {@link UNRESOLVED_BUDGET}-Sentinel samt Diagnose — nie als Vergleichswert `-1`.
 * 3. Ein `.ros` mit `costLimit value="-1.0"` laeuft durch Fixture-Parser und
 *    Fassade ohne Budget-Falschmeldung.
 *
 * Kontroll-Tests (duerfen schon heute gruen sein) sind als solche markiert: sie
 * pinnen die Sentinel-Konvention „nur genau -1" und die intakte Verdrahtung der
 * Fixtures.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { evaluate, prepareDataset } from './evaluator.js';
import { evaluateRosterBudget } from './budget.js';
import { query, createQueryContext } from './query.js';
import {
  scopeKey,
  ScopeKeyword,
  LimitMeasure,
  limitValueField,
  rosterBudgetLimitId,
  UNRESOLVED_BUDGET,
  DiagnosticKind,
} from './model.js';
import { createRosterBudget } from './rosterBudget.js';
import { rosterFromRos } from './__fixtures__/rosParser.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const POINTS = 'points-cost-type';
const MANA = 'mana-cost-type';

/**
 * Ein Zaehlindex-Fake wie in `budget.test.js`: liefert die verplanten Summen je
 * Kostenart nur am ROSTER-Rahmen mit den Gesamt-Flags; jeder andere Zugriff
 * liest leer.
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

// ── Kriterium 1: Budget-Regel — `-1` ist keine echte Grenze ──────────────────

describe('evaluateRosterBudget: eingestellte Grenze -1 bedeutet „unbegrenzt"', () => {
  it('meldet keine Verletzung fuer eine auf -1 eingestellte Kostenart, egal wie hoch die Summe', () => {
    const index = indexWithRosterSums({ [POINTS]: 2200 });
    const budget = createRosterBudget([{ costTypeId: POINTS, value: -1 }]);

    expect(evaluateRosterBudget(index, budget)).toHaveLength(0);
  });

  it('laesst eine echte Grenze neben dem Sentinel unberuehrt: nur die ueberschrittene echte Grenze meldet', () => {
    // Punkte unbegrenzt (-1, Summe 2200 → keine Meldung), Mana echt begrenzt
    // (50, Summe 60 → genau eine Meldung).
    const index = indexWithRosterSums({ [POINTS]: 2200, [MANA]: 60 });
    const budget = createRosterBudget([
      { costTypeId: POINTS, value: -1 },
      { costTypeId: MANA, value: 50 },
    ]);

    const violations = evaluateRosterBudget(index, budget);

    expect(violations).toHaveLength(1);
    expect(violations[0].limit.id).toBe(rosterBudgetLimitId(MANA));
    expect(violations[0].bound).toBe(50);
  });

  it('KONTROLLE (darf schon gruen sein): ein anderer negativer Wert ist KEIN Sentinel und bleibt echte Grenze', () => {
    // Die Sentinel-Konvention (model.js, unlimitedFromSentinel) deutet **genau**
    // -1 um; -2 bleibt eine hingeschriebene Zahl — jede Summe >= 0 uebersteigt sie.
    const index = indexWithRosterSums({ [POINTS]: 0 });
    const budget = createRosterBudget([{ costTypeId: POINTS, value: -2 }]);

    const violations = evaluateRosterBudget(index, budget);

    expect(violations).toHaveLength(1);
    expect(violations[0].bound).toBe(-2);
  });
});

// ── Kriterium 2: `limit::<id>` — fail-closed statt Vergleichswert -1 ─────────

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

describe('query LIMIT_VALUE: eingestellte Grenze -1 loest fail-closed auf, nie als Zahl -1', () => {
  it('liefert den UNRESOLVED_BUDGET-Sentinel samt Diagnose — wie fuer eine nicht budgetierte Kostenart', () => {
    const budget = createRosterBudget([{ costTypeId: POINTS, value: -1 }]);
    const { ctx, diagnostics } = contextWithBudget(budget);

    const result = query(ctx, limitValueField(POINTS), ScopeKeyword.ROSTER, null, { shared: true });

    // Nie der rohe Sentinel-Zahlwert — sonst feuerte z. B. `lessThan limit::pts 3000`,
    // als waere die Grenze -1.
    expect(result).not.toBe(-1);
    expect(result).toBe(UNRESOLVED_BUDGET);
    // Der fail-closed-Pfad meldet sich, statt still zu verschwinden. Die genaue
    // `reason` bleibt offen (NOT_BUDGETED oder eine eigene) — Art und Kostenart
    // muessen stimmen.
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.UNRESOLVED_BUDGET_LIMIT,
        costTypeId: POINTS,
      }),
    );
  });

  it('KONTROLLE (darf schon gruen sein): eine echte Grenze liefert weiter ihren Zahlwert ohne Diagnose', () => {
    const budget = createRosterBudget([{ costTypeId: POINTS, value: 2000 }]);
    const { ctx, diagnostics } = contextWithBudget(budget);

    expect(query(ctx, limitValueField(POINTS), ScopeKeyword.ROSTER, null, { shared: true })).toBe(2000);
    expect(diagnostics).toHaveLength(0);
  });

  it('gilt genauso im Force-Rahmen (Issue 0147): -1 loest fail-closed auf, nie als Zahl -1', () => {
    const budget = createRosterBudget([{ costTypeId: POINTS, value: -1 }]);
    const diagnostics = [];
    const ctx = createQueryContext({
      node: { isRoot: true, forceRoot: { isRoot: false } },
      root: { isRoot: true },
      index: forbiddenIndex,
      categoryIds: new Set(),
      diagnostics,
      budget,
    });

    const result = query(ctx, limitValueField(POINTS), ScopeKeyword.FORCE, null, { shared: true });

    expect(result).not.toBe(-1);
    expect(result).toBe(UNRESOLVED_BUDGET);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.UNRESOLVED_BUDGET_LIMIT,
        costTypeId: POINTS,
      }),
    );
  });
});

// ── Kriterium 3: `.ros` mit costLimit value="-1.0" durch Parser + Fassade ────

const FORCE_DEF_ID = 'force-army';
const WARRIOR_DEF_ID = 'entry-warrior';

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-unlimited-budget" name="Unlimited Budget Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Army"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
        <costs><cost name="pts" typeId="${POINTS}" value="10"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Eine `.ros`-Datei mit dem gegebenen `costLimit`-value-Attribut, wie BattleScribe sie schreibt. */
function rosXmlWithCostLimitValue(value) {
  return `<?xml version="1.0" encoding="utf-8"?>
<roster name="Unlimited Budget Roster">
  <costLimits>
    <costLimit typeId="${POINTS}" value="${value}" name="pts"/>
  </costLimits>
  <forces>
    <force entryId="${FORCE_DEF_ID}" name="Army">
      <selections>
        <selection entryId="${WARRIOR_DEF_ID}" name="Warrior" number="2"/>
      </selections>
    </force>
  </forces>
</roster>`;
}

const dir = mkdtempSync(join(tmpdir(), 'ros-unlimited-costlimit-'));

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Schreibt die `.ros`, parst sie ueber den Fixture-Parser und wertet gegen den Katalog aus. */
function evaluateRosWithCostLimitValue(value) {
  const rosPath = join(dir, `fixture-${value}.ros`);
  writeFileSync(rosPath, rosXmlWithCostLimitValue(value), 'utf8');
  const roster = rosterFromRos(rosPath);
  return evaluate(prepareDataset({ catalogues: [CATALOGUE_XML] }), roster);
}

/** Die roster-weiten Budget-Meldungen („Armee zu teuer") des Berichts. */
function rosterBudgetViolationsOf(report) {
  return report.violations.filter(
    message => message.limit?.measure === LimitMeasure.ROSTER_BUDGET,
  );
}

describe('.ros mit costLimit value="-1.0": Auswertung ohne Budget-Falschmeldung', () => {
  it('meldet fuer eine nicht-leere Armee keine „Armee zu teuer"-Verletzung', () => {
    const report = evaluateRosWithCostLimitValue('-1.0');

    // 2 × 10 Punkte sind verplant; die Grenze -1.0 heisst „unbegrenzt" — der
    // heutige Stand meldet hier faelschlich „Armee zu teuer" mit bound -1.
    expect(rosterBudgetViolationsOf(report)).toEqual([]);
  });

  it('KONTROLLE (darf schon gruen sein): dieselbe .ros mit echter Grenze 15 meldet die Ueberschreitung', () => {
    // Belegt, dass Fixture-Verdrahtung und Budget-Regel intakt sind — die
    // Abwesenheit der Meldung oben liegt also am Sentinel, nicht an toter Verdrahtung.
    const report = evaluateRosWithCostLimitValue('15.0');

    const violations = rosterBudgetViolationsOf(report);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: 20, bound: 15 });
  });
});
