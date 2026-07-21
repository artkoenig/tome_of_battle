import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { saveSystem, getSystem, getAllSystems, saveRoster, getRoster } from './database';
import { findEntryInSystem, findEntryInCatalogue } from '../solver/catalogResolver';

function buildSystem() {
  return {
    id: 'sys-1',
    name: 'Warhammer',
    catalogues: [
      {
        id: 'cat-1',
        name: 'Empire',
        selectionEntries: [{ id: 'se-1', name: 'Empire Captain' }]
      }
    ]
  };
}

beforeEach(() => {
  // A fresh in-memory IndexedDB per test keeps the persistence cases isolated.
  globalThis.indexedDB = new IDBFactory();
});

describe('system persistence after entry resolution', () => {
  it('stores a resolved system without any resolution index', async () => {
    const system = buildSystem();
    findEntryInSystem(system, 'se-1', 'cat-1');
    findEntryInCatalogue(system.catalogues[0], 'se-1');

    await saveSystem(system);

    expect(await getSystem('sys-1')).toEqual(buildSystem());
  });

  it('keeps a system resolvable after a save/load round trip', async () => {
    const system = buildSystem();
    findEntryInSystem(system, 'se-1', 'cat-1');
    await saveSystem(system);

    const [loaded] = await getAllSystems();
    expect(findEntryInSystem(loaded, 'se-1', 'cat-1').name).toBe('Empire Captain');
  });
});

describe('shared database connection', () => {
  it('opens the database only once across many operations', async () => {
    const openSpy = vi.spyOn(globalThis.indexedDB, 'open');

    await saveSystem(buildSystem());
    await saveRoster({ id: 'roster-1', name: 'Empire Army' });
    await getSystem('sys-1');
    await getRoster('roster-1');
    await getAllSystems();

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('reconnects when the underlying IndexedDB factory is replaced', async () => {
    await saveSystem(buildSystem());

    globalThis.indexedDB = new IDBFactory();

    expect(await getSystem('sys-1')).toBeUndefined();
  });
});
