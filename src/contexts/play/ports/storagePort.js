/**
 * Speicher-Port des Kontexts `play`.
 *
 * Die einzige Stelle unter `src/contexts/play/`, die `src/platform/` kennen darf
 * (Regel `kontext-nicht-auf-plattform`). Reine Weiterleitung: hier steht keine
 * Logik, nur die Liste dessen, was der Kontext von der Persistenz braucht.
 */
export { getGameForRoster, saveGame, deleteGamesOfRoster } from '../../../platform/persistence/database';
export { runGameStateMigration } from '../../../platform/persistence/migrations';
