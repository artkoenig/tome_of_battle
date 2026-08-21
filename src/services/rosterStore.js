import { getAllRosters, getRoster, saveRoster as persistRoster, deleteRoster as removeRoster } from '../db/database';
import { DATA_EVENT, emitDataChange } from './dataEvents';

/**
 * Fassade über die Roster-Ablage (ADR-0037).
 *
 * Vertrag:
 * - `loadRosters()` liefert alle gespeicherten Roster.
 * - `loadRoster(id)` liefert eines oder `undefined`.
 * - `saveRoster(roster)` legt an oder überschreibt und liefert das
 *   gespeicherte Roster zurück, damit ein Aufrufer denselben Stand
 *   weiterreichen kann, den die Abonnenten sehen.
 * - `deleteRoster(id)` entfernt eines.
 * - Beide Schreibwege melden ihren Abschluss über `dataEvents` — **nach** der
 *   Zusage der Ablage. Scheitert das Schreiben, wird nichts gemeldet und der
 *   Fehler durchgereicht.
 *
 * Die Oberfläche erreicht Roster ausschließlich hierüber; `src/db/database.js`
 * ist von dort aus tabu.
 */

/**
 * @returns {Promise<import('../types.js').Roster[]>}
 */
export function loadRosters() {
  return getAllRosters();
}

/**
 * @param {string} id
 * @returns {Promise<import('../types.js').Roster|undefined>}
 */
export function loadRoster(id) {
  return getRoster(id);
}

/**
 * @param {import('../types.js').Roster} roster
 * @returns {Promise<import('../types.js').Roster>} das gespeicherte Roster.
 */
export async function saveRoster(roster) {
  await persistRoster(roster);
  emitDataChange({ type: DATA_EVENT.ROSTER_SAVED, roster });
  return roster;
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteRoster(id) {
  await removeRoster(id);
  emitDataChange({ type: DATA_EVENT.ROSTER_DELETED, rosterId: id });
}
