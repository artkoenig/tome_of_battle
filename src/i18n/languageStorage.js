import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from './constants';

/**
 * Reads the persisted UI-language choice from localStorage.
 * @returns {string | null} a supported code, or null when nothing valid is stored
 */
export function readStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : null;
  } catch (error) {
    // Console-only by design: a blocked or unavailable localStorage only means
    // the app cannot remember a manual choice, so detection falls back to the
    // browser language — the UI stays fully usable.
    console.error('Failed to read stored UI language:', error);
    return null;
  }
}

/**
 * Persists the manual UI-language choice so it survives a reload.
 * @param {string} language
 */
export function writeStoredLanguage(language) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    // Console-only by design: the choice still applies for the running session;
    // only its persistence across restarts is lost.
    console.error('Failed to persist UI language:', error);
  }
}
