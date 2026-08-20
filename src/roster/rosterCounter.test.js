import { describe, test, expect } from 'vitest';
import { getSelectionOwnCosts, getSelectionTotalCost } from './rosterCounter.js';
/**
 * Die Rostersumme einer Kostenart, aus denselben Knotensummen gerechnet, die
 * `getSelectionTotalCost` liefert — der frühere `calculateRosterCosts` ist mit
 * dem zweiten Auswertungspfad entfallen (Issue 0157); die App liest ihre Summe
 * aus dem Bericht.
 */
const rosterTotalOf = (roster, system, costTypeId) =>
  (roster.forces || []).reduce((forceSum, force) => {
    const currentCatalogueId = force.catalogueId || roster.catalogueId || null;
    return forceSum + (force.selections || []).reduce(
      (sum, selection) => sum + getSelectionTotalCost(selection, costTypeId, 1, {
        system, roster, currentCatalogueId
      }), 0);
  }, 0);


// System where base costs live in the catalogue (unit cost + a link-level cost that
// overrides its target's cost), plus an unconditional cost modifier on the link.
const system = {
  id: 'sys',
  costTypes: [{ id: 'pts', name: 'pts' }],
  catalogues: [
    {
      id: 'cat',
      selectionEntries: [
        {
          id: 'unit',
          name: 'Warboss',
          type: 'unit',
          costs: [{ typeId: 'pts', value: 100 }],
          entryLinks: [
            {
              id: 'link-armour',
              name: 'Heavy Armour',
              targetId: 't-armour',
              type: 'selectionEntry',
              costs: [{ typeId: 'pts', value: 6 }]
            },
            {
              id: 'link-shield',
              name: 'Cheap Shield',
              targetId: 't-shield',
              type: 'selectionEntry',
              costs: [{ typeId: 'pts', value: 2 }],
              modifiers: [{ type: 'increment', field: 'pts', value: '3', conditions: [], conditionGroups: [] }]
            }
          ]
        }
      ],
      sharedSelectionEntries: [
        { id: 't-armour', name: 'Heavy Armour', type: 'upgrade', costs: [{ typeId: 'pts', value: 999 }] },
        { id: 't-shield', name: 'Cheap Shield', type: 'upgrade', costs: [{ typeId: 'pts', value: 999 }] }
      ]
    }
  ]
};

// Roster carries NO selection.costs — all base costs must come from the catalogue.
const makeRoster = () => ({
  id: 'r', catalogueId: 'cat', costLimitType: 'pts',
  forces: [
    {
      id: 'f', catalogueId: 'cat',
      selections: [
        {
          id: 'u', name: 'Warboss', selectionEntryId: 'unit', entryLinkId: null, number: 1,
          selections: [
            { id: 'a', name: 'Heavy Armour', entryLinkId: 'link-armour', selectionEntryId: null, number: 1, selections: [] },
            { id: 's', name: 'Cheap Shield', entryLinkId: 'link-shield', selectionEntryId: null, number: 1, selections: [] }
          ]
        }
      ]
    }
  ]
});

describe('rosterCounter — costs derived from the catalogue', () => {
  test('the roster total derives base + link costs and applies cost modifiers without stored selection.costs', () => {
    // 100 (unit) + 6 (link armour, link cost wins over target 999) + (2 + 3 modifier) shield = 111
    expect(rosterTotalOf(makeRoster(), system, 'pts')).toBe(111);
  });

  test('getSelectionOwnCosts returns a node own modifier-aware cost, excluding children', () => {
    const roster = makeRoster();
    const unit = roster.forces[0].selections[0];
    const shield = unit.selections[1];

    // Unit own cost excludes its children.
    expect(getSelectionOwnCosts(unit, 1, { system, roster, currentCatalogueId: 'cat' })).toEqual({ pts: 100 });
    // Link cost (2) plus the +3 modifier.
    expect(getSelectionOwnCosts(shield, 1, { system, roster, currentCatalogueId: 'cat', parentSelection: unit })).toEqual({ pts: 5 });
  });

  test('own cost scales with the effective count', () => {
    const roster = makeRoster();
    const armour = roster.forces[0].selections[0].selections[0];
    expect(getSelectionOwnCosts(armour, 4, { system, roster, currentCatalogueId: 'cat' })).toEqual({ pts: 24 });
  });

  test('getSelectionTotalCost sums a node and its children from the catalogue', () => {
    const roster = makeRoster();
    const unit = roster.forces[0].selections[0];
    // 100 + 6 + 5 = 111
    expect(getSelectionTotalCost(unit, 'pts', 1, { system, roster, currentCatalogueId: 'cat' })).toBe(111);
  });
});
