import { describe, test, expect } from 'vitest';
import {
  isPercentConstraint,
  isCostField,
  collectScopeSelections,
  getScopeReferenceTotal,
  resolveConstraintThreshold,
  formatConstraintLimit
} from './constraintScope.js';

// Generic, schema-shaped fixture: a two-force roster whose entries carry points
// so both selection-count and points references can be exercised.
const system = {
  id: 'sys',
  costTypes: [{ id: 'pts', name: 'Points' }],
  catalogues: [
    {
      id: 'cat',
      selectionEntries: [
        { id: 'lord', name: 'Lord', type: 'unit', costs: [{ typeId: 'pts', value: 100 }] },
        { id: 'trooper', name: 'Trooper', type: 'unit', costs: [{ typeId: 'pts', value: 50 }] },
        { id: 'banner', name: 'Banner', type: 'upgrade', costs: [{ typeId: 'pts', value: 20 }] }
      ]
    }
  ]
};

const makeRoster = () => ({
  id: 'r', catalogueId: 'cat', costLimit: 1000, costLimitType: 'pts',
  forces: [
    {
      id: 'f1', catalogueId: 'cat',
      selections: [
        {
          id: 's-lord', name: 'Lord', selectionEntryId: 'lord', entryLinkId: null, number: 1,
          selections: [
            { id: 's-banner', name: 'Banner', selectionEntryId: 'banner', entryLinkId: null, number: 1, selections: [] }
          ]
        },
        { id: 's-troop-a', name: 'Trooper', selectionEntryId: 'trooper', entryLinkId: null, number: 2, selections: [] }
      ]
    },
    {
      id: 'f2', catalogueId: 'cat',
      selections: [
        { id: 's-troop-b', name: 'Trooper', selectionEntryId: 'trooper', entryLinkId: null, number: 3, selections: [] }
      ]
    }
  ]
});

describe('isPercentConstraint', () => {
  test('true for the schema-valid percentValue flag', () => {
    expect(isPercentConstraint({ type: 'max', percentValue: true })).toBe(true);
  });
  test('true for the legacy percent pseudo-type', () => {
    expect(isPercentConstraint({ type: 'percent' })).toBe(true);
  });
  test('false for a plain absolute min/max constraint', () => {
    expect(isPercentConstraint({ type: 'max', percentValue: false })).toBe(false);
    expect(isPercentConstraint({ type: 'min' })).toBe(false);
  });
});

describe('isCostField', () => {
  test('a declared cost type is a cost field', () => {
    expect(isCostField('pts', system)).toBe(true);
  });
  test('selections and unknown fields are not cost fields', () => {
    expect(isCostField('selections', system)).toBe(false);
    expect(isCostField(undefined, system)).toBe(false);
    expect(isCostField('unknown', system)).toBe(false);
  });
  // No cost-type id may be assumed: `cost/@typeId` references an id the
  // catalogue author picks freely, so an id the system does not declare is an
  // unknown field — not points by virtue of being spelled `'pts'`.
  test('an undeclared field is not a cost field, however it is spelled', () => {
    const systemWithoutPoints = { id: 'sys', costTypes: [{ id: 'guid-casting-dice', name: ' Casting Dice' }] };

    expect(isCostField('pts', systemWithoutPoints)).toBe(false);
    expect(isCostField('ecfa-8486-4f6c-c249', systemWithoutPoints)).toBe(false);
  });
  test('the roster cost-limit type is a cost field even when undeclared', () => {
    const systemWithoutPoints = { id: 'sys', costTypes: [] };

    expect(isCostField('guid-points', systemWithoutPoints, { costLimitType: 'guid-points' })).toBe(true);
  });
});

// countSelections is a roster-tree primitive and is covered by rosterTree.test.js.

describe('collectScopeSelections', () => {
  const roster = makeRoster();
  const force1 = roster.forces[0];

  test('roster scope spans every force', () => {
    expect(collectScopeSelections({ roster, force: force1, scope: 'roster' })).toHaveLength(3);
  });

  test('force scope is limited to the subject force', () => {
    expect(collectScopeSelections({ roster, force: force1, scope: 'force' })).toHaveLength(2);
  });

  test('includeChildForces widens force scope to the whole roster', () => {
    expect(collectScopeSelections({ roster, force: force1, scope: 'force', includeChildForces: true })).toHaveLength(3);
  });

  test('parent scope uses the parent selection children', () => {
    const parentSelection = force1.selections[0];
    expect(collectScopeSelections({ roster, force: force1, scope: 'parent', parentSelection })).toHaveLength(1);
  });
});

describe('getScopeReferenceTotal', () => {
  const roster = makeRoster();
  const force1 = roster.forces[0];

  test('roster percentage of the limited cost type uses the points budget', () => {
    const constraint = { field: 'pts', scope: 'roster' };
    expect(getScopeReferenceTotal({ constraint, roster, system, force: force1 })).toBe(1000);
  });

  test('force cost reference sums the force points', () => {
    const constraint = { field: 'pts', scope: 'force' };
    // lord 100 + banner 20 + trooper 50*2 = 220
    expect(getScopeReferenceTotal({ constraint, roster, system, force: force1, forceCatalogueId: 'cat' })).toBe(220);
  });

  test('includeChildForces extends the cost reference across forces', () => {
    const constraint = { field: 'pts', scope: 'force', includeChildForces: true };
    // force1 220 + force2 trooper 50*3 = 370
    expect(getScopeReferenceTotal({ constraint, roster, system, force: force1, forceCatalogueId: 'cat' })).toBe(370);
  });

  test('selection-count reference counts selections in scope', () => {
    const constraint = { field: 'selections', scope: 'force' };
    expect(getScopeReferenceTotal({ constraint, roster, system, force: force1 })).toBe(3);
  });

  test('selection-count reference honours includeChildSelections', () => {
    const constraint = { field: 'selections', scope: 'force', includeChildSelections: true };
    expect(getScopeReferenceTotal({ constraint, roster, system, force: force1 })).toBe(4);
  });
});

describe('resolveConstraintThreshold', () => {
  const roster = makeRoster();
  const force1 = roster.forces[0];

  test('non-percent constraints resolve to the raw value', () => {
    const constraint = { type: 'max', field: 'pts', scope: 'roster' };
    expect(resolveConstraintThreshold({ constraint, value: 3, roster, system, force: force1 })).toBe(3);
  });

  test('percent constraint resolves to value% of the reference', () => {
    const constraint = { type: 'max', field: 'pts', scope: 'roster', percentValue: true };
    // 25% of the 1000 budget
    expect(resolveConstraintThreshold({ constraint, value: 25, roster, system, force: force1 })).toBe(250);
  });
});

describe('formatConstraintLimit', () => {
  test('renders an absolute constraint value unchanged', () => {
    expect(formatConstraintLimit(3, { type: 'max' })).toBe('3');
  });

  test('appends a percent sign for a percentValue constraint', () => {
    expect(formatConstraintLimit(25, { type: 'max', percentValue: true })).toBe('25 %');
  });

  test('appends a percent sign for the legacy percent pseudo-type', () => {
    expect(formatConstraintLimit(50, { type: 'percent' })).toBe('50 %');
  });

  test('treats a missing constraint as absolute', () => {
    expect(formatConstraintLimit(7, undefined)).toBe('7');
  });
});
