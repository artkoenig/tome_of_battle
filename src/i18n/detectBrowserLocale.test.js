import { describe, it, expect } from 'vitest';
import { detectBrowserLocale } from './detectBrowserLocale';
import {
  GERMAN_LOCALE,
  ENGLISH_LOCALE,
  FALLBACK_LOCALE,
} from './localeConfig';

describe('detectBrowserLocale', () => {
  it('picks German for a German browser language', () => {
    expect(detectBrowserLocale(['de-DE', 'en'])).toBe(GERMAN_LOCALE);
  });

  it('picks English for an English browser language', () => {
    expect(detectBrowserLocale(['en-US'])).toBe(ENGLISH_LOCALE);
  });

  it('falls back to English for an unsupported language (French), not German', () => {
    expect(detectBrowserLocale(['fr-FR', 'fr'])).toBe(FALLBACK_LOCALE);
    expect(detectBrowserLocale(['fr-FR', 'fr'])).not.toBe(GERMAN_LOCALE);
  });

  it('honours the first supported language in the preference order', () => {
    expect(detectBrowserLocale(['fr', 'de', 'en'])).toBe(GERMAN_LOCALE);
  });

  it('matches on the primary subtag regardless of region', () => {
    expect(detectBrowserLocale(['de-AT'])).toBe(GERMAN_LOCALE);
    expect(detectBrowserLocale(['en-GB'])).toBe(ENGLISH_LOCALE);
  });

  it('falls back to English for an empty or missing preference list', () => {
    expect(detectBrowserLocale([])).toBe(FALLBACK_LOCALE);
    expect(detectBrowserLocale(undefined)).toBe(FALLBACK_LOCALE);
  });

  it('is case-insensitive about the language tag', () => {
    expect(detectBrowserLocale(['DE-de'])).toBe(GERMAN_LOCALE);
  });
});
