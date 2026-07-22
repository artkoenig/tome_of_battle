import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { getEffectiveModifiers, getModifiedConstraintValue } from './modifierEvaluator.js';
import { isSelectionEntryHidden } from './entryVisibility.js';
import { isIndependentSubUnit } from './subUnit.js';
import { ConstraintScope } from './battlescribeConstants.js';
import { ConstraintKind, EntryLinkKind } from '../parser/schema/battlescribeSchema.generated.js';

/**
 * Collects the options a unit exposes in the editor.
 *
 * @param {Object} system
 * @param {string} activeCatalogueId
 * @param {Object} unitSelection - the roster selection whose options to collect.
 * @param {Object|null} [visibilityContext] - when provided, conditionally hidden
 *   entryLinks/groups/entries are evaluated against the current roster and omitted
 *   while their `hidden` flag resolves to true. Shape:
 *   `{ roster, selectionCounts, forceCategoryCounts, force }`. Omitting it keeps the
 *   raw, unfiltered collection callers such as roster synchronisation rely on, so
 *   filtering never silently prunes a stored selection.
 */
export const getUnitOptions = (system, activeCatalogueId, unitSelection, visibilityContext = null) => {
  if (!activeCatalogueId) return [];
  const entryId = unitSelection.entryLinkId || unitSelection.selectionEntryId;
  const rawEntry = findEntryInSystem(system, entryId, activeCatalogueId);
  const resolved = resolveEntry(system, rawEntry, activeCatalogueId);

  if (!resolved) return [];

  // A conditionally hidden entryLink/group/entry is only omitted when a visibility
  // context is supplied; the same evaluation the category adder uses (hidden flag plus
  // `set hidden` modifiers gated on their conditions) decides visibility here.
  const isHiddenInContext = (linkOrEntry) => {
    if (!visibilityContext) return false;
    const { roster, selectionCounts, forceCategoryCounts, force } = visibilityContext;
    return isSelectionEntryHidden(linkOrEntry, {
      system, roster, selectionCounts, forceCategoryCounts, force, catalogueId: activeCatalogueId
    });
  };

  // Recursive helper to find all nested entry IDs for a group
  const collectGroupItemIds = (gDef, groupItemIds = new Set(), visited = new Set()) => {
    if (!gDef || visited.has(gDef.id)) return groupItemIds;
    if (gDef.id) visited.add(gDef.id);

    gDef.selectionEntries?.forEach(item => {
      groupItemIds.add(item.id);
      const res = resolveEntry(system, item, activeCatalogueId);
      if (res) groupItemIds.add(res.id);
    });
    gDef.entryLinks?.forEach(link => {
      groupItemIds.add(link.id);
      groupItemIds.add(link.targetId);
      const res = resolveEntry(system, link, activeCatalogueId);
      if (res) {
        groupItemIds.add(res.id);
        // Only a linked *group* contributes further members to this group. A linked
        // option/upgrade (e.g. an upgrade-type mount) is itself a single member; its own
        // children are sub-options configured *under* it, not sibling choices of this
        // group — recursing into them would wrongly count them against the group's max.
        if (link.type === EntryLinkKind.SELECTION_ENTRY_GROUP) {
          collectGroupItemIds(res, groupItemIds, visited);
        }
      }
    });
    gDef.selectionEntryGroups?.forEach(subG => {
      collectGroupItemIds(subG, groupItemIds, visited);
    });
    return groupItemIds;
  };

  // Helper to prepare constraints with groupItemIds attached
  const prepareConstraints = (gDef) => {
    if (!gDef || !gDef.constraints) return [];
    const itemIds = collectGroupItemIds(gDef);
    return gDef.constraints.map(con => ({
      ...con,
      groupItemIds: itemIds
    }));
  };

  const optionsList = [];

  // Recursive options collector.
  //
  // `ownerSelectionId` names the roster selection under which a chosen option must nest.
  // It is null for options that belong directly to the unit, and the id of an active
  // sub-selection for the options that selection re-emits (see collectFromActiveSelections)
  // — e.g. the Barding of a chosen upgrade-type mount, which must attach under the mount's
  // selection rather than as a sibling of it on the unit. It is threaded unchanged through
  // the group/link recursion, since a display group inside an option is still nested under
  // that same owning selection.
  const collectOptions = (def, currentGroupName = null, currentGroupId = null, parentConstraints = null, parentModifiers = null, ownerSelectionId = null) => {
    // 1. Process selection entries
    def.selectionEntries?.forEach(child => {
      if (isHiddenInContext(child)) return;
      // A selectionEntry is always an option itself. We don't recurse into its children
      // until the user actually selects it (handled by collectFromActiveSelections).
      optionsList.push({
        option: child,
        parentDefId: def.id,
        groupName: currentGroupName,
        groupId: currentGroupId,
        groupConstraints: parentConstraints,
        groupModifiers: parentModifiers,
        ownerSelectionId
      });
    });

    // 2. Process entry links
    def.entryLinks?.forEach(child => {
      const resolvedChild = resolveEntry(system, child, activeCatalogueId);
      if (!resolvedChild) return;
      // A conditionally hidden link contributes nothing: for a group link this means the
      // whole (possibly bloodline-specific) group is skipped, not merged with its
      // same-named siblings; for an option link the single item is omitted.
      if (isHiddenInContext(child)) return;

      // If the entry link points to a group, we recurse into it to extract its items
      if (child.type === EntryLinkKind.SELECTION_ENTRY_GROUP) {
        const combinedConstraints = prepareConstraints(resolvedChild);
        // Resolve the link's own modifiers through the same seam so its
        // modifierGroup-gated modifiers are kept rather than silently dropped.
        const combinedModifiers = getEffectiveModifiers(resolvedChild).concat(getEffectiveModifiers(child));
        collectOptions(resolvedChild, resolvedChild.name || child.name, resolvedChild.id || child.id, combinedConstraints, combinedModifiers, ownerSelectionId);
      } else {
        // Otherwise it points to an option (upgrade, profile, etc.), so it's a selectable item
        optionsList.push({
          option: child,
          parentDefId: def.id,
          groupName: currentGroupName,
          groupId: currentGroupId,
          groupConstraints: parentConstraints,
          groupModifiers: parentModifiers,
          ownerSelectionId
        });
      }
    });

    // 3. Process selection entry groups
    def.selectionEntryGroups?.forEach(group => {
      if (isHiddenInContext(group)) return;
      const combinedGroupConstraints = prepareConstraints(group);
      collectOptions(group, group.name || currentGroupName, group.id || currentGroupId, combinedGroupConstraints, getEffectiveModifiers(group), ownerSelectionId);
    });
  };

  collectOptions(resolved);
  
  resolved.selectionEntries?.forEach(sub => {
    const subResolved = resolveEntry(system, sub, activeCatalogueId);
    if (subResolved && subResolved.type === 'model') {
      if (!isIndependentSubUnit(subResolved)) {
        collectOptions(subResolved, subResolved.name, subResolved.id);
      }
    }
  });

  const collectFromActiveSelections = (currentSel) => {
    currentSel.selections?.forEach(subSel => {
      const subEntryId = subSel.entryLinkId || subSel.selectionEntryId;
      const subRawEntry = findEntryInSystem(system, subEntryId, activeCatalogueId);
      const subResolved = resolveEntry(system, subRawEntry, activeCatalogueId);
      if (subResolved) {
        if (!isIndependentSubUnit(subResolved)) {
          if (subResolved.selectionEntries?.length > 0 || subResolved.entryLinks?.length > 0 || subResolved.selectionEntryGroups?.length > 0) {
            // Tag the re-emitted options with this active selection as their owner, so the
            // editor nests a chosen sub-option under it rather than as a sibling on the unit.
            collectOptions(subResolved, subResolved.name, subResolved.id, null, null, subSel.id);
          }
          collectFromActiveSelections(subSel);
        }
      }
    });
  };
  collectFromActiveSelections(unitSelection);

  const seenOptionIds = new Set();
  const uniqueOptionsList = [];
  optionsList.forEach(item => {
    const res = resolveEntry(system, item.option, activeCatalogueId);
    if (res) {
      const canonicalId = res.targetId || res.id;
      if (seenOptionIds.has(canonicalId)) {
        return;
      }
      seenOptionIds.add(canonicalId);
    }
    uniqueOptionsList.push(item);
  });

  return uniqueOptionsList;
};

