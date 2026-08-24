import { describe, it, expect } from 'vitest';

import {
  catalogueIdOfForce,
  catalogueIdContaining,
  createSelectionFactory,
} from '../../../ui/viewmodels/rosterSelectionFactory';

/**
 * Issue 0176 — the selection factory cut out of `useRosterState`. An entry
 * without a `targetId` resolves to itself, so these cases need no catalogue and
 * run instantly.
 */
describe('rosterSelectionFactory', () => {
  const roster = {
    catalogueId: 'roster-cat',
    forces: [
      { id: 'f1', catalogueId: 'force-cat', selections: [{ id: 's1', selections: [{ id: 's1a', selections: [] }] }] },
      { id: 'f2', selections: [{ id: 's2', selections: [] }] },
    ],
  };

  describe('catalogueIdOfForce', () => {
    it("prefers the force's own catalogue", () => {
      expect(catalogueIdOfForce(roster, roster.forces[0])).toBe('force-cat');
    });

    it("falls back to the roster's catalogue", () => {
      expect(catalogueIdOfForce(roster, roster.forces[1])).toBe('roster-cat');
    });

    it('is null without a force and without a roster', () => {
      expect(catalogueIdOfForce(null, null)).toBeNull();
    });
  });

  describe('catalogueIdContaining', () => {
    it('answers with the catalogue of the force holding the selection', () => {
      expect(catalogueIdContaining(roster, 's1a')).toBe('force-cat');
    });

    it('falls back to the roster for a force without a catalogue', () => {
      expect(catalogueIdContaining(roster, 's2')).toBe('roster-cat');
    });
  });

  describe('createSelectionFactory', () => {
    it('builds a selection from a bare entry', () => {
      const create = createSelectionFactory(null);
      const selection = create({ id: 'e1', name: 'Ghoul' }, 'cat-1', 'force-cat');

      expect(selection).toMatchObject({
        selectionEntryId: 'e1',
        entryLinkId: null,
        name: 'Ghoul',
        number: 1,
        category: 'cat-1',
        selections: [],
      });
      expect(selection.id).toEqual(expect.any(String));
    });

    it('carries an entry link as a link id', () => {
      const create = createSelectionFactory(null);
      const selection = create({ id: 'l1', targetId: 'e1', name: 'Zombie' }, null, null);

      expect(selection.entryLinkId).toBe('l1');
      expect(selection.selectionEntryId).toBeNull();
    });

    it('is null for a missing entry', () => {
      expect(createSelectionFactory(null)(null, null, null)).toBeNull();
    });
  });
});
