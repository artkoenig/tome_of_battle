import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoster } from './useRoster';
import { syncRosterSelectionsWithSystem } from '../roster';
import { findMissingMandatoryListRules } from '../evaluation/mandatoryListRules';

/**
 * Issue 0138 — the auto-add effect in useRoster.js (Plan contracts 5/6):
 * a 5th `isFreshRoster` parameter gates an effect that, per force, asks
 * `findMissingMandatoryListRules` (since Issue 0157 a **report** reader in
 * `src/evaluation/`) and commits any hits via `replaceRoster` (no undo step),
 * re-evaluating on every roster change so a newly-visible mandatory rule is
 * picked up within the same session (AC3).
 *
 * Only `findMissingMandatoryListRules` is stubbed here (plus the pre-existing
 * resolveEntry/syncRosterSelectionsWithSystem stubs this file already carries)
 * — which slots qualify is the reader's own contract, covered by
 * `mandatoryListRules.test.js` and, end to end, by
 * `useRoster.costedMandatoryAutoAdd.test.js`. This file drives the EFFECT
 * WIRING: gating on isFreshRoster, the no-undo-step commit, and same-session
 * re-evaluation.
 */
vi.mock('../roster', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveEntry: vi.fn((sys, entry) => ({ id: entry.id, name: entry.name || 'Resolved Name', type: entry.type || 'model', ...entry })),
  syncRosterSelectionsWithSystem: vi.fn(roster => roster),
}));

vi.mock('../evaluation/mandatoryListRules', () => ({
  findMissingMandatoryListRules: vi.fn(() => []),
}));

// The reader answers off the report, not off the force, so the stub simply
// reports the same hits on every pass. The effect's own guard — a rule whose
// entry the force already carries is never added again — is what keeps this
// from looping, and pinning that guard is part of the point.
const missingAmong = (hits) => () => hits;

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
  const mandatoryHit = {
  entry: mandatoryEntry, categoryId: 'cat-rules',
  defId: mandatoryEntry.id, resolvedId: mandatoryEntry.id, name: mandatoryEntry.name,
};

  beforeEach(() => {
    syncRosterSelectionsWithSystem.mockImplementation(roster => roster);
    findMissingMandatoryListRules.mockReset();
    findMissingMandatoryListRules.mockReturnValue([]);
  });

  it('AC1: adds the one eligible mandatory selection to a fresh roster', () => {
    findMissingMandatoryListRules.mockImplementation(missingAmong([mandatoryHit]));

    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn(), undefined, true));

    expect(result.current.roster.forces[0].selections.map(s => s.selectionEntryId)).toEqual(['laws-of-undeath']);
  });

  it('AC1: the auto-add commits via replaceRoster, not setRoster — no undo step is recorded', () => {
    findMissingMandatoryListRules.mockImplementation(missingAmong([mandatoryHit]));

    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn(), undefined, true));

    expect(result.current.roster.forces[0].selections).toHaveLength(1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('AC7: adds every independently eligible entry in the force at once', () => {
    const secondEntry = { id: 'campaign-rules', name: 'Campaign rules', type: 'upgrade' };
    const secondHit = {
      entry: secondEntry, categoryId: 'cat-rules',
      defId: secondEntry.id, resolvedId: secondEntry.id, name: secondEntry.name,
    };
    findMissingMandatoryListRules.mockImplementation(missingAmong([mandatoryHit, secondHit]));

    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn(), undefined, true));

    const ids = result.current.roster.forces[0].selections.map(s => s.selectionEntryId).sort();
    expect(ids).toEqual(['campaign-rules', 'laws-of-undeath']);
    expect(result.current.canUndo).toBe(false);
  });

  it('AC4: never auto-adds on a roster that is not freshly created (isFreshRoster=false)', () => {
    findMissingMandatoryListRules.mockImplementation(missingAmong([mandatoryHit]));

    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn(), undefined, false));

    expect(result.current.roster.forces[0].selections).toEqual([]);
  });

  it('AC4: never auto-adds when the fresh-marker is omitted (safe default for existing callers)', () => {
    findMissingMandatoryListRules.mockImplementation(missingAmong([mandatoryHit]));

    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn()));

    expect(result.current.roster.forces[0].selections).toEqual([]);
  });

  it('AC3: re-fires within the same session once a previously-hidden eligible entry becomes visible and mandatory', () => {
    const triggerEntry = { id: 'general-von-carstein', name: 'Von Carstein General' };

    // The reader only reports the reactive rule once the report says it is
    // visible and mandatory — the trigger selection is what flips that. The
    // stub stands in for the report changing under the same session.
    let visibleInReport = false;
    findMissingMandatoryListRules.mockImplementation(() => (visibleInReport ? [mandatoryHit] : []));

    const { result } = renderHook(() => useRoster(initialRoster, mockSystem, vi.fn(), undefined, true));

    // Nothing eligible yet: the reactive rule stays absent.
    expect(result.current.roster.forces[0].selections).toEqual([]);

    visibleInReport = true;
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
    // The reader reports nothing missing (the report shows the rule as
    // occupied) — no removal mechanism exists in this issue's scope, so the
    // roster must retain the selection regardless of the underlying entry's
    // current visibility.
    findMissingMandatoryListRules.mockReturnValue([]);
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
