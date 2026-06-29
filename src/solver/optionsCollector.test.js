import { test, expect } from 'vitest';
import { getUnitOptions } from './optionsCollector.js';
import { resolveEntry } from './validator.js';

// Mock system
const mockSystem = {
  catalogs: {
    'cat-1': {
      id: 'cat-1',
      selectionEntries: [
        {
          id: 'unit-1',
          name: 'Vampire Thrall',
          type: 'unit',
          selectionEntryGroups: [
            {
              id: 'group-1',
              name: 'Bloodline',
              selectionEntries: [
                {
                  id: 'upgrade-necrach',
                  name: 'Necrach',
                  type: 'upgrade',
                  entryLinks: [
                    {
                      id: 'link-general',
                      targetId: 'entry-general',
                      type: 'selectionEntry'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ],
      sharedSelectionEntries: [
        {
          id: 'entry-general',
          name: 'General',
          type: 'selectionEntry'
        }
      ]
    }
  }
};


test('should return top-level options but not recurse into unselected upgrades', () => {
  const unitSelection = {
    selectionEntryId: 'unit-1',
    selections: [] // No active selections inside the unit
  };

  const options = getUnitOptions(mockSystem, 'cat-1', unitSelection);
  
  const necrachOption = options.find(o => o.option.name === 'Necrach');
  expect(necrachOption).toBeDefined();
  expect(necrachOption?.groupName).toBe('Bloodline');

  const generalOption = options.find(o => o.option.name === 'General' || o.option.targetId === 'entry-general');
  expect(generalOption).toBeUndefined();
});

test('should return nested options if their parent is selected', () => {
  const unitSelection = {
    selectionEntryId: 'unit-1',
    selections: [
      {
        selectionEntryId: 'upgrade-necrach',
        selections: [] // The upgrade is active
      }
    ]
  };

  const options = getUnitOptions(mockSystem, 'cat-1', unitSelection);
  
  const necrachOption = options.find(o => o.option.name === 'Necrach');
  expect(necrachOption).toBeDefined();

  const generalOption = options.find(o => o.option.name === 'General' || o.option.targetId === 'entry-general');
  expect(generalOption).toBeDefined();
});

test('should recurse into entryLinks of type selectionEntryGroup', () => {
  const systemWithGroupLink = {
    catalogs: {
      'cat-1': {
        id: 'cat-1',
        selectionEntries: [
          {
            id: 'unit-1',
            name: 'Unit',
            type: 'unit',
            entryLinks: [
              {
                id: 'link-group',
                targetId: 'shared-group',
                type: 'selectionEntryGroup' // This should be recursed into immediately
              }
            ]
          }
        ],
        sharedSelectionEntryGroups: [
          {
            id: 'shared-group',
            name: 'Lahmia traits',
            entryLinks: [
              {
                id: 'link-trait1',
                targetId: 'shared-trait1',
                type: 'selectionEntry'
              }
            ]
          }
        ],
        sharedSelectionEntries: [
          {
            id: 'shared-trait1',
            name: 'Trait 1',
            type: 'upgrade'
          }
        ]
      }
    }
  };

  const unitSelection = {
    selectionEntryId: 'unit-1',
    selections: []
  };

  const options = getUnitOptions(systemWithGroupLink, 'cat-1', unitSelection);
  
  const traitOption = options.find(o => o.option.targetId === 'shared-trait1');
  expect(traitOption).toBeDefined();
  expect(traitOption?.groupName).toBe('Lahmia traits');
});

