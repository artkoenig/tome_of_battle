import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoster } from './useRoster';
import { syncRosterSelectionsWithSystem, calculateRosterCosts, validateRoster } from '../solver/validator';

// Only the rules engine is stubbed. The roster-tree primitives (rosterTree.js,
// re-exported by the facade) stay real: they are pure data-structure traversal
// with no rules in them, and stubbing them would hollow out the very state
// updates these tests assert on.
vi.mock('../solver/validator', async (importOriginal) => ({
  ...(await importOriginal()),
  calculateRosterCosts: vi.fn(() => ({ points: 100 })),
  validateRoster: vi.fn(() => []),
  resolveEntry: vi.fn((sys, entry) => ({ id: entry.id, name: entry.name || 'Resolved Name', type: entry.type || 'model', ...entry })),
  syncRosterSelectionsWithSystem: vi.fn(roster => roster),
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

  // Der Abgleich ist rein: er gibt das Roster zurück. Der Standard „nichts
  // anzugleichen" ist Identität; einzelne Tests setzen eine eigene Korrektur.
  beforeEach(() => {
    syncRosterSelectionsWithSystem.mockImplementation(roster => roster);
  });

  it('initializes with the roster and its derived costs and errors', () => {
    const mockSave = vi.fn();
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    expect(result.current.roster).toEqual(initialRoster);
    expect(result.current.costs).toEqual({ points: 100 });
    expect(result.current.validationErrors).toEqual([]);
  });

  it('derives costs and validation errors from the roster without waiting for the debounce', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));

    calculateRosterCosts.mockReturnValueOnce({ points: 250 });
    validateRoster.mockReturnValueOnce([{ message: 'Zu viele Punkte' }]);

    act(() => {
      result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
    });

    // Ohne Vorlauf der Debounce: Anzeige und Validierung gehören bereits zum neuen Roster
    expect(result.current.costs).toEqual({ points: 250 });
    expect(result.current.validationErrors).toEqual([{ message: 'Zu viele Punkte' }]);

    vi.useRealTimers();
  });

  it('debounces only the persistence, not the derived values', () => {
    vi.useFakeTimers();
    const mockSave = vi.fn();
    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, mockSave));

    act(() => {
      vi.advanceTimersByTime(200);
    });
    mockSave.mockClear();
    calculateRosterCosts.mockClear();

    act(() => {
      result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
    });

    expect(calculateRosterCosts).toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(mockSave).toHaveBeenCalledTimes(1);

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

  describe('subSelectionOperations', () => {
    const addUnitWithOption = (result, optionDefinition) => {
      act(() => {
        result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
      });
      const unit = result.current.roster.forces[0].selections[0];
      act(() => {
        result.current.subSelectionOperations.increaseCount(unit.id, optionDefinition);
      });
      return unit;
    };

    const childSelectionsOfUnit = (result) => result.current.roster.forces[0].selections[0].selections;

    it('increaseCount chooses an option once and raises its count afterwards', () => {
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));
      const bolter = { id: 'opt-1', name: 'Bolter' };
      const unit = addUnitWithOption(result, bolter);

      expect(childSelectionsOfUnit(result)).toHaveLength(1);
      expect(childSelectionsOfUnit(result)[0].number).toBe(1);

      act(() => {
        result.current.subSelectionOperations.increaseCount(unit.id, bolter);
      });

      expect(childSelectionsOfUnit(result)).toHaveLength(1);
      expect(childSelectionsOfUnit(result)[0].number).toBe(2);
    });

    it('decreaseCount drops the option once its count reaches zero', () => {
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));
      const bolter = { id: 'opt-1', name: 'Bolter' };
      const unit = addUnitWithOption(result, bolter);

      act(() => {
        result.current.subSelectionOperations.decreaseCount(unit.id, bolter);
      });

      expect(childSelectionsOfUnit(result)).toHaveLength(0);
    });

    it('addInstance keeps each instance of the same option separate', () => {
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));
      const champion = { id: 'opt-champion', name: 'Champion' };

      act(() => {
        result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
      });
      const unit = result.current.roster.forces[0].selections[0];

      act(() => {
        result.current.subSelectionOperations.addInstance(unit.id, champion);
      });
      act(() => {
        result.current.subSelectionOperations.addInstance(unit.id, champion);
      });

      const instances = childSelectionsOfUnit(result);
      expect(instances).toHaveLength(2);
      expect(instances[0].id).not.toBe(instances[1].id);
    });

    it('removeInstance removes the addressed instance by its selection id', () => {
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));
      const champion = { id: 'opt-champion', name: 'Champion' };

      act(() => {
        result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
      });
      const unit = result.current.roster.forces[0].selections[0];

      act(() => {
        result.current.subSelectionOperations.addInstance(unit.id, champion);
      });
      act(() => {
        result.current.subSelectionOperations.addInstance(unit.id, champion);
      });
      const survivingInstanceId = childSelectionsOfUnit(result)[1].id;
      const removedInstanceId = childSelectionsOfUnit(result)[0].id;

      act(() => {
        result.current.subSelectionOperations.removeInstance(unit.id, removedInstanceId);
      });

      expect(childSelectionsOfUnit(result).map(item => item.id)).toEqual([survivingInstanceId]);
    });
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
      result.current.subSelectionOperations.increaseCount(unit.id, { id: 'opt-1', name: 'Bolter' });
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

    it('undo reverts a sub-selection count change', () => {
      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));

      act(() => {
        result.current.addUnit({ id: 'entry-1', name: 'Space Marine' }, 'cat-1');
      });
      const unit = result.current.roster.forces[0].selections[0];

      act(() => {
        result.current.subSelectionOperations.increaseCount(unit.id, { id: 'opt-1', name: 'Bolter' });
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
      syncRosterSelectionsWithSystem.mockImplementationOnce(roster => ({ ...roster }));

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

    it('a state recorded in the undo history does not change retroactively', () => {
      const STALE_NAME = 'Veralteter Katalogname';
      const CURRENT_NAME = 'Aktueller Katalogname';

      // Reiner Abgleich: veraltete Namen werden in einem NEUEN Roster nachgezogen.
      const renameStaleUnits = (roster) => {
        let renamed = false;
        const forces = roster.forces.map(force => ({
          ...force,
          selections: force.selections.map(selection => {
            if (selection.name !== STALE_NAME) return selection;
            renamed = true;
            return { ...selection, name: CURRENT_NAME };
          })
        }));
        return renamed ? { ...roster, forces } : roster;
      };

      // Solange der Katalog aktuell scheint, gleicht der Effekt nichts ab.
      let catalogueHasChanged = false;
      syncRosterSelectionsWithSystem.mockImplementation(
        roster => (catalogueHasChanged ? renameStaleUnits(roster) : roster)
      );

      const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));

      act(() => {
        result.current.addUnit({ id: 'entry-1', name: STALE_NAME }, 'cat-1');
      });

      // Der Zustand, wie er in diesem Moment aufgezeichnet wurde
      const recordedRoster = result.current.roster;
      const recordedSnapshot = structuredClone(recordedRoster);
      expect(recordedSnapshot.forces[0].selections[0].name).toBe(STALE_NAME);

      // Ein Katalog-Update lässt den Abgleich bei der nächsten Änderung greifen
      catalogueHasChanged = true;
      act(() => {
        result.current.addUnit({ id: 'entry-2', name: 'Terminator' }, 'cat-1');
      });
      expect(result.current.roster.forces[0].selections[0].name).toBe(CURRENT_NAME);

      // Der aufgezeichnete Zustand ist davon unberührt: keine der Selections,
      // die er festhält, wurde nachträglich umbenannt.
      expect(recordedRoster).toEqual(recordedSnapshot);

      // Und ein Undo führt genau auf diesen aufgezeichneten Umfang zurück.
      act(() => {
        result.current.undo();
      });
      expect(result.current.roster.forces[0].selections.length)
        .toBe(recordedSnapshot.forces[0].selections.length);
    });
  });
});
