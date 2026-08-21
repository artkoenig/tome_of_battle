import { describe, it, expect, vi } from 'vitest';

import { createRosterCommands, findTargetForce } from './rosterCommands';

/**
 * Issue 0176 — the write commands cut out of `useRosterState`. They are a plain
 * factory over roster, report slots and the state writers, so every case here
 * runs without React and without a catalogue: an entry without a `targetId`
 * resolves to itself.
 */

function createSlots(overrides = {}) {
  return {
    pathOfForce: vi.fn(forceId => `slot:${forceId}`),
    pathOfSelection: vi.fn(selectionId => `slot:${selectionId}`),
    findChildSlot: vi.fn(() => undefined),
    findDescendantSlot: vi.fn(() => undefined),
    ...overrides,
  };
}

/** A `setRoster` that applies the updater to a roster held in the closure. */
function createStateSeam(initialRoster) {
  const seam = {
    roster: initialRoster,
    selectedSelectionId: null,
    setRoster: (updater) => { seam.roster = updater(seam.roster); },
    setSelectedSelectionId: (id) => { seam.selectedSelectionId = id; },
    saveNow: vi.fn(() => Promise.resolve()),
  };
  return seam;
}

function commandsFor(seam, slots = createSlots(), system = null) {
  return createRosterCommands({
    roster: seam.roster,
    system,
    slots,
    setRoster: seam.setRoster,
    selectedSelectionId: seam.selectedSelectionId,
    setSelectedSelectionId: seam.setSelectedSelectionId,
    saveNow: seam.saveNow,
  });
}

const ROSTER = {
  name: 'old name',
  catalogueId: 'roster-cat',
  forces: [
    { id: 'f1', catalogueId: 'force-cat', selections: [] },
    { id: 'f2', selections: [] },
  ],
};

describe('findTargetForce', () => {
  it('picks the named force', () => {
    expect(findTargetForce(ROSTER.forces, 'f2').id).toBe('f2');
  });

  it('falls back to the first force without a name', () => {
    expect(findTargetForce(ROSTER.forces, null).id).toBe('f1');
  });

  it('is null without forces', () => {
    expect(findTargetForce([], 'f1')).toBeNull();
  });
});

