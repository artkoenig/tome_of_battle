/**
 * Anwendungsfall „Liste umbenennen" (Issue 0188): eine reine Funktion vom
 * Roster auf das Roster. Der Selektionsbaum bleibt dabei identitätsgleich.
 */

import '../../../shared/rostermodel/types.js';

/**
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {string} newName
 * @returns {import('../../../shared/rostermodel/types.js').Roster}
 */
export function renameRoster(roster, newName) {
  return { ...roster, name: newName };
}
