import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  WHFB6_LINKING_DEFAULT,
  getWhfb6LinkingEnabled as loadWhfb6LinkingEnabled,
  setWhfb6LinkingEnabled as persistWhfb6LinkingEnabled,
} from '../db/database';

// App-wide settings, deliberately scoped to the single whfb6 linking flag (see
// ADR-0015). The context is null until a SettingsProvider mounts, which
// useSettings() treats as a programming error.
const SettingsContext = createContext(null);

/**
 * Provides the whfb6 linking setting reactively to any descendant. The value is
 * hydrated once from IndexedDB on mount (falling back to the default while the
 * async read is in flight) and written back whenever it changes.
 */
export function SettingsProvider({ children }) {
  const [whfb6LinkingEnabled, setWhfb6LinkingEnabledState] = useState(WHFB6_LINKING_DEFAULT);

  useEffect(() => {
    let isMounted = true;
    loadWhfb6LinkingEnabled()
      .then((storedValue) => {
        if (isMounted) setWhfb6LinkingEnabledState(storedValue);
      })
      .catch((error) => {
        // Console-only by design: the setting falls back to its documented default
        // (ADR-0015) and the app stays fully usable — only the rule links are missing,
        // which the user sees in the settings dialog itself.
        console.error('Failed to load whfb6 linking setting:', error);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const setWhfb6LinkingEnabled = (value) => {
    setWhfb6LinkingEnabledState(value);
    persistWhfb6LinkingEnabled(value).catch((error) => {
      // Console-only by design: the toggle applies immediately for this session and only
      // its persistence across restarts is lost — no data of the user's is at risk.
      console.error('Failed to persist whfb6 linking setting:', error);
    });
  };

  return (
    <SettingsContext.Provider value={{ whfb6LinkingEnabled, setWhfb6LinkingEnabled }}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Accesses the settings context. Throws when used outside a SettingsProvider so
 * a missing provider fails loudly instead of silently reading stale defaults.
 * @returns {{ whfb6LinkingEnabled: boolean, setWhfb6LinkingEnabled: (value: boolean) => void }}
 */
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === null) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
