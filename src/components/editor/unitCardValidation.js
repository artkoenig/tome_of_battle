/**
 * Zuordnung der Validierungsfehler zu Einheitenkarten.
 *
 * Der Validator verankert einen Verstoß an der konkret betroffenen Selection —
 * oft eine tief verschachtelte Option innerhalb einer Einheit. Eine
 * Einheitenkarte rendert aber nur ihre Wurzel-Selection; eigene Karten
 * bekommen allein die direkten Kinder, die eigenständige Untereinheiten sind.
 * Eine Karte zeigt deshalb genau die Fehler, deren Selection in ihrem Teilbaum
 * liegt — abzüglich der Teilbäume dieser eigenständigen Untereinheiten, deren
 * Karten dieselbe Regel rekursiv anwenden.
 */
import {
  childSelectionsOf,
  findEntryInSystem,
  resolveEntry,
  isIndependentSubUnit
} from '../../solver/validator';

/**
 * True, wenn die Selection eine eigenständige Untereinheit ist, ihr
 * aufgelöster Katalog-Eintrag also `isIndependentSubUnit` erfüllt.
 * @param {import('../../types.js').Selection} selection
 * @param {Object} system
 * @param {string|undefined} catalogueId Katalog-Kontext der Force
 * @returns {boolean}
 */
export function isIndependentSubUnitSelection(selection, system, catalogueId) {
  const entryId = selection.entryLinkId || selection.selectionEntryId;
  const entry = findEntryInSystem(system, entryId, catalogueId);
  return isIndependentSubUnit(resolveEntry(system, entry, catalogueId));
}

/**
 * Die Ids aller Selections, die die Karte der übergebenen Selection
 * repräsentiert: die Selection selbst samt Teilbaum, ohne die Teilbäume der
 * direkten Kinder mit eigener Karte.
 * @param {import('../../types.js').Selection} selection Wurzel der Karte
 * @param {Object} system
 * @param {string|undefined} catalogueId Katalog-Kontext der Force
 * @returns {Set<string>}
 */
export function collectCardSelectionIds(selection, system, catalogueId) {
  const cardSelectionIds = new Set();
  const addSubtree = (node) => {
    cardSelectionIds.add(node.id);
    childSelectionsOf(node).forEach(addSubtree);
  };
  cardSelectionIds.add(selection.id);
  childSelectionsOf(selection)
    .filter(child => !isIndependentSubUnitSelection(child, system, catalogueId))
    .forEach(addSubtree);
  return cardSelectionIds;
}

/**
 * Die Validierungsfehler, die auf der Karte der übergebenen Selection
 * erscheinen. Fehler ohne `selectionId` (Roster-/Kategorie-Ebene) und
 * missgebildete Einträge fallen heraus.
 * @param {import('../../types.js').ValidationError[]|null|undefined} validationErrors
 * @param {import('../../types.js').Selection} selection Wurzel der Karte
 * @param {Object} system
 * @param {string|undefined} catalogueId Katalog-Kontext der Force
 * @returns {import('../../types.js').ValidationError[]}
 */
export function selectionErrorsForCard(validationErrors, selection, system, catalogueId) {
  const cardSelectionIds = collectCardSelectionIds(selection, system, catalogueId);
  return (validationErrors ?? []).filter(error => cardSelectionIds.has(error?.selectionId));
}
