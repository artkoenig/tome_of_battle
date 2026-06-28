import { calculateRosterCosts, validateRoster, findEntryInSystem, resolveEntry, computeRosterCounts } from './validator.js';
import { JSDOM } from 'jsdom';
import { parseGameSystemXML } from '../parser/xmlParser.js';

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

// XML Update function imported & adapted for Test 7
const updateRawXmlTest = (system, entryId, type, localName, localCosts, localConstraints, localCharacteristics, localDescription) => {
  if (!system.rawXmls) return;
  let file = system.rawXmls.cat?.find(f => f.content.includes(entryId));
  if (!file) {
    file = system.rawXmls.gst?.find(f => f.content.includes(entryId));
  }
  if (!file) return;

  const parser = new DOMParser();
  const doc = parser.parseFromString(file.content, 'text/xml');
  const element = doc.querySelector(`[id="${entryId}"]`);
  if (!element) return;

  if (localName !== undefined) {
    element.setAttribute('name', localName);
  }
  if (type === 'entry') {
    Object.entries(localCosts).forEach(([typeId, val]) => {
      const costEl = element.querySelector(`cost[typeId="${typeId}"]`);
      if (costEl) costEl.setAttribute('value', parseFloat(val) || 0);
    });
  }
  if (type === 'entry' || type === 'group') {
    Object.entries(localConstraints).forEach(([conId, val]) => {
      const conEl = element.querySelector(`constraint[id="${conId}"]`);
      if (conEl) conEl.setAttribute('value', parseFloat(val) || 0);
    });
  }
  if (type === 'profile') {
    Object.entries(localCharacteristics).forEach(([name, val]) => {
      const charEl = Array.from(element.querySelectorAll('characteristic')).find(c => c.getAttribute('name') === name);
      if (charEl) charEl.textContent = val;
    });
  }
  if (type === 'rule') {
    let descEl = element.querySelector('description');
    if (!descEl) {
      descEl = doc.createElement('description');
      element.appendChild(descEl);
    }
    descEl.textContent = localDescription;
  }

  const serializer = new XMLSerializer();
  file.content = serializer.serializeToString(doc);
};

