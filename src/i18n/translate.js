import { FALLBACK_LANGUAGE } from './constants';

// Matches a single `{name}` placeholder and captures its identifier. Placeholder
// names are word characters only, so surrounding punctuation stays untouched.
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

// Parameter carrying the amount a plural key selects its variant by.
const COUNT_PARAM = 'count';

// Suffix of the catch-all plural variant. `Intl.PluralRules` guarantees every
// language uses the "other" category, so `<key>_other` is both the marker that a
// key is pluralized and the safe fallback when no more specific variant exists.
const PLURAL_OTHER_SUFFIX = '_other';

/**
 * Resolves a key's template string, preferring the active language and falling
 * back to English (ADR 0026). Returns `undefined` when the key exists in
 * neither, so callers can distinguish a real translation from a missing one.
 * @param {Record<string, Record<string, string>>} catalogs language code -> flat key/value map
 * @param {string} language active UI language code
 * @param {string} key
 * @returns {string | undefined}
 */
function resolveTemplate(catalogs, language, key) {
  const activeTemplate = catalogs[language]?.[key];
  if (typeof activeTemplate === 'string') return activeTemplate;

  const fallbackTemplate = catalogs[FALLBACK_LANGUAGE]?.[key];
  if (typeof fallbackTemplate === 'string') return fallbackTemplate;

  return undefined;
}

function hasTemplate(catalogs, language, key) {
  return resolveTemplate(catalogs, language, key) !== undefined;
}

/**
 * Picks the concrete catalog key to render. Plain keys are used verbatim; a key
 * that has a `<key>_other` variant is pluralized via `Intl.PluralRules` against
 * the `count` parameter, falling back to the "other" variant when a more
 * specific one is absent or no count was supplied.
 */
function selectMessageKey(catalogs, language, key, params) {
  const isPluralKey = hasTemplate(catalogs, language, `${key}${PLURAL_OTHER_SUFFIX}`);
  if (!isPluralKey) return key;

  const count = params[COUNT_PARAM];
  if (typeof count !== 'number') return `${key}${PLURAL_OTHER_SUFFIX}`;

  const category = new Intl.PluralRules(language).select(count);
  const variantKey = `${key}_${category}`;
  return hasTemplate(catalogs, language, variantKey)
    ? variantKey
    : `${key}${PLURAL_OTHER_SUFFIX}`;
}

/**
 * Renders a single parameter value. Numbers are formatted for the active
 * language via `Intl.NumberFormat` (ADR 0026); everything else is stringified.
 */
function formatValue(value, language) {
  if (typeof value === 'number') {
    return new Intl.NumberFormat(language).format(value);
  }
  return String(value);
}

function fillPlaceholders(template, params, language) {
  return template.replace(PLACEHOLDER_PATTERN, (placeholder, name) => {
    if (!(name in params)) return placeholder;
    return formatValue(params[name], language);
  });
}

/**
 * Translates a message key against the given catalogs. Pure and free of any
 * ambient language state, so it is fully unit-testable with injected catalogs.
 *
 * - Substitutes `{name}` placeholders from `params` (numbers get localized).
 * - Selects the numerus-correct plural variant for a pluralized key.
 * - Falls back to English for a key missing in the active language, and returns
 *   the key itself when it is absent everywhere, so gaps stay visible.
 *
 * @param {Record<string, Record<string, string>>} catalogs language code -> flat key/value map
 * @param {string} language active UI language code
 * @param {string} key
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function translateMessage(catalogs, language, key, params = {}) {
  const resolvedKey = selectMessageKey(catalogs, language, key, params);
  const template = resolveTemplate(catalogs, language, resolvedKey);
  if (template === undefined) return key;
  return fillPlaceholders(template, params, language);
}
