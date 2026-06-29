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

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
  } else {
    testsFailed++;
    console.error('❌ AssertionError:', message);
  }
}

console.log('--- RUNNING OPTIONS COLLECTOR TESTS ---');

// Test 1: should return top-level options but not recurse into unselected upgrades
(function testUnselectedUpgrade() {
  const unitSelection = {
    selectionEntryId: 'unit-1',
    selections: [] // No active selections inside the unit
  };

  const options = getUnitOptions(mockSystem, 'cat-1', unitSelection);
  
  const necrachOption = options.find(o => o.option.name === 'Necrach');
  assert(necrachOption !== undefined, 'Necrach should be collected as an option');
  assert(necrachOption?.groupName === 'Bloodline', 'Necrach should inherit the name of the selectionEntryGroup');

  const generalOption = options.find(o => o.option.name === 'General' || o.option.targetId === 'entry-general');
  assert(generalOption === undefined, 'General should NOT be an option because Necrach is not selected');
})();

// Test 2: should return nested options if their parent is selected
(function testSelectedUpgrade() {
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
  assert(necrachOption !== undefined, 'Necrach is still collected as a top-level option');

  const generalOption = options.find(o => o.option.name === 'General' || o.option.targetId === 'entry-general');
  assert(generalOption !== undefined, 'General SHOULD be an option now because Necrach is selected');
})();

// Test 3: should recurse into entryLinks of type selectionEntryGroup
(function testSelectionEntryGroup() {
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
  assert(traitOption !== undefined, 'Trait 1 should be collected directly as an option');
  assert(traitOption?.groupName === 'Lahmia traits', 'Trait 1 should be under Lahmia traits group');
})();

console.log(`\nResults: ${testsPassed} passed, ${testsFailed} failed`);
if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('ALL OPTIONS COLLECTOR TESTS SUCCESSFUL!');
}