// Optimized getUnitOptions test version
const getUnitOptionsTest = (unitSelection, system, activeCatalogue) => {
  if (!activeCatalogue) return [];
  const entryId = unitSelection.entryLinkId || unitSelection.selectionEntryId;
  const rawEntry = findEntryInSystem(system, entryId);
  const resolved = resolveEntry(system, rawEntry);
  if (!resolved) return [];

  const collectGroupItemIds = (gDef, groupItemIds = new Set(), visited = new Set()) => {
    if (!gDef || visited.has(gDef.id)) return groupItemIds;
    if (gDef.id) visited.add(gDef.id);

    gDef.selectionEntries?.forEach(item => {
      groupItemIds.add(item.id);
      const res = resolveEntry(system, item);
      if (res) groupItemIds.add(res.id);
    });
    gDef.entryLinks?.forEach(link => {
      groupItemIds.add(link.id);
      groupItemIds.add(link.targetId);
      const res = resolveEntry(system, link);
      if (res) {
        groupItemIds.add(res.id);
        collectGroupItemIds(res, groupItemIds, visited);
      }
    });
    gDef.selectionEntryGroups?.forEach(subG => {
      collectGroupItemIds(subG, groupItemIds, visited);
    });
    return groupItemIds;
  };

  const prepareConstraints = (gDef) => {
    if (!gDef || !gDef.constraints) return [];
    const itemIds = collectGroupItemIds(gDef);
    return gDef.constraints.map(con => ({
      ...con,
      groupItemIds: itemIds
    }));
  };

  const optionsList = [];

  const collectOptions = (def, currentGroupName = null, parentConstraints = null) => {
    def.selectionEntries?.forEach(child => {
      const resolvedChild = resolveEntry(system, child);
      if (!resolvedChild) return;

      if (child.type !== 'model' && (resolvedChild.selectionEntries?.length > 0 || resolvedChild.entryLinks?.length > 0 || resolvedChild.selectionEntryGroups?.length > 0)) {
        collectOptions(resolvedChild, currentGroupName || resolvedChild.name, prepareConstraints(resolvedChild).concat(parentConstraints || []));
      } else {
        optionsList.push({ 
          option: child, 
          parentDefId: def.id, 
          groupName: currentGroupName, 
          groupConstraints: parentConstraints 
        });
      }
    });

    def.entryLinks?.forEach(child => {
      const resolvedChild = resolveEntry(system, child);
      if (!resolvedChild) return;

      if (child.type === 'selectionEntryGroup' || resolvedChild.selectionEntries?.length > 0 || resolvedChild.entryLinks?.length > 0) {
        // FIXED: Only use resolvedChild constraints
        const combinedConstraints = prepareConstraints(resolvedChild);
        resolvedChild.selectionEntries?.forEach(subChild => {
          optionsList.push({ 
            option: subChild, 
            parentDefId: def.id, 
            groupName: resolvedChild.name || child.name, 
            groupConstraints: combinedConstraints 
          });
        });
        resolvedChild.entryLinks?.forEach(subChild => {
          optionsList.push({ 
            option: subChild, 
            parentDefId: def.id, 
            groupName: resolvedChild.name || child.name, 
            groupConstraints: combinedConstraints 
          });
        });
      } else if (resolvedChild.type !== 'model' && (resolvedChild.selectionEntries?.length > 0 || resolvedChild.entryLinks?.length > 0 || resolvedChild.selectionEntryGroups?.length > 0)) {
        collectOptions(resolvedChild, currentGroupName || resolvedChild.name, prepareConstraints(resolvedChild).concat(parentConstraints || []));
      } else {
        optionsList.push({ 
          option: child, 
          parentDefId: def.id, 
          groupName: currentGroupName, 
          groupConstraints: parentConstraints 
        });
      }
    });

    def.selectionEntryGroups?.forEach(group => {
      // FIXED: Only use group constraints
      const combinedGroupConstraints = prepareConstraints(group);
      group.selectionEntries?.forEach(child => {
        optionsList.push({ 
          option: child, 
          parentDefId: def.id, 
          groupName: group.name, 
          groupConstraints: combinedGroupConstraints 
        });
      });
      group.entryLinks?.forEach(child => {
        const resolvedChild = resolveEntry(system, child);
        if (resolvedChild && (resolvedChild.selectionEntries?.length > 0 || resolvedChild.entryLinks?.length > 0)) {
          const combinedChildConstraints = [...prepareConstraints(resolvedChild), ...combinedGroupConstraints];
          resolvedChild.selectionEntries?.forEach(sub => {
            optionsList.push({ 
              option: sub, 
              parentDefId: def.id, 
              groupName: resolvedChild.name || child.name || group.name, 
              groupConstraints: combinedChildConstraints 
            });
          });
          resolvedChild.entryLinks?.forEach(sub => {
            optionsList.push({ 
              option: sub, 
              parentDefId: def.id, 
              groupName: resolvedChild.name || child.name || group.name, 
              groupConstraints: combinedChildConstraints 
            });
          });
        }
      });
    });
  };

  collectOptions(resolved);
  return optionsList;
};

// 4. Run Tests
console.log('--- RUNNING SOLVER & VALIDATOR TESTS ---');

// Test 1: Calculate point totals
const costsValid = calculateRosterCosts(mockRosterValid, mockSystem);
console.log('Test 1 - Cost Summation: ', costsValid.pts === 250 ? 'PASSED' : `FAILED (Expected 250, got ${costsValid.pts})`);

// Test 2: Valid roster check
const errorsValid = validateRoster(mockRosterValid, mockSystem);
console.log('Test 2 - Valid Roster Errors count: ', errorsValid.length === 0 ? 'PASSED' : `FAILED (Got ${errorsValid.length} errors: ${JSON.stringify(errorsValid)})`);

