import {
  WHFB6_LINKING_DEFAULT,
  getWhfb6LinkingEnabled,
  setWhfb6LinkingEnabled as persistWhfb6LinkingEnabled,
} from '../../data/db/database';
import { DATA_EVENT, emitDataChange } from '../../shared/events/dataEvents';

/**
 * Fassade über die App-Einstellungen (ADR-0037).
 *
 * Bewusst auf die eine whfb6-Verknüpfungs-Option beschränkt (ADR-0015): mehr
 * Einstellungen gibt es nicht, und eine generische Schlüssel/Wert-Fassade
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
