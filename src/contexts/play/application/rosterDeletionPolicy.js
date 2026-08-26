import { DATA_EVENT, subscribeToDataChanges } from '../../../shared/events/dataEvents';
import { endGame } from './gameStore';

/**
 * Die Regel "mit der Liste geht ihre laufende Partie" (Produktentscheidung 2 des
 * PRD `docs/PRD-play-mode-eigener-kontext.md`).
 *
 * Sie stand bisher in `useRosterList.confirmRosterDeletion` — ein Fachsatz in
 * einer Ansicht, und die einzige Stelle, an der er existierte. Der veroeffentlichte
 * Kanal dafuer gibt es laengst: `armylist` meldet `roster-deleted` in
 * `src/shared/events/dataEvents.js`, sobald die Persistenz zugesagt hat. Dieser
 * Kontext hoert dort zu; die Kopplung an die Liste bleibt die `rosterId`, kein
 * Import (Regel N1).
 *
 * Zwei mechanische Punkte entscheiden die Form:
 * - `emitDataChange` stellt **synchron** zu und wartet auf keinen Verbraucher,
 *   `endGame` ist `async`. Der Abonnent ist also bewusst "feuern und vergessen";
 *   die Reihenfolge-Zusage des frueheren `await endGame(id)` faellt weg (niemand
 *   liest auf diesem Pfad den `games`-Store).
 * - Das `try/catch` des Kanals faengt nur einen **synchronen** Wurf. Ein
 *   zurueckgegebenes abgelehntes Promise entkaeme als unbehandelte Ablehnung,
 *   deshalb haengt hier ein eigenes `.catch` — und deshalb wird `endGame(...)`
 *   nicht zurueckgegeben.
 *
 * `endGame` ist idempotent: eine nie gespielte Liste hat keinen Datensatz, der
 * Lauf ueber die Treffer ist dann leer — kein Schreibvorgang, kein Fehler.
 */

/**
 * @param {import('../../../shared/events/dataEvents.js').DataChangeEvent} event
 * @returns {void}
 */
export function handleDataChange(event) {
  if (event.type !== DATA_EVENT.ROSTER_DELETED) return;
  endGame(event.rosterId).catch((error) => {
    // Eine verwaiste Partie ist kein Grund, den Loeschvorgang der Liste
    // scheitern zu lassen — die Liste ist zu diesem Zeitpunkt bereits weg.
    console.error('Ending the game of a deleted roster failed:', error);
  });
}

/** @type {(() => void)|null} */
let unsubscribe = null;

/**
 * Meldet die Regel am Aenderungskanal an. Mehrfacher Aufruf ist harmlos: es
 * bleibt bei genau einem Abonnenten.
 *
 * @returns {() => void} Abmeldefunktion (fuer Tests).
 */
export function armRosterDeletionPolicy() {
  if (!unsubscribe) {
    const stop = subscribeToDataChanges(handleDataChange);
    unsubscribe = () => { stop(); unsubscribe = null; };
  }
  return unsubscribe;
}

// Der Kontext ist scharf, sobald seine Tuer importiert ist (`index.js`), und das
// geschieht beim Start ueber `useAppData` — vor jedem moeglichen Loeschen.
armRosterDeletionPolicy();
