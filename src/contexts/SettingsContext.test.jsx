import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockGetWhfb6LinkingEnabled = vi.fn();
const mockSetWhfb6LinkingEnabled = vi.fn();

vi.mock('../db/database', () => ({
  WHFB6_LINKING_DEFAULT: true,
  getWhfb6LinkingEnabled: () => mockGetWhfb6LinkingEnabled(),
  setWhfb6LinkingEnabled: (value) => mockSetWhfb6LinkingEnabled(value),
}));

import { SettingsProvider, useSettings } from './SettingsContext';

describe('SettingsProvider / useSettings', () => {
  beforeEach(() => {
    mockGetWhfb6LinkingEnabled.mockReset();
    mockSetWhfb6LinkingEnabled.mockReset();
    mockGetWhfb6LinkingEnabled.mockResolvedValue(true);
    mockSetWhfb6LinkingEnabled.mockResolvedValue(undefined);
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
});
