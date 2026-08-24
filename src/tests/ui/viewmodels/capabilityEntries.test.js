import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Issue 0177, AC3 — the one place that resolves a report slot back to its
 * catalogue entry.
 *
 * `findEntryInSystem` is the seam here: what matters is which arguments the
 * lookup gets and what the two helpers do with a miss, not how the write model
 * walks a catalogue.
 */
const findEntryInSystem = vi.fn();
vi.mock('../../../domain/roster', () => ({
  findEntryInSystem: (...args) => findEntryInSystem(...args),
}));

const { findCapabilityEntry, capabilityEntryOf } = await import('../../../ui/viewmodels/capabilityEntries');

const SYSTEM = { id: 'sys1' };
const ENTRY = { id: 'def1', name: 'Great Weapon' };

describe('capabilityEntries', () => {
  beforeEach(() => {
    findEntryInSystem.mockReset();
  });

  describe('findCapabilityEntry', () => {
    it('looks the entry up by the slot definition id, inside the given catalogue', () => {
      findEntryInSystem.mockReturnValue(ENTRY);

      expect(findCapabilityEntry(SYSTEM, { defId: 'def1' }, 'cat1')).toBe(ENTRY);
      expect(findEntryInSystem).toHaveBeenCalledWith(SYSTEM, 'def1', 'cat1');
    });

    it('answers null without a slot, and asks the catalogue nothing', () => {
      expect(findCapabilityEntry(SYSTEM, null, 'cat1')).toBeNull();
      expect(findCapabilityEntry(SYSTEM, undefined, 'cat1')).toBeNull();
      expect(findEntryInSystem).not.toHaveBeenCalled();
    });

    it('answers null where the catalogue does not know the entry any more', () => {
      findEntryInSystem.mockReturnValue(undefined);

      expect(findCapabilityEntry(SYSTEM, { defId: 'gone' }, 'cat1')).toBeNull();
    });
  });

  describe('capabilityEntryOf', () => {
    it('hands the catalogue entry through where the lookup finds one', () => {
      findEntryInSystem.mockReturnValue(ENTRY);

      expect(capabilityEntryOf(SYSTEM, { defId: 'def1', name: 'Great Weapon' }, 'cat1')).toBe(ENTRY);
    });

    it('falls back to the name stub off the slot, so the row stays named', () => {
      findEntryInSystem.mockReturnValue(null);

      expect(capabilityEntryOf(SYSTEM, { defId: 'gone', name: 'Great Weapon' }, 'cat1'))
        .toEqual({ id: 'gone', name: 'Great Weapon' });
    });
  });
});
