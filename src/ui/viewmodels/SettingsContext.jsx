import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  WHFB6_LINKING_DEFAULT,
  loadWhfb6LinkingEnabled,
  saveWhfb6LinkingEnabled as persistWhfb6LinkingEnabled,
  DASHBOARD_FILTER_DEFAULT,
  loadDashboardFilter,
  saveDashboardFilter as persistDashboardFilter,
} from '../../contexts/armylist/application/settings';

/**
 * @typedef {{ systemIds: string[], factionIds: string[] }} DashboardFilter
 * @typedef {{
 *   whfb6LinkingEnabled: boolean,
 *   setWhfb6LinkingEnabled: (value: boolean) => void,
 *   dashboardFilter: DashboardFilter,
 *   setDashboardFilter: (value: DashboardFilter) => void,
 * }} SettingsValue
 */

// App-wide settings: the whfb6 linking flag (ADR-0015) and, since Issue 0203,
// the army list overview's filter — both persisted, both hydrated once on
// mount. The context is null until a SettingsProvider mounts, which
// useSettings() treats as a programming error.
// Ohne Provider ist der Wert `null`; der Typ muss trotzdem den Vertrag nennen,
// den `useSettings` erwartet — deshalb hier die Behauptung am Literal.
const SettingsContext = createContext(
  /** @type {SettingsValue|null} */ (null)
);

/**
 * Provides the whfb6 linking setting reactively to any descendant. The value is
 * hydrated once from IndexedDB on mount (falling back to the default while the
 * async read is in flight) and written back whenever it changes.
 */
export function SettingsProvider({ children }) {
  const [whfb6LinkingEnabled, setWhfb6LinkingEnabledState] = useState(WHFB6_LINKING_DEFAULT);
  const [dashboardFilter, setDashboardFilterState] = useState(DASHBOARD_FILTER_DEFAULT);

  useEffect(() => {
    let isMounted = true;
    loadDashboardFilter()
      .then((storedFilter) => {
        if (isMounted) setDashboardFilterState(storedFilter);
      })
      .catch((error) => {
        // Console-only by design: an unread filter falls back to "nothing
        // filtered", so the user sees every army list rather than none.
        console.error('Failed to load the dashboard filter:', error);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const setDashboardFilter = (value) => {
    setDashboardFilterState(value);
    persistDashboardFilter(value).catch((error) => {
      // Console-only by design: the filter applies immediately and only its
      // survival across a restart is lost.
      console.error('Failed to persist the dashboard filter:', error);
    });
  };

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
    <SettingsContext.Provider
      value={{ whfb6LinkingEnabled, setWhfb6LinkingEnabled, dashboardFilter, setDashboardFilter }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Accesses the settings context. Throws when used outside a SettingsProvider so
 * a missing provider fails loudly instead of silently reading stale defaults.
 * @returns {SettingsValue}
 */
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === null) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
