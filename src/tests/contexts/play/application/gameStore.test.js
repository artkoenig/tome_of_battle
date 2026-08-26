import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../platform/persistence/database', () => ({
  getGameForRoster: vi.fn(),
  saveGame: vi.fn(),
  deleteGamesOfRoster: vi.fn(),
}));
vi.mock('../../../../platform/persistence/migrations', () => ({
  runGameStateMigration: vi.fn(),
}));

import {
  getGameForRoster,
  saveGame as persistGame,
  deleteGamesOfRoster,
} from '../../../../platform/persistence/database';
import { loadGame, saveGame, endGame } from '../../../../contexts/play/application/gameStore';

const ROSTER = { id: 'roster-1', forces: [{ id: 'f1', selections: [{ id: 'unit-1' }] }] };

beforeEach(() => {
  getGameForRoster.mockReset().mockResolvedValue(undefined);
  persistGame.mockReset().mockResolvedValue(undefined);
  deleteGamesOfRoster.mockReset().mockResolvedValue(undefined);
});

describe('loadGame', () => {
  test('liefert die laufende Partie der Liste', async () => {
    const stored = { id: 'g1', rosterId: 'roster-1', round: 2, vp: 1, cp: 0, wounds: {} };
    getGameForRoster.mockResolvedValue(stored);

    expect(await loadGame('roster-1')).toBe(stored);
  });

  test('ohne laufende Partie eine frische, noch nicht gespeicherte', async () => {
    const game = await loadGame('roster-1');

    expect(game).toMatchObject({ rosterId: 'roster-1', round: 1, vp: 0, cp: 0, wounds: {} });
    expect(persistGame).not.toHaveBeenCalled();
  });
});

describe('saveGame', () => {
  test('schreibt die Partie und liefert den gespeicherten Stand', async () => {
    const game = { id: 'g1', rosterId: 'roster-1', round: 2, vp: 0, cp: 0, wounds: { 'unit-1': 3 } };

    const saved = await saveGame(game, ROSTER);

    expect(persistGame).toHaveBeenCalledWith(saved);
    expect(saved.wounds).toEqual({ 'unit-1': 3 });
  });

  // Produktentscheidung 1 des PRD: die Liste darf waehrend der Partie bearbeitet
  // werden. Ein Eintrag ohne Auswahl faellt beim naechsten Schreiben weg.
  test('entfernt verwaiste Wundeneintraege gegen die uebergebene Liste', async () => {
    const game = { id: 'g1', rosterId: 'roster-1', round: 2, vp: 0, cp: 0,
      wounds: { 'unit-1': 3, 'geloescht': 1 } };

    const saved = await saveGame(game, ROSTER);

    expect(saved.wounds).toEqual({ 'unit-1': 3 });
    expect(persistGame).toHaveBeenCalledWith(saved);
  });

  test('eine Partie ohne Verlauf wird nicht angelegt, sondern verworfen', async () => {
    const game = { id: 'g1', rosterId: 'roster-1', round: 1, vp: 0, cp: 0, wounds: {} };

    await saveGame(game, ROSTER);

    expect(persistGame).not.toHaveBeenCalled();
    expect(deleteGamesOfRoster).toHaveBeenCalledWith('roster-1');
  });
});

describe('endGame', () => {
  // Produktentscheidung 2 des PRD: eine beendete Partie wird verworfen, und mit
  // der Liste geht ihre Partie.
  test('verwirft die Partie der Liste', async () => {
    await endGame('roster-1');

    expect(deleteGamesOfRoster).toHaveBeenCalledWith('roster-1');
  });
});
