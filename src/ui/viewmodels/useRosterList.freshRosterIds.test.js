import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useRosterList from './useRosterList';
import { saveRoster, deleteRoster } from '../../data/db/database';
import {
  exportRosterToXml,
  importRosterFromXml,
  MissingSystemError,
} from '../../domain/roster/rosterSerialization';
import { readRosterText, buildRosterFile } from '../../data/services/rosterTransfer';
import { syncRosterSelectionsWithSystem, reconcileImportedSelectionIds } from '../../domain/roster';

/**
 * Issue 0138, Plan contract 4 — useRosterList tracks, purely in memory, which
 * roster ids were created THIS session (`freshRosterIds`), exposed through a
 * query function (here assumed named `isFreshRoster`, per the contract's own
 * "z. B. `isFreshRoster(id)`" wording — the observable behaviour under test,
 * not the exact function name, is what the acceptance criteria decide).
 *
 * These tests deliberately never inspect any field on the roster object
 * itself: the freshness marker must live outside the persisted Roster/Force
 * schema (never touch IndexedDB, `.rosz` export/import, or the object handed
 * to `saveRoster`).
 */
vi.mock('../../data/db/database', () => ({
  saveRoster: vi.fn().mockResolvedValue(null),
  deleteRoster: vi.fn().mockResolvedValue(null),
}));

const { MissingSystemErrorMock } = vi.hoisted(() => {
  class MissingSystemErrorMock extends Error {}
  return { MissingSystemErrorMock };
});

vi.mock('../../domain/roster/rosterSerialization', () => ({
  MissingSystemError: MissingSystemErrorMock,
  exportRosterToXml: vi.fn(() => '<xml/>'),
  importRosterFromXml: vi.fn(),
}));

vi.mock('../../data/services/rosterTransfer', () => ({
  readRosterText: vi.fn(() => Promise.resolve('<xml/>')),
  buildRosterFile: vi.fn(() => Promise.resolve({ blob: new Blob(), fileName: 'r.rosz' })),
}));

vi.mock('../../domain/roster', () => ({
  syncRosterSelectionsWithSystem: vi.fn((roster) => roster),
  reconcileImportedSelectionIds: vi.fn((roster) => roster),
}));

const system = { id: 'sys-1', name: 'Sys', costTypes: [{ id: 'pts' }], forceEntries: [{ id: 'force-a' }] };
const preExistingRoster = { id: 'roster-existing', name: 'Bestehende Liste', systemId: 'sys-1' };

function setup(overrides = {}) {
  const deps = {
    systems: [system],
    rosters: [preExistingRoster],
    setRosters: vi.fn(),
    reloadData: vi.fn(),
    navigate: vi.fn(),
    showToast: vi.fn(),
    ...overrides,
  };
  const view = renderHook((props) => useRosterList(props), { initialProps: deps });
  return { deps, ...view };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRosterList — in-memory freshness tracking (Issue 0138, contract 4)', () => {
  const form = { name: 'Neu', systemId: 'sys-1', catId: 'cat-1', forceEntryId: 'force-a', limit: '1000' };

  it('reports a roster created via createRoster as fresh in the creating session', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.createRoster(form);
    });

    const createdId = saveRoster.mock.calls[0][0].id;
    expect(result.current.isFreshRoster(createdId)).toBe(true);
  });

  it('never reports a pre-existing roster id (never created this session) as fresh', () => {
    const { result } = setup();
    expect(result.current.isFreshRoster(preExistingRoster.id)).toBe(false);
  });

  it('does not report an unknown/absent id as fresh', () => {
    const { result } = setup();
    expect(result.current.isFreshRoster('never-seen-id')).toBe(false);
  });

  it('does not mark anything fresh when createRoster fails validation and never saves', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.createRoster({ name: '', systemId: 'sys-1', catId: 'cat-1' });
    });

    expect(saveRoster).not.toHaveBeenCalled();
    // Nothing was created, so there is no id to legitimately query — but the
    // hook must not have marked some stray/placeholder id fresh either.
    expect(result.current.isFreshRoster(undefined)).toBe(false);
  });

  it('is not part of the persisted/saved roster shape: a reloaded session no longer reports it fresh', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.createRoster(form);
    });
    const createdRoster = saveRoster.mock.calls[0][0];
    expect(result.current.isFreshRoster(createdRoster.id)).toBe(true);

    // Simulate a page reload: a brand-new hook instance that only ever sees
    // the created roster as data loaded from persistence (never through
    // createRoster in this instance's own lifetime).
    const reloaded = setup({ rosters: [preExistingRoster, createdRoster] });
    expect(reloaded.result.current.isFreshRoster(createdRoster.id)).toBe(false);
  });
});
