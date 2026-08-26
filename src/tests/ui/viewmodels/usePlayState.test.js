import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePlayState from '../../../ui/viewmodels/usePlayState';
import { PERSISTENCE_FAILURE_MESSAGE_KEY } from '../../../ui/viewmodels/persistenceFailure';
import { t } from '../../../ui/i18n/i18nStore';

// Die Ablage der Partie ist gemockt, das Aggregat selbst nicht: was der Hook
// ueber Wunden und Zaehler rechnet, soll die echte Fachlogik des Kontexts
// `play` rechnen (Issue 0190).
const mockLoadGame = vi.fn();
const mockSaveGame = vi.fn();

vi.mock('../../../contexts/play', async (importOriginal) => ({
  ...(await importOriginal()),
  loadGame: (...args) => mockLoadGame(...args),
  saveGame: (...args) => mockSaveGame(...args),
}));

const ROSTER = {
  id: 'roster-1',
  forces: [{ id: 'force-1', selections: [{ id: 'unit-1' }, { id: 'unit-2' }] }],
};

const storedGame = (wounds = {}) => ({
  id: 'game-1',
  rosterId: 'roster-1',
  round: 1,
  vp: 0,
  cp: 0,
  wounds,
});

beforeEach(() => {
  mockLoadGame.mockReset().mockResolvedValue(storedGame());
  mockSaveGame.mockReset().mockResolvedValue(undefined);
});

describe('usePlayState Hook', () => {
  it('initializes with a fresh game for the roster', () => {
    const { result } = renderHook(() => usePlayState(ROSTER));

    expect(result.current.game.rosterId).toBe('roster-1');
    expect(result.current.game.round).toBe(1);
    expect(result.current.game.vp).toBe(0);
    expect(result.current.game.wounds).toEqual({});
  });

  it('adopts the running game of the roster once it is read', async () => {
    mockLoadGame.mockResolvedValue(storedGame({ 'unit-1': 3 }));

    const { result } = renderHook(() => usePlayState(ROSTER));

    await vi.waitFor(() => {
      expect(result.current.game.wounds).toEqual({ 'unit-1': 3 });
    });
    expect(mockLoadGame).toHaveBeenCalledWith('roster-1');
  });

  it('adjustTracker updates vp and round correctly', () => {
    const { result } = renderHook(() => usePlayState(ROSTER));

    act(() => {
      result.current.adjustTracker('vp', 5);
    });

    expect(result.current.game.vp).toBe(5);

    act(() => {
      result.current.adjustTracker('round', 1);
    });

    expect(result.current.game.round).toBe(2);
  });

  it('handleAdjustWound updates wound state correctly', () => {
    const { result } = renderHook(() => usePlayState(ROSTER));

    // First adjustment, unit has 10 max wounds, takes 2 damage -> 8 remaining
    act(() => {
      result.current.handleAdjustWound('unit-1', -2, 10);
    });

    expect(result.current.game.wounds['unit-1']).toBe(8);

    // Heal 1 wound
    act(() => {
      result.current.handleAdjustWound('unit-1', 1, 10);
    });

    expect(result.current.game.wounds['unit-1']).toBe(9);

    // Overheal should be capped at max
    act(() => {
      result.current.handleAdjustWound('unit-1', 5, 10);
    });

    expect(result.current.game.wounds['unit-1']).toBe(10);

    // Overkill should be capped at 0
    act(() => {
      result.current.handleAdjustWound('unit-1', -20, 10);
    });

    expect(result.current.game.wounds['unit-1']).toBe(0);
  });

  it('getUnitCurrentWounds returns correct value', () => {
    const { result } = renderHook(() => usePlayState(ROSTER));

    // Unit not tracked yet, should return max wounds
    expect(result.current.getUnitCurrentWounds('unit-not-found', 15)).toBe(15);

    act(() => {
      result.current.handleAdjustWound('unit-2', -5, 15);
    });

    expect(result.current.getUnitCurrentWounds('unit-2', 15)).toBe(10);
  });

  // Der Kern von Issue 0190: eine Wunde geht in die Partie, nicht in die Liste.
  it('writes the wound to the game store, with the roster only as a reference', async () => {
    const { result } = renderHook(() => usePlayState(ROSTER));

    act(() => {
      result.current.handleAdjustWound('unit-1', -2, 10);
    });

    await vi.waitFor(() => {
      expect(mockSaveGame).toHaveBeenCalled();
    });
    const [savedGame, passedRoster] = mockSaveGame.mock.calls.at(-1);
    expect(savedGame.wounds).toEqual({ 'unit-1': 8 });
    expect(savedGame.rosterId).toBe('roster-1');
    expect(passedRoster).toBe(ROSTER);
  });

  // Der Spielmodus wird oft nur betrachtet; ein Betreten ohne Zug darf keinen
  // Datensatz erzeugen und den gerade gelesenen Stand nicht zurueckschreiben.
  it('writes nothing until the player makes a move', async () => {
    renderHook(() => usePlayState(ROSTER));

    await vi.waitFor(() => {
      expect(mockLoadGame).toHaveBeenCalled();
    });
    expect(mockSaveGame).not.toHaveBeenCalled();
  });

  // Der Spielstand wird bei jeder Wunde neu geschrieben; ein stiller Fehlschlag am
  // Spieltisch ist von einem erfolgreichen Speichern nicht zu unterscheiden.
  it('reports a failed game state save through the error channel', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reportError = vi.fn();
    mockSaveGame.mockRejectedValue(new Error('QuotaExceededError'));

    const { result } = renderHook(() => usePlayState(ROSTER, reportError));

    act(() => {
      result.current.adjustTracker('vp', 3);
    });

    await vi.waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(t(PERSISTENCE_FAILURE_MESSAGE_KEY.gameState));
    });
    consoleErrorSpy.mockRestore();
  });

  it('stays silent while the game state is saved successfully', async () => {
    const reportError = vi.fn();

    const { result } = renderHook(() => usePlayState(ROSTER, reportError));

    act(() => {
      result.current.adjustTracker('vp', 3);
    });

    await vi.waitFor(() => {
      expect(mockSaveGame).toHaveBeenCalled();
    });
    expect(reportError).not.toHaveBeenCalled();
  });
});
