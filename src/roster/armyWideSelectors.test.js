import { describe, it, expect } from 'vitest';
import {
  collectForceScopedMinSelectors,
  isReachableViaForceCategories,
  collectUnreachableArmyWideSelectors
} from './armyWideSelectors.js';

const CATALOGUE_ID = 'cat-1';
const REACHABLE_CATEGORY = 'special-rules';
const UNLISTED_CATEGORY = 'unlisted-cat';

// A catalogue with the four relevant shapes: a mandatory selector reachable via a force
// category (Bloodlines), a mandatory selector with no matching category (orphan), a
// hidden mandatory selector, a non-mandatory (min 0) force selector, and a plain entry.
const system = {
  catalogues: [{
    id: CATALOGUE_ID,
    selectionEntries: [
      {
        id: 'bloodlines', name: 'Bloodlines', hidden: false,
        categoryLinks: [{ targetId: REACHABLE_CATEGORY, primary: true }],
        constraints: [{ type: 'min', value: 1, scope: 'force', field: 'selections', id: 'c-bl' }]
      },
      {
        id: 'orphan', name: 'Army Doctrine', hidden: false,
        categoryLinks: [{ targetId: UNLISTED_CATEGORY, primary: true }],
        constraints: [{ type: 'min', value: 1, scope: 'force', field: 'selections', id: 'c-or' }]
      },
      {
        id: 'sylvania', name: 'Army of Sylvania', hidden: true,
        constraints: [{ type: 'min', value: 1, scope: 'force', field: 'selections', id: 'c-sy' }]
      },
      {
        id: 'skeletons', name: 'Skeletons',
        constraints: [{ type: 'min', value: 0, scope: 'force', field: 'selections', id: 'c-sk' }]
      },
      { id: 'zombies', name: 'Zombies', constraints: [] }
    ]
  }]
};

const forceDef = {
  id: 'fe-1',
  categoryLinks: [{ targetId: REACHABLE_CATEGORY }, { targetId: 'core' }]
};

const visibilityContext = () => ({
  system,
  catalogueId: CATALOGUE_ID,
  forceDef,
  roster: { forces: [{ id: 'f1' }] },
  selectionCounts: {},
  forceCategoryCounts: {},
  force: { id: 'f1' }
});

describe('collectForceScopedMinSelectors', () => {
  it('returns every root entry carrying a force-scoped min constraint', () => {
    const ids = collectForceScopedMinSelectors(system, CATALOGUE_ID).map(c => c.entry.id).sort();
    expect(ids).toEqual(['bloodlines', 'orphan', 'skeletons', 'sylvania']);
  });

  it('returns an empty list for an unknown catalogue', () => {
    expect(collectForceScopedMinSelectors(system, 'no-such-cat')).toEqual([]);
  });
});

describe('isReachableViaForceCategories', () => {
  it('is true when a categoryLink targets a category the force offers', () => {
    const bloodlines = system.catalogues[0].selectionEntries[0];
    expect(isReachableViaForceCategories(bloodlines, forceDef)).toBe(true);
  });

  it('is false when no categoryLink matches a force category', () => {
    const orphan = system.catalogues[0].selectionEntries[1];
    expect(isReachableViaForceCategories(orphan, forceDef)).toBe(false);
  });
});

describe('collectUnreachableArmyWideSelectors', () => {
  it('returns only mandatory, visible selectors that no force category surfaces', () => {
    const entries = collectUnreachableArmyWideSelectors(visibilityContext());
    // Bloodlines is reachable (excluded), Sylvania is hidden (excluded), Skeletons is
    // min 0 (excluded); only the orphan mandatory selector needs its own configurator.
    expect(entries.map(e => e.id)).toEqual(['orphan']);
  });
});
