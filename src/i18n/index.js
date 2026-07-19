import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES,
  GERMAN_LOCALE,
  ENGLISH_LOCALE,
} from './localeConfig';
import germanResources from './resources/de.json';
import englishResources from './resources/en.json';

// Single i18next instance for the whole app (see ADR-0022). Resources are
// bundled inline rather than loaded via a backend, so initialisation is
// synchronous and `t()` returns real values on the very first render — no
// suspense fallback or key-flash. Browser detection and the persisted user
// preference are applied at runtime by SettingsContext, not here, which keeps
// this module a deterministic starting point (German source language).
const isDevelopment = Boolean(import.meta.env && import.meta.env.DEV);

i18n.use(initReactI18next).init({
  resources: {
    [GERMAN_LOCALE]: { translation: germanResources },
    [ENGLISH_LOCALE]: { translation: englishResources },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: FALLBACK_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  // Resources are bundled, so initialise fully synchronously: `t()` returns real
  // strings on the first render (no key-flash) instead of settling a tick later.
  initImmediate: false,
  // A missing key in the active locale falls back silently to the English
  // value; no visible placeholder or raw key ever reaches the UI.
  returnNull: false,
  returnEmptyString: false,
  interpolation: {
    // React already escapes rendered values, so i18next must not double-escape.
    escapeValue: false,
  },
  react: {
    // Synchronous init means the tree is always ready; suspense would add an
    // unnecessary loading boundary.
    useSuspense: false,
  },
  // In development a missing key additionally surfaces as a console warning so
  // gaps are caught early; production stays silent.
  saveMissing: isDevelopment,
  missingKeyHandler: isDevelopment
    ? (languages, namespace, key) => {
        console.warn(
          `[i18n] Missing translation key "${key}" for locale(s) ${languages.join(', ')} — falling back to ${FALLBACK_LOCALE}.`
        );
      }
    : undefined,
});

export default i18n;
