import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { initializeLanguage, changeLanguage } from './languageController';
import { getLanguage, setActiveLanguage } from './i18nStore';
import { LANGUAGE_STORAGE_KEY } from './constants';

describe('languageController', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    setActiveLanguage('de');
  });

  it('changeLanguage switches the active language immediately', () => {
    changeLanguage('en');
    expect(getLanguage()).toBe('en');
  });

  it('changeLanguage persists the choice so it survives a reload', () => {
    changeLanguage('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('initializeLanguage restores a persisted choice', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    const resolved = initializeLanguage();
    expect(resolved).toBe('en');
    expect(getLanguage()).toBe('en');
  });

  it('initializeLanguage ignores an unsupported persisted value', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    // With no supported stored value, detection falls to the browser language;
    // jsdom reports English, so the result must be a supported language.
    const resolved = initializeLanguage();
    expect(['de', 'en']).toContain(resolved);
    expect(resolved).not.toBe('fr');
  });
});
