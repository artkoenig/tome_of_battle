import { describe, test, expect } from 'vitest';
import { syncRosterSelectionsWithSystem } from './validator.js';

// Gespeicherte Roster tragen Namen und (historisch) Kosten mit sich. Beim Abgleich
// gewinnt der Katalog: Namen werden nachgezogen, Alt-Kosten fallen weg (ADR-0011).
describe('syncRosterSelectionsWithSystem — Abgleich mit dem Katalog', () => {
  const CATALOGUE_ID = 'cat-sync';
  const ENTRY_ID = 'item-sync-1';
  const CURRENT_NAME = 'Updated Weapon Name';
  const STORED_NAME = 'Old Weapon Name';
  const POINTS = 'pts';

  function createSystem() {
    return {
      id: 'sys-sync',
      name: 'Sync System',
      costTypes: [{ id: POINTS, name: 'Points' }],
      catalogues: [{
        id: CATALOGUE_ID,
        name: 'Sync Catalogue',
        selectionEntries: [{ id: ENTRY_ID, name: CURRENT_NAME, costs: [{ typeId: POINTS, value: 15 }] }]
      }]
    };
  }

  function createStaleRoster() {
    return {
      name: 'Sync Roster',
      catalogueId: CATALOGUE_ID,
      forces: [{
        id: 'force-sync-1',
        catalogueId: CATALOGUE_ID,
        selections: [{
          id: 'sel-sync-1',
          selectionEntryId: ENTRY_ID,
          name: STORED_NAME,
          costs: [{ typeId: POINTS, value: 5 }],
          selections: []
        }]
      }]
    };
  }

  const onlySelectionOf = roster => roster.forces[0].selections[0];

  test('zieht den Namen aus dem Katalog nach', () => {
    const synced = syncRosterSelectionsWithSystem(createStaleRoster(), createSystem());

    expect(onlySelectionOf(synced).name).toBe(CURRENT_NAME);
  });

  test('entfernt die im Roster gespeicherten Alt-Kosten', () => {
    const synced = syncRosterSelectionsWithSystem(createStaleRoster(), createSystem());

    expect(onlySelectionOf(synced).costs).toBeUndefined();
  });

  test('gibt beim zweiten Lauf dasselbe Roster zurück', () => {
    const system = createSystem();
    const synced = syncRosterSelectionsWithSystem(createStaleRoster(), system);

    expect(syncRosterSelectionsWithSystem(synced, system)).toBe(synced);
  });

  test('gibt ein bereits abgeglichenes Roster unverändert — und identisch — zurück', () => {
    const system = createSystem();
    const freshRoster = createStaleRoster();
    onlySelectionOf(freshRoster).name = CURRENT_NAME;
    delete onlySelectionOf(freshRoster).costs;

    expect(syncRosterSelectionsWithSystem(freshRoster, system)).toBe(freshRoster);
  });

  test('lässt das übergebene Roster unangetastet', () => {
    const roster = createStaleRoster();
    const rosterBefore = structuredClone(roster);

    const synced = syncRosterSelectionsWithSystem(roster, createSystem());

    expect(roster).toEqual(rosterBefore);
    expect(synced).not.toBe(roster);
    expect(onlySelectionOf(synced)).not.toBe(onlySelectionOf(roster));
  });

  test('gleicht auch geschachtelte Selections ab und teilt unberührte Teilbäume', () => {
    const UNTOUCHED_ID = 'sel-untouched';
    const roster = createStaleRoster();
    const staleUnit = onlySelectionOf(roster);
    staleUnit.name = CURRENT_NAME;
    delete staleUnit.costs;
    staleUnit.selections = [
      { id: 'sel-nested', selectionEntryId: ENTRY_ID, name: STORED_NAME, selections: [] },
      { id: UNTOUCHED_ID, name: 'Freitext ohne Katalogeintrag', selections: [] }
    ];
    const untouchedBefore = staleUnit.selections[1];

    const synced = syncRosterSelectionsWithSystem(roster, createSystem());
    const syncedChildren = onlySelectionOf(synced).selections;

    expect(syncedChildren[0].name).toBe(CURRENT_NAME);
    expect(syncedChildren[1]).toBe(untouchedBefore);
  });
});
