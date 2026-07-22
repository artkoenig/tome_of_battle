import { SUPPORTED_LANGUAGES, FALLBACK_LANGUAGE } from './constants';

// Language tag prefix that maps to German. Everything else maps to the fallback
// language (CONTEXT.md "UI-Sprache": Deutsch -> Deutsch, sonst Englisch).
const GERMAN_PREFIX = 'de';
const GERMAN = 'de';

function normalizeToTags(browserLanguages) {
  if (Array.isArray(browserLanguages)) return browserLanguages;
  if (typeof browserLanguages === 'string') return [browserLanguages];
  return [];
}

/**
 * Determines the active UI language as a pure function of the persisted choice
 * and the browser's language preferences (ADR 0026).
 *
 * A previously stored, supported choice always wins. Otherwise the browser's
 * primary language decides: a German tag yields German, anything else the
 * fallback language (English).
 *
 * @param {{ storedLanguage?: string | null, browserLanguages?: string[] | string }} input
 * @returns {string} a code from {@link SUPPORTED_LANGUAGES}
 */
export function detectLanguage({ storedLanguage, browserLanguages } = {}) {
  if (SUPPORTED_LANGUAGES.includes(storedLanguage)) {
    return storedLanguage;
  }

  const [primaryTag] = normalizeToTags(browserLanguages);
  if (typeof primaryTag === 'string' && primaryTag.toLowerCase().startsWith(GERMAN_PREFIX)) {
    return GERMAN;
  }

  return FALLBACK_LANGUAGE;
}
