import { describe, it, expect } from 'vitest';
import { findEntryInCatalogue, findEntryInSystem, resolveEntry } from './catalogResolver.js';

describe('catalogResolver - findEntryInCatalogue', () => {
  it('finds and caches direct child objects in catalogue', () => {
    const mockCat = {
      id: 'cat-1',
      selectionEntries: [
        { id: 'se-1', name: 'Empire Captain' }
      ]
    };

    const found = findEntryInCatalogue(mockCat, 'se-1');
    expect(found).toEqual({ id: 'se-1', name: 'Empire Captain' });
    expect(mockCat._entryCache.get('se-1')).toBe(found);
  });
});

describe('catalogResolver - findEntryInSystem', () => {
  it('finds entry in preferred catalogue when catalogueId is specified', () => {
    const mockSystem = {
      id: 'sys-1',
      catalogues: [
        {
          id: 'cat-1',
          selectionEntries: [{ id: 'se-1', name: 'Captain from preferred' }]
        },
        {
          id: 'cat-2',
          selectionEntries: [{ id: 'se-1', name: 'Captain from other' }]
        }
      ]
    };

    const found = findEntryInSystem(mockSystem, 'se-1', 'cat-1');
    expect(found.name).toBe('Captain from preferred');
  });

  it('falls back to search other catalogues if not found in preferred', () => {
    const mockSystem = {
      id: 'sys-1',
      catalogues: [
        {
          id: 'cat-1',
          selectionEntries: [{ id: 'se-1', name: 'Preferred' }]
        },
        {
          id: 'cat-2',
          selectionEntries: [{ id: 'se-2', name: 'Fallback target' }]
        }
      ]
    };

    const found = findEntryInSystem(mockSystem, 'se-2', 'cat-1');
    expect(found.name).toBe('Fallback target');
  });

  it('returns null if entry does not exist anywhere in system', () => {
    const mockSystem = {
      id: 'sys-1',
      catalogues: [
        {
          id: 'cat-1',
          selectionEntries: [{ id: 'se-1', name: 'One' }]
        }
      ]
    };

    const found = findEntryInSystem(mockSystem, 'non-existent', 'cat-1');
    expect(found).toBeNull();
  });

  it('uses caching for performance and invalidates when system catalogues reference changes', () => {
    const mockSystem = {
      id: 'sys-1',
      catalogues: [
        {
          id: 'cat-1',
          selectionEntries: [{ id: 'se-1', name: 'Original' }]
        }
      ]
    };

    const firstRun = findEntryInSystem(mockSystem, 'se-1');
    expect(firstRun.name).toBe('Original');
    
    // Modify catalogue directly to see cache in action
    mockSystem.catalogues[0].selectionEntries[0].name = 'Modified In-Place';
    const secondRun = findEntryInSystem(mockSystem, 'se-1');
    expect(secondRun.name).toBe('Modified In-Place'); // Same object in cache

    // Change system.catalogues reference
    mockSystem.catalogues = [
      {
        id: 'cat-1',
        selectionEntries: [{ id: 'se-1', name: 'Brand New' }]
      }
    ];

    const thirdRun = findEntryInSystem(mockSystem, 'se-1');
    expect(thirdRun.name).toBe('Brand New'); // Invalidated and re-fetched
  });
});

describe('catalogResolver - resolveEntry', () => {
  it('returns entry directly if it has no targetId (is not an entryLink)', () => {
    const mockSystem = { id: 'sys-1', catalogues: [] };
    const rawEntry = { id: 'se-1', name: 'Foot Knight', costs: [{ value: 10 }] };
    
    const resolved = resolveEntry(mockSystem, rawEntry);
    expect(resolved).toEqual(rawEntry);
  });

  it('resolves an entryLink with targetId and merges characteristics and constraints', () => {
    const mockSystem = {
      id: 'sys-1',
      catalogues: [
        {
          id: 'cat-1',
          selectionEntries: [
            {
              id: 'target-1',
              name: 'Base Knight',
              constraints: [{ type: 'max', value: 2 }],
              costs: [{ typeId: 'pts', value: 20 }]
            }
          ]
        }
      ]
    };

    const linkEntry = {
      id: 'link-1',
      targetId: 'target-1',
      name: 'Linked Knight Extra',
      constraints: [{ type: 'min', value: 1 }],
      costs: []
    };

    const resolved = resolveEntry(mockSystem, linkEntry, 'cat-1');
    expect(resolved.id).toBe('link-1'); // preserves link id
    expect(resolved.targetId).toBe('target-1');
    expect(resolved.name).toBe('Linked Knight Extra');
    expect(resolved.costs).toEqual([{ typeId: 'pts', value: 20 }]); // falls back to target cost
    expect(resolved.constraints).toEqual([
      { type: 'min', value: 1 },
      { type: 'max', value: 2 }
    ]);
  });

  it('resolves infoLinks of type rule and profile', () => {
    const mockSystem = {
      id: 'sys-1',
      catalogues: [
        {
          id: 'cat-1',
          sharedRules: [
            { id: 'rule-1', name: 'Knightly Virtue', description: 'Rules text' }
          ],
          sharedProfiles: [
            { id: 'prof-1', name: 'Knight Profile', profileTypeName: 'Unit', characteristics: [] }
          ]
        }
      ]
    };

    const entryWithLinks = {
      id: 'se-1',
      name: 'Grail Knight',
      infoLinks: [
        { targetId: 'rule-1', type: 'rule' },
        { targetId: 'prof-1', type: 'profile' }
      ]
    };

    const resolved = resolveEntry(mockSystem, entryWithLinks, 'cat-1');
    expect(resolved.rules).toEqual([
      { id: 'rule-1', name: 'Knightly Virtue', description: 'Rules text' }
    ]);
    expect(resolved.profiles).toEqual([
      { id: 'prof-1', name: 'Knight Profile', profileTypeName: 'Unit', characteristics: [] }
    ]);
  });

  it('returns null if input entry is falsy', () => {
    const resolved = resolveEntry({ id: 'sys-1' }, null);
    expect(resolved).toBeNull();
  });
});