export const isUniqueOptionTakenElsewhere = (targetRes, system, activeCatalogueId, selection, roster) => {
  const targetIdToCheck = targetRes.targetId || targetRes.id;
  let taken = false;
  
  const checkSelection = (sel, isUnderCurrent) => {
    const underCurrent = isUnderCurrent || (sel.id === selection.id);
    
    if (!underCurrent) {
      const selRaw = findEntryInSystem(system, sel.selectionEntryId || sel.entryLinkId, activeCatalogueId);
      const selRes = resolveEntry(system, selRaw, activeCatalogueId);
      const selUnderlyingId = selRes ? (selRes.targetId || selRes.id) : (sel.selectionEntryId || sel.entryLinkId);
      
      if (selUnderlyingId === targetIdToCheck) {
        taken = true;
        return;
      }
    }
    
    sel.selections?.forEach(sub => checkSelection(sub, underCurrent));
  };

  roster.forces?.forEach(force => {
    force.selections?.forEach(sel => checkSelection(sel, false));
  });

  return taken;
};

// "Roster-unique" means an entry (or its category) is capped at exactly one across the
// roster/force. The cap is read as its EFFECTIVE value — modifiers on the max constraint
// apply — so a modifier that lifts or lowers the cap is honoured rather than the raw
// catalogue number. No roster context is available on this static-uniqueness path, so an
// unconditional modifier decides; a purely conditional one falls through to the raw value.
const ROSTER_UNIQUE_MAX = 1;

const isEffectiveMaxRosterUnique = (constraint, modifierSource) =>
  constraint.type === ConstraintKind.MAX &&
  getModifiedConstraintValue(constraint, getEffectiveModifiers(modifierSource), {}) === ROSTER_UNIQUE_MAX;

export const isOptionRosterUnique = (res, system) => {
  if (!res) return false;

  // 1. Check constraints on the entry itself
  const hasDirectConstraint = res.constraints?.some(c =>
    (c.scope === ConstraintScope.ROSTER || c.scope === ConstraintScope.FORCE) &&
    isEffectiveMaxRosterUnique(c, res)
  );
  if (hasDirectConstraint) return true;

  // 2. Check constraints on the categories it links to
  const hasCategoryConstraint = res.categoryLinks?.some(cl => {
    const catDef = system.categoryEntries?.find(ce => ce.id === cl.targetId);
    return catDef?.constraints?.some(c =>
      (c.scope === ConstraintScope.ROSTER || c.scope === ConstraintScope.FORCE || !c.scope) &&
      isEffectiveMaxRosterUnique(c, catDef)
    );
  });

  return !!hasCategoryConstraint;
};

