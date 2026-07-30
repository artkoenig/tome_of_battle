import { describe, test, expect } from 'vitest';
import { computeRosterCounts } from './rosterCounter.js';
import { createQueryContext, measureQuery, MeasureTarget, measureOver, resolveScopeAnchor } from './queryEngine.js';
import { evaluateCondition, getModifiedConstraintValue } from './modifierEvaluator.js';

// ---------------------------------------------------------------------------
// Slice 06 (ADR 0029, §7.7): der Scope→Anker-Resolver (resolveScopeAnchor, L2a)
// ist die EINZIGE scope-bewusste Stelle — für Constraints, Conditions UND Repeats.
// Die Zähl-Frame folgt dem ZIEL-TYP, nicht der Query-Art:
//   - Kategorie-Ziel  → armeeweit über alle Kontingente,
//   - Eintrags-Ziel + scope=force → pro Kontingent,
//   - roster          → armeeweit.
// Diese Tests decken genau die zuvor divergierenden Fälle für Conditions und
// Repeats an einem MEHR-KONTINGENT-Roster ab und zeigen den Constraint-Gleichlauf.
// ---------------------------------------------------------------------------

const CATALOGUE_ID = 'cat-1';
const SPECIAL_UNIT_ID = 'special-unit';
const ELITE_CATEGORY_ID = 'cat-elite';
const FORCE_EMPTY = 'f-empty';
const FORCE_WITH_UNIT = 'f-with-unit';

const system = {
  id: 'sys-1',
  categoryEntries: [{ id: ELITE_CATEGORY_ID, name: 'Elite' }],
  catalogues: [{
    id: CATALOGUE_ID,
    selectionEntries: [{
      id: SPECIAL_UNIT_ID,
      name: 'Special Unit',
      type: 'unit',
      categoryLinks: [{ targetId: ELITE_CATEGORY_ID, primary: true }]
    }]
  }]
};

// Genau eine Instanz des Elite-Eintrags, ausschließlich im zweiten Kontingent.
const roster = {
  catalogueId: CATALOGUE_ID,
  forces: [
    { id: FORCE_EMPTY, catalogueId: CATALOGUE_ID, selections: [] },
    {
      id: FORCE_WITH_UNIT, catalogueId: CATALOGUE_ID,
      selections: [{ id: 's-1', selectionEntryId: SPECIAL_UNIT_ID, number: 1, selections: [] }]
    }
  ]
};

const counts = computeRosterCounts(roster, system);

/** Ein flacher Auswertungs-Kontext, wie ihn der Validator je Kontingent baut. */
const ctxForForce = (forceId) => ({
  system, roster, counts, force: { id: forceId }, parentCatalogueId: CATALOGUE_ID
});

test('Vorbedingung: der Elite-Eintrag steht nur im zweiten Kontingent', () => {
  expect(counts.selectionCounts[SPECIAL_UNIT_ID]).toBe(1);
  expect(counts.selectionCounts[ELITE_CATEGORY_ID]).toBe(1);
  expect(counts.forceSelectionCounts[FORCE_WITH_UNIT][SPECIAL_UNIT_ID]).toBe(1);
  expect(counts.forceSelectionCounts[FORCE_EMPTY]?.[SPECIAL_UNIT_ID]).toBeUndefined();
});

describe('Condition — Eintrags-Ziel mit scope=force zählt PRO KONTINGENT', () => {
  const forceEntryCondition = {
    type: 'atLeast', value: 1, field: 'selections', scope: 'force', childId: SPECIAL_UNIT_ID
  };

  test('im leeren Kontingent nicht erfüllt (der Eintrag steht im anderen)', () => {
    expect(evaluateCondition(forceEntryCondition, ctxForForce(FORCE_EMPTY))).toBe(false);
  });

  test('im Kontingent mit dem Eintrag erfüllt', () => {
    expect(evaluateCondition(forceEntryCondition, ctxForForce(FORCE_WITH_UNIT))).toBe(true);
  });

  test('scope=roster zählt denselben Eintrag armeeweit — in jedem Kontingent erfüllt', () => {
    const rosterEntryCondition = { ...forceEntryCondition, scope: 'roster' };
    expect(evaluateCondition(rosterEntryCondition, ctxForForce(FORCE_EMPTY))).toBe(true);
    expect(evaluateCondition(rosterEntryCondition, ctxForForce(FORCE_WITH_UNIT))).toBe(true);
  });
});

