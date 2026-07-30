/**
 * Die Änderungsoperationen auf den Unter-Auswahlen einer Einheit — als benannte,
 * reine Funktionen über der Kindliste einer Einheit.
 *
 * Jede Operation hat eine eindeutige Signatur: Wer eine Instanz entfernt,
 * übergibt eine Selection-Id; wer eine Option hinzufügt oder ihre Anzahl
 * verschiebt, übergibt eine Options-Definition. Ein Aktions-String, der beides
 * durch denselben Parameter schleust, existiert damit nicht mehr.
 *
 * Alle Funktionen sind rein: Die übergebene Liste bleibt unberührt, zurück kommt
 * eine neue Liste (oder — wenn nichts zu tun war — die unveränderte Eingabe).
 */
import { ownCountOf } from './rosterTree.js';

/** Anzahl, mit der eine frisch angelegte Auswahl in die Liste eintritt. */
const INITIAL_SELECTION_COUNT = 1;

/** Anzahl, bei deren Erreichen eine Auswahl nicht mehr geführt wird. */
const EMPTY_SELECTION_COUNT = 0;

/**
 * Die Katalog-Id, über die eine Selection ihrer Options-Definition zugeordnet
 * wird: der verlinkte Eintrag, ersatzweise der direkte Eintrag.
 */
const optionDefinitionIdOf = (selection) => selection.entryLinkId || selection.selectionEntryId;

/** Neue Liste ohne den Eintrag an `index`. */
const withoutIndex = (selections, index) => selections.filter((_, position) => position !== index);

/** Neue Liste, in der der Eintrag an `index` durch `replacement` ersetzt ist. */
const withReplacedIndex = (selections, index, replacement) =>
  selections.map((selection, position) => (position === index ? replacement : selection));

/**
 * Index der Auswahl, die zur Options-Definition `optionDefinitionId` gehört,
 * oder `-1`.
 */
const indexOfOption = (selections, optionDefinitionId) =>
  selections.findIndex(selection => optionDefinitionIdOf(selection) === optionDefinitionId);

/**
 * Fügt eine eigenständig geführte Instanz hinzu — auch dann, wenn dieselbe
 * Options-Definition bereits in der Liste steht (jede Instanz einer
 * eigenständigen Untereinheit wird einzeln geführt).
 *
 * @param {import('../types.js').Selection[]} childSelections
 * @param {import('../types.js').Selection|null} newInstance frisch erzeugte Auswahl
 * @returns {import('../types.js').Selection[]}
 */
export function withAddedInstance(childSelections, newInstance) {
  if (!newInstance) return childSelections;
  return [...childSelections, { ...newInstance, number: INITIAL_SELECTION_COUNT }];
}

/**
 * Entfernt die Instanz mit dieser Selection-Id. Fehlt sie, bleibt die Liste
 * inhaltlich unverändert.
 *
 * @param {import('../types.js').Selection[]} childSelections
 * @param {string} instanceSelectionId
 * @returns {import('../types.js').Selection[]}
 */
export function withoutInstance(childSelections, instanceSelectionId) {
  return childSelections.filter(selection => selection.id !== instanceSelectionId);
}

/**
 * Verschiebt die Anzahl der zu `optionDefinitionId` gehörenden Auswahl um
 * `countDelta`. Die einzige Stelle, an der die Erhöhen-/Verringern-Regel steht:
 *
 *  - Ist die Option noch nicht gewählt, legt eine Erhöhung sie über
 *    `createInstance` an; eine Verringerung lässt die Liste unverändert.
 *  - Erreicht die Anzahl null, entfällt die Auswahl ersatzlos.
 *
 * @param {import('../types.js').Selection[]} childSelections
 * @param {string} optionDefinitionId Id der Options-Definition
 * @param {number} countDelta Verschiebung der Anzahl (positiv oder negativ)
 * @param {() => import('../types.js').Selection|null} createInstance
 *        erzeugt die Auswahl, wenn die Option noch nicht gewählt ist
 * @returns {import('../types.js').Selection[]}
 */
export function withChangedOptionCount(childSelections, optionDefinitionId, countDelta, createInstance) {
  const index = indexOfOption(childSelections, optionDefinitionId);

  if (index < 0) {
    return countDelta > 0 ? withAddedInstance(childSelections, createInstance()) : childSelections;
  }

  const changedCount = ownCountOf(childSelections[index]) + countDelta;
  if (changedCount <= EMPTY_SELECTION_COUNT) {
    return withoutIndex(childSelections, index);
  }
  return withReplacedIndex(childSelections, index, { ...childSelections[index], number: changedCount });
}
