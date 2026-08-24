import { describe, it, expect } from 'vitest';
import { allSelectedCatalogues, buildBundleView } from '../../../ui/viewmodels/importerBundle';
import { REVISION_TONE } from '../../../ui/viewmodels/importerRevisionDisplay';

/**
 * Issue 0176 — the bundle view of the import shell, cut out of
 * `useImporter.js`. A pure function: no hook, no provider.
 */
const INDEX_SYSTEM = {
  id: 'sys1',
  name: 'Warhammer',
  gst: { fileName: 'wh.gst', revision: 5 },
  catalogues: [
    { id: 'cat1', name: 'Bretonnia', fileName: 'bret.cat', revision: 3 },
    { id: 'cat2', name: 'Empire', fileName: 'emp.cat', revision: 2 },
  ],
};

const viewOf = (overrides = {}) => buildBundleView({
  availableSystems: [INDEX_SYSTEM],
  selectedBundleSysId: 'sys1',
  selectedCats: allSelectedCatalogues(INDEX_SYSTEM),
  systems: [],
  ...overrides,
});

describe('importerBundle', () => {
  it('marks every catalogue of a system as selected', () => {
    expect(allSelectedCatalogues(INDEX_SYSTEM)).toEqual({ cat1: true, cat2: true });
    expect(allSelectedCatalogues(undefined)).toEqual({});
  });

  it('counts the selected catalogues of the chosen system', () => {
    const view = viewOf({ selectedCats: { cat1: true } });
    expect(view.hasIndex).toBe(true);
    expect(view.selectedCount).toBe(1);
    expect(view.allChecked).toBe(false);
    expect(view.catalogues.map(c => c.isSelected)).toEqual([true, false]);
  });

  it('holds the chosen system against the installed one', () => {
    const stored = { id: 'sys1', gst: { revision: 4 }, catalogues: [{ id: 'cat1', revision: 3 }] };
    const view = viewOf({ systems: [stored] });
    expect(view.revisionDisplay.tone).toBe(REVISION_TONE.ACCENT);
    expect(view.catalogues[0].revisionDisplay.tone).toBe(REVISION_TONE.SUBTLE);
  });

  it('is empty without a chosen system, and knows whether an index arrived at all', () => {
    expect(viewOf({ selectedBundleSysId: 'other' })).toMatchObject({
      hasIndex: true,
      selectedSystem: null,
      selectedCount: 0,
      catalogues: [],
    });
    expect(viewOf({ availableSystems: [], selectedBundleSysId: '' }).hasIndex).toBe(false);
  });
});
