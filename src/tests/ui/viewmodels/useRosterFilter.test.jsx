import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * Issue 0203 — the filter's ViewModel: the values on offer, the chips, and the
 * writes it makes into the persisted settings. The settings context is the one
 * module mocked; the derivations are production code.
 */
const setDashboardFilter = vi.fn();
let dashboardFilter = { systemIds: [], factionIds: [] };

vi.mock('../../../ui/viewmodels/SettingsContext', () => ({
  useSettings: () => ({ dashboardFilter, setDashboardFilter }),
}));

const { useRosterFilter } = await import('../../../ui/viewmodels/useRosterFilter');
const { FILTER_CATEGORY } = await import('../../../ui/viewmodels/rosterFilter');

const SYSTEMS = [
  { id: 'sys-1', name: 'Warhammer Fantasy', catalogues: [{ id: 'cat-1', name: 'Empire' }, { id: 'cat-2', name: 'Bretonnia' }] },
  { id: 'sys-2', name: 'Mordheim', catalogues: [{ id: 'cat-3', name: 'Skaven' }] },
];

const ROSTERS = [
  { id: 'r1', systemId: 'sys-1', catalogueId: 'cat-1' },
  { id: 'r2', systemId: 'sys-2', catalogueId: 'cat-3' },
  { id: 'r3', systemId: 'sys-1', catalogueId: 'gone' },
];

beforeEach(() => {
  setDashboardFilter.mockClear();
  dashboardFilter = { systemIds: [], factionIds: [] };
});

describe('useRosterFilter', () => {
  it('offers only the values that occur among the stored army lists, by name', () => {
    const { result } = renderHook(() => useRosterFilter({ rosters: ROSTERS, systems: SYSTEMS }));

    expect(result.current.options.systems.map(o => o.name)).toEqual(['Mordheim', 'Warhammer Fantasy']);
    // Bretonnia carries no list, and `gone` resolves to no army book at all.
    expect(result.current.options.factions.map(o => o.name)).toEqual(['Empire', 'Skaven']);
  });

  it('writes a toggled value into the settings and takes one back out', () => {
    const { result, rerender } = renderHook(() => useRosterFilter({ rosters: ROSTERS, systems: SYSTEMS }));

    act(() => result.current.toggleValue(FILTER_CATEGORY.FACTION, 'cat-1'));
    expect(setDashboardFilter).toHaveBeenCalledWith({ systemIds: [], factionIds: ['cat-1'] });

    dashboardFilter = { systemIds: ['sys-1'], factionIds: ['cat-1'] };
    rerender();

    expect(result.current.selectedCount).toBe(2);
    expect(result.current.chips).toEqual([
      { category: FILTER_CATEGORY.SYSTEM, id: 'sys-1', name: 'Warhammer Fantasy' },
      { category: FILTER_CATEGORY.FACTION, id: 'cat-1', name: 'Empire' },
    ]);

    act(() => result.current.removeValue(FILTER_CATEGORY.SYSTEM, 'sys-1'));
    expect(setDashboardFilter).toHaveBeenLastCalledWith({ systemIds: [], factionIds: ['cat-1'] });

    act(() => result.current.clearAll());
    expect(setDashboardFilter).toHaveBeenLastCalledWith({ systemIds: [], factionIds: [] });
  });

  it('opens and closes the mobile sheet', () => {
    const { result } = renderHook(() => useRosterFilter({ rosters: ROSTERS, systems: SYSTEMS }));

    expect(result.current.isSheetOpen).toBe(false);
    act(() => result.current.openSheet());
    expect(result.current.isSheetOpen).toBe(true);
    act(() => result.current.closeSheet());
    expect(result.current.isSheetOpen).toBe(false);
  });
});
