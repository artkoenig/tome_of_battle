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
import { childSelectionsOf } from '../../roster';
import { isIndependentSubUnitSlot } from '../../evaluation/slotLookups';

/**
 * Die Ids aller Selections, die die Karte der übergebenen Selection
 * repräsentiert: die Selection selbst samt Teilbaum, ohne die Teilbäume der
 * direkten Kinder mit eigener Karte.
 *
 * Welches Kind eine eigene Karte bekommt, sagt der Bericht
 * (`capability.isIndependentSubUnit`, Issue 0156) — die Karte löst dafür keinen
 * Katalog-Eintrag mehr auf.
 * @param {import('../../types.js').Selection} selection Wurzel der Karte
 * @param {Map<string, object>|null|undefined} capabilities Slot-Map des Berichts
 * @param {Map<string, string>|null|undefined} pathBySelectionId App-Selection-UUID → Slot-Pfad
 * @returns {Set<string>}
 */
export function collectCardSelectionIds(selection, capabilities, pathBySelectionId) {
  const cardSelectionIds = new Set();
  const addSubtree = (node) => {
    cardSelectionIds.add(node.id);
    childSelectionsOf(node).forEach(addSubtree);
  };
  cardSelectionIds.add(selection.id);
  childSelectionsOf(selection)
    .filter(child => !isIndependentSubUnitSlot(capabilities, pathBySelectionId, child))
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
 * @param {Map<string, object>|null|undefined} capabilities Slot-Map des Berichts
 * @returns {object[]}
 */
export function selectionViolationsForCard(violations, pathBySelectionId, selection, capabilities) {
  if (!pathBySelectionId) return [];
  const cardSelectionIds = collectCardSelectionIds(selection, capabilities, pathBySelectionId);
  const cardPaths = new Set();
  for (const selectionId of cardSelectionIds) {
    const path = pathBySelectionId.get(selectionId);
    if (path !== undefined) cardPaths.add(path);
  }
  return (violations ?? []).filter(violation => cardPaths.has(violation?.anchor?.path));
}
