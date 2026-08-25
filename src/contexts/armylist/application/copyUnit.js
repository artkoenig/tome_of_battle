/**
 * Anwendungsfall „Einheit kopieren" (Issue 0188): eine reine Funktion vom
 * Roster auf das Roster.
 *
 * Jede Selektion des kopierten Teilbaums erhält eine frische Id, damit die Kopie
 * mit dem Original nicht kollidiert. Die Kopie steht direkt hinter dem Original.
 */

import { childSelectionsOf, mapSelectionTree } from '../model/rosterTree.js';
import '../../../shared/rostermodel/types.js';

/** Kopiert einen Teilbaum mit durchgehend frischen Ids. */
const cloneSelection = (unit) => mapSelectionTree(unit, (selection, clonedChildren) => ({
  ...selection,
  id: crypto.randomUUID(),
  selections: clonedChildren
}));

/**
 * Kopiert die Wurzel-Selektion `selectionId` innerhalb ihres Kontingents. Kennt
 * das Roster sie nicht, kommt es unverändert zurück — der Aufrufer erkennt
 * „nichts geschehen" an der Identität.
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {string} selectionId
 * @returns {import('../../../shared/rostermodel/types.js').Roster}
 */
export function copyUnit(roster, selectionId) {
  const forces = roster?.forces ?? [];
  const owningForce = forces.find(
    force => childSelectionsOf(force).some(selection => selection.id === selectionId)
  );
  if (!owningForce) return roster;

  const units = childSelectionsOf(owningForce);
  const originalIndex = units.findIndex(selection => selection.id === selectionId);
  const copiedUnits = [...units];
  copiedUnits.splice(originalIndex + 1, 0, cloneSelection(units[originalIndex]));

  return {
    ...roster,
    forces: forces.map(force => (
      force === owningForce ? { ...force, selections: copiedUnits } : force
    ))
  };
}
