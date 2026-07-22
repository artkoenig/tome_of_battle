// Language codes the UI ships translations for. English is the fallback
// language (ADR 0026): a missing key in any other language resolves to its
// English text, and new languages are added purely as JSON files against the
// English key set.
export const SUPPORTED_LANGUAGES = ['de', 'en'];

// Fallback language (ADR 0026, CONTEXT.md "Fallback-Sprache"). Also the default
// active language before detection runs.
export const FALLBACK_LANGUAGE = 'en';

// localStorage key under which the manual UI-language choice is persisted. The
// choice is stored per surface (CONTEXT.md "UI-Sprache"); this key belongs to
// the app surface, separate from any language choice the landing page keeps.
export const LANGUAGE_STORAGE_KEY = 'tome-of-battle.ui-language';

// Endonyms shown in the language switcher. A language is always offered under
// its own name, so these labels are intentionally not themselves translated.
export const LANGUAGE_LABELS = Object.freeze({
  de: 'Deutsch',
  en: 'English',
});
