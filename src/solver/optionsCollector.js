import { findEntryInSystem, resolveEntry } from './catalogResolver.js';

export const getUnitOptions = (system, activeCatalogueId, unitSelection) => {
  if (!activeCatalogueId) return [];
  const entryId = unitSelection.entryLinkId || unitSelection.selectionEntryId;
  const rawEntry = findEntryInSystem(system, entryId, activeCatalogueId);
  const resolved = resolveEntry(system, rawEntry, activeCatalogueId);
  
  if (!resolved) return [];

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
  const collectOptions = (def, currentGroupName = null, currentGroupId = null, parentConstraints = null) => {
    // 1. Process selection entries
    def.selectionEntries?.forEach(child => {
      // A selectionEntry is always an option itself. We don't recurse into its children
      // until the user actually selects it (handled by collectFromActiveSelections).
      optionsList.push({ 
        option: child, 
        parentDefId: def.id, 
        groupName: currentGroupName, 
        groupId: currentGroupId,
        groupConstraints: parentConstraints 
      });
    });

    // 2. Process entry links
    def.entryLinks?.forEach(child => {
      const resolvedChild = resolveEntry(system, child, activeCatalogueId);
      if (!resolvedChild) return;

      // If the entry link points to a group, we recurse into it to extract its items
      if (child.type === 'selectionEntryGroup') {
        const combinedConstraints = prepareConstraints(resolvedChild);
        collectOptions(resolvedChild, resolvedChild.name || child.name, resolvedChild.id || child.id, combinedConstraints);
      } else {
        // Otherwise it points to an option (upgrade, profile, etc.), so it's a selectable item
        optionsList.push({ 
          option: child, 
          parentDefId: def.id, 
          groupName: currentGroupName, 
          groupId: currentGroupId,
          groupConstraints: parentConstraints 
        });
      }
    });

    // 3. Process selection entry groups
    def.selectionEntryGroups?.forEach(group => {
      const combinedGroupConstraints = prepareConstraints(group);
      collectOptions(group, group.name || currentGroupName, group.id || currentGroupId, combinedGroupConstraints);
    });
  };

  const hasEntryChildren = (res) => {
    if (!res) return false;
    const hasSE = res.selectionEntries && res.selectionEntries.length > 0;
    const hasEL = res.entryLinks && res.entryLinks.length > 0;
    const hasSEG = res.selectionEntryGroups && res.selectionEntryGroups.length > 0;
    return hasSE || hasEL || hasSEG;
  };

  const isIndependentSubUnit = (res) => {
    return res && res.type === 'unit' && (res.collective === false || res.collective === 'false') && hasEntryChildren(res);
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
    c.type === 'max' && 
    c.value === 1 && 
    (c.scope === 'roster' || c.scope === 'force')
  );
  if (hasDirectConstraint) return true;

  // 2. Check constraints on the categories it links to
  const hasCategoryConstraint = res.categoryLinks?.some(cl => {
    const catDef = system.categoryEntries?.find(ce => ce.id === cl.targetId);
    return catDef?.constraints?.some(c => 
      c.type === 'max' && 
      c.value === 1 && 
      (c.scope === 'roster' || c.scope === 'force' || !c.scope)
    );
  });
  
  return !!hasCategoryConstraint;
};

