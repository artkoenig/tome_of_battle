import { describe, it, expect, vi } from 'vitest';

import {
  raiseUnit, withRaisedUnits, findTargetForce
} from '../../../../contexts/armylist/application/raiseUnit.js';

/**
 * Issue 0188 — raising a unit is a use case of the list context, so every case
 * here runs without React and without a catalogue: an entry without a
 * `targetId` resolves to itself, and the report's slot side is a plain stub.
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

const ROSTER = {
  name: 'old name',
  catalogueId: 'roster-cat',
  forces: [
    { id: 'f1', catalogueId: 'force-cat', selections: [] },
    { id: 'f2', selections: [] },
  ],
};

const raise = (roster, command, slots = createSlots()) =>
  raiseUnit(roster, { system: null, slots, ...command });

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

describe('raiseUnit', () => {
  it('appends the new unit to the named force and hands it back', () => {
    const { roster, unit } = raise(ROSTER, {
      entry: { id: 'e1', name: 'Ghoul' }, categoryId: 'cat-1', targetForceId: 'f2',
    });

    expect(roster.forces[0].selections).toHaveLength(0);
    expect(roster.forces[1].selections).toEqual([unit]);
    expect(unit).toMatchObject({ name: 'Ghoul', category: 'cat-1' });
  });

  it('leaves the roster it was given untouched', () => {
    raise(ROSTER, { entry: { id: 'e1', name: 'Ghoul' }, categoryId: 'cat-1' });

    expect(ROSTER.forces[0].selections).toHaveLength(0);
  });

  it('falls back to the first force without a target', () => {
    const { roster } = raise(ROSTER, { entry: { id: 'e1', name: 'Ghoul' }, categoryId: 'cat-1' });

    expect(roster.forces[0].selections).toHaveLength(1);
  });

  it('carries the mandatory members the report offers at the force', () => {
    const slots = createSlots({
      findChildSlot: vi.fn(() => ({ raiseMembers: [{ defId: 'm1', count: 2 }] })),
    });
    const { roster } = raise(ROSTER, {
      entry: { id: 'e1', name: 'Ghoul', selectionEntries: [{ id: 'm1', name: 'Ghoul King' }] },
      categoryId: 'cat-1',
      targetForceId: 'f1',
    }, slots);

    expect(slots.findChildSlot).toHaveBeenCalledWith('slot:f1', 'e1');
    expect(roster.forces[0].selections[0].selections)
      .toEqual([expect.objectContaining({ name: 'Ghoul King', number: 2 })]);
  });

  it('raises nothing into a roster without forces', () => {
    const empty = { ...ROSTER, forces: [] };
    const { roster, unit } = raise(empty, { entry: { id: 'e1' }, categoryId: 'cat-1' });

    expect(unit).toBeNull();
    expect(roster).toBe(empty);
  });
});

describe('withRaisedUnits', () => {
  it('returns the roster unchanged for a force it no longer holds', () => {
    expect(withRaisedUnits(ROSTER, 'gone', [{ id: 'u1' }])).toBe(ROSTER);
  });

  it('returns the roster unchanged without units', () => {
    expect(withRaisedUnits(ROSTER, 'f1', [])).toBe(ROSTER);
  });

  it('appends below what the force already holds', () => {
    const held = { ...ROSTER, forces: [{ id: 'f1', selections: [{ id: 'u1' }] }] };
    const raised = withRaisedUnits(held, 'f1', [{ id: 'u2' }]);

    expect(raised.forces[0].selections.map(unit => unit.id)).toEqual(['u1', 'u2']);
  });
});
