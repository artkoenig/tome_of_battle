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

  test('meldet eine Änderung und zieht den Namen aus dem Katalog nach', () => {
    const roster = createStaleRoster();

    const changed = syncRosterSelectionsWithSystem(roster, createSystem());

    expect(changed).toBe(true);
    expect(onlySelectionOf(roster).name).toBe(CURRENT_NAME);
  });

  test('entfernt die im Roster gespeicherten Alt-Kosten', () => {
    const roster = createStaleRoster();

    syncRosterSelectionsWithSystem(roster, createSystem());

    expect(onlySelectionOf(roster).costs).toBeUndefined();
  });

  test('meldet beim zweiten Lauf keine Änderung mehr', () => {
    const roster = createStaleRoster();
    const system = createSystem();

    syncRosterSelectionsWithSystem(roster, system);

    expect(syncRosterSelectionsWithSystem(roster, system)).toBe(false);
  });
});
