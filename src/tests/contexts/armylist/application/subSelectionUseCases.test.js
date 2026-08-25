import { describe, it, expect, vi } from 'vitest';

import {
  addSubSelectionInstance, removeSubSelectionInstance, changeOptionCount
} from '../../../../contexts/armylist/application/subSelectionUseCases.js';

/**
 * Issue 0188 — the sub-selection operations as use cases of the list context.
 * The report's slot side is a plain stub and an entry without a `targetId`
 * resolves to itself, so nothing here needs React or a catalogue.
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

const NESTED = {
  name: 'list',
  catalogueId: 'roster-cat',
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

const optionsOf = (roster) => roster.forces[0].selections[0].selections;

describe('addSubSelectionInstance', () => {
  it('adds a further instance of an option below the unit', () => {
    const roster = addSubSelectionInstance(NESTED, {
      unitSelectionId: 'u1',
      optionDefinition: { id: 'opt2', name: 'Shield' },
      system: null,
      slots: createSlots(),
    });

    expect(optionsOf(roster).map(option => option.name)).toEqual(['Banner', 'Shield']);
  });

  it('asks the report for the members the option carries', () => {
    const slots = createSlots();
    addSubSelectionInstance(NESTED, {
      unitSelectionId: 'u1',
      optionDefinition: { id: 'opt2', name: 'Shield' },
      system: null,
      slots,
    });

    expect(slots.findDescendantSlot).toHaveBeenCalledWith('slot:u1', 'opt2');
  });
});

describe('removeSubSelectionInstance', () => {
  it('removes a single instance by its selection id', () => {
    const roster = removeSubSelectionInstance(NESTED, {
      unitSelectionId: 'u1', instanceSelectionId: 'o1',
    });

    expect(optionsOf(roster)).toEqual([]);
  });

  it('leaves a force without the unit untouched', () => {
    const roster = removeSubSelectionInstance(NESTED, {
      unitSelectionId: 'unknown', instanceSelectionId: 'o1',
    });

    expect(roster.forces[0]).toBe(NESTED.forces[0]);
  });
});

describe('changeOptionCount', () => {
  const change = (countDelta, optionDefinition = { id: 'opt', name: 'Banner' }) =>
    changeOptionCount(NESTED, {
      unitSelectionId: 'u1', optionDefinition, countDelta, system: null, slots: createSlots(),
    });

  it('raises the count of an existing option', () => {
    expect(optionsOf(change(1))[0].number).toBe(2);
  });

  it('drops the option when its count reaches zero', () => {
    expect(optionsOf(change(-1))).toEqual([]);
  });

  it('creates the option when it is raised from nothing', () => {
    const roster = change(1, { id: 'opt2', name: 'Shield' });

    expect(optionsOf(roster).map(option => option.name)).toEqual(['Banner', 'Shield']);
  });

  it('leaves the roster it was given untouched', () => {
    change(1);

    expect(NESTED.forces[0].selections[0].selections[0].number).toBe(1);
  });
});
