import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryUnitAdder from './CategoryUnitAdder';

// Lucide icons are irrelevant to the selection logic under test.
vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  X: () => <span data-testid="icon-x" />,
}));

// Render the BottomSheet's children inline whenever it is open, so the offered
// units become queryable without driving the real sheet animation/portal.
vi.mock('./BottomSheet', () => ({
  default: ({ isOpen, children, title }) =>
    isOpen ? (
      <div data-testid="bottom-sheet">
        <h4>{title}</h4>
        {children}
      </div>
    ) : null,
}));

// Category ids used across the fixture. The army offers "Core"; the shared
// library unit is statically filed under "Regiment of Renown".
const CAT_CORE = 'cat-core';
const CAT_ROR = 'cat-regiment-of-renown';
const CAT_RARE = 'cat-rare';

// Mirrors the real "Definitive Edition" Ogre Kingdoms structure: the army
// catalogue links (entryLink) a unit whose selectionEntry lives in a separate
// library catalogue ("Mercenaries") where it is statically primary in
// "Regiment of Renown". A modifierGroup on the link recategorises it into the
// army's "Core" for a standard force (set-primary Core, remove RoR/Rare).
function buildSystem() {
  const ogreBullsTarget = {
    id: 'tgt-ogre-bulls',
    name: 'Ogre Bulls',
    type: 'unit',
    categoryLinks: [
      { targetId: CAT_ROR, primary: true },
      { targetId: CAT_RARE, primary: false },
    ],
    costs: [{ name: 'pts', typeId: 'pts', value: '155' }],
  };

  const ogreBullsLink = {
    id: 'link-ogre-bulls',
    name: 'Ogre Bulls',
    type: 'selectionEntry',
    targetId: 'tgt-ogre-bulls',
    categoryLinks: [],
    // The army recategorises the linked unit into its own "Core". (Deterministic
    // positive/negative condition-gating coverage lives in entryVisibility.test.js;
    // here we only need the unit to surface under Core.)
    modifierGroups: [
      {
        type: 'and',
        conditions: [],
        modifiers: [
          { type: 'set-primary', field: 'category', value: CAT_CORE },
          { type: 'add', field: 'category', value: CAT_CORE },
          { type: 'remove', field: 'category', value: CAT_ROR },
          { type: 'remove', field: 'category', value: CAT_RARE },
        ],
      },
    ],
  };

  // Control: a unit that is statically primary in Core must keep appearing.
  const gnoblarsEntry = {
    id: 'entry-gnoblars',
    name: 'Gnoblars',
    type: 'unit',
    categoryLinks: [{ targetId: CAT_CORE, primary: true }],
    costs: [{ name: 'pts', typeId: 'pts', value: '2' }],
  };

  return {
    catalogues: [
      {
        id: 'army-cat',
        name: 'Ogre Kingdoms',
        selectionEntries: [gnoblarsEntry],
        entryLinks: [ogreBullsLink],
      },
      {
        id: 'library-cat',
        name: 'Mercenaries',
        selectionEntries: [ogreBullsTarget],
      },
    ],
  };
}

function renderCoreAdder(system) {
  const roster = {
    catalogueId: 'army-cat',
    forces: [{ id: 'f-1', catalogueId: 'army-cat', forceEntryId: 'force-standard', selections: [] }],
  };
  render(
    <CategoryUnitAdder
      categoryId={CAT_CORE}
      categoryName="Core"
      system={system}
      activeCatalogue={system.catalogues[0]}
      costTypeLabel="pts"
      costLimitType="pts"
      addUnit={vi.fn()}
      roster={roster}
      selectionCounts={{}}
    />
  );
  // Open the "Core ausheben" popover.
  fireEvent.click(screen.getByTitle('Core ausheben'));
}

describe('CategoryUnitAdder — effective category membership', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers a unit recategorised into Core by a set-primary modifier (Ogre Bulls)', () => {
    renderCoreAdder(buildSystem());
    // Regression: without honouring the set-primary modifier the link stays under
    // its static "Regiment of Renown" primary and never appears here.
    expect(screen.getByText('Ogre Bulls')).toBeTruthy();
  });

  it('still offers a statically-Core unit (no regression)', () => {
    renderCoreAdder(buildSystem());
    expect(screen.getByText('Gnoblars')).toBeTruthy();
  });
});
