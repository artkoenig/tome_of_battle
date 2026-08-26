import {
  getGameForRoster,
  saveGame as persistGame,
  deleteGamesOfRoster,
  runGameStateMigration,
} from '../ports/storagePort';
import { createGame, isUnplayedGame, withoutOrphanedWounds } from '../model/game';

/**
 * Fassade ueber die Partie-Ablage (ADR-0037, Issue 0190).
 *
 * Vertrag:
 * - `loadGame(rosterId)` liefert die laufende Partie einer Liste, sonst eine
 *   frische, noch **nicht** gespeicherte. Der Aufrufer bekommt so immer eine
 *   Partie in der Hand und muss den Anfangsfall nicht kennen.
 * - `saveGame(game, roster)` schreibt sie und liefert den gespeicherten Stand.
 *   Verwaiste Wundeneintraege fallen dabei weg, eine Partie ohne Verlauf wird
 *   gar nicht erst angelegt.
 * - `endGame(rosterId)` verwirft sie. Es gibt je Liste hoechstens eine, und ein
 *   Loeschen der Liste laeuft ebenfalls hierueber.
 *
 * Kein `dataEvents`-Signal: der Kanal traegt Listen- und Systemstaende, an denen
 * die Roster-Liste haengt. Eine Wunde geht sie nichts an — genau darum liegt sie
 * jetzt woanders.
 */

/**
 * @param {string} rosterId
 * @returns {Promise<import('../model/game.js').Game>}
 */
export async function loadGame(rosterId) {
  const stored = await getGameForRoster(rosterId);
  return stored ?? createGame(rosterId);
}

/**
 * @param {import('../model/game.js').Game} game
 * @param {import('../../../shared/rostermodel/types.js').Roster|null} [roster] die Liste,
 *   gegen die verwaiste Wundeneintraege geprueft werden.
 * @returns {Promise<import('../model/game.js').Game>} der gespeicherte Stand.
 */
export async function saveGame(game, roster = null) {
  const pruned = withoutOrphanedWounds(game, roster);
  // Eine Partie ohne jeden Verlauf ist keine: sie wuerde nur einen Datensatz je
  // Liste erzeugen, den niemand liest. Ein bereits gespeicherter Stand, der auf
  // den Anfang zurueckgesetzt wird, verschwindet damit ebenfalls.
  if (isUnplayedGame(pruned)) {
    await deleteGamesOfRoster(pruned.rosterId);
    return pruned;
  }
  await persistGame(pruned);
  return pruned;
}

/**
 * @param {string} rosterId
 * @returns {Promise<void>}
 */
export function endGame(rosterId) {
  return deleteGamesOfRoster(rosterId);
}

/**
 * Der Startlauf-Anteil dieses Kontexts: der alte `gameState` der gespeicherten
 * Roster wandert in den `games`-Store. Die Oberflaeche erreicht die Persistenz
 * nur ueber eine `application`-Schicht, deshalb geht auch die Migration hier
 * durch.
 *
 * @returns {Promise<{ movedGames: number, cleanedRosters: number }>}
 */
export function migrateStoredGames() {
  return runGameStateMigration();
}
