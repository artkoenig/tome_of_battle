/**
 * Anwendungsfall „Einheit entfernen" (Issue 0188): eine reine Funktion vom
 * Roster auf das Roster. Der Auswahl-Zustand der Oberfläche ist nicht Sache des
 * Schreibmodells — die Ansicht räumt ihn selbst auf.
 */

import { childSelectionsOf } from '../model/rosterTree.js';
import '../../../shared/rostermodel/types.js';

/**
 * Entfernt die Wurzel-Selektion `selectionId` aus dem Kontingent, das sie führt.
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {string} selectionId
 * @returns {import('../../../shared/rostermodel/types.js').Roster}
 */
export function removeUnit(roster, selectionId) {
  const forces = roster?.forces ?? [];
  return {
    ...roster,
    forces: forces.map(force => ({
      ...force,
      selections: childSelectionsOf(force).filter(selection => selection.id !== selectionId)
    }))
  };
}
