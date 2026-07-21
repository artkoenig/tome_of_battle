import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { getUnitOptions } from './optionsCollector.js';
import { isIndependentSubUnit } from './subUnit.js';
import '../types.js';

/**
 * Rewrites imported option selections so they reference catalogue entries the same
 * way natively created ones do.
 *
 * BattleScribe/New Recruit files identify a chosen option by its target entry id,
 * whereas the rest of the app matches options by the catalogue's link id
 * (see `resolveEntry`, which keeps the link id). Without this alignment the editor
 * cannot recognise imported options as selected. We map each option the unit exposes
 * (via `getUnitOptions`, the same collector the editor uses) from its canonical
 * target id to its link/entry id, then adopt that id on the matching selection.
 * Idempotent: natively created rosters already use the link id and are left untouched.
 *
 * @returns {boolean} true, wenn das Roster verändert wurde
 */
export function reconcileImportedSelectionIds(roster, system) {
  if (!roster || !system) return false;
  let rosterModified = false;

  const reconcileUnit = (unitSelection, catalogueId) => {
    const canonicalToOption = new Map();
    getUnitOptions(system, catalogueId, unitSelection).forEach(({ option }) => {
      const resolved = resolveEntry(system, option, catalogueId);
      if (!resolved) return;
      const canonicalId = resolved.targetId || resolved.id;
      if (!canonicalToOption.has(canonicalId)) canonicalToOption.set(canonicalId, option);
    });

    const reassign = (selection) => {
      selection.selections?.forEach(child => {
        const currentId = child.selectionEntryId || child.entryLinkId;
        const option = canonicalToOption.get(currentId);
        if (option) {
          const newEntryLinkId = option.targetId ? option.id : null;
          const newSelectionEntryId = option.targetId ? null : option.id;
          if (child.entryLinkId !== newEntryLinkId || child.selectionEntryId !== newSelectionEntryId) {
            child.entryLinkId = newEntryLinkId;
            child.selectionEntryId = newSelectionEntryId;
            rosterModified = true;
          }
        }

        const childDef = resolveEntry(system, findEntryInSystem(system, child.selectionEntryId || child.entryLinkId, catalogueId), catalogueId);
        if (isIndependentSubUnit(childDef)) {
          reconcileUnit(child, catalogueId);
        } else {
          reassign(child);
        }
      });
    };

    reassign(unitSelection);
  };

  roster.forces?.forEach(force => {
    const catalogueId = force.catalogueId || roster.catalogueId;
    force.selections?.forEach(unitSelection => reconcileUnit(unitSelection, catalogueId));
  });

  return rosterModified;
}

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
          // Costs are derived from the catalogue at read time (ADR-0011), not stored.
          // Drop any legacy costs field lazily so old rosters converge to the new model.
          if (selection.costs !== undefined) {
            delete selection.costs;
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
