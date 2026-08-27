import {
  WHFB6_LINKING_DEFAULT,
  getWhfb6LinkingEnabled,
  setWhfb6LinkingEnabled as persistWhfb6LinkingEnabled,
  DASHBOARD_FILTER_DEFAULT,
  getDashboardFilter,
  setDashboardFilter as persistDashboardFilter,
} from '../ports/storagePort';
import { DATA_EVENT, emitDataChange } from '../../../shared/events/dataEvents';

/**
 * Fassade über die App-Einstellungen (ADR-0037).
 *
 * Bewusst benannt statt generisch: jede Einstellung hat hier ihr eigenes Paar
 * aus Lesen und Schreiben (ADR-0015) — die whfb6-Verknüpfung und seit Issue
 * 0203 der Filter der Listen-Übersicht. Eine generische Schlüssel/Wert-Fassade
 * würde nur Vorrat bauen.
 *
 * Vertrag:
 * - `WHFB6_LINKING_DEFAULT` ist der Wert, der gilt, solange noch nichts
 *   gelesen wurde.
 * - `loadWhfb6LinkingEnabled()` liest den gespeicherten Wert.
 * - `saveWhfb6LinkingEnabled(value)` schreibt ihn und meldet den Abschluss
 *   über `dataEvents`. Der Fehler eines fehlgeschlagenen Schreibens wird
 *   durchgereicht und nichts gemeldet.
 */

export { WHFB6_LINKING_DEFAULT };

/**
 * @returns {Promise<boolean>}
 */
export function loadWhfb6LinkingEnabled() {
  return getWhfb6LinkingEnabled();
}

/**
 * @param {boolean} value
 * @returns {Promise<boolean>} der geschriebene Wert.
 */
export async function saveWhfb6LinkingEnabled(value) {
  await persistWhfb6LinkingEnabled(value);
  emitDataChange({ type: DATA_EVENT.SETTINGS_CHANGED, whfb6LinkingEnabled: value });
  return value;
}

export { DASHBOARD_FILTER_DEFAULT };

/**
 * Liest den gespeicherten Filter der Listen-Übersicht (Issue 0203).
 *
 * @returns {Promise<{ systemIds: string[], factionIds: string[] }>}
 */
export function loadDashboardFilter() {
  return getDashboardFilter();
}

/**
 * Schreibt den Filter der Listen-Übersicht.
 *
 * Bewusst **ohne** `emitDataChange`: der Filter ist eine reine Anzeige-Wahl,
 * und ein Meldung je Häkchen würde die Listen der App bei jedem Klick neu
 * lesen lassen. Er wird beim Start gelesen, sonst nie.
 *
 * @param {{ systemIds: string[], factionIds: string[] }} filter
 * @returns {Promise<{ systemIds: string[], factionIds: string[] }>} der geschriebene Filter.
 */
export async function saveDashboardFilter(filter) {
  await persistDashboardFilter(filter);
  return filter;
}