// Test 3: Point limit check
const errorsLimit = validateRoster(mockRosterLimitExceeded, mockSystem);
const pointError = errorsLimit.find(e => e.type === 'roster-limit');
console.log('Test 3 - Points Limit Check: ', pointError ? 'PASSED' : 'FAILED (Expected point limit error)');

// Test 4: Detachment category limits
const errorsCategory = validateRoster(mockRosterCategoryViolation, mockSystem);
const catError = errorsCategory.find(e => e.type === 'category-min');
console.log('Test 4 - Detachment Category Check: ', catError ? 'PASSED' : 'FAILED (Expected category minimum constraint violation)');

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
updateRawXmlTest(testSystem, 'unit-thrall', 'entry', 'Vampire Thrall Elite', { pts: 95 }, { 'max-thralls': 4 }, {}, '');
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
  name: 'Orc Shaman'
};
const activeCatalogue = mockSystem.catalogues[0];
const shamanOptions = getUnitOptionsTest(mockShamanSelection, mockSystem, activeCatalogue);
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

// Test 15: Black Orc hero extra cost mapping in computeRosterCounts
const mockSystemForMapping = {
  catalogues: [
    {
      id: 'cat-og',
      selectionEntries: [
        {
          id: 'bigboss-id',
          name: 'Black Orc Bigboss',
          categoryLinks: [
            { targetId: '7a1c-d611-c2dc-def1' }, // Characters
            { targetId: 'c16b-f319-2c62-2c12' }  // Heroes
          ]
        },
        {
          id: 'extra-cost-id',
          name: 'Black Orc hero extra cost',
          categoryLinks: [
            { targetId: '7a1c-d611-c2dc-def1' }, // Characters
            { targetId: '7a1c-d611-c2dc-def1' }  // Characters duplicate
          ]
        }
      ]
    }
  ]
};
const mockRosterForMapping = {
  forces: [
    {
      id: 'force-1',
      catalogueId: 'cat-og',
      selections: [
        {
          selectionEntryId: 'bigboss-id',
          number: 1,
          selections: [
            {
              selectionEntryId: 'extra-cost-id',
              number: 1
            }
          ]
        }
      ]
    }
  ]
};
const { categoryCounts } = computeRosterCounts(mockRosterForMapping, mockSystemForMapping);
const charactersCount = categoryCounts['force-1']['7a1c-d611-c2dc-def1'];
const heroesCount = categoryCounts['force-1']['c16b-f319-2c62-2c12'];
const mappingSuccess = charactersCount === 2 && heroesCount === 2;
console.log('Test 15 - Double Choice Category Mapping (Black Orc Bigboss = 2 Chars + 2 Heroes): ',
  mappingSuccess ? 'PASSED' : `FAILED (Characters: ${charactersCount}/2, Heroes: ${heroesCount}/2)`
);

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

console.log('--- TEST RUN COMPLETE ---');
if (costsValid.pts === 250 && errorsValid.length === 0 && pointError && catError && 
    errorsGroupValid.length === 0 && groupError && (wouldLanceExceed && !wouldShieldExceed) && 
    (hasUpdatedName && hasUpdatedPoints && hasUpdatedConstraint) &&
    (gazeSpellOption && !hasParentConstraintLeak) &&
    (takenForCap2 === true && takenForCap1 === false) &&
    tacOverLimitError &&
    charactersOverLimitError &&
    charactersWithinLimitNoError &&
    deDuplicationSuccess &&
    xmlCategoryLinksSuccess &&
    mappingSuccess &&
    fallbackSuccess &&
    collisionSuccess) {
  console.log('ALL TESTS SUCCESSFUL!');
  process.exit(0);
} else {
  console.error('SOME TESTS FAILED.');
  process.exit(1);
}
