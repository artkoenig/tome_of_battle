import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

/**
 * Issue 0165, AC1 and AC2 — the library shell's ViewModel.
 *
 * The point of AC2 is where the evaluation runs. `RosterDashboard` used to call
 * `evaluateAppRoster` inside the map loop of its render, so every keystroke in
 * the rename field re-evaluated every roster on screen. Here it runs once per
 * roster/system identity; a render pass without a data change evaluates nothing.
 *
 * The evaluation cache is the seam that gets counted, so it is the one module
 * mocked — everything else is production code.
 */
const evaluateAppRoster = vi.fn(() => ({ costTotals: { pts: 120 } }));
const describeSystem = vi.fn(() => ({ costTypes: [{ id: 'pts', name: 'Punkte' }] }));

vi.mock('../../../domain/evaluation/evaluationCache', () => ({
  evaluateAppRoster: (...args) => evaluateAppRoster(...args),
  describeSystem: (...args) => describeSystem(...args),
}));

const { useRosterDashboard } = await import('../../../ui/viewmodels/useRosterDashboard');

const SYSTEM = {
  id: 'sys1',
  name: 'Warhammer',
  catalogues: [{ id: 'cat1', name: 'Bretonnia' }],
  forceEntries: [],
};

const roster = (id, name, catalogueId = 'cat1') => ({
  id, name, systemId: 'sys1', catalogueId, costLimit: 2000, costLimitType: 'pts', forces: [],
});

beforeEach(() => {
  evaluateAppRoster.mockClear();
  describeSystem.mockClear();
});

describe('useRosterDashboard', () => {
  it('groups the rosters by game system and army book and carries the card values', () => {
    const { result } = renderHook(() => useRosterDashboard({
      rosters: [roster('r1', 'Erste'), roster('r2', 'Zweite', 'unknown-cat')],
      systems: [SYSTEM],
    }));

    expect(result.current.systemGroups).toHaveLength(1);
    const [group] = result.current.systemGroups;
    expect(group.systemName).toBe('Warhammer');
    expect(group.factions.map(f => f.factionName)).toEqual(['Bretonnia', expect.any(String)]);

    const card = group.factions[0].cards[0];
    expect(card.roster.id).toBe('r1');
    expect(card.currentPoints).toBe(120);
    expect(card.costLimit).toBe(2000);
  });

  it('sorts the roster without an army book to the end of its system', () => {
    const { result } = renderHook(() => useRosterDashboard({
      rosters: [roster('r1', 'Ohne Buch', 'unknown-cat'), roster('r2', 'Mit Buch')],
      systems: [SYSTEM],
    }));

    const factions = result.current.systemGroups[0].factions;
    expect(factions[0].factionName).toBe('Bretonnia');
    expect(factions[1].cards[0].roster.id).toBe('r1');
  });

  it('evaluates once per roster, not once per render pass', () => {
    // Both lists keep their identity across the render passes — that is what
    // the app does too (`useAppData` publishes them as state).
    const rosters = [roster('r1', 'Erste'), roster('r2', 'Zweite')];
    const systems = [SYSTEM];
    const { result, rerender } = renderHook(() => useRosterDashboard({ rosters, systems }));

    expect(evaluateAppRoster).toHaveBeenCalledTimes(2);

    // A second render pass with the very same inputs.
    rerender();
    expect(evaluateAppRoster).toHaveBeenCalledTimes(2);

    // And a state change of the shell itself — the rename field opening — is a
    // render without a data change too.
    act(() => result.current.startEditing(rosters[0], { stopPropagation() {} }));
    expect(result.current.editingId).toBe('r1');
    expect(evaluateAppRoster).toHaveBeenCalledTimes(2);

    act(() => result.current.setEditName('Erste umbenannt'));
    expect(evaluateAppRoster).toHaveBeenCalledTimes(2);
  });

  it('reports the rename to the caller and closes the field', () => {
    const onRenameRoster = vi.fn();
    const rosters = [roster('r1', 'Erste')];
    const { result } = renderHook(() => useRosterDashboard({
      rosters, systems: [SYSTEM], onRenameRoster,
    }));

    act(() => result.current.startEditing(rosters[0], { stopPropagation() {} }));
    act(() => result.current.setEditName('Neuer Name'));
    act(() => result.current.finishEditing(rosters[0]));

    expect(onRenameRoster).toHaveBeenCalledWith(rosters[0], 'Neuer Name');
    expect(result.current.editingId).toBeNull();
  });

  it('hands the picked file to the caller and clears the input', () => {
    const onImportRoster = vi.fn();
    const { result } = renderHook(() => useRosterDashboard({
      rosters: [], systems: [], onImportRoster,
    }));

    const file = new File(['x'], 'army.ros');
    const target = { files: [file], value: 'army.ros' };
    act(() => result.current.pickImportFile({ target }));

    expect(onImportRoster).toHaveBeenCalledWith(file);
    expect(target.value).toBe('');
  });

  it('deletes the roster of the action sheet and closes it', () => {
    const onDeleteRoster = vi.fn();
    const rosters = [roster('r1', 'Erste')];
    const { result } = renderHook(() => useRosterDashboard({
      rosters, systems: [SYSTEM], onDeleteRoster,
    }));

    act(() => result.current.openRosterActions('r1'));
    expect(result.current.isRosterActionsSheetOpen).toBe(true);

    act(() => result.current.deleteFromSheet());
    expect(onDeleteRoster).toHaveBeenCalledWith('r1', expect.anything());
    expect(result.current.isRosterActionsSheetOpen).toBe(false);
  });
});
