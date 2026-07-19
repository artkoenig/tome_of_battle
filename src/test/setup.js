import { beforeEach } from 'vitest';
import i18n from '../i18n';
import { GERMAN_LOCALE } from '../i18n/localeConfig';

// Initialising the i18next instance here (via the import above) registers it
// with react-i18next for every test file, so `useTranslation()` returns real
// strings instead of raw keys without each test wiring up i18n itself.

// The component tests assert the German UI copy, so the test environment is
// pinned to German deterministically:
//   1. navigator language preferences report German, so any SettingsProvider
//      that runs browser detection resolves to 'de' (never the English
//      fallback that jsdom's default 'en-US' would otherwise produce).
Object.defineProperty(navigator, 'languages', {
  configurable: true,
  get: () => [`${GERMAN_LOCALE}-DE`, GERMAN_LOCALE],
});
Object.defineProperty(navigator, 'language', {
  configurable: true,
  get: () => `${GERMAN_LOCALE}-DE`,
});

//   2. Every test starts from German, so a test that switches the language
//      (e.g. the locale switcher tests) cannot leak state into the next one.
beforeEach(() => {
  i18n.changeLanguage(GERMAN_LOCALE);
});
