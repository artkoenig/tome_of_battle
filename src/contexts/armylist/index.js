/**
 * Die veröffentlichte Sprache des Kontexts `armylist` — die eine Adresse, unter
 * der ihn ein Bildschirm anspricht (Gegenstück zu `contexts/play/index.js`).
 *
 * Warum es ihn gibt (Issue 0193, AC3): `useRosterList` hatte sieben Importe in
 * drei Kontexte hinein. Ein Bildschirm, der die inneren Wege eines Kontexts
 * einzeln kennt, hält jede Umlagerung darin fest. Hier steht deshalb, was von
 * außen gebraucht wird — Namen ergänzt man in dieser Datei, statt tiefer zu
 * greifen.
 *
 * Was hier **nicht** hineingehört: ein Name eines fremden Kontexts. Der Barrel
 * veröffentlicht `armylist`, er reicht das Lesemodell nicht durch — wer einen
 * Bericht braucht, ruft einen Anwendungsfall, der ihn selbst holt
 * (`applyMandatoryListRulesToFreshRoster`, `buildRosterExportFile`).
 */

export { saveRoster, deleteRoster } from './application/rosterStore.js';
export { readRosterText } from './application/rosterTransfer.js';
export { buildRosterExportFile } from './application/rosterExport.js';
export { applyMandatoryListRulesToFreshRoster } from './application/mandatoryListRules.js';
export { importRosterFromXml, MissingSystemError } from './model/rosterSerialization.js';
export { buildRoster } from './model/createRoster.js';
// Über den Modell-Barrel, nicht an ihm vorbei: `model/index.js` ist die
// veröffentlichte Fläche des Schreibmodells (und die Adresse, die ein Test
// ersetzt).
export {
  reconcileImportedSelectionIds,
  syncRosterSelectionsWithSystem,
} from './model/index.js';
