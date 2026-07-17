import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockGetRuleUrl = vi.fn();
const mockUseSettings = vi.fn();

vi.mock('../data/rulesLookup', () => ({
  getRuleUrl: (name) => mockGetRuleUrl(name),
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

import { useRuleUrl } from './useRuleUrl';

const RULE_URL = 'https://6th.whfb.app/special-rules/killing-blow';

describe('useRuleUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the mapped URL when linking is enabled and a mapping exists', () => {
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true });
    mockGetRuleUrl.mockReturnValue(RULE_URL);

    const { result } = renderHook(() => useRuleUrl());

    expect(result.current('Killing Blow')).toBe(RULE_URL);
  });

  it('returns null when linking is enabled but no mapping exists', () => {
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true });
    mockGetRuleUrl.mockReturnValue(null);

    const { result } = renderHook(() => useRuleUrl());

    expect(result.current('Unknown Rule')).toBeNull();
  });

  it('returns null for every name when linking is disabled, without consulting the mapping', () => {
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: false });
    mockGetRuleUrl.mockReturnValue(RULE_URL);

    const { result } = renderHook(() => useRuleUrl());

    expect(result.current('Killing Blow')).toBeNull();
    expect(mockGetRuleUrl).not.toHaveBeenCalled();
  });
});
