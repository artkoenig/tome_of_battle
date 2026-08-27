import { useCallback, useMemo, useState } from 'react';
import { useSettings } from './SettingsContext';
import {
  EMPTY_ROSTER_FILTER,
  filterChipsOf,
  filterOptionsOf,
  filterValueCount,
  toggleFilterValue,
  withoutFilterValue,
} from './rosterFilter';

/**
 * ViewModel des Übersichts-Filters (Issue 0203).
 *
 * Der Filter gehört weder der Übersicht noch der Kopfzeile allein: auf dem
 * Schreibtisch steht er in der Werkzeugleiste der Übersicht, unterhalb der
 * mobilen Schwelle in der App-Kopfzeile neben den Einstellungen. Deshalb liegt
 * er eine Ebene über beiden — `App` ruft diesen Haken einmal und reicht das
 * Bündel weiter. Die Auswahl selbst liegt in `SettingsContext`, weil sie einen
 * Neustart überlebt.
 */

/** @type {object[]} */
const NO_ROSTERS = [];

/** @type {object[]} */
const NO_SYSTEMS = [];

/**
 * @param {{ rosters?: object[], systems?: object[] }} args
 */
export function useRosterFilter({ rosters = NO_ROSTERS, systems = NO_SYSTEMS } = {}) {
  const { dashboardFilter, setDashboardFilter } = useSettings();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const options = useMemo(() => filterOptionsOf(rosters, systems), [rosters, systems]);
  const chips = useMemo(() => filterChipsOf(dashboardFilter, options), [dashboardFilter, options]);

  const toggleValue = useCallback(
    (category, id) => setDashboardFilter(toggleFilterValue(dashboardFilter, category, id)),
    [dashboardFilter, setDashboardFilter]
  );

  const removeValue = useCallback(
    (category, id) => setDashboardFilter(withoutFilterValue(dashboardFilter, category, id)),
    [dashboardFilter, setDashboardFilter]
  );

  const clearAll = useCallback(
    () => setDashboardFilter(EMPTY_ROSTER_FILTER),
    [setDashboardFilter]
  );

  return {
    selection: dashboardFilter,
    options,
    chips,
    selectedCount: filterValueCount(dashboardFilter),
    toggleValue,
    removeValue,
    clearAll,
    isSheetOpen,
    openSheet: useCallback(() => setIsSheetOpen(true), []),
    closeSheet: useCallback(() => setIsSheetOpen(false), []),
  };
}
