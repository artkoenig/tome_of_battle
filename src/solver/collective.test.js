import { describe, it, expect } from 'vitest';
import { calculateRosterCosts, getSelectionTotalCost, computeRosterCounts } from './validator.js';

describe('Collective Entries', () => {
  const mockSystem = {
    id: 'sys-1',
    costTypes: [{ id: 'pts', name: 'Points' }],
    catalogues: [
      {
        id: 'cat-1',
        selectionEntries: [
          { id: 'unit-1', name: 'Archers' },
          { id: 'upgrade-1', name: 'Spear', collective: true, costs: [{ typeId: 'pts', value: 2 }] },
          { id: 'upgrade-2', name: 'Banner', collective: false, costs: [{ typeId: 'pts', value: 10 }] }
        ]
      }
    ]
  };

  it('multiplies collective option costs by parent count', () => {
    // 10 Archers with 1 collective Spear upgrade
    const roster = {
      forces: [
        {
          id: 'f-1',
          catalogueId: 'cat-1',
          selections: [
            {
              id: 'sel-1',
              selectionEntryId: 'unit-1',
              number: 10,
              costs: [{ typeId: 'pts', value: 5 }],
              selections: [
                {
                  id: 'sel-2',
                  selectionEntryId: 'upgrade-1',
                  number: 1, // Single selection of the collective upgrade
                  collective: true,
                  costs: [{ typeId: 'pts', value: 2 }]
                }
              ]
            }
          ]
        }
      ]
    };

    const costs = calculateRosterCosts(roster, mockSystem);
    // 10 archers * 5 = 50
    // 1 collective spear * 2 pts * 10 archers = 20
    // Total = 70
    expect(costs.pts).toBe(70);
  });

  it('multiplies non-collective option costs by parent count', () => {
    // 10 Archers with 1 non-collective Banner upgrade
    const roster = {
      forces: [
        {
          id: 'f-1',
          catalogueId: 'cat-1',
          selections: [
            {
              id: 'sel-1',
              selectionEntryId: 'unit-1',
              number: 10,
              costs: [{ typeId: 'pts', value: 5 }],
              selections: [
                {
                  id: 'sel-2',
                  selectionEntryId: 'upgrade-2',
                  number: 1,
                  collective: false,
                  costs: [{ typeId: 'pts', value: 10 }]
                }
              ]
            }
          ]
        }
      ]
    };

    const costs = calculateRosterCosts(roster, mockSystem);
    // 10 archers * 5 = 50
    // 1 non-collective banner * 10 pts * 10 archers = 100
    // Total = 150
    expect(costs.pts).toBe(150);
  });

  it('getSelectionTotalCost works correctly for collective children', () => {
    const parentSelection = {
      id: 'sel-1',
      number: 10,
      costs: [{ typeId: 'pts', value: 5 }],
      selections: [
        {
          id: 'sel-2',
          number: 1,
          collective: true,
          costs: [{ typeId: 'pts', value: 2 }]
        }
      ]
    };

    const totalCost = getSelectionTotalCost(parentSelection, 'pts');
    expect(totalCost).toBe(70);
  });

  it('computeRosterCounts correctly counts collective categories', () => {
    // 10 Archers with 1 collective Spear upgrade that grants a "Spear" category
    const mockSystemWithCategories = {
      ...mockSystem,
      catalogues: [
        {
          id: 'cat-1',
          selectionEntries: [
            { id: 'unit-1', name: 'Archers', categoryLinks: [{ targetId: 'cat-model' }] },
            { id: 'upgrade-1', name: 'Spear', collective: true, categoryLinks: [{ targetId: 'cat-spear' }] }
          ]
        }
      ]
    };

    const roster = {
      forces: [
        {
          id: 'f-1',
          catalogueId: 'cat-1',
          selections: [
            {
              id: 'sel-1',
              selectionEntryId: 'unit-1',
              number: 10,
              selections: [
                {
                  id: 'sel-2',
                  selectionEntryId: 'upgrade-1',
                  number: 1,
                  collective: true
                }
              ]
            }
          ]
        }
      ]
    };

    const { selectionCounts, categoryCounts } = computeRosterCounts(roster, mockSystemWithCategories);
    
    // 10 archers = 10 model counts
    expect(categoryCounts['f-1']['cat-model']).toBe(10);
    // 1 collective spear upgrade * 10 archers = 10 spear counts
    expect(categoryCounts['f-1']['cat-spear']).toBe(10);
    // Unit 1 count should be 10
    expect(selectionCounts['unit-1']).toBe(10);
    // Upgrade 1 count should be 10 (effective count)
    expect(selectionCounts['upgrade-1']).toBe(10);
  });
});
