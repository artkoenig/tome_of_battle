import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import '../types.js';

/**
 * Gleicht gespeicherte Roster-Selections mit dem (ggf. aktualisierten)
 * System ab: Namen und Kosten werden aus den Katalogdefinitionen
 * nachgezogen. Mutiert das Roster in-place.
 * @returns {boolean} true, wenn das Roster verändert wurde
 */
export function syncRosterSelectionsWithSystem(roster, system) {
  if (!roster || !system) return false;
  let rosterModified = false;

  const syncSelection = (selection, catalogueId) => {
    const entryId = selection.selectionEntryId || selection.entryLinkId;
    if (entryId) {
      const entryDef = findEntryInSystem(system, entryId, catalogueId);
      if (entryDef) {
        const resolved = resolveEntry(system, entryDef, catalogueId);
        if (resolved) {
          if (selection.name !== resolved.name) {
            selection.name = resolved.name;
            rosterModified = true;
          }
          const oldCostsJson = JSON.stringify(selection.costs || []);
          const newCostsJson = JSON.stringify(resolved.costs || []);
          if (oldCostsJson !== newCostsJson) {
            selection.costs = resolved.costs || [];
            rosterModified = true;
          }
        }
      }
    }
    if (selection.selections) {
      selection.selections.forEach(child => syncSelection(child, catalogueId));
    }
  };

  roster.forces?.forEach(force => {
    force.selections?.forEach(sel => syncSelection(sel, force.catalogueId || roster.catalogueId));
  });

  return rosterModified;
}
