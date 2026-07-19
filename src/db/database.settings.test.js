import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  getWhfb6LinkingEnabled,
  setWhfb6LinkingEnabled,
  WHFB6_LINKING_DEFAULT,
  getLocale,
  setLocale,
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

describe('locale setting persistence', () => {
  it('resolves to null without a stored record so the caller can detect', async () => {
    expect(await getLocale()).toBeNull();
  });

  it('persists a chosen locale and reads it back', async () => {
    await setLocale('en');
    expect(await getLocale()).toBe('en');

    await setLocale('de');
    expect(await getLocale()).toBe('de');
  });

  it('keeps the persisted locale when read through a new database connection', async () => {
    await setLocale('en');
    // getLocale opens the database again, mirroring a page reload against the
    // same underlying store — the manual choice survives.
    expect(await getLocale()).toBe('en');
  });

  it('stores the locale independently of the whfb6 linking setting', async () => {
    await setLocale('en');
    await setWhfb6LinkingEnabled(false);
    expect(await getLocale()).toBe('en');
    expect(await getWhfb6LinkingEnabled()).toBe(false);
  });
});
