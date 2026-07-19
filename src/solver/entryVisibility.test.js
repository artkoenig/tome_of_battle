import { describe, it, expect } from 'vitest';
import { getEffectiveEntryCategoryLinks, isEntryPrimaryInCategory, getVisibleCatalogueEntriesForCategory } from './entryVisibility.js';

// Category ids used across the fixture.
const CAT_CORE = 'cat-core';
const CAT_ROR = 'cat-regiment-of-renown';
const CAT_RARE = 'cat-rare';

// A selection whose presence gates the recategorisation modifier, so a single fixture
// can exercise both the "modifier applies" and "modifier gated off" paths.
const RECATEGORISE_TRIGGER = 'recategorise-trigger';

// Mirrors the real "Definitive Edition" Ogre Kingdoms structure: the army catalogue
// links (entryLink) a unit defined in a separate library catalogue where it is
// statically primary in "Regiment of Renown". A modifierGroup on the link recategorises
// it into the army's "Core" when its condition passes (in the real data every branch
// sets Core; here the condition is a simple selection-count gate so the test can toggle
// it deterministically without relying on force-scope resolution).
function buildSystem() {
  const target = {
    id: 'tgt-ogre-bulls',
    name: 'Ogre Bulls',
    type: 'unit',
    categoryLinks: [
      { targetId: CAT_ROR, primary: true },
      { targetId: CAT_RARE, primary: false },
    ],
  };

  const link = {
    id: 'link-ogre-bulls',
    name: 'Ogre Bulls',
    type: 'selectionEntry',
    targetId: 'tgt-ogre-bulls',
    categoryLinks: [],
    modifierGroups: [
      {
        type: 'and',
        conditions: [
          { type: 'atLeast', value: 1, field: RECATEGORISE_TRIGGER, childId: RECATEGORISE_TRIGGER },
        ],
        modifiers: [
          { type: 'set-primary', field: 'category', value: CAT_CORE },
          { type: 'add', field: 'category', value: CAT_CORE },
          { type: 'remove', field: 'category', value: CAT_ROR },
          { type: 'remove', field: 'category', value: CAT_RARE },
        ],
      },
    ],
  };

  return {
    link,
    system: {
      catalogues: [
        { id: 'army-cat', name: 'Ogre Kingdoms', entryLinks: [link] },
        { id: 'library-cat', name: 'Mercenaries', selectionEntries: [target] },
      ],
    },
  };
}

const roster = { catalogueId: 'army-cat', forces: [{ id: 'f-1', catalogueId: 'army-cat', selections: [] }] };
const force = roster.forces[0];
const APPLIED = { [RECATEGORISE_TRIGGER]: 1 }; // selection counts that satisfy the gate
const GATED_OFF = {}; // no trigger selection -> modifier does not fire

describe('getEffectiveEntryCategoryLinks / isEntryPrimaryInCategory', () => {
  it('resolves an entryLink into its library target and applies a set-primary category modifier', () => {
    const { link, system } = buildSystem();

    const links = getEffectiveEntryCategoryLinks(link, { system, roster, selectionCounts: APPLIED, force });
    const primary = links.filter(l => l.primary).map(l => l.targetId);

    expect(primary).toEqual([CAT_CORE]);
    // The static Regiment of Renown / Rare memberships are removed by the modifier.
    expect(links.some(l => l.targetId === CAT_ROR)).toBe(false);
    expect(links.some(l => l.targetId === CAT_RARE)).toBe(false);
  });

  it('reports the effective primary category, not the static one', () => {
    const { link, system } = buildSystem();

    expect(isEntryPrimaryInCategory(link, CAT_CORE, { system, roster, selectionCounts: APPLIED, force })).toBe(true);
    expect(isEntryPrimaryInCategory(link, CAT_ROR, { system, roster, selectionCounts: APPLIED, force })).toBe(false);
  });

  it('keeps the static primary category when the modifier condition fails', () => {
    const { link, system } = buildSystem();

    expect(isEntryPrimaryInCategory(link, CAT_CORE, { system, roster, selectionCounts: GATED_OFF, force })).toBe(false);
    expect(isEntryPrimaryInCategory(link, CAT_ROR, { system, roster, selectionCounts: GATED_OFF, force })).toBe(true);
  });

  it('returns an empty list for an unresolvable entry', () => {
    const { system } = buildSystem();
    const dangling = { id: 'x', name: 'X', type: 'selectionEntry', targetId: 'does-not-exist' };
    expect(getEffectiveEntryCategoryLinks(dangling, { system, roster, selectionCounts: APPLIED, force })).toEqual([]);
  });
});

// Extracted from CategoryUnitAdder's own enumeration (main-issue 35) so
// list-configuration category classification can reuse the exact same
// catalogue membership CategoryUnitAdder already offers as addable units.
describe('getVisibleCatalogueEntriesForCategory', () => {
  it('returns entryLinks whose effective primary category matches, honouring modifier-driven recategorisation', () => {
    const { link, system } = buildSystem();
    const armyCatalogue = system.catalogues.find(c => c.id === 'army-cat');

    expect(getVisibleCatalogueEntriesForCategory(armyCatalogue, CAT_CORE, {
      system, roster, selectionCounts: APPLIED, force
    })).toEqual([link]);

    expect(getVisibleCatalogueEntriesForCategory(armyCatalogue, CAT_CORE, {
      system, roster, selectionCounts: GATED_OFF, force
    })).toEqual([]);
  });

  it('excludes a conditionally hidden entry', () => {
    const hiddenLink = {
      id: 'link-hidden', name: 'Hidden Unit', type: 'selectionEntry', targetId: 'tgt-hidden', categoryLinks: [], hidden: true
    };
    const target = { id: 'tgt-hidden', name: 'Hidden Unit', type: 'unit', categoryLinks: [{ targetId: CAT_CORE, primary: true }] };
    const catalogue = { id: 'army-cat-2', entryLinks: [hiddenLink], selectionEntries: [] };
    const sys = { catalogues: [catalogue, { id: 'lib-2', selectionEntries: [target] }] };

    expect(getVisibleCatalogueEntriesForCategory(catalogue, CAT_CORE, {
      system: sys, roster, selectionCounts: {}, force
    })).toEqual([]);
  });

  it('returns an empty list without a catalogue', () => {
    expect(getVisibleCatalogueEntriesForCategory(null, CAT_CORE, {
      system: {}, roster, selectionCounts: {}, force
    })).toEqual([]);
  });
});
