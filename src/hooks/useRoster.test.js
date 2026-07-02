import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoster } from './useRoster';

// Mock dependencies
vi.mock('../solver/validator', () => ({
  calculateRosterCosts: vi.fn(() => ({ points: 100 })),
  validateRoster: vi.fn(() => []),
  resolveEntry: vi.fn((sys, entry) => ({ id: entry.id, name: entry.name || 'Resolved Name', type: entry.type || 'model', ...entry })),
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

  it('saves immediately when unit is added', () => {
    const mockSave = vi.fn();
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    // Clear initial render calls
    mockSave.mockClear();

    const testEntry = { id: 'entry-1', name: 'Space Marine' };

    act(() => {
      result.current.addUnit(testEntry, 'cat-1');
    });

    // Check that it was called immediately (without advancing timers)
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].forces[0].selections[0].name).toBe('Space Marine');
  });

  it('selects the default selection entry by ID when adding unit with selectionEntryGroups', () => {
    const mockSave = vi.fn();
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    const testEntry = {
      id: 'unit-lord',
      name: 'Bretonnian Lord',
      type: 'unit',
      selectionEntryGroups: [
        {
          id: 'group-mounts',
          name: 'Mounts',
          defaultSelectionEntryId: 'mount-horse',
          constraints: [{ type: 'min', value: 1 }],
          selectionEntries: [
            { id: 'mount-foot', name: 'On Foot' }
          ],
          entryLinks: [
            { id: 'mount-horse', name: 'Bretonnian Warhorse' }
          ]
        }
      ]
    };

    act(() => {
      result.current.addUnit(testEntry, 'cat-1');
    });

    expect(result.current.roster.forces[0].selections.length).toBe(1);
    const unitSel = result.current.roster.forces[0].selections[0];
    expect(unitSel.name).toBe('Bretonnian Lord');
    expect(unitSel.selections.length).toBe(1);
    expect(unitSel.selections[0].name).toBe('Bretonnian Warhorse');
    expect(unitSel.selections[0].selectionEntryId || unitSel.selections[0].entryLinkId).toBe('mount-horse');
  });

  it('falls back to the first option when defaultSelectionEntryId does not match or is absent', () => {
    const mockSave = vi.fn();
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    const testEntry = {
      id: 'unit-lord-no-default',
      name: 'Bretonnian Lord No Default',
      type: 'unit',
      selectionEntryGroups: [
        {
          id: 'group-mounts',
          name: 'Mounts',
          constraints: [{ type: 'min', value: 1 }],
          selectionEntries: [
            { id: 'mount-foot', name: 'On Foot' }
          ],
          entryLinks: [
            { id: 'mount-horse', name: 'Bretonnian Warhorse' }
          ]
        }
      ]
    };

    act(() => {
      result.current.addUnit(testEntry, 'cat-1');
    });

    expect(result.current.roster.forces[0].selections.length).toBe(1);
    const unitSel = result.current.roster.forces[0].selections[0];
    expect(unitSel.selections.length).toBe(1);
    expect(unitSel.selections[0].name).toBe('On Foot');
    expect(unitSel.selections[0].selectionEntryId || unitSel.selections[0].entryLinkId).toBe('mount-foot');
  });
});
