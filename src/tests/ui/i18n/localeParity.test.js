import { describe, it, expect } from 'vitest';
import de from '../../../ui/i18n/locales/de.json';
import en from '../../../ui/i18n/locales/en.json';
import { SUPPORTED_LANGUAGES } from '../../../ui/i18n/constants';

// One entry per shipped language, so adding a language to SUPPORTED_LANGUAGES
// without a matching locale file (or vice versa) is caught here too.
const catalogs = { de, en };

describe('locale parity', () => {
  it('ships a catalog for every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(catalogs[language], `missing locale file for "${language}"`).toBeDefined();
    }
  });

  it('has identical key sets across all language files', () => {
    const referenceKeys = Object.keys(en).sort();

    for (const language of SUPPORTED_LANGUAGES) {
      const keys = Object.keys(catalogs[language]).sort();
      expect(keys, `key set of "${language}" differs from English`).toEqual(referenceKeys);
    }
  });

  it('has no empty translations', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const [key, value] of Object.entries(catalogs[language])) {
        expect(value, `empty value for "${key}" in "${language}"`).not.toBe('');
      }
    }
  });
});
