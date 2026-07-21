import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { getEffectiveModifiers } from './modifierEvaluator.js';
import { isSelectionEntryHidden } from './entryVisibility.js';
import { isIndependentSubUnit } from './subUnit.js';
import { ConstraintScope } from './battlescribeConstants.js';
import { ConstraintKind } from '../parser/schema/battlescribeSchema.generated.js';

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
    return isSelectionEntryHidden(linkOrEntry, { system, roster, selectionCounts, forceCategoryCounts, force });
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
        collectGroupItemIds(res, groupItemIds, visited);
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

  // Recursive options collector
  const collectOptions = (def, currentGroupName = null, currentGroupId = null, parentConstraints = null, parentModifiers = null) => {
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
        groupModifiers: parentModifiers
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
      if (child.type === 'selectionEntryGroup') {
        const combinedConstraints = prepareConstraints(resolvedChild);
        // Resolve the link's own modifiers through the same seam so its
        // modifierGroup-gated modifiers are kept rather than silently dropped.
        const combinedModifiers = getEffectiveModifiers(resolvedChild).concat(getEffectiveModifiers(child));
        collectOptions(resolvedChild, resolvedChild.name || child.name, resolvedChild.id || child.id, combinedConstraints, combinedModifiers);
      } else {
        // Otherwise it points to an option (upgrade, profile, etc.), so it's a selectable item
        optionsList.push({
          option: child,
          parentDefId: def.id,
          groupName: currentGroupName,
          groupId: currentGroupId,
          groupConstraints: parentConstraints,
          groupModifiers: parentModifiers
        });
      }
    });

    // 3. Process selection entry groups
    def.selectionEntryGroups?.forEach(group => {
      if (isHiddenInContext(group)) return;
      const combinedGroupConstraints = prepareConstraints(group);
      collectOptions(group, group.name || currentGroupName, group.id || currentGroupId, combinedGroupConstraints, getEffectiveModifiers(group));
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
            collectOptions(subResolved, subResolved.name, subResolved.id);
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

export const isOptionRosterUnique = (res, system) => {
  if (!res) return false;
  
  // 1. Check constraints on the entry itself
  const hasDirectConstraint = res.constraints?.some(c => 
    c.type === ConstraintKind.MAX && 
    c.value === 1 && 
    (c.scope === ConstraintScope.ROSTER || c.scope === ConstraintScope.FORCE)
  );
  if (hasDirectConstraint) return true;

  // 2. Check constraints on the categories it links to
  const hasCategoryConstraint = res.categoryLinks?.some(cl => {
    const catDef = system.categoryEntries?.find(ce => ce.id === cl.targetId);
    return catDef?.constraints?.some(c => 
      c.type === ConstraintKind.MAX && 
      c.value === 1 && 
      (c.scope === ConstraintScope.ROSTER || c.scope === ConstraintScope.FORCE || !c.scope)
    );
  });
  
  return !!hasCategoryConstraint;
};

