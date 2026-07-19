import { SUPPORTED_LOCALES, FALLBACK_LOCALE } from './localeConfig';

// Reduces a BCP-47 language tag (e.g. "de-DE", "en-GB") to its primary
// subtag in lower case ("de", "en").
function primarySubtag(languageTag) {
  return String(languageTag).toLowerCase().split('-')[0];
}

/**
 * Picks the UI locale for a first-time visitor from their browser language
 * preferences. The first preference whose primary subtag is a supported locale
 * wins; if none match (e.g. French), the global fallback (English) applies —
 * never the German source language (see ADR-0022).
 *
 * @param {string[]} preferredLanguages Ordered language tags, most preferred
 *   first (as provided by `navigator.languages`).
 * @returns {string} A locale from {@link SUPPORTED_LOCALES}.
 */
export function detectBrowserLocale(preferredLanguages) {
  const languages = Array.isArray(preferredLanguages) ? preferredLanguages : [];

  for (const languageTag of languages) {
    const candidate = primarySubtag(languageTag);
    if (SUPPORTED_LOCALES.includes(candidate)) {
      return candidate;
    }
  }

  return FALLBACK_LOCALE;
}

/**
 * Convenience wrapper that reads the current browser's language preferences.
 * `navigator.languages` is preferred (ordered list); `navigator.language` is a
 * single-value fallback for older environments.
 *
 * @returns {string} A locale from {@link SUPPORTED_LOCALES}.
 */
export function detectCurrentBrowserLocale() {
  const languages =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language].filter(Boolean);
  return detectBrowserLocale(languages);
}
