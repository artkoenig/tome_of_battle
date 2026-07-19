import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  WHFB6_LINKING_DEFAULT,
  getWhfb6LinkingEnabled as loadWhfb6LinkingEnabled,
  setWhfb6LinkingEnabled as persistWhfb6LinkingEnabled,
  getLocale as loadLocale,
  setLocale as persistLocale,
} from '../db/database';
import i18n from '../i18n';
import { DEFAULT_LOCALE } from '../i18n/localeConfig';
import { detectCurrentBrowserLocale } from '../i18n/detectBrowserLocale';

// App-wide settings store (see ADR-0023, revising ADR-0015's single-value
// stance). It holds every setting that needs reactive, app-wide access with
// IndexedDB persistence — currently the whfb6 linking flag and the UI locale.
// The context is null until a SettingsProvider mounts, which useSettings()
// treats as a programming error.
const SettingsContext = createContext(null);

/**
 * Provides the app settings reactively to any descendant. Each value is hydrated
 * once from IndexedDB on mount (falling back to a sensible default while the
 * async read is in flight) and written back whenever it changes.
 *
 * The locale hydration additionally drives i18next: a persisted choice is
 * applied verbatim (permanently overriding browser detection), while its
 * absence triggers a one-time browser-language detection whose result is
 * activated but deliberately NOT persisted — only an explicit user choice is
 * stored.
 */
export function SettingsProvider({ children }) {
  const [whfb6LinkingEnabled, setWhfb6LinkingEnabledState] = useState(WHFB6_LINKING_DEFAULT);
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    let isMounted = true;
    loadWhfb6LinkingEnabled()
      .then((storedValue) => {
        if (isMounted) setWhfb6LinkingEnabledState(storedValue);
      })
      .catch((error) => {
        console.error('Failed to load whfb6 linking setting:', error);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadLocale()
      .then((persistedLocale) => {
        const activeLocale = persistedLocale ?? detectCurrentBrowserLocale();
        if (!isMounted) return;
        setLocaleState(activeLocale);
        i18n.changeLanguage(activeLocale);
      })
      .catch((error) => {
        console.error('Failed to load locale setting:', error);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const setWhfb6LinkingEnabled = (value) => {
    setWhfb6LinkingEnabledState(value);
    persistWhfb6LinkingEnabled(value).catch((error) => {
      console.error('Failed to persist whfb6 linking setting:', error);
    });
  };

  const setLocale = (nextLocale) => {
    setLocaleState(nextLocale);
    i18n.changeLanguage(nextLocale);
    persistLocale(nextLocale).catch((error) => {
      console.error('Failed to persist locale setting:', error);
    });
  };

  return (
    <SettingsContext.Provider
      value={{ whfb6LinkingEnabled, locale, setWhfb6LinkingEnabled, setLocale }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Accesses the settings context. Throws when used outside a SettingsProvider so
 * a missing provider fails loudly instead of silently reading stale defaults.
 * @returns {{
 *   whfb6LinkingEnabled: boolean,
 *   locale: string,
 *   setWhfb6LinkingEnabled: (value: boolean) => void,
 *   setLocale: (locale: string) => void,
 * }}
 */
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === null) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
