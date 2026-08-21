/**
 * Vorgabewerte eines neuen bzw. unvollständig deklarierten Rosters.
 *
 * Bewusst eine eigene, winzige Quelle: das Punktelimit wird an drei
 * unabhängigen Stellen gebraucht (Anlege-Dialog, Import, Export) und lag zuvor
 * mehrfach als eigene Konstante bzw. als nacktes Literal vor.
 */

/** Punktelimit, wenn weder Nutzer noch Roster-Datei eines vorgeben. */
export const DEFAULT_ROSTER_COST_LIMIT = 2000;

/** Runde, in der eine frisch begonnene Partie steht. */
const FIRST_GAME_ROUND = 1;

/**
 * Spielstand einer noch nicht begonnenen Partie: erste Runde, keine Sieges- und
 * Kommandopunkte, keine erlittenen Wunden. `wounds` bildet eine Selection-Id auf
 * ihre aktuellen Wunden ab — je nach Einheit eine Zahl oder ein Wert je Modell.
 *
 * Bewusst eine Fabrikfunktion statt einer geteilten Konstanten: `wounds` ist
 * veränderlicher Spielzustand, den jede Partie als eigene Instanz braucht.
 *
 * @returns {Object} frischer Spielstand
 */
export function createInitialGameState() {
  return {
    round: FIRST_GAME_ROUND,
    vp: 0,
    cp: 0,
    wounds: {}
  };
}
