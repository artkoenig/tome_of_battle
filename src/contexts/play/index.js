/**
 * Die **eine** Tuer des Kontexts `play` (Issue 0190, AC7).
 *
 * Die Oberflaeche spricht die laufende Partie ausschliesslich hierueber an; die
 * Module darunter (`model/`, `application/`, `ports/`) sind kontextintern. Kein
 * anderer Kontext importiert diesen, und dieser keinen anderen — die Kopplung
 * an die Liste ist die `rosterId`, nicht ein Import
 * (`kontext-kein-fremder-kontext`, Regel N1).
 *
 * Nur Re-Exporte und das Scharfstellen der eigenen Regeln, keine Logik.
 *
 * Das Beenden einer Partie steht hier bewusst **nicht** mehr: das Beenden beim
 * Loeschen der Liste ist eine Regel dieses Kontexts und haengt seit Issue 0193 am
 * Aenderungskanal (`application/rosterDeletionPolicy.js`), nicht an einem Hook der
 * Oberflaeche. Der Import unten meldet sie an.
 */
import './application/rosterDeletionPolicy';

export { loadGame, saveGame, migrateStoredGames } from './application/gameStore';
export {
  createGame as createGameFor,
  currentWoundsOf,
  withAdjustedWound,
  withAdjustedTracker,
} from './model/game';
