import { describe, it, expect } from 'vitest';
import { detectLanguage } from './languageDetection';

describe('detectLanguage', () => {
  it('prefers a stored, supported choice over the browser language', () => {
    expect(detectLanguage({ storedLanguage: 'en', browserLanguages: ['de-DE'] })).toBe('en');
    expect(detectLanguage({ storedLanguage: 'de', browserLanguages: ['en-US'] })).toBe('de');
  });

  it('ignores an unsupported stored value and uses the browser language', () => {
    expect(detectLanguage({ storedLanguage: 'fr', browserLanguages: ['de-DE'] })).toBe('de');
    expect(detectLanguage({ storedLanguage: null, browserLanguages: ['en-GB'] })).toBe('en');
  });

  it('maps a German browser language to German', () => {
    expect(detectLanguage({ browserLanguages: ['de-AT', 'en-US'] })).toBe('de');
    expect(detectLanguage({ browserLanguages: 'de' })).toBe('de');
  });

  it('maps any non-German browser language to English', () => {
    expect(detectLanguage({ browserLanguages: ['fr-FR'] })).toBe('en');
    expect(detectLanguage({ browserLanguages: ['en-US'] })).toBe('en');
  });

  it('falls back to English when nothing is known', () => {
    expect(detectLanguage({})).toBe('en');
    expect(detectLanguage({ browserLanguages: [] })).toBe('en');
  });
});
