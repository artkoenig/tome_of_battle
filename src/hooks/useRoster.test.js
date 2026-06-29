import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoster } from './useRoster';

// Mock dependencies
vi.mock('../solver/validator', () => ({
  calculateRosterCosts: vi.fn(() => ({ points: 100 })),
  validateRoster: vi.fn(() => []),
  resolveEntry: vi.fn((sys, entry) => ({ id: entry.id, name: entry.name || 'Resolved Name', type: entry.type || 'model' })),
  syncRosterSelectionsWithSystem: vi.fn(() => false),
}));

describe('useRoster Hook', () => {
  const mockSystem = { id: 'sys-1', name: 'Test System' };
  const initialRoster = {
    id: 'roster-1',
    name: 'Test Roster',
    costLimitValue: 1000,
    costLimitType: 'points',
    catalogueId: 'cat-1',
    forces: [{ selections: [] }]
  };

  it('initializes with default values', () => {
    const mockSave = vi.fn();
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    expect(result.current.roster).toEqual(initialRoster);
    expect(result.current.costs).toEqual({});
    expect(result.current.validationErrors).toEqual([]);
  });

  it('debounces validation and cost calculation', async () => {
    vi.useFakeTimers();
    const mockSave = vi.fn();
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    // Initially costs and errors might not be populated immediately if debounced
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.costs.points).toBe(100);
    
    vi.useRealTimers();
  });

  it('addUnit adds a new selection to the roster', () => {
    const mockSave = vi.fn();
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    const testEntry = { id: 'entry-1', name: 'Space Marine' };

    act(() => {
      result.current.addUnit(testEntry, 'cat-1');
    });

    expect(result.current.roster.forces[0].selections.length).toBe(1);
    expect(result.current.roster.forces[0].selections[0].name).toBe('Space Marine');
  });

  it('removeUnit removes a selection', () => {
    const rosterWithUnit = {
      ...initialRoster,
      forces: [{ selections: [{ id: 'sel-1', name: 'Space Marine' }] }]
    };

    const mockSave = vi.fn();
    const { result } = renderHook(() => useRoster(rosterWithUnit, mockSystem, mockSave));

    act(() => {
      result.current.removeUnit('sel-1');
    });

    expect(result.current.roster.forces[0].selections.length).toBe(0);
  });

  it('calls saveRosterCallback when save is called', async () => {
    const mockSave = vi.fn();
    // mock alert to prevent jsdom errors
    window.alert = vi.fn();
    
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    await act(async () => {
      await result.current.save();
    });

    expect(mockSave).toHaveBeenCalledWith(result.current.roster);
  });
});
