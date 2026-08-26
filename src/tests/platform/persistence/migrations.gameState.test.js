import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../platform/persistence/database', () => ({
  saveSystem: vi.fn(),
  getAllRosters: vi.fn(),
  saveRoster: vi.fn(),
  getGameForRoster: vi.fn(),
  saveGame: vi.fn(),
}));

import {
  getAllRosters,
  saveRoster,
  getGameForRoster,
  saveGame,
} from '../../../platform/persistence/database';
import { runGameStateMigration } from '../../../platform/persistence/migrations';

// Ein Roster in der **alten** Form, wie es vor Issue 0190 in der IndexedDB lag:
// der Spielstand steckt im Listendatensatz.
const rosterInOldShape = (id, gameState) => ({
  id,
  name: `Liste ${id}`,
  systemId: 'sys-1',
  catalogueId: 'cat-1',
  costLimit: 2000,
  costLimitType: 'pts',
  forces: [{ id: `${id}-force`, forceEntryId: 'fe-1', catalogueId: 'cat-1', selections: [] }],
  gameState,
});

const storedGames = () => saveGame.mock.calls.map(([game]) => game);
const storedRosters = () => saveRoster.mock.calls.map(([roster]) => roster);

beforeEach(() => {
  getAllRosters.mockReset().mockResolvedValue([]);
  saveRoster.mockReset().mockResolvedValue(undefined);
  getGameForRoster.mockReset().mockResolvedValue(undefined);
  saveGame.mockReset().mockResolvedValue(undefined);
});

describe('runGameStateMigration', () => {
  test('hebt eine gezaehlte Partie verlustfrei in den games-Store', async () => {
    getAllRosters.mockResolvedValue([
      rosterInOldShape('roster-1', {
        round: 3,
        vp: 7,
        cp: 2,
        wounds: { 'unit-1': 4, 'unit-2': [2, 1, 0] },
      }),
    ]);

    const result = await runGameStateMigration();

    expect(result.movedGames).toBe(1);
    expect(storedGames()[0]).toMatchObject({
      rosterId: 'roster-1',
      round: 3,
      vp: 7,
      cp: 2,
      // Die Form der Wunden bleibt, wie sie war — Zahl oder Wert je Modell.
      wounds: { 'unit-1': 4, 'unit-2': [2, 1, 0] },
    });
  });

  test('entfernt gameState aus dem Listendatensatz und laesst die Liste sonst unberuehrt', async () => {
    const old = rosterInOldShape('roster-1', { round: 2, vp: 0, cp: 0, wounds: {} });
    getAllRosters.mockResolvedValue([old]);

    await runGameStateMigration();

    const [migrated] = storedRosters();
    expect(migrated).not.toHaveProperty('gameState');
    const { gameState: _dropped, ...listData } = old;
    expect(migrated).toEqual(listData);
  });

  // Jedes vor 0190 angelegte Roster trug den Anfangszustand, ohne dass je
  // gespielt wurde. Das ist keine Partie, sondern das Fehlen einer.
  test('der Anfangszustand erzeugt keine Partie, raeumt das Feld aber weg', async () => {
    getAllRosters.mockResolvedValue([
      rosterInOldShape('roster-1', { round: 1, vp: 0, cp: 0, wounds: {} }),
    ]);

    const result = await runGameStateMigration();

    expect(result.movedGames).toBe(0);
    expect(saveGame).not.toHaveBeenCalled();
    expect(storedRosters()[0]).not.toHaveProperty('gameState');
  });

  test('ein Roster ohne gameState wird nicht neu geschrieben', async () => {
    getAllRosters.mockResolvedValue([
      { id: 'roster-1', name: 'Neu', systemId: 'sys-1', catalogueId: 'cat-1', forces: [] },
    ]);

    const result = await runGameStateMigration();

    expect(result).toEqual({ movedGames: 0, cleanedRosters: 0 });
    expect(saveRoster).not.toHaveBeenCalled();
    expect(saveGame).not.toHaveBeenCalled();
  });

  test('legt keine zweite Partie an, wenn die Liste schon eine hat', async () => {
    getAllRosters.mockResolvedValue([
      rosterInOldShape('roster-1', { round: 4, vp: 0, cp: 0, wounds: { 'unit-1': 1 } }),
    ]);
    getGameForRoster.mockResolvedValue({ id: 'g1', rosterId: 'roster-1', round: 9, vp: 0, cp: 0, wounds: {} });

    const result = await runGameStateMigration();

    expect(result.movedGames).toBe(0);
    expect(saveGame).not.toHaveBeenCalled();
  });

  test('ist idempotent: der zweite Lauf findet nichts mehr zu tun', async () => {
    const migratedStore = [rosterInOldShape('roster-1', { round: 3, vp: 1, cp: 0, wounds: {} })];
    getAllRosters.mockImplementation(async () => migratedStore);
    saveRoster.mockImplementation(async (roster) => {
      migratedStore[0] = roster;
    });

    const first = await runGameStateMigration();
    saveGame.mockClear();
    const second = await runGameStateMigration();

    expect(first.movedGames).toBe(1);
    expect(second).toEqual({ movedGames: 0, cleanedRosters: 0 });
    expect(saveGame).not.toHaveBeenCalled();
  });
});
