import { describe, it, expect } from 'vitest';
import {
  catalogueDirectoryFromIndex,
  catalogueDirectoryFromLinks,
  findMissingLibraryDependencies,
} from './libraryDependencies';

describe('findMissingLibraryDependencies with an index-bounded directory', () => {
  const indexDirectory = catalogueDirectoryFromIndex([
    { id: 'dogs', name: 'Dogs of War' },
    { id: 'merc', name: 'Mercenaries' },
    { id: 'empire', name: 'Empire' },
  ]);

  it('flags a catalogueLink target that exists but was left out of the import', () => {
    const importedCatalogues = [
      { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'merc', name: 'Mercenaries' }] },
    ];

    const missing = findMissingLibraryDependencies(importedCatalogues, indexDirectory);

    expect(missing).toEqual([{ id: 'merc', name: 'Mercenaries', requiredBy: ['Dogs of War'] }]);
  });

  it('returns nothing when the linked target is part of the import', () => {
    const importedCatalogues = [
      { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'merc', name: 'Mercenaries' }] },
      { id: 'merc', name: 'Mercenaries', catalogueLinks: [] },
    ];

    const missing = findMissingLibraryDependencies(importedCatalogues, indexDirectory);

    expect(missing).toEqual([]);
  });

  it('ignores a target that is not a selectable catalogue at all', () => {
    const importedCatalogues = [
      { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'ghost', name: 'Phantom' }] },
    ];

    const missing = findMissingLibraryDependencies(importedCatalogues, indexDirectory);

    expect(missing).toEqual([]);
  });

  it('deduplicates a shared missing dependency and lists every referencing catalogue', () => {
    const importedCatalogues = [
      { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'merc' }] },
      { id: 'empire', name: 'Empire', catalogueLinks: [{ targetId: 'merc' }] },
    ];

    const missing = findMissingLibraryDependencies(importedCatalogues, indexDirectory);

    expect(missing).toEqual([{ id: 'merc', name: 'Mercenaries', requiredBy: ['Dogs of War', 'Empire'] }]);
  });

  it('tolerates catalogues without catalogueLinks', () => {
    const importedCatalogues = [{ id: 'empire', name: 'Empire' }];

    const missing = findMissingLibraryDependencies(importedCatalogues, indexDirectory);

    expect(missing).toEqual([]);
  });

  it('tolerates a missing catalogue list', () => {
    expect(findMissingLibraryDependencies(undefined, indexDirectory)).toEqual([]);
  });

  it('ignores a link without a target id', () => {
    const importedCatalogues = [{ id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ name: 'Nowhere' }] }];

    expect(findMissingLibraryDependencies(importedCatalogues, indexDirectory)).toEqual([]);
  });
});

describe('findMissingLibraryDependencies with a link-derived directory', () => {
  const linkDirectory = catalogueDirectoryFromLinks();

  it('flags any link target missing from the import, since no index bounds the set', () => {
    const importedCatalogues = [
      { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'merc', name: 'Mercenaries' }] },
    ];

    const missing = findMissingLibraryDependencies(importedCatalogues, linkDirectory);

    expect(missing).toEqual([{ id: 'merc', name: 'Mercenaries', requiredBy: ['Dogs of War'] }]);
  });

  it('falls back to the target id when the link carries no name', () => {
    const importedCatalogues = [{ id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'merc' }] }];

    const missing = findMissingLibraryDependencies(importedCatalogues, linkDirectory);

    expect(missing).toEqual([{ id: 'merc', name: 'merc', requiredBy: ['Dogs of War'] }]);
  });

  it('returns nothing when every link target is part of the import', () => {
    const importedCatalogues = [
      { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'merc', name: 'Mercenaries' }] },
      { id: 'merc', name: 'Mercenaries', catalogueLinks: [] },
    ];

    expect(findMissingLibraryDependencies(importedCatalogues, linkDirectory)).toEqual([]);
  });
});
