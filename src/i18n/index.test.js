import { describe, it, expect, vi } from 'vitest';
import { createInstance } from 'i18next';
import i18n from './index';
import {
  GERMAN_LOCALE,
  ENGLISH_LOCALE,
  FALLBACK_LOCALE,
} from './localeConfig';

describe('i18n instance', () => {
  it('initialises with German as the active language and English as fallback', () => {
    expect(i18n.language).toBe(GERMAN_LOCALE);
    expect(i18n.options.fallbackLng).toContain(FALLBACK_LOCALE);
  });

  it('resolves a key present in both locales to the active locale value', async () => {
    await i18n.changeLanguage(GERMAN_LOCALE);
    expect(i18n.t('navigation.camp')).toBe('Heerlager');
    await i18n.changeLanguage(ENGLISH_LOCALE);
    expect(i18n.t('navigation.camp')).toBe('War Camp');
  });

  it('falls back to the English value when the active locale lacks the key', async () => {
    const englishOnlyKey = 'testOnly.englishOnly';
    const englishOnlyValue = 'English only value';
    i18n.addResource(ENGLISH_LOCALE, 'translation', englishOnlyKey, englishOnlyValue);

    await i18n.changeLanguage(GERMAN_LOCALE);

    // No German value exists, so the fallback English value is used verbatim —
    // no raw key and no placeholder markup reach the caller.
    expect(i18n.t(englishOnlyKey)).toBe(englishOnlyValue);
  });

  it('invokes the missing-key handler when a key is absent in every locale', () => {
    const missingKeyHandler = vi.fn();
    const instance = createInstance();
    instance.init({
      lng: GERMAN_LOCALE,
      fallbackLng: FALLBACK_LOCALE,
      resources: {
        [GERMAN_LOCALE]: { translation: {} },
        [ENGLISH_LOCALE]: { translation: {} },
      },
      saveMissing: true,
      missingKeyHandler,
    });

    instance.t('totally.absent.key');

    expect(missingKeyHandler).toHaveBeenCalled();
  });
});
