// Central definition of the locales the UI chrome supports (see ADR-0022).
// German is the full source language; English is the global fallback used both
// for unsupported browser languages and for individual missing keys.
export const GERMAN_LOCALE = 'de';
export const ENGLISH_LOCALE = 'en';

// The ordered list of locales the app can display. Anything outside this list
// resolves to the fallback.
export const SUPPORTED_LOCALES = [GERMAN_LOCALE, ENGLISH_LOCALE];

// Initial language of the i18next instance before any browser detection or
// persisted preference is applied. Kept as the source language so the UI has a
// deterministic, fully-translated starting point.
export const DEFAULT_LOCALE = GERMAN_LOCALE;

// Global fallback language: used when the active locale lacks a key and when the
// browser language is not one of the SUPPORTED_LOCALES.
export const FALLBACK_LOCALE = ENGLISH_LOCALE;
