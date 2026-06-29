import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePlayState from './usePlayState';

describe('usePlayState Hook', () => {
  const initialRoster = {
    id: 'roster-1',
    gameState: {
      round: 1,
      vp: 0,
      cp: 0,
      wounds: {}
    }
  };

  it('initializes with default game state', () => {
    const mockSetRoster = vi.fn();
    const mockSave = vi.fn();
    const { result } = renderHook(() => usePlayState(initialRoster, mockSetRoster, mockSave));

    expect(result.current.gameState.round).toBe(1);
    expect(result.current.gameState.vp).toBe(0);
    expect(result.current.gameState.wounds).toEqual({});
  });

  it('adjustTracker updates vp and round correctly', () => {
    const mockSetRoster = vi.fn();
    const mockSave = vi.fn();
    const { result } = renderHook(() => usePlayState(initialRoster, mockSetRoster, mockSave));

    act(() => {
      result.current.adjustTracker('vp', 5);
    });

    expect(result.current.gameState.vp).toBe(5);

    act(() => {
      result.current.adjustTracker('round', 1);
    });

    expect(result.current.gameState.round).toBe(2);
  });

  it('handleAdjustWound updates wound state correctly', () => {
    const mockSetRoster = vi.fn();
    const mockSave = vi.fn();
    const { result } = renderHook(() => usePlayState(initialRoster, mockSetRoster, mockSave));

    // First adjustment, unit has 10 max wounds, takes 2 damage -> 8 remaining
    act(() => {
      result.current.handleAdjustWound('unit-1', -2, 10);
    });

    expect(result.current.gameState.wounds['unit-1']).toBe(8);

    // Heal 1 wound
    act(() => {
      result.current.handleAdjustWound('unit-1', 1, 10);
    });

    expect(result.current.gameState.wounds['unit-1']).toBe(9);

    // Overheal should be capped at max
    act(() => {
      result.current.handleAdjustWound('unit-1', 5, 10);
    });

    expect(result.current.gameState.wounds['unit-1']).toBe(10);

    // Overkill should be capped at 0
    act(() => {
      result.current.handleAdjustWound('unit-1', -20, 10);
    });

    expect(result.current.gameState.wounds['unit-1']).toBe(0);
  });

  it('getUnitCurrentWounds returns correct value', () => {
    const mockSetRoster = vi.fn();
    const mockSave = vi.fn();
    const { result } = renderHook(() => usePlayState(initialRoster, mockSetRoster, mockSave));

    // Unit not tracked yet, should return max wounds
    expect(result.current.getUnitCurrentWounds('unit-not-found', 15)).toBe(15);

    act(() => {
      result.current.handleAdjustWound('unit-2', -5, 15);
    });

    expect(result.current.getUnitCurrentWounds('unit-2', 15)).toBe(10);
  });
});
