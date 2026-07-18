import { describe, test, expect } from 'vitest';
import { validateRoster } from './validator.js';

// Generic (non-WHFB6), schema-shaped fixtures that exercise the constraint
// attributes percentValue / includeChildSelections / includeChildForces end to
// end through validateRoster.

const POINTS = 'pts';
const FORCE_ENTRY_ID = 'fe-army';

function makeSystem(selectionEntries) {
  return {
    id: 'sys',
    costTypes: [{ id: POINTS, name: 'Points' }],
    categoryEntries: [],
    forceEntries: [{ id: FORCE_ENTRY_ID, name: 'Army', categoryLinks: [] }],
    catalogues: [{ id: 'cat', selectionEntries }]
  };
}

function makeForce(id, selections) {
  return { id, forceEntryId: FORCE_ENTRY_ID, catalogueId: 'cat', selections };
}

function makeRoster(costLimit, forces) {
  return { id: 'r', catalogueId: 'cat', costLimit, costLimitType: POINTS, forces };
}

describe('percentValue entry constraint (points, roster scope)', () => {
  const constraint = { id: 'c-lord-pct', type: 'max', value: 25, field: POINTS, scope: 'roster', percentValue: true };
  const system = makeSystem([
    { id: 'lord', name: 'Lord', type: 'unit', costs: [{ typeId: POINTS, value: 300 }], constraints: [constraint] }
  ]);
  const rosterWith = costLimit => makeRoster(costLimit, [
    makeForce('f1', [{ id: 's-lord', name: 'Lord', selectionEntryId: 'lord', entryLinkId: null, number: 1, selections: [] }])
  ]);

  test('flags a unit costing more than the percentage of the points budget', () => {
    // 300 pts > 25% of 1000 = 250
    const errors = validateRoster(rosterWith(1000), system);
    expect(errors.some(e => e.type === 'entry-percent-max' && e.selectionId === 's-lord')).toBe(true);
  });

  test('passes when the unit stays within the percentage budget', () => {
    // 300 pts <= 25% of 2000 = 500
    const errors = validateRoster(rosterWith(2000), system);
    expect(errors.some(e => e.type === 'entry-percent-max')).toBe(false);
  });
});

describe('includeChildForces widens a force-scoped count', () => {
  const buildSystem = includeChildForces => makeSystem([
    {
      id: 'trooper', name: 'Trooper', type: 'unit', costs: [{ typeId: POINTS, value: 50 }],
      constraints: [{ id: 'c-troop-max', type: 'max', value: 2, field: 'selections', scope: 'force', includeChildForces }]
    }
  ]);
  const twoForces = () => makeRoster(1000, [
    makeForce('f1', [{ id: 't1', name: 'Trooper', selectionEntryId: 'trooper', entryLinkId: null, number: 2, selections: [] }]),
    makeForce('f2', [{ id: 't2', name: 'Trooper', selectionEntryId: 'trooper', entryLinkId: null, number: 2, selections: [] }])
  ]);

  test('two per force is within the per-force max when child forces are excluded', () => {
    const errors = validateRoster(twoForces(), buildSystem(false));
    expect(errors.some(e => e.type === 'entry-max')).toBe(false);
  });

  test('the same roster breaches the max once child forces are included', () => {
    // 2 + 2 = 4 across forces > 2
    const errors = validateRoster(twoForces(), buildSystem(true));
    expect(errors.some(e => e.type === 'entry-max')).toBe(true);
  });
});

describe('includeChildSelections widens a parent-scoped count', () => {
  const buildSystem = includeChildSelections => makeSystem([
    { id: 'squad', name: 'Squad', type: 'unit', costs: [{ typeId: POINTS, value: 100 }] },
    { id: 'sergeant', name: 'Sergeant', type: 'upgrade', costs: [{ typeId: POINTS, value: 20 }] },
    {
      id: 'weapon', name: 'Special Weapon', type: 'upgrade', costs: [{ typeId: POINTS, value: 10 }],
      constraints: [{ id: 'c-weapon-max', type: 'max', value: 1, field: 'selections', scope: 'parent', includeChildSelections }]
    }
  ]);
  // A squad with one weapon directly plus a sergeant carrying a second weapon.
  const roster = () => makeRoster(1000, [
    makeForce('f1', [
      {
        id: 's-squad', name: 'Squad', selectionEntryId: 'squad', entryLinkId: null, number: 1,
        selections: [
          { id: 's-weapon-1', name: 'Special Weapon', selectionEntryId: 'weapon', entryLinkId: null, number: 1, selections: [] },
          {
            id: 's-sergeant', name: 'Sergeant', selectionEntryId: 'sergeant', entryLinkId: null, number: 1,
            selections: [
              { id: 's-weapon-2', name: 'Special Weapon', selectionEntryId: 'weapon', entryLinkId: null, number: 1, selections: [] }
            ]
          }
        ]
      }
    ])
  ]);

  test('one direct weapon per parent is within the max', () => {
    const errors = validateRoster(roster(), buildSystem(false));
    expect(errors.some(e => e.type === 'entry-max')).toBe(false);
  });

  test('counting the nested weapon breaches the max', () => {
    const errors = validateRoster(roster(), buildSystem(true));
    expect(errors.some(e => e.type === 'entry-max' && e.selectionId === 's-weapon-1')).toBe(true);
  });
});

describe('percentValue group constraint (points, roster scope)', () => {
  const buildSystem = () => makeSystem([
    {
      id: 'hero', name: 'Hero', type: 'unit', costs: [{ typeId: POINTS, value: 100 }],
      selectionEntryGroups: [
        {
          id: 'grp-magic', name: 'Magic Items',
          selectionEntries: [
            { id: 'item-a', name: 'Item A', type: 'upgrade', costs: [{ typeId: POINTS, value: 75 }] },
            { id: 'item-b', name: 'Item B', type: 'upgrade', costs: [{ typeId: POINTS, value: 75 }] }
          ],
          constraints: [{ id: 'c-magic-pct', type: 'max', value: 10, field: POINTS, scope: 'roster', percentValue: true }]
        }
      ]
    }
  ]);
  const rosterWith = costLimit => makeRoster(costLimit, [
    makeForce('f1', [
      {
        id: 's-hero', name: 'Hero', selectionEntryId: 'hero', entryLinkId: null, number: 1,
        selections: [
          { id: 's-item-a', name: 'Item A', selectionEntryId: 'item-a', entryLinkId: null, number: 1, selections: [] },
          { id: 's-item-b', name: 'Item B', selectionEntryId: 'item-b', entryLinkId: null, number: 1, selections: [] }
        ]
      }
    ])
  ]);

  test('flags magic items exceeding the percentage of the points budget', () => {
    // 150 pts > 10% of 1000 = 100
    const errors = validateRoster(rosterWith(1000), buildSystem());
    expect(errors.some(e => e.type === 'group-percent-max' && e.selectionId === 's-hero')).toBe(true);
  });

  test('passes when magic items stay within the percentage budget', () => {
    // 150 pts <= 10% of 2000 = 200
    const errors = validateRoster(rosterWith(2000), buildSystem());
    expect(errors.some(e => e.type === 'group-percent-max')).toBe(false);
  });
});
