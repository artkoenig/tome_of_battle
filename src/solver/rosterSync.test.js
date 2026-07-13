import { describe, test, expect } from 'vitest';
import { reconcileImportedSelectionIds } from './validator.js';
import { getUnitOptions } from './optionsCollector.js';
import { resolveEntry } from './validator.js';

// Mock system mirroring the three ways New Recruit references an option:
//  - a direct selectionEntry ("Choppa")
//  - an entry link to a shared entry ("General")
//  - an entry link nested inside a group ("Ironskin Shield")
const mockSystem = {
  id: 'sys',
  costTypes: [{ id: 'pts', name: 'pts' }],
  catalogues: [
    {
      id: 'cat',
      selectionEntries: [
        {
          id: 'unit',
          name: 'Orc Warboss',
          type: 'unit',
          selectionEntries: [
            { id: 'se-choppa', name: 'Choppa', type: 'upgrade', costs: [{ typeId: 'pts', value: 0 }] }
          ],
          entryLinks: [
            { id: 'link-general', targetId: 't-general', type: 'selectionEntry' }
          ],
          selectionEntryGroups: [
            {
              id: 'grp-magic',
              name: 'Magic Items',
              entryLinks: [
                { id: 'link-shield', targetId: 't-shield', type: 'selectionEntry' }
              ]
            }
          ]
        }
      ],
      sharedSelectionEntries: [
        { id: 't-general', name: 'General', type: 'upgrade', costs: [{ typeId: 'pts', value: 15 }] },
        { id: 't-shield', name: 'Ironskin Shield', type: 'upgrade', costs: [{ typeId: 'pts', value: 6 }] }
      ]
    }
  ]
};

// A freshly imported roster references options by their TARGET id (New Recruit convention).
const makeImportedRoster = () => ({
  id: 'r1',
  systemId: 'sys',
  catalogueId: 'cat',
  forces: [
    {
      id: 'f1',
      catalogueId: 'cat',
      selections: [
        {
          id: 'u1',
          name: 'Orc Warboss',
          selectionEntryId: 'unit',
          entryLinkId: null,
          number: 1,
          selections: [
            { id: 'c1', name: 'Choppa', selectionEntryId: 'se-choppa', entryLinkId: null, number: 1, selections: [] },
            { id: 'c2', name: 'General', selectionEntryId: 't-general', entryLinkId: null, number: 1, selections: [] },
            { id: 'c3', name: 'Ironskin Shield', selectionEntryId: 't-shield', entryLinkId: null, number: 1, selections: [] }
          ]
        }
      ]
    }
  ]
});

// Mirrors the editor's option-matching logic (SelectionConfigurator.getSubSelectionCount).
const countSelectedByOptionId = (unitSelection, optionId) => {
  const walk = (list) => list.reduce((sum, item) => {
    const matched = (item.entryLinkId || item.selectionEntryId) === optionId ? (item.number || 1) : 0;
    return sum + matched + walk(item.selections || []);
  }, 0);
  return walk(unitSelection.selections || []);
};

describe('reconcileImportedSelectionIds', () => {
  test('rewrites target-id option references to the catalogue link/entry ids the editor matches', () => {
    const roster = makeImportedRoster();
    const modified = reconcileImportedSelectionIds(roster, mockSystem);

    expect(modified).toBe(true);
    const children = roster.forces[0].selections[0].selections;
    const byName = Object.fromEntries(children.map(c => [c.name, c]));

    // Direct selectionEntry keeps its entry id.
    expect(byName['Choppa'].selectionEntryId).toBe('se-choppa');
    expect(byName['Choppa'].entryLinkId).toBe(null);

    // Linked options adopt the link id (matching resolveEntry, which keeps the link id).
    expect(byName['General'].entryLinkId).toBe('link-general');
    expect(byName['General'].selectionEntryId).toBe(null);
    expect(byName['Ironskin Shield'].entryLinkId).toBe('link-shield');
    expect(byName['Ironskin Shield'].selectionEntryId).toBe(null);
  });

  test('makes every imported option recognisable as selected by the editor', () => {
    const roster = makeImportedRoster();
    const unit = roster.forces[0].selections[0];

    // Before reconciliation the linked options are invisible to the editor's matcher.
    const options = getUnitOptions(mockSystem, 'cat', unit);
    const generalOption = options.find(o => resolveEntry(mockSystem, o.option, 'cat').name === 'General');
    const generalResolvedId = resolveEntry(mockSystem, generalOption.option, 'cat').id;
    expect(countSelectedByOptionId(unit, generalResolvedId)).toBe(0);

    reconcileImportedSelectionIds(roster, mockSystem);

    // After reconciliation each catalogue option resolves to a selected count > 0.
    getUnitOptions(mockSystem, 'cat', unit).forEach(({ option }) => {
      const resolvedId = resolveEntry(mockSystem, option, 'cat').id;
      expect(countSelectedByOptionId(unit, resolvedId)).toBeGreaterThan(0);
    });
  });

  test('is idempotent and leaves natively created rosters untouched', () => {
    const roster = makeImportedRoster();
    reconcileImportedSelectionIds(roster, mockSystem); // first pass fixes ids
    const secondPass = reconcileImportedSelectionIds(roster, mockSystem);
    expect(secondPass).toBe(false);
  });
});
