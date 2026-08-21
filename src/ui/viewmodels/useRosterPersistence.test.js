import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../domain/roster', () => ({
  syncRosterSelectionsWithSystem: vi.fn((roster) => roster),
}));

import { syncRosterSelectionsWithSystem } from '../../domain/roster';
import { useRosterPersistence } from './useRosterPersistence';

/**
 * Issue 0176 — catalogue sync and autosave, cut out of `useRosterState`. The
 * 150 ms delay and the unmount flush stay as they were (Issue 0176, out of
 * scope); these cases pin them next to the module that now owns them.
 */

const SYSTEM = { id: 'sys' };
const ROSTER = { id: 'r1', forces: [] };

function renderPersistence(overrides = {}) {
  const props = {
    roster: ROSTER,
    system: SYSTEM,
    replaceRoster: vi.fn(),
    saveRosterCallback: vi.fn(() => Promise.resolve()),
    reportError: vi.fn(),
    ...overrides,
  };
  const rendered = renderHook(args => useRosterPersistence(args), { initialProps: props });
  return { ...rendered, props };
}

beforeEach(() => {
  vi.useFakeTimers();
  syncRosterSelectionsWithSystem.mockImplementation(roster => roster);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useRosterPersistence', () => {
  it('saves the roster only after the debounce has elapsed', () => {
    const { props } = renderPersistence();

    act(() => { vi.advanceTimersByTime(149); });
    expect(props.saveRosterCallback).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1); });
    expect(props.saveRosterCallback).toHaveBeenCalledWith(ROSTER);
  });

  it('writes a synced roster back instead of saving the stale one', () => {
    const synced = { ...ROSTER, synced: true };
    syncRosterSelectionsWithSystem.mockReturnValue(synced);
    const { props } = renderPersistence();

    expect(props.replaceRoster).toHaveBeenCalledWith(synced);
    act(() => { vi.advanceTimersByTime(500); });
    expect(props.saveRosterCallback).not.toHaveBeenCalled();
  });

  it('does nothing without a system', () => {
    const { props } = renderPersistence({ system: null });

    act(() => { vi.advanceTimersByTime(500); });
    expect(props.saveRosterCallback).not.toHaveBeenCalled();
  });

  it('flushes a pending save on unmount', () => {
    const { unmount, props } = renderPersistence();

    act(() => { unmount(); });
    expect(props.saveRosterCallback).toHaveBeenCalledWith(ROSTER);
  });

  it('reports a rejected save through the app-wide channel', async () => {
    const saveRosterCallback = vi.fn(() => Promise.reject(new Error('quota')));
    const reportError = vi.fn();
    renderPersistence({ saveRosterCallback, reportError });

    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    expect(reportError).toHaveBeenCalledWith(expect.any(String));
  });

  it('reports a throwing save through the app-wide channel', () => {
    const saveRosterCallback = vi.fn(() => { throw new Error('blocked'); });
    const reportError = vi.fn();
    renderPersistence({ saveRosterCallback, reportError });

    act(() => { vi.advanceTimersByTime(150); });
    expect(reportError).toHaveBeenCalledWith(expect.any(String));
  });

  it('saveNow awaits the callback with the roster it is given', async () => {
    const { result, props } = renderPersistence();
    const explicit = { id: 'r2' };

    await act(async () => { await result.current.saveNow(explicit); });

    expect(props.saveRosterCallback).toHaveBeenCalledWith(explicit);
  });

  it('saveNow is harmless without a save callback', async () => {
    const { result } = renderPersistence({ saveRosterCallback: undefined });

    await expect(result.current.saveNow(ROSTER)).resolves.toBeUndefined();
  });
});
