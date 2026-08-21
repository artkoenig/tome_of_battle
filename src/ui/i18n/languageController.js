import { detectLanguage } from './languageDetection';
import { readStoredLanguage, writeStoredLanguage } from './languageStorage';
import { setActiveLanguage } from './i18nStore';

function browserLanguages() {
  if (typeof navigator === 'undefined') return [];
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages;
  }
  return navigator.language ? [navigator.language] : [];
}

/**
 * Establishes the active UI language on startup: the persisted choice wins,
 * otherwise the browser language decides (ADR 0026). Also sets the document's
 * `lang` attribute via the store.
 * @returns {string} the resolved active language code
 */
export function initializeLanguage() {
  const language = detectLanguage({
    storedLanguage: readStoredLanguage(),
    browserLanguages: browserLanguages(),
  });
  setActiveLanguage(language);
  return language;
}

/**
 * Applies a manual language choice: switches the active language immediately
 * (no reload) and persists it so it survives a reload.
 * @param {string} language
 */
export function changeLanguage(language) {
  setActiveLanguage(language);
  writeStoredLanguage(language);
}
