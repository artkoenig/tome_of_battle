/**
 * Zuordnung der Verletzungen des Evaluator-Berichts zu Einheitenkarten.
 *
 * Der Evaluator verankert eine Verletzung an einem Slot, adressiert über
 * dessen Pfad (`violation.anchor.path`); die Brücke zur App-Selection ist
 * `pathBySelectionId` (App-Selection-UUID → Slot-Pfad, `useEvaluation`). Eine
 * Verletzung kann an einer tief verschachtelten Option innerhalb einer Einheit
 * hängen. Eine Einheitenkarte rendert aber nur ihre Wurzel-Selection; eigene
 * Karten bekommen allein die direkten Kinder, die eigenständige Untereinheiten
 * sind. Eine Karte zeigt deshalb genau die Verletzungen, deren Anker-Pfad zu
 * einer Selection ihres Teilbaums gehört — abzüglich der Teilbäume dieser
 * eigenständigen Untereinheiten, deren Karten dieselbe Regel rekursiv anwenden.
 */
import {
  childSelectionsOf,
  findEntryInSystem,
  resolveEntry,
  isIndependentSubUnit
} from '../../roster';

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
 * Die Verletzungen des Evaluator-Berichts, die auf der Karte der übergebenen
 * Selection erscheinen: die, deren `anchor.path` der Slot-Pfad einer Selection
 * des Kartenteilbaums ist. Verletzungen ohne Selection-Anker (Roster-,
 * Kontingent- oder Kategorie-Ebene, synthetische Anker) und missgebildete
 * Einträge fallen heraus.
 * @param {object[]|null|undefined} violations Verletzungen der Evaluator-Fassade
 * @param {Map<string, string>|null|undefined} pathBySelectionId App-Selection-UUID → Slot-Pfad
 * @param {import('../../types.js').Selection} selection Wurzel der Karte
 * @param {Object} system
 * @param {string|undefined} catalogueId Katalog-Kontext der Force
 * @returns {object[]}
 */
export function selectionViolationsForCard(violations, pathBySelectionId, selection, system, catalogueId) {
  if (!pathBySelectionId) return [];
  const cardSelectionIds = collectCardSelectionIds(selection, system, catalogueId);
  const cardPaths = new Set();
  for (const selectionId of cardSelectionIds) {
    const path = pathBySelectionId.get(selectionId);
    if (path !== undefined) cardPaths.add(path);
  }
  return (violations ?? []).filter(violation => cardPaths.has(violation?.anchor?.path));
}
