import { useCallback } from 'react';
import { getRuleUrl } from '../data/rulesLookup';
import { useSettings } from '../contexts/SettingsContext';

/**
 * Central resolver for 6th.whfb.app rule links that honors the global whfb6
 * linking setting. Returns a `getRuleUrl(name)` function which yields a URL only
 * when linking is enabled AND a mapping exists for the name; when the setting is
 * off it returns null for every name, regardless of whether a mapping would
 * exist. This is the single seam all chip call sites are meant to use so the
 * setting cannot be forgotten at an individual call site (see ADR-0015).
 *
 * @returns {(name: string) => (string | null)}
 */
export function useRuleUrl() {
  const { whfb6LinkingEnabled } = useSettings();
  return useCallback(
    (name) => (whfb6LinkingEnabled ? getRuleUrl(name) : null),
    [whfb6LinkingEnabled]
  );
}
