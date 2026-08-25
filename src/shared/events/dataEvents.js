/**
 * Der eine Änderungs-Kanal der Datenschicht (ADR-0037).
 *
 * IndexedDB meldet von sich aus keine Änderung — es gibt nur
 * `onversionchange`/`onclose` an der Verbindung. Solange jede Ansicht direkt
 * schrieb, konnte eine zweite Ansicht ihren Stand nur durch einen
 * Navigationswechsel (`reloadData`) erfahren. Mit der Fassade gibt es genau
 * eine Stelle, an der ein Schreibvorgang abschließt, und deshalb genau einen
 * Ort für die Benachrichtigung: dieses Modul.
 *
 * Vertrag:
 * - Jeder **schreibende** Aufruf von `src/domain/services/` meldet seinen Abschluss
 *   hier, und zwar erst nachdem die Persistenz zugesagt hat. Ein Fehlschlag
 *   meldet nichts.
 * - Ein Verbraucher abonniert mit `subscribeToDataChanges` und bekommt die
 *   Abmeldefunktion zurück.
 * - Die Zustellung ist synchron und in Abonnier-Reihenfolge. Ein werfender
 *   Verbraucher darf weder den Schreibvorgang noch die übrigen Verbraucher
 *   umbringen: sein Fehler wird protokolliert und übersprungen.
 *
 * Ausdrücklich **nicht** hier: die Benachrichtigung über Browser-Tabs hinweg
 * (`BroadcastChannel`) — eigener Vorgang.
 */

/**
 * Die Ereignisarten. Ein Ereignis nennt immer, was fertig geschrieben wurde;
 * ein Verbraucher soll daraus seinen Stand nachziehen können, ohne erneut zu
 * lesen.
 */
export const DATA_EVENT = Object.freeze({
  ROSTER_SAVED: 'roster-saved',
  ROSTER_DELETED: 'roster-deleted',
  SYSTEM_IMPORTED: 'system-imported',
  SYSTEM_DELETED: 'system-deleted',
  SETTINGS_CHANGED: 'settings-changed',
});

/**
 * Ein Ereignis nennt seine Art und den fertig geschriebenen Gegenstand.
 *
 * @typedef {{ type: 'roster-saved', roster: import('../rostermodel/types.js').Roster }
 *   | { type: 'roster-deleted', rosterId: string }
 *   | { type: 'system-imported', system: object }
 *   | { type: 'system-deleted', systemId: string }
 *   | { type: 'settings-changed', whfb6LinkingEnabled: boolean }} DataChangeEvent
 */

/** @type {Set<(event: DataChangeEvent) => void>} */
const listeners = new Set();

/**
 * Meldet einen abgeschlossenen Schreibvorgang an alle Abonnenten.
 * Nur `src/domain/services/` ruft das auf.
 *
 * @param {DataChangeEvent} event
 */
export function emitDataChange(event) {
  // Über eine Kopie laufen: ein Verbraucher, der sich in seiner Reaktion
  // abmeldet (oder einen weiteren anmeldet), verändert sonst die Menge
  // während der Iteration.
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (error) {
      // Ein kaputter Verbraucher darf den Schreibvorgang nicht mitnehmen —
      // gespeichert ist zu diesem Zeitpunkt bereits.
      console.error('Data change listener failed:', error);
    }
  }
}

/**
 * Abonniert alle Änderungen der Datenschicht.
 *
 * @param {(event: DataChangeEvent) => void} listener
 * @returns {() => void} Abmeldefunktion; mehrfacher Aufruf ist harmlos.
 */
export function subscribeToDataChanges(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
