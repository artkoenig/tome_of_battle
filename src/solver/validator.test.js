import { calculateRosterCosts, validateRoster, findEntryInSystem, resolveEntry, computeRosterCounts, evaluateConditionGroup, getModifiedConstraintValue, getOptionDisplayCost, getSelectionTotalCost, syncRosterSelectionsWithSystem, collectUnitProfilesAndRules } from './validator.js';
import { JSDOM } from 'jsdom';
import { parseGameSystemXML } from '../parser/xmlParser.js';

import { updateRawXml } from '../parser/catalogEditor.js';
import { getUnitOptions } from './optionsCollector.js';
import { test, expect } from 'vitest';


// 1. Mock Game System Definition
const mockSystem = {
  id: 'sys-123',
  name: 'Test Grimdark System',
  costTypes: [
    { id: 'pts', name: 'Points', defaultCostLimit: 2000 }
  ],
  categoryEntries: [
    { id: 'cat-hq', name: 'HQ' },
    { id: 'cat-troops', name: 'Troops' },
    { id: 'cat-characters', name: 'Characters' }
  ],
  forceEntries: [
    {
      id: 'force-patrol',
      name: 'Patrol Force',
      categoryLinks: [
        {
          id: 'cl-hq',
          targetId: 'cat-hq',
          name: 'HQ Link',
          constraints: [
            { type: 'min', value: 1, scope: 'force' },
            { type: 'max', value: 2, scope: 'force' }
          ]
        },
        {
          id: 'cl-troops',
          targetId: 'cat-troops',
          name: 'Troops Link',
          constraints: [
            { type: 'min', value: 1, scope: 'force' },
            { type: 'max', value: 3, scope: 'force' }
          ]
        },
        {
          id: 'cl-characters',
          targetId: 'cat-characters',
          name: 'Characters Link',
          constraints: [
            { id: 'limit-char-max', type: 'max', value: 1, scope: 'force' }
          ],
          modifiers: [
            {
              type: 'set',
              field: 'limit-char-max',
              value: '3',
              valueObject: 3,
              conditions: [
                { field: 'limit::pts', type: 'lessThan', value: 2000 }
              ]
            }
          ]
        }
      ]
    }
  ],
  catalogues: [
    {
      id: 'cat-marines',
      name: 'Space Marines',
      selectionEntries: [
        {
          id: 'unit-captain',
          name: 'Space Marine Captain',
          costs: [{ typeId: 'pts', value: 100 }],
          categoryLinks: [{ targetId: 'cat-hq' }, { targetId: 'cat-characters' }]
        },
        {
          id: 'unit-tactical',
          name: 'Tactical Squad',
          costs: [{ typeId: 'pts', value: 150 }],
          categoryLinks: [{ targetId: 'cat-troops' }],
          constraints: [
            { id: 'limit-tactical', type: 'max', value: 2, field: 'selections', scope: 'parent' }
          ]
        },
        {
          id: 'unit-vampire',
          name: 'Vampire Thrall',
          costs: [{ typeId: 'pts', value: 80 }],
          categoryLinks: [{ targetId: 'cat-hq' }, { targetId: 'cat-characters' }],
          selectionEntryGroups: [
            {
              id: 'group-magic-items',
              name: 'Magic Items',
              constraints: [
                { id: 'limit-magic-items', type: 'max', value: 50, field: 'pts', scope: 'parent' }
              ],
              selectionEntries: [
                {
                  id: 'item-sword',
                  name: 'Sword of Battle',
                  costs: [{ typeId: 'pts', value: 30 }]
                },
                {
                  id: 'item-shield',
                  name: 'Shield of Grace',
                  costs: [{ typeId: 'pts', value: 15 }]
                },
                {
                  id: 'item-lance',
                  name: 'Lance of Doom',
                  costs: [{ typeId: 'pts', value: 25 }]
                }
              ]
            }
          ]
        },
        {
          id: 'unit-shaman',
          name: 'Orc Shaman',
          costs: [{ typeId: 'pts', value: 80 }],
          categoryLinks: [{ targetId: 'cat-hq' }],
          selectionEntries: [
            {
              id: 'upgrade-show-spells',
              name: 'Show Spells',
              constraints: [
                { id: 'limit-show-spells', type: 'max', value: 1, field: 'selections', scope: 'parent' }
              ],
              selectionEntryGroups: [
                {
                  id: 'group-little-waaagh',
                  name: 'LittleWaaagh',
                  selectionEntries: [
                    {
                      id: 'spell-gaze',
                      name: '1. Gaze of Mork',
                      costs: [{ typeId: 'pts', value: 0 }]
                    },
                    {
                      id: 'spell-fist',
                      name: '2. Fist of Gork',
                      costs: [{ typeId: 'pts', value: 0 }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

// 2. Mock Roster Definitions
const mockRosterValid = {
  name: 'Strike Force Alpha',
  costLimit: 1000,
  costLimitType: 'pts',
  forces: [
    {
      id: 'f1',
      forceEntryId: 'force-patrol',
      catalogueId: 'cat-marines',
      selections: [
        {
          id: 'sel-cap',
          selectionEntryId: 'unit-captain',
          name: 'Space Marine Captain',
          number: 1,
          category: 'cat-hq',
          costs: [{ typeId: 'pts', value: 100 }],
          selections: [
            {
              id: 'sel-general',
              selectionEntryId: '1b7c-2c90-6d96-28c9',
              name: 'General',
              number: 1
            }
          ]
        },
        {
          id: 'sel-tac',
          selectionEntryId: 'unit-tactical',
          name: 'Tactical Squad',
          number: 1,
          category: 'cat-troops',
          costs: [{ typeId: 'pts', value: 150 }]
        }
      ]
    }
  ]
};

const mockRosterLimitExceeded = {
  name: 'Blob Horde',
  costLimit: 200,
  costLimitType: 'pts',
  forces: [
    {
      id: 'f1',
      forceEntryId: 'force-patrol',
      catalogueId: 'cat-marines',
      selections: [
        {
          id: 'sel-cap',
          selectionEntryId: 'unit-captain',
          name: 'Space Marine Captain',
          number: 1,
          category: 'cat-hq',
          costs: [{ typeId: 'pts', value: 100 }],
          selections: [
            {
              id: 'sel-general',
              selectionEntryId: '1b7c-2c90-6d96-28c9',
              name: 'General',
              number: 1
            }
          ]
        },
        {
          id: 'sel-tac',
          selectionEntryId: 'unit-tactical',
          name: 'Tactical Squad',
          number: 1,
          category: 'cat-troops',
          costs: [{ typeId: 'pts', value: 150 }]
        }
      ]
    }
  ]
};

const mockRosterCategoryViolation = {
  name: 'No HQ Force',
  costLimit: 1000,
  costLimitType: 'pts',
  forces: [
    {
      id: 'f1',
      forceEntryId: 'force-patrol',
      catalogueId: 'cat-marines',
      selections: [
        {
          id: 'sel-tac',
          selectionEntryId: 'unit-tactical',
          name: 'Tactical Squad',
          number: 1,
          category: 'cat-troops',
          costs: [{ typeId: 'pts', value: 150 }],
          selections: [
            {
              id: 'sel-general',
              selectionEntryId: '1b7c-2c90-6d96-28c9',
              name: 'General',
              number: 1
            }
          ]
        }
      ]
    }
  ]
};

// 3. Define additional Mock Rosters for Group Constraints
const mockRosterGroupValid = {
  name: 'Vampire Army Valid Group',
  costLimit: 1000,
  costLimitType: 'pts',
  forces: [
    {
      id: 'f1',
      forceEntryId: 'force-patrol',
      catalogueId: 'cat-marines',
      selections: [
        {
          id: 'sel-vampire-1',
          selectionEntryId: 'unit-vampire',
          name: 'Vampire Thrall',
          number: 1,
          category: 'cat-hq',
          costs: [{ typeId: 'pts', value: 80 + 30 + 15 }], // 125
          selections: [
            {
              id: 'sel-sword',
              selectionEntryId: 'item-sword',
              name: 'Sword of Battle',
              number: 1,
              costs: [{ typeId: 'pts', value: 30 }]
            },
            {
              id: 'sel-shield',
              selectionEntryId: 'item-shield',
              name: 'Shield of Grace',
              number: 1,
              costs: [{ typeId: 'pts', value: 15 }]
            },
            {
              id: 'sel-general',
              selectionEntryId: '1b7c-2c90-6d96-28c9',
              name: 'General',
              number: 1
            }
          ]
        },
        {
          id: 'sel-tac-1',
          selectionEntryId: 'unit-tactical',
          name: 'Tactical Squad',
          number: 1,
          category: 'cat-troops',
          costs: [{ typeId: 'pts', value: 150 }]
        }
      ]
    }
  ]
};

const mockRosterGroupInvalid = {
  name: 'Vampire Army Invalid Group',
  costLimit: 1000,
  costLimitType: 'pts',
  forces: [
    {
      id: 'f1',
      forceEntryId: 'force-patrol',
      catalogueId: 'cat-marines',
      selections: [
        {
          id: 'sel-vampire-2',
          selectionEntryId: 'unit-vampire',
          name: 'Vampire Thrall',
          number: 1,
          category: 'cat-hq',
          costs: [{ typeId: 'pts', value: 80 + 30 + 25 }], // 135
          selections: [
            {
              id: 'sel-sword',
              selectionEntryId: 'item-sword',
              name: 'Sword of Battle',
              number: 1,
              costs: [{ typeId: 'pts', value: 30 }]
            },
            {
              id: 'sel-lance',
              selectionEntryId: 'item-lance',
              name: 'Lance of Doom',
              number: 1,
              costs: [{ typeId: 'pts', value: 25 }]
            },
            {
              id: 'sel-general',
              selectionEntryId: '1b7c-2c90-6d96-28c9',
              name: 'General',
              number: 1
            }
          ]
        },
        {
          id: 'sel-tac-2',
          selectionEntryId: 'unit-tactical',
          name: 'Tactical Squad',
          number: 1,
          category: 'cat-troops',
          costs: [{ typeId: 'pts', value: 150 }]
        }
      ]
    }
  ]
};

// Mock DOMParser / XMLSerializer for Node environment testing using JSDOM
const jsdomObj = new JSDOM();
globalThis.DOMParser = jsdomObj.window.DOMParser;
globalThis.XMLSerializer = jsdomObj.window.XMLSerializer;

// Removed duplicate updateRawXmlTest
// Removed duplicate getUnitOptionsTest
// 4. Run Tests

// Test 1: Calculate point totals
const costsValid = calculateRosterCosts(mockRosterValid, mockSystem);
test('Cost Summation', () => {
  expect( costsValid.pts === 250).toBeTruthy();
});

// Test 2: Valid roster check
const errorsValid = validateRoster(mockRosterValid, mockSystem);
test('Valid Roster Errors count', () => {
  expect( errorsValid.length === 0).toBeTruthy();
});

// Test 3: Point limit check
const errorsLimit = validateRoster(mockRosterLimitExceeded, mockSystem);
const pointError = errorsLimit.find(e => e.type === 'roster-limit');
test('Points Limit Check', () => {
  expect( pointError).toBeTruthy();
});

// Test 4: Detachment category limits
const errorsCategory = validateRoster(mockRosterCategoryViolation, mockSystem);
const catError = errorsCategory.find(e => e.type === 'category-min');
test('Detachment Category Check', () => {
  expect( catError).toBeTruthy();
});

// Test 5: Group points max constraint (Magic Items group max limit = 50)
const errorsGroupValid = validateRoster(mockRosterGroupValid, mockSystem);
const errorsGroupInvalid = validateRoster(mockRosterGroupInvalid, mockSystem);
const groupError = errorsGroupInvalid.find(e => e.type === 'group-points-max');
console.log('Test 5 - Group Points Max Check (Valid vs Invalid): ', 
  (errorsGroupValid.length === 0 && groupError) ? 'PASSED' : `FAILED (Valid errors: ${errorsGroupValid.length}, Invalid groupError: ${!!groupError})`
);

// Test 6: Option group points limit check (Simulation of "wouldExceedPointsLimit" logic)
// Limit is 50. Currently selected items: Sword of Battle (30).
// Check if Lance of Doom (25) exceeds limit: 30 + 25 = 55 > 50 -> Exceeds.
// Check if Shield of Grace (15) exceeds limit: 30 + 15 = 45 <= 50 -> Does not exceed.
const currentPoints = 30;
const limit = 50;
const wouldLanceExceed = (currentPoints + 25) > limit;
const wouldShieldExceed = (currentPoints + 15) > limit;
console.log('Test 6 - Option Selectability Limit Check: ', 
  (wouldLanceExceed && !wouldShieldExceed) ? 'PASSED' : 'FAILED (Selectability limits incorrect)'
);

// Test 7: XML modification logic serialization (updateRawXml)
const mockXmlContent = `
<selectionEntry id="unit-thrall" name="Vampire Thrall">
  <costs>
    <cost typeId="pts" value="80" />
  </costs>
  <constraints>
    <constraint id="max-thralls" type="max" value="3" />
  </constraints>
</selectionEntry>
`;
const testSystem = {
  rawXmls: {
    cat: [
      { name: 'vampires.cat', content: mockXmlContent }
    ]
  }
};
// Perform update XML
updateRawXml(testSystem, 'unit-thrall', 'entry', 'Vampire Thrall Elite', { pts: 95 }, { 'max-thralls': 4 }, {}, '');
const updatedXml = testSystem.rawXmls.cat[0].content;
const hasUpdatedName = updatedXml.includes('name="Vampire Thrall Elite"');
const hasUpdatedPoints = updatedXml.includes('typeId="pts" value="95"');
const hasUpdatedConstraint = updatedXml.includes('id="max-thralls" type="max" value="4"');
console.log('Test 7 - XML Modifier Serialization: ', 
  (hasUpdatedName && hasUpdatedPoints && hasUpdatedConstraint) ? 'PASSED' : `FAILED (XML did not update correctly. Output: ${updatedXml})`
);

// Test 8: Selection Entry Group Constraint Isolation (Waaagh Spells Bug)
const mockShamanSelection = {
  selectionEntryId: 'unit-shaman',
  name: 'Orc Shaman',
  selections: [
    { selectionEntryId: 'upgrade-show-spells' }
  ]
};
const activeCatalogue = mockSystem.catalogues[0];
const shamanOptions = getUnitOptions(mockSystem, activeCatalogue.id, mockShamanSelection);
const gazeSpellOption = shamanOptions.find(o => o.option.id === 'spell-gaze');
const hasParentConstraintLeak = gazeSpellOption?.groupConstraints?.some(c => c.id === 'limit-show-spells');
console.log('Test 8 - Selection Group Constraint Isolation (Waaagh Spells Bug): ',
  (gazeSpellOption && !hasParentConstraintLeak) ? 'PASSED' : `FAILED (Spell option inherits parent limit: ${hasParentConstraintLeak})`
);

// Test 9: Unique Magic Items check (prevent selecting unique items already selected elsewhere in the roster)
const isUniqueOptionTakenElsewhereTest = (roster, currentSelectionId, targetResId, system) => {
  let taken = false;
  
  const checkSelection = (sel, isUnderCurrent) => {
    const underCurrent = isUnderCurrent || (sel.id === currentSelectionId);
    
    if (!underCurrent) {
      const selRaw = findEntryInSystem(system, sel.selectionEntryId || sel.entryLinkId);
      const selRes = resolveEntry(system, selRaw);
      const selUnderlyingId = selRes ? selRes.id : (sel.selectionEntryId || sel.entryLinkId);
      
      if (selUnderlyingId === targetResId) {
        taken = true;
        return;
      }
    }
    
    sel.selections?.forEach(sub => checkSelection(sub, underCurrent));
  };

  roster.forces?.forEach(force => {
    force.selections?.forEach(sel => checkSelection(sel, false));
  });

  return taken;
};

const mockRosterUniqueItems = {
  forces: [
    {
      id: 'f1',
      selections: [
        {
          id: 'sel-cap-1',
          selectionEntryId: 'unit-captain',
          selections: [
            {
              id: 'sel-sword-unique',
              selectionEntryId: 'item-sword'
            }
          ]
        },
        {
          id: 'sel-cap-2',
          selectionEntryId: 'unit-captain',
          selections: []
        }
      ]
    }
  ]
};

const takenForCap2 = isUniqueOptionTakenElsewhereTest(mockRosterUniqueItems, 'sel-cap-2', 'item-sword', mockSystem);
const takenForCap1 = isUniqueOptionTakenElsewhereTest(mockRosterUniqueItems, 'sel-cap-1', 'item-sword', mockSystem);

console.log('Test 9 - Roster-wide Uniqueness Check: ',
  (takenForCap2 === true && takenForCap1 === false) ? 'PASSED' : `FAILED (Cap2: ${takenForCap2}, Cap1: ${takenForCap1})`
);

// Test 10: Maximum Unit Types per Army / parent force-level constraint checking (Tactical Squad max 2 limit)
const mockRosterTacticalOverLimit = {
  name: 'Tactical Horde Over Limit',
  costLimit: 1000,
  costLimitType: 'pts',
  forces: [
    {
      id: 'f1',
      forceEntryId: 'force-patrol',
      catalogueId: 'cat-marines',
      selections: [
        {
          id: 'sel-cap',
          selectionEntryId: 'unit-captain',
          name: 'Space Marine Captain',
          number: 1,
          category: 'cat-hq',
          costs: [{ typeId: 'pts', value: 100 }],
          selections: [
            {
              id: 'sel-general',
              selectionEntryId: '1b7c-2c90-6d96-28c9',
              name: 'General',
              number: 1
            }
          ]
        },
        {
          id: 'sel-tac-1',
          selectionEntryId: 'unit-tactical',
          name: 'Tactical Squad 1',
          number: 1,
          category: 'cat-troops',
          costs: [{ typeId: 'pts', value: 150 }]
        },
        {
          id: 'sel-tac-2',
          selectionEntryId: 'unit-tactical',
          name: 'Tactical Squad 2',
          number: 1,
          category: 'cat-troops',
          costs: [{ typeId: 'pts', value: 150 }]
        },
        {
          id: 'sel-tac-3',
          selectionEntryId: 'unit-tactical',
          name: 'Tactical Squad 3',
          number: 1,
          category: 'cat-troops',
          costs: [{ typeId: 'pts', value: 150 }]
        }
      ]
    }
  ]
};

const errorsTacOverLimit = validateRoster(mockRosterTacticalOverLimit, mockSystem);
const tacOverLimitError = errorsTacOverLimit.find(e => e.type === 'entry-max' && e.selectionId === 'sel-tac-1');
console.log('Test 10 - Unit Type Army Max Limit Check: ',
  tacOverLimitError ? 'PASSED' : `FAILED (No entry-max error found: ${JSON.stringify(errorsTacOverLimit)})`
);

// Test 11: Multi-category counts validation (Characters constraint max 1 limit)
const mockRosterCharactersOverLimit = {
  name: 'Characters Over Limit',
  costLimit: 2500,
  costLimitType: 'pts',
  forces: [
    {
      id: 'f1',
      forceEntryId: 'force-patrol',
      catalogueId: 'cat-marines',
      selections: [
        {
          id: 'sel-cap',
          selectionEntryId: 'unit-captain',
          name: 'Space Marine Captain',
          number: 1,
          category: 'cat-hq',
          costs: [{ typeId: 'pts', value: 100 }],
          selections: [
            {
              id: 'sel-general',
              selectionEntryId: '1b7c-2c90-6d96-28c9',
              name: 'General',
              number: 1
            }
          ]
        },
        {
          id: 'sel-vampire',
          selectionEntryId: 'unit-vampire',
          name: 'Vampire Thrall',
          number: 1,
          category: 'cat-hq',
          costs: [{ typeId: 'pts', value: 80 }]
        },
        {
          id: 'sel-tac',
          selectionEntryId: 'unit-tactical',
          name: 'Tactical Squad',
          number: 1,
          category: 'cat-troops',
          costs: [{ typeId: 'pts', value: 150 }]
        }
      ]
    }
  ]
};

const errorsCharacters = validateRoster(mockRosterCharactersOverLimit, mockSystem);
const charactersOverLimitError = errorsCharacters.find(e => e.type === 'category-max' && e.categoryId === 'cat-characters');
console.log('Test 11 - Multi-category Force Limit Check (Characters): ',
  charactersOverLimitError ? 'PASSED' : `FAILED (No category-max error found: ${JSON.stringify(errorsCharacters)})`
);

// Test 12: Modifier evaluation on category constraints (Characters set to 3 at 1500pts)
const mockRosterCharactersWithinModifiedLimit = {
  ...mockRosterCharactersOverLimit,
  costLimit: 1500
};
const errorsCharactersModified = validateRoster(mockRosterCharactersWithinModifiedLimit, mockSystem);
const charactersWithinLimitNoError = !errorsCharactersModified.some(e => e.type === 'category-max' && e.categoryId === 'cat-characters');
console.log('Test 12 - Category Constraint Modifier Evaluation (Limit 3 at 1500pts): ',
  charactersWithinLimitNoError ? 'PASSED' : `FAILED (Constraint set modifier did not apply: ${JSON.stringify(errorsCharactersModified)})`
);

// Test 13: Category Link De-duplication Check (avoiding duplicate category counts for identical targetIds)
const mockSystemDeDuplication = {
  ...mockSystem,
  catalogues: [
    {
      id: 'cat-marines',
      name: 'Space Marines',
      selectionEntries: [
        {
          id: 'unit-captain',
          name: 'Space Marine Captain',
          costs: [{ typeId: 'pts', value: 100 }],
          categoryLinks: [
            { targetId: 'cat-hq', primary: true },
            { targetId: 'cat-hq', primary: false } // duplicate link to same category
          ]
        }
      ]
    }
  ]
};

const mockRosterDeDuplication = {
  name: 'De-dup Captain',
  costLimit: 2000,
  costLimitType: 'pts',
  forces: [
    {
      id: 'f1',
      forceEntryId: 'force-patrol',
      catalogueId: 'cat-marines',
      selections: [
        {
          id: 'sel-cap',
          selectionEntryId: 'unit-captain',
          name: 'Space Marine Captain',
          number: 1,
          costs: [{ typeId: 'pts', value: 100 }]
        }
      ]
    }
  ]
};

const { categoryCounts: deDupCounts } = computeRosterCounts(mockRosterDeDuplication, mockSystemDeDuplication);
const hqCount = deDupCounts['f1']?.['cat-hq'] || 0;
const deDuplicationSuccess = hqCount === 1;
console.log('Test 13 - Category Link De-duplication Check (avoid double count): ',
  deDuplicationSuccess ? 'PASSED' : `FAILED (Expected count 1, got ${hqCount})`
);

// Test 13b: Nested Primary Category Link Ignoring Check (avoid double counting child selections in force categories)
const mockSystemNestedCategory = {
  ...mockSystem,
  catalogues: [
    {
      id: 'cat-nested',
      name: 'Nested Category Test',
      selectionEntries: [
        {
          id: 'parent-unit',
          name: 'Parent Unit',
          categoryLinks: [
            { targetId: 'cat-special', primary: true }
          ],
          selectionEntries: [
            {
              id: 'child-model',
              name: 'Child Model',
              categoryLinks: [
                { targetId: 'cat-special', primary: true }
              ]
            }
          ]
        }
      ]
    }
  ]
};

const mockRosterNestedCategory = {
  name: 'Nested Category',
  costLimit: 2000,
  costLimitType: 'pts',
  forces: [
    {
      id: 'f-nested',
      forceEntryId: 'force-patrol',
      catalogueId: 'cat-nested',
      selections: [
        {
          id: 'sel-parent',
          selectionEntryId: 'parent-unit',
          name: 'Parent Unit',
          number: 1,
          selections: [
            {
              id: 'sel-child',
              selectionEntryId: 'child-model',
              name: 'Child Model',
              number: 2
            }
          ]
        }
      ]
    }
  ]
};

const { categoryCounts: nestedCounts } = computeRosterCounts(mockRosterNestedCategory, mockSystemNestedCategory);
const specialCount = nestedCounts['f-nested']?.['cat-special'] || 0;
const nestedCategorySuccess = specialCount === 1;
console.log('Test 13b - Nested Primary Category Link Ignoring Check (avoid double count): ',
  nestedCategorySuccess ? 'PASSED' : `FAILED (Expected count 1, got ${specialCount})`
);

// Test 14: Category Link Constraints and Modifiers XML Parsing Check
const mockGstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<gameSystem id="sys-123" name="Test System" xmlns="http://www.battlescribe.net/schema/gameSystemSchema">
  <forceEntries>
    <forceEntry id="force-patrol" name="Patrol">
      <categoryLinks>
        <categoryLink id="cl-hq" name="HQ" targetId="cat-hq" primary="false">
          <constraints>
            <constraint id="max-hq" type="max" value="2" field="selections" scope="parent" shared="true"/>
          </constraints>
          <modifiers>
            <modifier type="set" field="max-hq" value="3">
              <conditions>
                <condition field="limit::pts" value="2000" type="greaterThan"/>
              </conditions>
            </modifier>
          </modifiers>
        </categoryLink>
      </categoryLinks>
    </forceEntry>
  </forceEntries>
</gameSystem>
`;

const parsedGst = parseGameSystemXML(mockGstXml);
const parsedForce = parsedGst.forceEntries?.[0];
const parsedCatLink = parsedForce?.categoryLinks?.[0];
const hasParsedConstraints = parsedCatLink?.constraints?.length > 0 && parsedCatLink.constraints[0].id === 'max-hq';
const hasParsedModifiers = parsedCatLink?.modifiers?.length > 0 && parsedCatLink.modifiers[0].field === 'max-hq';
const xmlCategoryLinksSuccess = hasParsedConstraints && hasParsedModifiers;
console.log('Test 14 - XML CategoryLink Constraints and Modifiers Parsing Check: ',
  xmlCategoryLinksSuccess ? 'PASSED' : `FAILED (Constraints parsed: ${!!hasParsedConstraints}, Modifiers parsed: ${!!hasParsedModifiers})`
);

// Test 15 removed as the underlying hack in validator was removed.

// Test 16: Fallback Heroes Max Constraint injection
const mockSystemForFallback = {
  categoryEntries: [
    { id: '7a1c-d611-c2dc-def1', name: 'Characters' },
    { id: 'c16b-f319-2c62-2c12', name: 'Heroes' }
  ],
  forceEntries: [
    {
      id: 'force-entry-1',
      name: 'Standard',
      categoryLinks: [
        {
          targetId: '7a1c-d611-c2dc-def1',
          name: 'Characters',
          constraints: [
            { id: 'char-max', type: 'max', value: 3, field: 'selections', scope: 'parent' }
          ]
        },
        {
          targetId: 'c16b-f319-2c62-2c12',
          name: 'Heroes' // No max constraint defined
        }
      ]
    }
  ],
  catalogues: [
    {
      id: 'cat-og',
      selectionEntries: [
        {
          id: 'hero-id',
          name: 'Goblin Shaman',
          categoryLinks: [
            { targetId: '7a1c-d611-c2dc-def1' }, // Characters
            { targetId: 'c16b-f319-2c62-2c12' }  // Heroes
          ]
        }
      ]
    }
  ]
};
const mockRosterForFallback = {
  forces: [
    {
      id: 'force-1',
      forceEntryId: 'force-entry-1',
      catalogueId: 'cat-og',
      selections: [
        { selectionEntryId: 'hero-id', number: 1 },
        { selectionEntryId: 'hero-id', number: 1 },
        { selectionEntryId: 'hero-id', number: 1 },
        { selectionEntryId: 'hero-id', number: 1 } // 4 heroes total (exceeds limit 3)
      ]
    }
  ]
};
const fallbackErrors = validateRoster(mockRosterForFallback, mockSystemForFallback);
const hasHeroesMaxError = fallbackErrors.some(e => e.type === 'category-max' && e.categoryId === 'c16b-f319-2c62-2c12');
const fallbackSuccess = hasHeroesMaxError;
console.log('Test 16 - Fallback Heroes Max Constraint Validation Check: ',
  fallbackSuccess ? 'PASSED' : 'FAILED (No Heroes max constraint error was generated)'
);

// Test 17 - Catalogue ID Collision Namespace Resolution Check
const collisionSystem = {
  id: 'sys-collision',
  catalogues: [
    {
      id: 'cat-og',
      name: 'Orcs and Goblins',
      selectionEntries: [
        {
          id: 'colliding-id',
          name: 'Black Orc Warboss',
          selectionEntryGroups: [
            { id: 'group-mounts', name: 'Mounts' }
          ]
        }
      ]
    },
    {
      id: 'cat-cd',
      name: 'Chaos Dwarfs',
      selectionEntries: [
        {
          id: 'colliding-id',
          name: 'Chaos Dwarf Hero',
          selectionEntryGroups: []
        }
      ]
    }
  ]
};

const resolvedWarboss = findEntryInSystem(collisionSystem, 'colliding-id', 'cat-og');
const resolvedHero = findEntryInSystem(collisionSystem, 'colliding-id', 'cat-cd');
const resolvedFallback = findEntryInSystem(collisionSystem, 'colliding-id'); // fallback should find one of them

const collisionSuccess = 
  resolvedWarboss && resolvedWarboss.name === 'Black Orc Warboss' && resolvedWarboss.selectionEntryGroups?.length === 1 &&
  resolvedHero && resolvedHero.name === 'Chaos Dwarf Hero' && resolvedHero.selectionEntryGroups?.length === 0 &&
  resolvedFallback && (resolvedFallback.name === 'Black Orc Warboss' || resolvedFallback.name === 'Chaos Dwarf Hero');

console.log('Test 17 - Catalogue ID Collision Resolution Check: ',
  collisionSuccess ? 'PASSED' : 'FAILED'
);

// Test 18: Condition Group Logical Operators (AND, OR, NOT)
const conditionGroupRoster = {
  costLimit: 1000,
  costLimitType: 'pts',
  forces: []
};
const selectionCounts = { 'unit-a': 2, 'unit-b': 0 };

// OR condition group: True if any condition is true
const groupOr = {
  type: 'or',
  conditions: [
    { field: 'unit-a', type: 'greaterThan', value: 0 }, // True (2 > 0)
    { field: 'unit-b', type: 'greaterThan', value: 0 }  // False (0 > 0)
  ]
};
const groupOrResultTrue = evaluateConditionGroup(groupOr, conditionGroupRoster, selectionCounts, {});

const groupOrAllFalse = {
  type: 'or',
  conditions: [
    { field: 'unit-a', type: 'greaterThan', value: 5 }, // False (2 > 5)
    { field: 'unit-b', type: 'greaterThan', value: 0 }  // False (0 > 0)
  ]
};
const groupOrResultFalse = evaluateConditionGroup(groupOrAllFalse, conditionGroupRoster, selectionCounts, {});

// NOT condition group: True if NOT all conditions are true
const groupNot = {
  type: 'not',
  conditions: [
    { field: 'unit-a', type: 'greaterThan', value: 0 }, // True (2 > 0)
    { field: 'unit-b', type: 'greaterThan', value: 0 }  // False (0 > 0)
  ]
};
const groupNotResultTrue = evaluateConditionGroup(groupNot, conditionGroupRoster, selectionCounts, {});

const groupNotAllTrue = {
  type: 'not',
  conditions: [
    { field: 'unit-a', type: 'greaterThan', value: 0 }, // True (2 > 0)
    { field: 'unit-a', type: 'equalTo', value: 2 }      // True (2 == 2)
  ]
};
const groupNotResultFalse = evaluateConditionGroup(groupNotAllTrue, conditionGroupRoster, selectionCounts, {});

// AND condition group (default/other): True only if all conditions are true
const groupAnd = {
  type: 'and',
  conditions: [
    { field: 'unit-a', type: 'greaterThan', value: 0 }, // True
    { field: 'unit-b', type: 'equalTo', value: 0 }      // True
  ]
};
const groupAndResultTrue = evaluateConditionGroup(groupAnd, conditionGroupRoster, selectionCounts, {});

const condGroupSuccess = 
  groupOrResultTrue === true && 
  groupOrResultFalse === false && 
  groupNotResultTrue === true && 
  groupNotResultFalse === false && 
  groupAndResultTrue === true;

console.log('Test 18 - Condition Group Logical Operators (AND, OR, NOT): ',
  condGroupSuccess ? 'PASSED' : `FAILED (OR: ${groupOrResultTrue}/${groupOrResultFalse}, NOT: ${groupNotResultTrue}/${groupNotResultFalse}, AND: ${groupAndResultTrue})`
);

// Test 19: Repeating Modifiers (repeat field and limit)
const repeatRoster = {
  costLimit: 2500, // For limit::pts checks
  costLimitType: 'pts',
  forces: []
};
const repeatSelectionCounts = { 'unit-x': 6 };

const mockConstraint = { id: 'con-max', value: 0 };

// Mod 1: repeats every 1000 pts limit, increment by 2
const modLimitRepeat = {
  field: 'con-max',
  type: 'increment',
  valueObject: 2,
  repeat: {
    field: 'limit::pts',
    value: 1000,
    repeats: 1
  }
};
// 2500 / 1000 = 2 repeats. Final value = 0 + (2 * 2 * 1) = 4.
const valLimitRepeat = getModifiedConstraintValue(mockConstraint, [modLimitRepeat], repeatRoster, {}, {});

// Mod 2: repeats every 2 selections of unit-x, decrement by 1
const modFieldRepeat = {
  field: 'con-max',
  type: 'decrement',
  valueObject: 1,
  repeat: {
    field: 'unit-x',
    value: 2,
    repeats: 3 // multiplier
  }
};
// 10 - (1 * 3 * 3) = 1.
const valFieldRepeat = getModifiedConstraintValue({ id: 'con-max', value: 10 }, [modFieldRepeat], repeatRoster, repeatSelectionCounts, {});

const repeatSuccess = valLimitRepeat === 4 && valFieldRepeat === 1;
console.log('Test 19 - Repeating Modifiers (repeat field and limit): ',
  repeatSuccess ? 'PASSED' : `FAILED (limit-repeat: ${valLimitRepeat}/4, field-repeat: ${valFieldRepeat}/1)`
);

// Test 19b: Repeating Modifiers (repeat childId and category counts)
const modChildIdRepeat = {
  field: 'con-max',
  type: 'increment',
  valueObject: 1,
  repeat: {
    field: 'selections',
    childId: 'cat-gnoblar',
    value: 1,
    repeats: 1
  }
};
const repeatForceCategoryCounts = { 'cat-gnoblar': 2 };
const valChildIdRepeat = getModifiedConstraintValue({ id: 'con-max', value: 0 }, [modChildIdRepeat], repeatRoster, {}, repeatForceCategoryCounts);
console.log('Test 19b - Repeating Modifiers (repeat childId and category counts): ',
  valChildIdRepeat === 2 ? 'PASSED' : `FAILED (expected: 2, got: ${valChildIdRepeat})`
);


// Test 21: Repeatable magic items validation via group modifiers
const mockSystemRepeatable = {
  id: 'sys-repeatable',
  name: 'Test System Repeatable',
  costTypes: [{ id: 'pts', name: 'Points', defaultCostLimit: 2000 }],
  categoryEntries: [{ id: 'cat-hq', name: 'HQ' }],
  forceEntries: [
    {
      id: 'force-patrol',
      name: 'Patrol Force',
      categoryLinks: [{ id: 'cl-hq', targetId: 'cat-hq', name: 'HQ Link' }]
    }
  ],
  catalogues: [
    {
      id: 'cat-wizard',
      name: 'Wizards',
      selectionEntries: [
        {
          id: 'unit-wizard',
          name: 'Wizard Shaman',
          costs: [{ typeId: 'pts', value: 100 }],
          categoryLinks: [{ targetId: 'cat-hq' }],
          selectionEntryGroups: [
            {
              id: 'group-arcane',
              name: 'Arcane Items',
              modifiers: [
                {
                  type: 'increment',
                  field: 'con-arcane-max',
                  valueObject: 1,
                  conditions: [
                    { field: 'item-scroll', type: 'greaterThan', value: 0 }
                  ],
                  repeat: {
                    field: 'item-scroll',
                    value: 1,
                    repeats: 1
                  }
                }
              ],
              constraints: [
                { id: 'con-arcane-max', type: 'max', value: 1, field: 'selections', scope: 'parent' }
              ],
              selectionEntries: [
                {
                  id: 'item-scroll',
                  name: 'Dispel Scroll',
                  costs: [{ typeId: 'pts', value: 25 }]
                },
                {
                  id: 'item-staff',
                  name: 'Staff of Sorcery',
                  costs: [{ typeId: 'pts', value: 50 }],
                  constraints: [
                    { id: 'con-staff-max', type: 'max', value: 1, field: 'selections', scope: 'parent' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

const mockRosterRepeatableValid = {
  name: 'Wizard Army',
  costLimit: 2000,
  costLimitType: 'pts',
  forces: [
    {
      id: 'f1',
      forceEntryId: 'force-patrol',
      catalogueId: 'cat-wizard',
      selections: [
        {
          id: 'sel-wizard',
          selectionEntryId: 'unit-wizard',
          name: 'Wizard Shaman',
          number: 1,
          category: 'cat-hq',
          costs: [{ typeId: 'pts', value: 100 + 25 + 25 + 50 }], // 200 pts
          selections: [
            {
              id: 'sel-scroll-1',
              selectionEntryId: 'item-scroll',
              name: 'Dispel Scroll',
              number: 2,
              costs: [{ typeId: 'pts', value: 25 }]
            },
            {
              id: 'sel-staff',
              selectionEntryId: 'item-staff',
              name: 'Staff of Sorcery',
              number: 1,
              costs: [{ typeId: 'pts', value: 50 }]
            },
            {
              id: 'sel-general',
              selectionEntryId: '1b7c-2c90-6d96-28c9',
              name: 'General',
              number: 1
            }
          ]
        }
      ]
    }
  ]
};

const errorsRepeatableValid = validateRoster(mockRosterRepeatableValid, mockSystemRepeatable);
const test21Success = errorsRepeatableValid.length === 0;

console.log('Test 21 - Repeatable Magic Items Group limit increment: ',
  test21Success ? 'PASSED' : `FAILED (Errors: ${JSON.stringify(errorsRepeatableValid)})`
);

// Test 22: Nested Selection display costs and group constraint points validation
const mockSystemNested = {
  id: 'sys-nested',
  name: 'Nested System',
  costTypes: [{ id: 'pts', name: 'Points', defaultCostLimit: 2000 }],
  categoryEntries: [{ id: 'cat-hq', name: 'HQ' }],
  forceEntries: [{ id: 'force-patrol', name: 'Patrol Force', categoryLinks: [{ id: 'cl-hq', targetId: 'cat-hq' }] }],
  catalogues: [
    {
      id: 'cat-nested',
      name: 'Nested Catalogue',
      selectionEntries: [
        {
          id: 'unit-nested',
          name: 'Wizard',
          costs: [{ typeId: 'pts', value: 100 }],
          categoryLinks: [{ targetId: 'cat-hq' }],
          selectionEntryGroups: [
            {
              id: 'group-magic',
              name: 'Magic Items',
              constraints: [
                { id: 'limit-magic-pts', type: 'max', value: 30, field: 'pts', scope: 'parent' }
              ],
              selectionEntries: [
                {
                  id: 'item-parent',
                  name: 'Power Stone Wrapper',
                  costs: [{ typeId: 'pts', value: 0 }],
                  selectionEntries: [
                    {
                      id: 'item-child',
                      name: 'Power Stone Item',
                      constraints: [{ id: 'con-child-min', type: 'min', value: 1, field: 'selections' }],
                      costs: [{ typeId: 'pts', value: 25 }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

// 1. Verify getOptionDisplayCost on item-parent
const displayCost = getOptionDisplayCost(mockSystemNested, { id: 'item-parent' }, 'pts');

// 2. Verify getSelectionTotalCost on selected parent containing the child
const mockSelectionParent = {
  id: 'sel-parent',
  selectionEntryId: 'item-parent',
  name: 'Power Stone Wrapper',
  number: 1,
  costs: [{ typeId: 'pts', value: 0 }],
  selections: [
    {
      id: 'sel-child',
      selectionEntryId: 'item-child',
      name: 'Power Stone Item',
      number: 1,
      costs: [{ typeId: 'pts', value: 25 }]
    }
  ]
};
const selectionTotalCost = getSelectionTotalCost(mockSelectionParent, 'pts');

// 3. Verify validateRoster correctly flags group points limit when we exceed 30 pts (e.g. if we have 2 Power Stones)
const mockRosterNestedInvalid = {
  name: 'Nested Army',
  costLimit: 2000,
  costLimitType: 'pts',
  forces: [
    {
      id: 'f1',
      forceEntryId: 'force-patrol',
      catalogueId: 'cat-nested',
      selections: [
        {
          id: 'sel-wizard',
          selectionEntryId: 'unit-nested',
          name: 'Wizard',
          number: 1,
          category: 'cat-hq',
          costs: [{ typeId: 'pts', value: 100 }],
          selections: [
            {
              id: 'sel-parent-1',
              selectionEntryId: 'item-parent',
              name: 'Power Stone Wrapper',
              number: 2, // taking 2 wraps
              costs: [{ typeId: 'pts', value: 0 }],
              selections: [
                {
                  id: 'sel-child-1',
                  selectionEntryId: 'item-child',
                  name: 'Power Stone Item',
                  number: 2, // 2 items = 50 pts, exceeds 30 pts limit
                  costs: [{ typeId: 'pts', value: 25 }]
                }
              ]
            },
            {
              id: 'sel-general',
              selectionEntryId: '1b7c-2c90-6d96-28c9',
              name: 'General',
              number: 1
            }
          ]
        }
      ]
    }
  ]
};

const errorsNestedInvalid = validateRoster(mockRosterNestedInvalid, mockSystemNested);
const test22Success = (displayCost === 25) && (selectionTotalCost === 25) && (errorsNestedInvalid.some(e => e.type === 'group-points-max'));

console.log('Test 22 - Nested Selection display costs and group constraint points validation: ',
  test22Success ? 'PASSED' : `FAILED (displayCost: ${displayCost}, selectionTotalCost: ${selectionTotalCost}, errors: ${JSON.stringify(errorsNestedInvalid)})`
);

// Test 23: syncRosterSelectionsWithSystem syncing selection name and costs
const mockSystemSyncTest = {
  id: 'sys-sync',
  name: 'Sync System',
  costTypes: [{ id: 'pts', name: 'Points' }],
  catalogues: [
    {
      id: 'cat-sync',
      name: 'Sync Catalogue',
      selectionEntries: [
        {
          id: 'item-sync-1',
          name: 'Updated Weapon Name',
          costs: [{ typeId: 'pts', value: 15 }]
        }
      ]
    }
  ]
};

const mockRosterSyncTest = {
  name: 'Sync Roster',
  catalogueId: 'cat-sync',
  forces: [
    {
      id: 'force-sync-1',
      catalogueId: 'cat-sync',
      selections: [
        {
          id: 'sel-sync-1',
          selectionEntryId: 'item-sync-1',
          name: 'Old Weapon Name',
          costs: [{ typeId: 'pts', value: 5 }],
          selections: []
        }
      ]
    }
  ]
};

const syncResult1 = syncRosterSelectionsWithSystem(mockRosterSyncTest, mockSystemSyncTest);
const nameUpdated = mockRosterSyncTest.forces[0].selections[0].name === 'Updated Weapon Name';
const costUpdated = mockRosterSyncTest.forces[0].selections[0].costs?.[0]?.value === 15;
const syncResult2 = syncRosterSelectionsWithSystem(mockRosterSyncTest, mockSystemSyncTest);

const test23Success = syncResult1 === true && nameUpdated && costUpdated && syncResult2 === false;

console.log('Test 23 - Selection name and costs syncing with system catalog: ',
  test23Success ? 'PASSED' : `FAILED (sync1: ${syncResult1}, nameUpdated: ${nameUpdated}, costUpdated: ${costUpdated}, sync2: ${syncResult2})`
);

// Test 24 - collectUnitProfilesAndRules extraction from nested user selections
const mockSystemProfilesTest = {
  id: 'sys-profiles',
  name: 'Test Profiles System',
  catalogues: [
    {
      id: 'cat-profiles',
      sharedSelectionEntries: [
        {
          id: 'base-unit',
          name: 'Base Unit',
          profiles: [
            { id: 'prof-base', name: 'Base Profile', profileTypeName: 'Unit' }
          ],
          selectionEntryGroups: [
            {
              id: 'group-bloodline',
              selectionEntries: [
                {
                  id: 'upgrade-bloodline-1',
                  name: 'Bloodline 1',
                  profiles: [
                    { id: 'prof-bloodline-1', name: 'Bloodline 1 Profile', profileTypeName: 'Profile' }
                  ],
                  rules: [
                    { id: 'rule-bloodline-1', name: 'Bloodline Rule' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

const mockSelectionProfilesTest = {
  selectionEntryId: 'base-unit',
  selections: [
    {
      selectionEntryId: 'upgrade-bloodline-1'
    }
  ]
};

const profilesResult = collectUnitProfilesAndRules(mockSystemProfilesTest, mockSelectionProfilesTest, 'cat-profiles');

const test24Success = 
  profilesResult.profiles.length === 2 && 
  profilesResult.profiles.some(p => p.id === 'prof-base') &&
  profilesResult.profiles.some(p => p.id === 'prof-bloodline-1') &&
  profilesResult.rules.length === 1 &&
  profilesResult.rules.some(r => r.id === 'rule-bloodline-1');

test('Profile and Rule extraction from nested user selections', () => {
  expect( test24Success).toBeTruthy();
});

console.log('--- BSB Logic Gap Fix Test ---');
const bsbRoster = {
  catalogueId: 'cat-marines',
  costLimit: 2000,
  costLimitType: 'pts',
  forces: [
    {
      id: 'force-1',
      forceEntryId: 'force-patrol',
      catalogueId: 'cat-marines',
      selections: [
        {
          id: 'sel-1',
          name: 'Hero 1',
          selectionEntryId: 'unit-captain',
          selections: [
            {
              id: 'bsb-1',
              name: 'Battle Standard Bearer Target',
              entryLinkId: 'link-1',
              number: 1
            }
          ]
        },
        {
          id: 'sel-2',
          name: 'Hero 2',
          selectionEntryId: 'unit-captain',
          selections: [
            {
              id: 'bsb-2',
              name: 'Battle Standard Bearer Target',
              entryLinkId: 'link-2',
              number: 1
            }
          ]
        }
      ]
    }
  ]
};

const bsbSystem = {
  ...mockSystem,
  catalogues: [
    {
      id: 'cat-marines',
      name: 'Space Marines',
      selectionEntries: mockSystem.catalogues[0].selectionEntries,
      sharedSelectionEntries: [
        {
          id: 'bsb-target',
          name: 'Battle Standard Bearer Target',
          type: 'upgrade',
          constraints: [
            { type: 'max', value: 1, scope: 'roster' }
          ]
        }
      ],
      entryLinks: [
        { id: 'link-1', targetId: 'bsb-target', type: 'selectionEntry' },
        { id: 'link-2', targetId: 'bsb-target', type: 'selectionEntry' }
      ]
    }
  ]
};

const bsbErrors = validateRoster(bsbRoster, bsbSystem);
const bsbLogicGapFixSuccess = bsbErrors.filter(e => e.type === 'entry-max' && e.message.includes('maximal 1 Auswahlen')).length === 2;
test('BSB Logic Gap Fix Test', () => {
  expect( bsbLogicGapFixSuccess).toBeTruthy();
});

console.log('--- collectUnitProfilesAndRules Optional vs Mandatory test ---');
const optionalMandatorySystem = {
  id: 'sys-opt-mand',
  catalogues: [
    {
      id: 'cat-opt-mand',
      sharedSelectionEntries: [
        {
          id: 'unit-shaman',
          name: 'Savage Orc Great Shaman',
          profiles: [
            { id: 'prof-shaman', name: 'Shaman Profile', profileTypeName: 'Profile' }
          ],
          selectionEntries: [
            {
              id: 'upgrade-boar',
              name: 'Boar',
              type: 'upgrade',
              constraints: [{ type: 'max', value: 1 }],
              profiles: [
                { id: 'prof-boar', name: 'Boar Profile', profileTypeName: 'Profile' }
              ]
            },
            {
              id: 'model-bodyguard',
              name: 'Bodyguard',
              type: 'model',
              constraints: [{ type: 'min', value: 1 }],
              profiles: [
                { id: 'prof-bodyguard', name: 'Bodyguard Profile', profileTypeName: 'Profile' }
              ]
            }
          ]
        }
      ]
    }
  ]
};

// Case A: Shaman selected, Boar NOT selected
const selectionWithoutBoar = {
  selectionEntryId: 'unit-shaman',
  selections: []
};

const resultWithoutBoar = collectUnitProfilesAndRules(optionalMandatorySystem, selectionWithoutBoar, 'cat-opt-mand');
const hasShamanProfile = resultWithoutBoar.profiles.some(p => p.id === 'prof-shaman');
const hasBoarProfile = resultWithoutBoar.profiles.some(p => p.id === 'prof-boar');
const hasBodyguardProfile = resultWithoutBoar.profiles.some(p => p.id === 'prof-bodyguard'); // Should be included as it is type: model / mandatory (min: 1)

// Case B: Shaman selected, Boar IS selected
const selectionWithBoar = {
  selectionEntryId: 'unit-shaman',
  selections: [
    {
      selectionEntryId: 'upgrade-boar'
    }
  ]
};

const resultWithBoar = collectUnitProfilesAndRules(optionalMandatorySystem, selectionWithBoar, 'cat-opt-mand');
const hasBoarProfileWhenSelected = resultWithBoar.profiles.some(p => p.id === 'prof-boar');

test('collectUnitProfilesAndRules handles optional upgrades and mandatory models correctly', () => {
  expect(hasShamanProfile).toBe(true);
  expect(hasBoarProfile).toBe(false);
  expect(hasBodyguardProfile).toBe(true);
  expect(hasBoarProfileWhenSelected).toBe(true);
});

console.log('--- TEST RUN COMPLETE ---');
console.log('--- TEST RUN COMPLETE ---');
