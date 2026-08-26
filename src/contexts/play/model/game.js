/**
 * Das Aggregat des Kontexts `play` (Issue 0190, PRD
 * `docs/PRD-play-mode-eigener-kontext.md`).
 *
 * Eine Partie ist ein eigener Gegenstand mit eigener Lebensdauer: sie beginnt,
 * wenn der Spieler sie beginnt, und ist vorbei, wenn er sie beendet. Sie
 * verweist ueber `rosterId` auf die Liste — das ist die **einzige** Kopplung
 * zwischen den beiden Kontexten, ein Import waere eine zweite.
 *
 * Alles hier ist rein: eine Partie geht als Wert hinein und als neuer Wert
 * heraus. Wer schreibt, ist `application/gameStore.js`.
 */

import '../../../shared/rostermodel/types.js';

/**
 * @typedef {Object} Game
 * @property {string} id        Schluessel des Datensatzes.
 * @property {string} rosterId  Referenz auf die Liste.
 * @property {number} round     Aktuelle Spielrunde.
 * @property {number} vp        Siegpunkte.
 * @property {number} cp        Kommandopunkte.
 * @property {Object<string, number|number[]>} wounds  Verbleibende Wunden je
 *   Auswahl-Id — eine Zahl, oder ein Wert je Modell.
 */

/** Runde, in der eine frisch begonnene Partie steht. */
const FIRST_GAME_ROUND = 1;

/**
 * Eine frische Partie zu einer Liste: erste Runde, keine Punkte, keine Wunden.
 *
 * Bewusst eine Fabrik statt einer geteilten Konstanten — `wounds` ist
 * veraenderlicher Spielzustand, den jede Partie als eigene Instanz braucht.
 *
 * @param {string} rosterId
 * @returns {Game}
 */
export function createGame(rosterId) {
  return {
    id: crypto.randomUUID(),
    rosterId,
    round: FIRST_GAME_ROUND,
    vp: 0,
    cp: 0,
    wounds: {},
  };
}

/**
 * Ob eine Partie noch keinen Verlauf hat. Ein solcher Zustand ist keine Partie,
 * sondern das Fehlen einer — er wird nicht gespeichert und beim Umzug aus dem
 * alten `gameState` nicht uebernommen (`runGameStateMigration`).
 *
 * @param {Game} game
 * @returns {boolean}
 */
export function isUnplayedGame(game) {
  return (
    game.round === FIRST_GAME_ROUND &&
    game.vp === 0 &&
    game.cp === 0 &&
    Object.keys(game.wounds).length === 0
  );
}

/**
 * Die verbleibenden Wunden einer Auswahl. Ohne Eintrag gilt sie als unverwundet
 * — dasselbe Verhalten wie fuer jede Auswahl, die erst nach dem Anpfiff zur
 * Liste kam.
 *
 * @param {Game} game
 * @param {string} selectionId
 * @param {number} totalMaxWounds
 * @returns {number}
 */
export function currentWoundsOf(game, selectionId, totalMaxWounds) {
  const value = game.wounds[selectionId];
  if (value === undefined) return totalMaxWounds;
  if (Array.isArray(value)) return value.reduce((sum, wounds) => sum + wounds, 0);
  return value;
}

/**
 * Eine genommene (oder geheilte) Wunde. Der Wert bleibt zwischen 0 und dem
 * Maximum der Auswahl.
 *
 * @param {Game} game
 * @param {string} selectionId
 * @param {number} delta
 * @param {number} totalMaxWounds
 * @returns {Game}
 */
export function withAdjustedWound(game, selectionId, delta, totalMaxWounds) {
  const current = currentWoundsOf(game, selectionId, totalMaxWounds);
  const next = Math.max(0, Math.min(totalMaxWounds, current + delta));
  return { ...game, wounds: { ...game.wounds, [selectionId]: next } };
}

/**
 * Runde, VP oder CP um `delta` verschieben, nie unter null. Diese Zaehler sind
 * listenunabhaengig — eine Listenaenderung ruehrt sie nicht an.
 *
 * @param {Game} game
 * @param {'round'|'vp'|'cp'} field
 * @param {number} delta
 * @returns {Game}
 */
export function withAdjustedTracker(game, field, delta) {
  return { ...game, [field]: Math.max(0, game[field] + delta) };
}

/**
 * Jede Auswahl-Id einer Liste, Unter-Auswahlen eingeschlossen.
 *
 * Der Kontext `play` liest hier die **geteilte** Roster-Form
 * (`src/shared/rostermodel/types.js`), nicht das Schreibmodell der Liste: ein
 * Import von `contexts/armylist/` waere eine Kontextgrenze.
 *
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @returns {Set<string>}
 */
export function selectionIdsOf(roster) {
  /** @type {Set<string>} */
  const ids = new Set();
  const collect = (selections) => {
    for (const selection of selections ?? []) {
      if (selection?.id) ids.add(selection.id);
      collect(selection?.selections);
    }
  };
  for (const force of roster?.forces ?? []) collect(force?.selections);
  return ids;
}

/**
 * Die Partie ohne Wundeneintraege verwaister Auswahlen (Produktentscheidung 1
 * des PRD: Liste und Partie koexistieren).
 *
 * Verschwindet eine Auswahl aus der Liste, wird ihr Eintrag beim Lesen ohnehin
 * nie gefragt; beim naechsten **Schreiben** der Partie faellt er weg. Kein
 * Eintrag einer noch vorhandenen Auswahl geht dabei verloren, und Runde, VP und
 * CP bleiben in jedem Fall stehen.
 *
 * Ohne Liste (kein Bezug zur Hand) bleibt die Partie unveraendert — lieber ein
 * verwaister Eintrag als eine geloeschte Wunde.
 *
 * @param {Game} game
 * @param {import('../../../shared/rostermodel/types.js').Roster|null} roster
 * @returns {Game}
 */
export function withoutOrphanedWounds(game, roster) {
  if (!roster) return game;
  const known = selectionIdsOf(roster);
  const entries = Object.entries(game.wounds).filter(([selectionId]) => known.has(selectionId));
  if (entries.length === Object.keys(game.wounds).length) return game;
  return { ...game, wounds: Object.fromEntries(entries) };
}