describe('createRosterCommands', () => {
  describe('addUnit', () => {
    it('appends the new unit to the named force and selects it', () => {
      const seam = createStateSeam(ROSTER);
      commandsFor(seam).addUnit({ id: 'e1', name: 'Ghoul' }, 'cat-1', 'f2');

      expect(seam.roster.forces[0].selections).toHaveLength(0);
      const [unit] = seam.roster.forces[1].selections;
      expect(unit).toMatchObject({ name: 'Ghoul', category: 'cat-1' });
      expect(seam.selectedSelectionId).toBe(unit.id);
    });

    it('falls back to the first force without a target', () => {
      const seam = createStateSeam(ROSTER);
      commandsFor(seam).addUnit({ id: 'e1', name: 'Ghoul' }, 'cat-1');

      expect(seam.roster.forces[0].selections).toHaveLength(1);
    });

    it('carries the mandatory members the report offers at the force', () => {
      const slots = createSlots({
        findChildSlot: vi.fn(() => ({
          raiseMembers: [{ defId: 'm1', count: 2 }],
        })),
      });
      const seam = createStateSeam(ROSTER);
      commandsFor(seam, slots).addUnit(
        { id: 'e1', name: 'Ghoul', selectionEntries: [{ id: 'm1', name: 'Ghoul King' }] },
        'cat-1',
        'f1'
      );

      expect(slots.findChildSlot).toHaveBeenCalledWith('slot:f1', 'e1');
      expect(seam.roster.forces[0].selections[0].selections)
        .toEqual([expect.objectContaining({ name: 'Ghoul King', number: 2 })]);
    });

    it('writes nothing into a force the state no longer holds', () => {
      const seam = createStateSeam(ROSTER);
      seam.setRoster = (updater) => { seam.roster = updater({ ...ROSTER, forces: [] }); };
      commandsFor(seam).addUnit({ id: 'e1', name: 'Ghoul' }, 'cat-1', 'f1');

      expect(seam.roster.forces).toEqual([]);
    });
  });

  describe('removeUnit', () => {
    const withUnits = {
      ...ROSTER,
      forces: [{ id: 'f1', selections: [{ id: 'u1', selections: [] }, { id: 'u2', selections: [] }] }],
    };

    it('drops the unit from its force', () => {
      const seam = createStateSeam(withUnits);
      commandsFor(seam).removeUnit('u1');

      expect(seam.roster.forces[0].selections.map(s => s.id)).toEqual(['u2']);
    });

    it('clears the UI selection when the removed unit was selected', () => {
      const seam = createStateSeam(withUnits);
      seam.selectedSelectionId = 'u1';
      commandsFor(seam).removeUnit('u1');

      expect(seam.selectedSelectionId).toBeNull();
    });

    it('keeps a UI selection that points elsewhere', () => {
      const seam = createStateSeam(withUnits);
      seam.selectedSelectionId = 'u2';
      commandsFor(seam).removeUnit('u1');

      expect(seam.selectedSelectionId).toBe('u2');
    });
  });

  describe('copyUnit', () => {
    it('inserts a clone with fresh ids right after the original', () => {
      const seam = createStateSeam({
        ...ROSTER,
        forces: [{
          id: 'f1',
          selections: [
            { id: 'u1', name: 'Ghoul', selections: [{ id: 'o1', name: 'Banner', selections: [] }] },
            { id: 'u2', name: 'Zombie', selections: [] },
          ],
        }],
      });
      commandsFor(seam).copyUnit('u1');

      const selections = seam.roster.forces[0].selections;
      expect(selections.map(s => s.name)).toEqual(['Ghoul', 'Ghoul', 'Zombie']);
      expect(selections[1].id).not.toBe('u1');
      expect(selections[1].selections[0].id).not.toBe('o1');
      expect(selections[1].selections[0].name).toBe('Banner');
    });

    it('leaves the roster untouched for an unknown id', () => {
      const seam = createStateSeam(ROSTER);
      commandsFor(seam).copyUnit('nope');

      expect(seam.roster).toBe(ROSTER);
    });
  });

  describe('sub selection operations', () => {
    const nested = {
      ...ROSTER,
      forces: [{
        id: 'f1',
        catalogueId: 'force-cat',
        selections: [{
          id: 'u1',
          name: 'Ghoul',
          selections: [{ id: 'o1', selectionEntryId: 'opt', name: 'Banner', number: 1, selections: [] }],
        }],
      }],
    };

    it('adds a further instance of an option below the unit', () => {
      const seam = createStateSeam(nested);
      commandsFor(seam).addSubSelectionInstance('u1', { id: 'opt2', name: 'Shield' });

      const options = seam.roster.forces[0].selections[0].selections;
      expect(options.map(o => o.name)).toEqual(['Banner', 'Shield']);
    });

    it('removes a single instance by its selection id', () => {
      const seam = createStateSeam(nested);
      commandsFor(seam).removeSubSelectionInstance('u1', 'o1');

      expect(seam.roster.forces[0].selections[0].selections).toEqual([]);
    });

    it('raises the count of an existing option', () => {
      const seam = createStateSeam(nested);
      commandsFor(seam).changeSubSelectionCount('u1', { id: 'opt', name: 'Banner' }, 1);

      expect(seam.roster.forces[0].selections[0].selections[0].number).toBe(2);
    });

    it('leaves a force without the unit untouched', () => {
      const seam = createStateSeam(nested);
      const otherForce = seam.roster.forces[0];
      commandsFor(seam).removeSubSelectionInstance('unknown', 'o1');

      expect(seam.roster.forces[0]).toBe(otherForce);
    });
  });

  it('updateRosterName renames the roster', () => {
    const seam = createStateSeam(ROSTER);
    commandsFor(seam).updateRosterName('new name');

    expect(seam.roster.name).toBe('new name');
    expect(seam.roster.forces).toBe(ROSTER.forces);
  });

  it('save hands the current roster to the persistence seam', async () => {
    const seam = createStateSeam(ROSTER);
    await commandsFor(seam).save();

    expect(seam.saveNow).toHaveBeenCalledWith(ROSTER);
  });
});
