/**
 * Die **eine** Tuer des Kontexts `play` (Issue 0190, AC7).
 *
 * Die Oberflaeche spricht die laufende Partie ausschliesslich hierueber an; die
 * Module darunter (`model/`, `application/`, `ports/`) sind kontextintern. Kein
 * anderer Kontext importiert diesen, und dieser keinen anderen — die Kopplung
 * an die Liste ist die `rosterId`, nicht ein Import
 * (`kontext-kein-fremder-kontext`, Regel N1).
 *
 * Nur Re-Exporte, keine Logik.
 */
export { loadGame, saveGame, endGame, migrateStoredGames } from './application/gameStore';
export {
  createGame as createGameFor,
  currentWoundsOf,
  withAdjustedWound,
  withAdjustedTracker,
} from './model/game';
