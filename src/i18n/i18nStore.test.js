import { describe, it, expect, vi, afterEach } from 'vitest';
import { getLanguage, setActiveLanguage, subscribeToLanguage, t } from './i18nStore';

describe('i18nStore', () => {
  afterEach(() => {
    // Leave the store in the test-pinned default so later files are unaffected.
    setActiveLanguage('de');
  });

  it('reports and updates the active language', () => {
    setActiveLanguage('en');
    expect(getLanguage()).toBe('en');
    setActiveLanguage('de');
    expect(getLanguage()).toBe('de');
  });

  it('mirrors the active language onto the document lang attribute', () => {
    setActiveLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    setActiveLanguage('de');
    expect(document.documentElement.lang).toBe('de');
  });

  it('rejects an unsupported language', () => {
    expect(() => setActiveLanguage('fr')).toThrow(/Unsupported UI language/);
  });

  it('notifies subscribers on a real change only', () => {
    setActiveLanguage('de');
    const listener = vi.fn();
    const unsubscribe = subscribeToLanguage(listener);

    setActiveLanguage('de'); // no change
    expect(listener).not.toHaveBeenCalled();

    setActiveLanguage('en'); // change
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setActiveLanguage('de');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('translates through the active language with English fallback', () => {
    setActiveLanguage('de');
    expect(t('settings.title')).toBe('Einstellungen');
    setActiveLanguage('en');
    expect(t('settings.title')).toBe('Settings');
  });
});
