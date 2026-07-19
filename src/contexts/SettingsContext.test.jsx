import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockGetWhfb6LinkingEnabled = vi.fn();
const mockSetWhfb6LinkingEnabled = vi.fn();
const mockGetLocale = vi.fn();
const mockSetLocale = vi.fn();
const mockChangeLanguage = vi.fn();
const mockDetectCurrentBrowserLocale = vi.fn();

vi.mock('../db/database', () => ({
  WHFB6_LINKING_DEFAULT: true,
  getWhfb6LinkingEnabled: () => mockGetWhfb6LinkingEnabled(),
  setWhfb6LinkingEnabled: (value) => mockSetWhfb6LinkingEnabled(value),
  getLocale: () => mockGetLocale(),
  setLocale: (value) => mockSetLocale(value),
}));

vi.mock('../i18n', () => ({
  default: { changeLanguage: (value) => mockChangeLanguage(value) },
}));

vi.mock('../i18n/detectBrowserLocale', () => ({
  detectCurrentBrowserLocale: () => mockDetectCurrentBrowserLocale(),
}));

import { SettingsProvider, useSettings } from './SettingsContext';

describe('SettingsProvider / useSettings', () => {
  beforeEach(() => {
    mockGetWhfb6LinkingEnabled.mockReset();
    mockSetWhfb6LinkingEnabled.mockReset();
    mockGetLocale.mockReset();
    mockSetLocale.mockReset();
    mockChangeLanguage.mockReset();
    mockDetectCurrentBrowserLocale.mockReset();

    mockGetWhfb6LinkingEnabled.mockResolvedValue(true);
    mockSetWhfb6LinkingEnabled.mockResolvedValue(undefined);
    mockGetLocale.mockResolvedValue(null);
    mockSetLocale.mockResolvedValue(undefined);
    mockDetectCurrentBrowserLocale.mockReturnValue('de');
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

  describe('locale', () => {
    it('exposes the German default while the locale is still loading', () => {
      mockGetLocale.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
      expect(result.current.locale).toBe('de');
    });

    it('hydrates a persisted locale and applies it to i18next without detecting', async () => {
      mockGetLocale.mockResolvedValue('en');
      const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });

      await waitFor(() => expect(result.current.locale).toBe('en'));
      expect(mockChangeLanguage).toHaveBeenCalledWith('en');
      expect(mockDetectCurrentBrowserLocale).not.toHaveBeenCalled();
    });

    it('detects the browser locale when none is persisted and does not persist the detection', async () => {
      mockGetLocale.mockResolvedValue(null);
      mockDetectCurrentBrowserLocale.mockReturnValue('en');
      const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });

      await waitFor(() => expect(result.current.locale).toBe('en'));
      expect(mockChangeLanguage).toHaveBeenCalledWith('en');
      // Detection is applied but never written back — only a manual choice is.
      expect(mockSetLocale).not.toHaveBeenCalled();
    });

    it('switches, applies and persists the locale on a manual change', async () => {
      mockGetLocale.mockResolvedValue('de');
      const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
      await waitFor(() => expect(result.current.locale).toBe('de'));

      act(() => {
        result.current.setLocale('en');
      });

      expect(result.current.locale).toBe('en');
      expect(mockChangeLanguage).toHaveBeenCalledWith('en');
      expect(mockSetLocale).toHaveBeenCalledWith('en');
    });
  });
});
