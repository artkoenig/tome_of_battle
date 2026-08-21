import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  getWhfb6LinkingEnabled,
  setWhfb6LinkingEnabled,
  WHFB6_LINKING_DEFAULT,
} from './database';

beforeEach(() => {
  // A fresh in-memory IndexedDB per test keeps the persistence cases isolated.
  globalThis.indexedDB = new IDBFactory();
});

describe('whfb6 linking setting persistence', () => {
  it('defaults to true without a stored record', async () => {
    expect(WHFB6_LINKING_DEFAULT).toBe(true);
    expect(await getWhfb6LinkingEnabled()).toBe(true);
  });

  it('persists a written value and reads it back', async () => {
    await setWhfb6LinkingEnabled(false);
    expect(await getWhfb6LinkingEnabled()).toBe(false);

    await setWhfb6LinkingEnabled(true);
    expect(await getWhfb6LinkingEnabled()).toBe(true);
  });

  it('keeps the persisted value when read through a new database connection', async () => {
    await setWhfb6LinkingEnabled(false);
    // getWhfb6LinkingEnabled opens the database again, mirroring a page reload
    // against the same underlying store.
    expect(await getWhfb6LinkingEnabled()).toBe(false);
  });
});
