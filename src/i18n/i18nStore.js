import de from './locales/de.json';
import en from './locales/en.json';
import { translateMessage } from './translate';
import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from './constants';

// Single source of truth for the active UI language. The store keeps it as one
// module-level value behind a controlled API (get/set/subscribe), so the whole
// app reads one language and a change fans out to every subscriber (UDF/SSOT).
const catalogs = { de, en };

let activeLanguage = FALLBACK_LANGUAGE;
const listeners = new Set();

function applyDocumentLanguage(language) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = language;
  }
}

/** @returns {string} the active UI language code */
export function getLanguage() {
  return activeLanguage;
}

/**
 * Subscribes to language changes. Returns an unsubscribe function, matching the
 * contract `useSyncExternalStore` expects.
 * @param {() => void} listener
 * @returns {() => void}
 */
export function subscribeToLanguage(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Sets the active UI language in memory and mirrors it onto the document's
 * `lang` attribute. Subscribers are notified only on an actual change. This is
 * the sole mutator of the language state; persistence and detection are layered
 * on top of it (see languageController) so this stays a pure in-memory concern
 * usable directly by tests to pin the language.
 * @param {string} language a code from {@link SUPPORTED_LANGUAGES}
 */
export function setActiveLanguage(language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new Error(`Unsupported UI language: ${language}`);
  }

  const hasChanged = language !== activeLanguage;
  activeLanguage = language;
  applyDocumentLanguage(language);

  if (hasChanged) {
    listeners.forEach((listener) => listener());
  }
}

/**
 * Translates a message key into the active UI language. This is the module's
 * single public translation API; components reach it through
 * {@link useTranslation} so re-rendering on a language change is automatic.
 * @param {string} key
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function t(key, params) {
  return translateMessage(catalogs, activeLanguage, key, params);
}
