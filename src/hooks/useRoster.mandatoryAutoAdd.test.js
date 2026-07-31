import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoster } from './useRoster';
import { syncRosterSelectionsWithSystem, findMissingMandatoryListRuleSelections } from '../roster';

/**
 * Issue 0138 — the new auto-add effect in useRoster.js (Plan contracts 5/6):
 * a 5th `isFreshRoster` parameter gates a new effect that, per force, calls
 * `findMissingMandatoryListRuleSelections` and commits any hits via
 * `replaceRoster` (no undo step), re-evaluating on every roster change so a
 * newly-visible mandatory rule is picked up within the same session (AC3).
 *
 * Only `findMissingMandatoryListRuleSelections` is stubbed here (plus the
 * pre-existing resolveEntry/syncRosterSelectionsWithSystem stubs this file
 * already carries) — its own correctness (which entries qualify, hidden
 * handling, etc.) is covered by listRules.mandatoryPredicate.test.js. This
 * file drives the EFFECT WIRING: gating on isFreshRoster, the no-undo-step
 * commit, and same-session re-evaluation.
 */
vi.mock('../roster', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveEntry: vi.fn((sys, entry) => ({ id: entry.id, name: entry.name || 'Resolved Name', type: entry.type || 'model', ...entry })),
  syncRosterSelectionsWithSystem: vi.fn(roster => roster),
  findMissingMandatoryListRuleSelections: vi.fn(() => []),
}));

// Mock implementation factory: mirrors the real sweep's own idempotence
// (findPresentSelection) — a hit is only reported while its id is absent from
// force.selections — so wiring the mock this way is what avoids masking (or
// causing) an infinite auto-add loop in these tests, exactly like the
// contract's own "kein doppeltes Hinzufügen" guarantee.
const missingAmong = (hits) => (_system, _catalogue, force) => {
  const presentIds = new Set((force.selections || []).map(s => s.selectionEntryId));
  return hits.filter(hit => !presentIds.has(hit.entry.id));
};

describe('useRoster — automatic mandatory list-rule auto-add (Issue 0138)', () => {
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
  const mandatoryHit = { entry: mandatoryEntry, resolved: { ...mandatoryEntry }, categoryId: 'cat-rules' };

  beforeEach(() => {
    syncRosterSelectionsWithSystem.mockImplementation(roster => roster);
    findMissingMandatoryListRuleSelections.mockReset();
    findMissingMandatoryListRuleSelections.mockReturnValue([]);
  });

  it('AC1: adds the one eligible mandatory selection to a fresh roster', () => {
    findMissingMandatoryListRuleSelections.mockImplementation(missingAmong([mandatoryHit]));

    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn(), undefined, true));

    expect(result.current.roster.forces[0].selections.map(s => s.selectionEntryId)).toEqual(['laws-of-undeath']);
  });

  it('AC1: the auto-add commits via replaceRoster, not setRoster — no undo step is recorded', () => {
    findMissingMandatoryListRuleSelections.mockImplementation(missingAmong([mandatoryHit]));

    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn(), undefined, true));

    expect(result.current.roster.forces[0].selections).toHaveLength(1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('AC7: adds every independently eligible entry in the force at once', () => {
    const secondEntry = { id: 'campaign-rules', name: 'Campaign rules', type: 'upgrade' };
    const secondHit = { entry: secondEntry, resolved: { ...secondEntry }, categoryId: 'cat-rules' };
    findMissingMandatoryListRuleSelections.mockImplementation(missingAmong([mandatoryHit, secondHit]));

    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn(), undefined, true));

    const ids = result.current.roster.forces[0].selections.map(s => s.selectionEntryId).sort();
    expect(ids).toEqual(['campaign-rules', 'laws-of-undeath']);
    expect(result.current.canUndo).toBe(false);
  });

  it('AC4: never auto-adds on a roster that is not freshly created (isFreshRoster=false)', () => {
    findMissingMandatoryListRuleSelections.mockImplementation(missingAmong([mandatoryHit]));

    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn(), undefined, false));

    expect(result.current.roster.forces[0].selections).toEqual([]);
  });

  it('AC4: never auto-adds when the fresh-marker is omitted (safe default for existing callers)', () => {
    findMissingMandatoryListRuleSelections.mockImplementation(missingAmong([mandatoryHit]));

    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));

    expect(result.current.roster.forces[0].selections).toEqual([]);
  });

  it('AC3: re-fires within the same session once a previously-hidden eligible entry becomes visible and mandatory', () => {
    const triggerEntry = { id: 'general-von-carstein', name: 'Von Carstein General' };

    // The sweep only reports the reactive rule once its trigger selection is
    // present in the force — mirroring findMissingMandatoryListRuleSelections'
    // own reactive-visibility contract (AC3).
    findMissingMandatoryListRuleSelections.mockImplementation((_system, _catalogue, force) => {
      const ids = (force.selections || []).map(s => s.selectionEntryId);
      const hasTrigger = ids.includes('general-von-carstein');
      const alreadyPresent = ids.includes('laws-of-undeath');
      return (hasTrigger && !alreadyPresent) ? [mandatoryHit] : [];
    });

    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn(), undefined, true));

    // Nothing eligible yet: the reactive rule stays absent.
    expect(result.current.roster.forces[0].selections).toEqual([]);

    act(() => {
      result.current.addUnit(triggerEntry, 'cat-general');
    });

    // The trigger is now present (a manual, undoable action) AND, in the same
    // session/render, the newly-visible mandatory rule has been auto-added
    // alongside it — no separate "create a new roster" step required.
    const ids = result.current.roster.forces[0].selections.map(s => s.selectionEntryId);
    expect(ids).toContain('general-von-carstein');
    expect(ids).toContain('laws-of-undeath');
  });

  it('AC6 (second half): a selection that was auto-added earlier is not stripped from the roster on a later render', () => {
    // The sweep reports nothing missing (findPresentSelection already finds
    // it) — no removal mechanism exists in this issue's scope, so the roster
    // must retain the selection regardless of the underlying entry's current
    // visibility.
    findMissingMandatoryListRuleSelections.mockReturnValue([]);
    const rosterWithSelection = {
      ...initialRoster,
      forces: [{
        id: 'force-1', catalogueId: 'cat-1',
        selections: [{ id: 'sel-1', selectionEntryId: 'laws-of-undeath', name: 'The Laws of Undeath', selections: [] }],
      }],
    };

    const { result } = renderHook(() => useRoster(rosterWithSelection, mockSystem, vi.fn(), undefined, true));

    expect(result.current.roster.forces[0].selections.map(s => s.selectionEntryId)).toEqual(['laws-of-undeath']);

    // Trigger a further render (e.g. an unrelated user action) and confirm the
    // selection is still untouched afterwards.
    act(() => {
      result.current.updateRosterName('Renamed');
    });
    expect(result.current.roster.forces[0].selections.map(s => s.selectionEntryId)).toEqual(['laws-of-undeath']);
  });
});
