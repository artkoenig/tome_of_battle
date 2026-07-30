import { describe, it, expect } from 'vitest';
import { findEntryInCatalogue, findEntryInSystem, resolveEntry } from './catalogResolver.js';

describe('catalogResolver - findEntryInCatalogue', () => {
  it('finds direct child objects in catalogue', () => {
    const mockCat = {
      id: 'cat-1',
      selectionEntries: [
        { id: 'se-1', name: 'Empire Captain' }
      ]
    };

    const found = findEntryInCatalogue(mockCat, 'se-1');
    expect(found).toBe(mockCat.selectionEntries[0]);
  });

  it('reuses the index across lookups without touching the catalogue object', () => {
    const mockCat = {
      id: 'cat-1',
      selectionEntries: [
        { id: 'se-1', name: 'Empire Captain' }
      ]
    };
    const ownKeysBefore = Object.keys(mockCat);

    expect(findEntryInCatalogue(mockCat, 'se-1')).toBe(findEntryInCatalogue(mockCat, 'se-1'));
    expect(Object.keys(mockCat)).toEqual(ownKeysBefore);
  });

  it('indexes a replaced catalogue object independently of the previous one', () => {
    const originalCat = {
      id: 'cat-1',
      selectionEntries: [{ id: 'se-1', name: 'Original' }]
    };
    expect(findEntryInCatalogue(originalCat, 'se-1').name).toBe('Original');

    const replacedCat = {
      id: 'cat-1',
      selectionEntries: [{ id: 'se-1', name: 'Brand New' }]
    };
    expect(findEntryInCatalogue(replacedCat, 'se-1').name).toBe('Brand New');
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

  it('does not attach the index to the system or its catalogues', () => {
    const mockSystem = {
      id: 'sys-1',
      catalogues: [
        {
          id: 'cat-1',
          selectionEntries: [{ id: 'se-1', name: 'Captain' }]
        }
      ]
    };
    const systemKeysBefore = Object.keys(mockSystem);
    const catalogueKeysBefore = Object.keys(mockSystem.catalogues[0]);

    findEntryInSystem(mockSystem, 'se-1', 'cat-1');

    expect(Object.keys(mockSystem)).toEqual(systemKeysBefore);
    expect(Object.keys(mockSystem.catalogues[0])).toEqual(catalogueKeysBefore);
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

  it('resolves publicationId and page to publicationRef on resolved entry, rules, and profiles', () => {
    const mockSystem = {
      id: 'sys-1',
      publications: [
        { id: 'pub-brb', name: 'Rulebook' }
      ],
      catalogues: [
        {
          id: 'cat-1',
          publications: [
            { id: 'pub-codex', name: 'Codex' }
          ],
          selectionEntries: [
            {
              id: 'target-1',
              name: 'Space Marine',
              publicationId: 'pub-codex',
              page: '44',
              rules: [
                { id: 'rule-1', name: 'Rite', publicationId: 'pub-codex', page: '45' }
              ],
              profiles: [
                { id: 'prof-1', name: 'Stats', publicationId: 'pub-brb', page: '200' }
              ]
            }
          ]
        }
      ]
    };

    const linkEntry = {
      id: 'link-1',
      targetId: 'target-1',
      name: 'Linked Space Marine'
    };

    const resolved = resolveEntry(mockSystem, linkEntry, 'cat-1');
    expect(resolved.publicationRef).toBe('[Codex, S. 44]');
    expect(resolved.rules[0].publicationRef).toBe('[Codex, S. 45]');
    expect(resolved.profiles[0].publicationRef).toBe('[Rulebook, S. 200]');
  });

  it('flattens an inline infoGroup into the entry profiles and rules', () => {
    const mockSystem = { id: 'sys-1', catalogues: [{ id: 'cat-1' }] };
    const entry = {
      id: 'se-1',
      name: 'Wizard',
      infoGroups: [
        {
          id: 'ig-1',
          name: 'Spellcasting',
          profiles: [{ id: 'prof-spell', name: 'Fireball', characteristics: [] }],
          rules: [{ id: 'rule-cast', name: 'Cast on 7+' }]
        }
      ]
    };

    const resolved = resolveEntry(mockSystem, entry, 'cat-1');
    expect(resolved.profiles.map(p => p.id)).toEqual(['prof-spell']);
    expect(resolved.rules.map(r => r.id)).toEqual(['rule-cast']);
  });

  it('resolves an infoLink of type infoGroup, including infoLinks nested inside the group', () => {
    const mockSystem = {
      id: 'sys-1',
      catalogues: [
        {
          id: 'cat-1',
          sharedRules: [{ id: 'rule-ward', name: 'Ward Save' }],
          sharedInfoGroups: [
            {
              id: 'ig-blessings',
              name: 'Blessings',
              rules: [{ id: 'rule-blessed', name: 'Blessed' }],
              infoLinks: [{ id: 'il-ward', targetId: 'rule-ward', type: 'rule' }]
            }
          ]
        }
      ]
    };

    const entry = {
      id: 'se-1',
      name: 'Priest',
      infoLinks: [{ id: 'il-blessings', targetId: 'ig-blessings', type: 'infoGroup' }]
    };

    const resolved = resolveEntry(mockSystem, entry, 'cat-1');
    expect(resolved.rules.map(r => r.id).sort()).toEqual(['rule-blessed', 'rule-ward']);
  });

  it('marks profiles and rules bundled by a hidden infoGroup as hidden', () => {
    const mockSystem = { id: 'sys-1', catalogues: [{ id: 'cat-1' }] };
    const entry = {
      id: 'se-1',
      name: 'Hidden Bundle',
      infoGroups: [
        {
          id: 'ig-hidden',
          name: 'Concealed',
          hidden: true,
          profiles: [{ id: 'prof-secret', name: 'Secret', characteristics: [] }],
          rules: [{ id: 'rule-secret', name: 'Secret Rule' }]
        }
      ]
    };

    const resolved = resolveEntry(mockSystem, entry, 'cat-1');
    expect(resolved.profiles.find(p => p.id === 'prof-secret').hidden).toBe(true);
    expect(resolved.rules.find(r => r.id === 'rule-secret').hidden).toBe(true);
  });
});