describe('Condition — Kategorie-Ziel zählt ARMEEWEIT, auch unter scope=force (§7.7)', () => {
  const forceCategoryCondition = {
    type: 'atLeast', value: 1, field: 'selections', scope: 'force', childId: ELITE_CATEGORY_ID
  };

  test('im leeren Kontingent trotzdem erfüllt — die Kategorie ist armeeweit belegt', () => {
    expect(evaluateCondition(forceCategoryCondition, ctxForForce(FORCE_EMPTY))).toBe(true);
  });

  test('im belegten Kontingent ebenso erfüllt', () => {
    expect(evaluateCondition(forceCategoryCondition, ctxForForce(FORCE_WITH_UNIT))).toBe(true);
  });
});

describe('Repeat — dieselbe Ziel-Typ-Regel wie die Condition', () => {
  const INCREMENT = 5;
  const CONSTRAINT_ID = 'con';
  const repeatFires = (repeat, ctx) => {
    const value = getModifiedConstraintValue(
      { id: CONSTRAINT_ID, value: 0 },
      [{ field: CONSTRAINT_ID, type: 'increment', valueObject: INCREMENT, repeat }],
      ctx
    );
    return value === INCREMENT;
  };

  test('Eintrags-Ziel + scope=force: nur im Kontingent mit dem Eintrag ausgelöst', () => {
    const repeat = { scope: 'force', childId: SPECIAL_UNIT_ID, value: 1, repeats: 1 };
    expect(repeatFires(repeat, ctxForForce(FORCE_EMPTY))).toBe(false);
    expect(repeatFires(repeat, ctxForForce(FORCE_WITH_UNIT))).toBe(true);
  });

  test('Kategorie-Ziel: armeeweit, daher in jedem Kontingent ausgelöst (§7.7)', () => {
    const repeat = { scope: 'force', childId: ELITE_CATEGORY_ID, value: 1, repeats: 1 };
    expect(repeatFires(repeat, ctxForForce(FORCE_EMPTY))).toBe(true);
    expect(repeatFires(repeat, ctxForForce(FORCE_WITH_UNIT))).toBe(true);
  });
});

describe('Constraint — eine kategoriezählende Constraint zählt nun ebenfalls armeeweit', () => {
  // Ein Kategorie-scope-Constraint (ENTRY_BUCKET) misst über resolveScopeAnchor die
  // armeeweite selectionCounts-Tabelle — auch im leeren Kontingent, in dem die Kategorie
  // gar nicht belegt ist. Das ist der Gleichlauf mit der Condition (§7.7).
  const categoryConstraint = { scope: ELITE_CATEGORY_ID, field: 'selections' };
  const nullSubject = (forceId) => ({
    selection: null, parentSelection: null, force: { id: forceId }, entry: null, entryId: null
  });
  const queryCtx = createQueryContext({ roster, system, counts, forceCatalogueId: CATALOGUE_ID });

  test('armeeweit im belegten wie im leeren Kontingent (identischer Zählwert)', () => {
    const inEmpty = measureQuery(categoryConstraint, nullSubject(FORCE_EMPTY), queryCtx).value;
    const inPopulated = measureQuery(categoryConstraint, nullSubject(FORCE_WITH_UNIT), queryCtx).value;
    expect(inEmpty).toBe(1);
    expect(inPopulated).toBe(1);
  });

  test('ein force-scoped ENTRAGS-Constraint bleibt hingegen pro Kontingent', () => {
    const forceEntryConstraint = { scope: 'force', field: 'selections' };
    const subjectFor = (forceId) => ({
      selection: null, parentSelection: null, force: { id: forceId }, entry: null, entryId: SPECIAL_UNIT_ID
    });
    const anchorEmpty = resolveScopeAnchor(forceEntryConstraint, subjectFor(FORCE_EMPTY), queryCtx);
    const anchorPopulated = resolveScopeAnchor(forceEntryConstraint, subjectFor(FORCE_WITH_UNIT), queryCtx);
    expect(measureOver(anchorEmpty, { target: MeasureTarget.INSTANCES, subject: subjectFor(FORCE_EMPTY), ctx: queryCtx })).toBe(0);
    expect(measureOver(anchorPopulated, { target: MeasureTarget.INSTANCES, subject: subjectFor(FORCE_WITH_UNIT), ctx: queryCtx })).toBe(1);
  });
});
