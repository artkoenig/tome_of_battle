import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockGetWhfb6LinkingEnabled = vi.fn();
const mockSetWhfb6LinkingEnabled = vi.fn();
const mockGetDashboardFilter = vi.fn();
const mockSetDashboardFilter = vi.fn();

vi.mock('../../../platform/persistence/database', () => ({
  WHFB6_LINKING_DEFAULT: true,
  getWhfb6LinkingEnabled: () => mockGetWhfb6LinkingEnabled(),
  setWhfb6LinkingEnabled: (value) => mockSetWhfb6LinkingEnabled(value),
  DASHBOARD_FILTER_DEFAULT: { systemIds: [], factionIds: [] },
  getDashboardFilter: () => mockGetDashboardFilter(),
  setDashboardFilter: (value) => mockSetDashboardFilter(value),
}));

import { SettingsProvider, useSettings } from '../../../ui/viewmodels/SettingsContext';

describe('SettingsProvider / useSettings', () => {
  beforeEach(() => {
    mockGetWhfb6LinkingEnabled.mockReset();
    mockSetWhfb6LinkingEnabled.mockReset();
    mockGetWhfb6LinkingEnabled.mockResolvedValue(true);
    mockSetWhfb6LinkingEnabled.mockResolvedValue(undefined);
    mockGetDashboardFilter.mockReset();
    mockSetDashboardFilter.mockReset();
    mockGetDashboardFilter.mockResolvedValue({ systemIds: [], factionIds: [] });
    mockSetDashboardFilter.mockResolvedValue(undefined);
  });

  it('throws when useSettings is used outside a provider', () => {
    expect(() => renderHook(() => useSettings())).toThrow(/SettingsProvider/);
  });

  it('exposes the default value while the persisted value is still loading', () => {
    // A pending read means no stored record has resolved yet — the consumer must
    // see the default rather than undefined.
    mockGetWhfb6LinkingEnabled.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
    expect(result.current.whfb6LinkingEnabled).toBe(true);
  });

  it('hydrates the persisted value from the database', async () => {
    mockGetWhfb6LinkingEnabled.mockResolvedValue(false);
    const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
    await waitFor(() => expect(result.current.whfb6LinkingEnabled).toBe(false));
  });

  it('updates the value reactively and persists it on change', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
    await waitFor(() => expect(result.current.whfb6LinkingEnabled).toBe(true));

    act(() => {
      result.current.setWhfb6LinkingEnabled(false);
    });

    expect(result.current.whfb6LinkingEnabled).toBe(false);
    expect(mockSetWhfb6LinkingEnabled).toHaveBeenCalledWith(false);
  });

  // Issue 0203, AC8 — the overview's filter is a persisted setting: it is read
  // once on start and written on every change, so an army list a filter hides
  // is still hidden after a restart.
  describe('dashboard filter', () => {
    it('exposes the empty filter while the persisted one is still loading', () => {
      mockGetDashboardFilter.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
      expect(result.current.dashboardFilter).toEqual({ systemIds: [], factionIds: [] });
    });

    it('restores the persisted filter on start', async () => {
      mockGetDashboardFilter.mockResolvedValue({ systemIds: ['sys-1'], factionIds: ['cat-2'] });
      const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
      await waitFor(() => expect(result.current.dashboardFilter)
        .toEqual({ systemIds: ['sys-1'], factionIds: ['cat-2'] }));
    });

    it('publishes a changed filter and persists it', async () => {
      const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
      await waitFor(() => expect(mockGetDashboardFilter).toHaveBeenCalled());

      const next = { systemIds: [], factionIds: ['cat-1'] };
      act(() => {
        result.current.setDashboardFilter(next);
      });

      expect(result.current.dashboardFilter).toEqual(next);
      expect(mockSetDashboardFilter).toHaveBeenCalledWith(next);
    });
  });
});
