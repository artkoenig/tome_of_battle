/**
 * Speicher-Port des Kontexts `armylist`.
 *
 * Die einzige Stelle unter `src/contexts/armylist/`, die `src/platform/` kennen darf
 * (Regel `kontext-nicht-auf-plattform`). Die Anwendungsschicht spricht ausschließlich
 * über diesen Port mit der IndexedDB — sie importiert nie `platform/persistence/*`
 * direkt. Reine Weiterleitung: hier steht keine Logik, nur die Liste dessen, was der
 * Kontext von der Persistenz braucht.
 */
export {
  getAllRosters,
  getRoster,
  saveRoster,
  deleteRoster,
  WHFB6_LINKING_DEFAULT,
  getWhfb6LinkingEnabled,
  setWhfb6LinkingEnabled,
} from '../../../platform/persistence/database';
