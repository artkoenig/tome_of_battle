import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoster } from './useRoster';
import { syncRosterSelectionsWithSystem } from '../solver/validator';

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
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    await act(async () => {
      await result.current.save();
    });

    expect(mockSave).toHaveBeenCalledWith(result.current.roster);
  });

  it('saves after the debounce delay when unit is added', () => {
    vi.useFakeTimers();
    const mockSave = vi.fn();
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    // Initialen Autosave abwarten und zurücksetzen
    act(() => {
      vi.advanceTimersByTime(200);
    });
    mockSave.mockClear();

    const testEntry = { id: 'entry-1', name: 'Space Marine' };

    act(() => {
      result.current.addUnit(testEntry, 'cat-1');
    });

    // Vor Ablauf der Debounce noch kein Save
    expect(mockSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].forces[0].selections[0].name).toBe('Space Marine');

    vi.useRealTimers();
  });

  it('flushes a pending save on unmount', () => {
    vi.useFakeTimers();
    const mockSave = vi.fn();
    const { result, unmount } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    act(() => {
      vi.advanceTimersByTime(200);
    });
    mockSave.mockClear();

    act(() => {
      result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
    });

    // Unmount vor Ablauf der Debounce — die Änderung darf nicht verloren gehen
    unmount();

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].forces[0].selections[0].name).toBe('Space Marine');

    vi.useRealTimers();
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

  it('updateRosterName updates the roster name', () => {
    vi.useFakeTimers();
    const mockSave = vi.fn();
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    act(() => {
      result.current.updateRosterName('New Roster Name');
    });

    expect(result.current.roster.name).toBe('New Roster Name');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(mockSave).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('keeps selectedRosterSelection in sync with the roster tree (ID-based)', () => {
    const mockSave = vi.fn();
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    act(() => {
      result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
    });

    const unit = result.current.roster.forces[0].selections[0];
    expect(result.current.selectedRosterSelection?.id).toBe(unit.id);

    // Nach einer Mutation zeigt die Auswahl auf den aktualisierten Knoten aus dem Roster
    act(() => {
      result.current.updateSubSelection(unit.id, { id: 'opt-1', name: 'Bolter' }, 'increment');
    });

    expect(result.current.selectedRosterSelection).toBe(result.current.roster.forces[0].selections[0]);
    expect(result.current.selectedRosterSelection.selections.length).toBe(1);

    // Entfernen der Einheit setzt die Auswahl zurück
    act(() => {
      result.current.removeUnit(unit.id);
    });
    expect(result.current.selectedRosterSelection).toBe(null);
  });

  describe('Undo/Redo', () => {
    it('reports no undo/redo history right after initialization', () => {
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('undo reverts addUnit and redo restores it', () => {
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));

      act(() => {
        result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
      });
      expect(result.current.roster.forces[0].selections.length).toBe(1);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);

      act(() => {
        result.current.undo();
      });
      expect(result.current.roster.forces[0].selections.length).toBe(0);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);

      act(() => {
        result.current.redo();
      });
      expect(result.current.roster.forces[0].selections.length).toBe(1);
      expect(result.current.roster.forces[0].selections[0].name).toBe('Space Marine');
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it('undo reverts removeUnit', () => {
      const rosterWithUnit = {
        ...initialRoster,
        forces: [{ selections: [{ id: 'sel-1', name: 'Space Marine' }] }]
      };
      const { result } = renderHook(() => useRoster(rosterWithUnit, mockSystem, vi.fn()));

      act(() => {
        result.current.removeUnit('sel-1');
      });
      expect(result.current.roster.forces[0].selections.length).toBe(0);

      act(() => {
        result.current.undo();
      });
      expect(result.current.roster.forces[0].selections.length).toBe(1);
      expect(result.current.roster.forces[0].selections[0].id).toBe('sel-1');
    });

    it('undo reverts copyUnit', () => {
      const rosterWithUnit = {
        ...initialRoster,
        forces: [{ selections: [{ id: 'sel-1', name: 'Space Marine', selections: [] }] }]
      };
      const { result } = renderHook(() => useRoster(rosterWithUnit, mockSystem, vi.fn()));

      act(() => {
        result.current.copyUnit('sel-1');
      });
      expect(result.current.roster.forces[0].selections.length).toBe(2);

      act(() => {
        result.current.undo();
      });
      expect(result.current.roster.forces[0].selections.length).toBe(1);
    });

    it('undo reverts updateSubSelection', () => {
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));

      act(() => {
        result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
      });
      const unit = result.current.roster.forces[0].selections[0];

      act(() => {
        result.current.updateSubSelection(unit.id, { id: 'opt-1', name: 'Bolter' }, 'increment');
      });
      expect(result.current.roster.forces[0].selections[0].selections.length).toBe(1);

      act(() => {
        result.current.undo();
      });
      expect(result.current.roster.forces[0].selections[0].selections.length).toBe(0);
    });

    it('undo reverts updateRosterName', () => {
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));

      act(() => {
        result.current.updateRosterName('New Roster Name');
      });
      expect(result.current.roster.name).toBe('New Roster Name');

      act(() => {
        result.current.undo();
      });
      expect(result.current.roster.name).toBe(initialRoster.name);
    });

    it('a new change after undo discards the redo history', () => {
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));

      act(() => {
        result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
      });
      act(() => {
        result.current.undo();
      });
      expect(result.current.canRedo).toBe(true);

      act(() => {
        result.current.addUnit({ id: 'entry-2', name: 'Terminator' }, 'cat-1');
      });
      expect(result.current.canRedo).toBe(false);
      expect(result.current.roster.forces[0].selections[0].name).toBe('Terminator');
    });

    it('supports an unbounded number of undo steps', () => {
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));

      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.addUnit({ id: `entry-${i}`, name: `Unit ${i}` }, 'cat-1');
        });
      }
      expect(result.current.roster.forces[0].selections.length).toBe(20);

      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.undo();
        });
      }
      expect(result.current.roster.forces[0].selections.length).toBe(0);
      expect(result.current.canUndo).toBe(false);
    });

    it('persists the roster via autosave after an undo', () => {
      vi.useFakeTimers();
      const mockSave = vi.fn();
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

      act(() => {
        vi.advanceTimersByTime(200);
      });
      mockSave.mockClear();

      act(() => {
        result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      mockSave.mockClear();

      act(() => {
        result.current.undo();
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave.mock.calls[0][0].forces[0].selections.length).toBe(0);

      vi.useRealTimers();
    });

    it('persists the roster via autosave after a redo', () => {
      vi.useFakeTimers();
      const mockSave = vi.fn();
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

      act(() => {
        result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
      });
      act(() => {
        result.current.undo();
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      mockSave.mockClear();

      act(() => {
        result.current.redo();
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave.mock.calls[0][0].forces[0].selections.length).toBe(1);

      vi.useRealTimers();
    });

    it('an automatic system correction does not create its own undo step', () => {
      vi.useFakeTimers();
      syncRosterSelectionsWithSystem.mockReturnValueOnce(true);

      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));

      // Die Korrektur beim ersten Effekt-Durchlauf darf keinen Undo-Schritt erzeugen
      expect(result.current.canUndo).toBe(false);

      act(() => {
        result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
      });
      expect(result.current.canUndo).toBe(true);

      act(() => {
        result.current.undo();
      });

      // Zurück auf den (bereits korrigierten) Ausgangszustand, keine Korrektur rückgängig zu machen
      expect(result.current.roster.forces[0].selections.length).toBe(0);
      expect(result.current.canUndo).toBe(false);

      vi.useRealTimers();
    });
  });
});
