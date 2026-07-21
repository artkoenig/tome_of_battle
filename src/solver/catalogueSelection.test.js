import { describe, it, expect } from 'vitest';
import { getPlayableCatalogues } from './catalogueSelection';

describe('getPlayableCatalogues', () => {
  const factionCatalogue = { id: 'cat-faction', name: 'Faction', isLibrary: false };
  const libraryCatalogue = { id: 'cat-library', name: 'Shared Library', isLibrary: true };

  it('leaves out catalogues flagged as a library', () => {
    const system = { catalogues: [factionCatalogue, libraryCatalogue] };
    expect(getPlayableCatalogues(system).map(c => c.id)).toEqual(['cat-faction']);
  });

  it('keeps a catalogue without the library flag', () => {
    const system = { catalogues: [{ id: 'cat-legacy', name: 'Legacy' }] };
    expect(getPlayableCatalogues(system).map(c => c.id)).toEqual(['cat-legacy']);
  });

  it('returns an empty list for a missing system or missing catalogues', () => {
    expect(getPlayableCatalogues(undefined)).toEqual([]);
    expect(getPlayableCatalogues({})).toEqual([]);
  });

  it('does not modify the system it reads from', () => {
    const system = { catalogues: [factionCatalogue, libraryCatalogue] };
    getPlayableCatalogues(system);
    expect(system.catalogues).toHaveLength(2);
  });
});
