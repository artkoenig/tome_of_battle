import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRosterState } from '../../../ui/viewmodels/useRosterState';
import { syncRosterSelectionsWithSystem } from '../../../contexts/armylist/model';
import { findMissingMandatoryListRules } from '../../../contexts/ruleengine/readmodel/mandatoryListRules';

/**
 * Issue 0138 — the automatic mandatory list-rule addition seen from the state
 * node. Since Issue 0189 the rule itself is the use case
 * `applyMandatoryListRules` and is pinned without React in
 * `src/tests/contexts/armylist/mandatoryListRules.test.js`; what is left here is
 * the WIRING the node contributes and nothing else: the commit without an undo
 * step, the gate's safe default for a caller that omits it, and the
 * re-evaluation within the same session.
 */
vi.mock('../../../contexts/armylist/model', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveEntry: vi.fn((sys, entry) => ({ id: entry.id, name: entry.name || 'Resolved Name', type: entry.type || 'model', ...entry })),
  syncRosterSelectionsWithSystem: vi.fn(roster => roster),
}));

vi.mock('../../../contexts/ruleengine/readmodel/mandatoryListRules', () => ({
  findMissingMandatoryListRules: vi.fn(() => []),
}));

describe('useRosterState — automatic mandatory list-rule auto-add (Issue 0138)', () => {
  const mockSystem = { id: 'sys-1', name: 'Test System' };
  const initialRoster = {
    id: 'roster-1',
    name: 'Test Roster',
    costLimitValue: 1000,
    costLimitType: 'points',
    catalogueId: 'cat-1',
    forces: [{ id: 'force-1', catalogueId: 'cat-1', selections: [] }],
  };

  const mandatoryEntry = { id: 'laws-of-undeath', name: 'The Laws of Undeath', type: 'upgrade' };
  const mandatoryHit = {
    entry: mandatoryEntry, categoryId: 'cat-rules',
    defId: mandatoryEntry.id, resolvedId: mandatoryEntry.id, name: mandatoryEntry.name,
  };

  beforeEach(() => {
    syncRosterSelectionsWithSystem.mockImplementation(roster => roster);
    findMissingMandatoryListRules.mockReset();
    findMissingMandatoryListRules.mockReturnValue([]);
  });

  it('AC1: the auto-add commits via replaceRoster, not setRoster — no undo step is recorded', () => {
    findMissingMandatoryListRules.mockReturnValue([mandatoryHit]);

    const { result } = renderHook(() => useRosterState(initialRoster, mockSystem, vi.fn(), undefined, true));

    expect(result.current.roster.forces[0].selections.map(s => s.selectionEntryId)).toEqual(['laws-of-undeath']);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('AC4: never auto-adds when the fresh-marker is omitted (safe default for existing callers)', () => {
    findMissingMandatoryListRules.mockReturnValue([mandatoryHit]);

    const { result } = renderHook(() => useRosterState(initialRoster, mockSystem, vi.fn()));

    expect(result.current.roster.forces[0].selections).toEqual([]);
  });

  it('AC3: re-fires within the same session once a previously-hidden eligible entry becomes visible and mandatory', () => {
    const triggerEntry = { id: 'general-von-carstein', name: 'Von Carstein General' };

    // The reader only reports the reactive rule once the report says it is
    // visible and mandatory — the trigger selection is what flips that. The
    // stub stands in for the report changing under the same session.
    let visibleInReport = false;
    findMissingMandatoryListRules.mockImplementation(() => (visibleInReport ? [mandatoryHit] : []));

    const { result } = renderHook(() => useRosterState(initialRoster, mockSystem, vi.fn(), undefined, true));

    // Nothing eligible yet: the reactive rule stays absent.
    expect(result.current.roster.forces[0].selections).toEqual([]);

    visibleInReport = true;
    act(() => {
      result.current.commands.addUnit(triggerEntry, 'cat-general');
    });

    // The trigger is now present (a manual, undoable action) AND, in the same
    // session/render, the newly-visible mandatory rule has been auto-added
    // alongside it — no separate "create a new roster" step required.
    const ids = result.current.roster.forces[0].selections.map(s => s.selectionEntryId);
    expect(ids).toContain('general-von-carstein');
    expect(ids).toContain('laws-of-undeath');
  });
});
