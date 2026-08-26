import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../platform/persistence/database', () => ({
  getAllRosters: vi.fn(),
  getRoster: vi.fn(),
  saveRoster: vi.fn(),
  deleteRoster: vi.fn(),
  WHFB6_LINKING_DEFAULT: false,
  getWhfb6LinkingEnabled: vi.fn(),
  setWhfb6LinkingEnabled: vi.fn(),
  getGameForRoster: vi.fn(),
  saveGame: vi.fn(),
  deleteGamesOfRoster: vi.fn(),
}));
vi.mock('../../../../platform/persistence/migrations', () => ({
  runGameStateMigration: vi.fn(),
}));

import {
  deleteRoster as removeRoster,
  deleteGamesOfRoster,
} from '../../../../platform/persistence/database';
import { deleteRoster } from '../../../../contexts/armylist/application/rosterStore';
import { armRosterDeletionPolicy } from '../../../../contexts/play/application/rosterDeletionPolicy';

/**
 * Die Regel "mit der Liste geht ihre Partie" ohne React: gelöscht wird über die
 * Anwendungsschicht der Liste, die Partie verschwindet über den Änderungskanal.
 */

/** @type {(() => void)|null} */
let stopPolicy = null;

beforeEach(() => {
  removeRoster.mockReset().mockResolvedValue(undefined);
  deleteGamesOfRoster.mockReset().mockResolvedValue(undefined);
  // Das Modul meldet sich beim Laden selbst an; der Aufruf ist idempotent und
  // liefert hier nur die Abmeldefunktion für den Testabschluss.
  stopPolicy = armRosterDeletionPolicy();
});

afterEach(() => {
  stopPolicy?.();
  stopPolicy = null;
  vi.restoreAllMocks();
});

describe('rosterDeletionPolicy', () => {
  test('das Löschen einer Liste beendet ihre Partie — ohne Oberfläche', async () => {
    await deleteRoster('roster-1');

    expect(removeRoster).toHaveBeenCalledWith('roster-1');
    expect(deleteGamesOfRoster).toHaveBeenCalledWith('roster-1');
  });

  test('genau ein Abonnent, auch wenn das Scharfstellen mehrfach läuft', async () => {
    armRosterDeletionPolicy();
    armRosterDeletionPolicy();

    await deleteRoster('roster-1');

    expect(deleteGamesOfRoster).toHaveBeenCalledTimes(1);
  });

  test('eine nie gespielte Liste ist ein Nichts-Fall: kein Schreibvorgang, kein Wurf', async () => {
    // `deleteGamesOfRoster` läuft über die Treffer der `rosterId`; ohne Partie
    // ist das eine leere Schleife.
    deleteGamesOfRoster.mockResolvedValue(undefined);

    await expect(deleteRoster('nie-gespielt')).resolves.toBeUndefined();
  });

  test('ein Fehlschlag der Partie wird protokolliert und lässt das Löschen der Liste stehen', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    deleteGamesOfRoster.mockRejectedValue(new Error('games store kaputt'));

    await expect(deleteRoster('roster-1')).resolves.toBeUndefined();
    // Die abgelehnte Zusage hängt an einem eigenen `.catch` — sonst entkäme sie
    // als unbehandelte Ablehnung, denn `emitDataChange` wartet auf niemanden.
    await Promise.resolve();

    expect(logged).toHaveBeenCalled();
    expect(removeRoster).toHaveBeenCalledWith('roster-1');
  });
});
