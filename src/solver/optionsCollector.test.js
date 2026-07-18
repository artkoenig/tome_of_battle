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

// ---------------------------------------------------------------------------
// Hidden-flag filtering (Issue 17/07): conditionally hidden entryLinks/groups are
// omitted only when a visibility context is supplied, so several same-named groups
// (e.g. per-bloodline "Vampiric Powers") no longer all surface at once.
// ---------------------------------------------------------------------------
const BLOODLINE_ENTRY_ID = 'bloodline-blood-dragon';

// A unit that links two same-named groups, each hidden by default and unhidden by a
// force-scoped condition on a different bloodline — the shape the real catalogue uses.
const systemWithBloodlineGatedGroups = {
  catalogs: {
    'cat-1': {
      id: 'cat-1',
      selectionEntries: [
        {
          id: 'unit-1', name: 'Vampire', type: 'unit',
          entryLinks: [
            {
              id: 'vp-link-a', targetId: 'vp-group-a', type: 'selectionEntryGroup', hidden: true,
              modifiers: [{
                type: 'set', field: 'hidden', value: 'false',
                conditions: [{ type: 'atLeast', value: 1, field: 'selections', scope: 'force', childId: BLOODLINE_ENTRY_ID }]
              }]
            },
            {
              id: 'vp-link-b', targetId: 'vp-group-b', type: 'selectionEntryGroup', hidden: true,
              modifiers: [{
                type: 'set', field: 'hidden', value: 'false',
                conditions: [{ type: 'atLeast', value: 1, field: 'selections', scope: 'force', childId: 'bloodline-other' }]
              }]
            }
          ]
        }
      ],
      sharedSelectionEntryGroups: [
        { id: 'vp-group-a', name: 'Vampiric Powers', entryLinks: [{ id: 'pl-a', targetId: 'power-a', type: 'selectionEntry' }] },
        { id: 'vp-group-b', name: 'Vampiric Powers', entryLinks: [{ id: 'pl-b', targetId: 'power-b', type: 'selectionEntry' }] }
      ],
      sharedSelectionEntries: [
        { id: 'power-a', name: 'Blademaster', type: 'upgrade' },
        { id: 'power-b', name: 'Summon Wolves', type: 'upgrade' }
      ]
    }
  }
};

const unitOnly = { selectionEntryId: 'unit-1', selections: [] };

test('without a visibility context, hidden groups are collected unchanged (backward compatible)', () => {
  const options = getUnitOptions(systemWithBloodlineGatedGroups, 'cat-1', unitOnly);
  expect(options.find(o => o.option.targetId === 'power-a')).toBeDefined();
  expect(options.find(o => o.option.targetId === 'power-b')).toBeDefined();
});

test('with a visibility context and no bloodline selected, both hidden groups are omitted', () => {
  const visibilityContext = { roster: { forces: [{}] }, selectionCounts: {}, forceCategoryCounts: {}, force: {} };
  const options = getUnitOptions(systemWithBloodlineGatedGroups, 'cat-1', unitOnly, visibilityContext);
  expect(options.find(o => o.option.targetId === 'power-a')).toBeUndefined();
  expect(options.find(o => o.option.targetId === 'power-b')).toBeUndefined();
});

test('with a bloodline selected, only that bloodline\'s group is collected', () => {
  const visibilityContext = {
    roster: { forces: [{}] },
    selectionCounts: { [BLOODLINE_ENTRY_ID]: 1 },
    forceCategoryCounts: {},
    force: {}
  };
  const options = getUnitOptions(systemWithBloodlineGatedGroups, 'cat-1', unitOnly, visibilityContext);
  const powerA = options.find(o => o.option.targetId === 'power-a');
  expect(powerA).toBeDefined();
  expect(powerA.groupName).toBe('Vampiric Powers');
  // The group carries the (unique) link id, which is what keeps the five identically
  // named bloodline groups distinct when the configurator groups by id.
  expect(powerA.groupId).toBe('vp-link-a');
  // The other bloodline's identically-named group stays hidden.
  expect(options.find(o => o.option.targetId === 'power-b')).toBeUndefined();
});

test('collects a group-link\'s modifierGroup-gated modifiers into the group modifiers (Issue 19, B3)', () => {
  // A modifier that lives inside the group link's modifierGroups (not its direct
  // modifiers) must still surface on the collected options' groupModifiers. Resolving
  // the link through getEffectiveModifiers keeps the seam consistent so these gated
  // modifiers are never silently dropped from the group's effective modifier set.
  const GATED_MODIFIER_FIELD = 'grp-link-gated-max';
  const systemWithGatedGroupLink = {
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
                type: 'selectionEntryGroup',
                modifierGroups: [
                  {
                    conditions: [{ field: 'some-cat', type: 'greaterThan', value: 0 }],
                    modifiers: [{ type: 'set', field: GATED_MODIFIER_FIELD, value: 2 }]
                  }
                ]
              }
            ]
          }
        ],
        sharedSelectionEntryGroups: [
          {
            id: 'shared-group',
            name: 'Lahmia traits',
            entryLinks: [
              { id: 'link-trait1', targetId: 'shared-trait1', type: 'selectionEntry' }
            ]
          }
        ],
        sharedSelectionEntries: [
          { id: 'shared-trait1', name: 'Trait 1', type: 'upgrade' }
        ]
      }
    }
  };

  const unitSelection = { selectionEntryId: 'unit-1', selections: [] };
  const options = getUnitOptions(systemWithGatedGroupLink, 'cat-1', unitSelection);

  const traitOption = options.find(o => o.option.targetId === 'shared-trait1');
  expect(traitOption).toBeDefined();
  const gatedModifier = traitOption.groupModifiers?.find(mod => mod.field === GATED_MODIFIER_FIELD);
  expect(gatedModifier).toBeDefined();
  // The enclosing modifierGroup's condition must have been folded onto the modifier.
  expect(gatedModifier.conditions?.some(cond => cond.field === 'some-cat')).toBe(true);
});

