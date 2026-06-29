import { findEntryInSystem, resolveEntry } from './validator.js';

export const getUnitOptions = (system, activeCatalogueId, unitSelection) => {
  if (!activeCatalogueId) return [];
  const entryId = unitSelection.entryLinkId || unitSelection.selectionEntryId;
  const rawEntry = findEntryInSystem(system, entryId, activeCatalogueId);
  const resolved = resolveEntry(system, rawEntry, activeCatalogueId);
  
  if (!resolved) return [];

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

  const prepareConstraints = (gDef) => {
    if (!gDef || !gDef.constraints) return [];
    const itemIds = collectGroupItemIds(gDef);
    return gDef.constraints.map(con => ({
      ...con,
      groupItemIds: itemIds
    }));
  };

  const optionsList = [];

  const collectOptions = (def, currentGroupName = null, currentGroupId = null, parentConstraints = null) => {
    def.selectionEntries?.forEach(child => {
      optionsList.push({ 
        option: child, 
        parentDefId: def.id, 
        groupName: currentGroupName, 
        groupId: currentGroupId,
        groupConstraints: parentConstraints 
      });
    });

    def.entryLinks?.forEach(child => {
      const resolvedChild = resolveEntry(system, child, activeCatalogueId);
      if (!resolvedChild) return;

      if (child.type === 'selectionEntryGroup') {
        const combinedConstraints = prepareConstraints(resolvedChild).concat(parentConstraints || []);
        collectOptions(resolvedChild, resolvedChild.name || child.name, resolvedChild.id || child.id, combinedConstraints);
      } else {
        optionsList.push({ 
          option: child, 
          parentDefId: def.id, 
          groupName: currentGroupName, 
          groupId: currentGroupId,
          groupConstraints: parentConstraints 
        });
      }
    });

    def.selectionEntryGroups?.forEach(group => {
      const combinedGroupConstraints = prepareConstraints(group).concat(parentConstraints || []);
      collectOptions(group, group.name || currentGroupName, group.id || currentGroupId, combinedGroupConstraints);
    });
  };

  collectOptions(resolved);
  
  resolved.selectionEntries?.forEach(sub => {
    const subResolved = resolveEntry(system, sub, activeCatalogueId);
    if (subResolved && subResolved.type === 'model') {
      collectOptions(subResolved);
    }
  });

  const collectFromActiveSelections = (currentSel) => {
    currentSel.selections?.forEach(subSel => {
      const subEntryId = subSel.entryLinkId || subSel.selectionEntryId;
      const subRawEntry = findEntryInSystem(system, subEntryId, activeCatalogueId);
      const subResolved = resolveEntry(system, subRawEntry, activeCatalogueId);
      if (subResolved) {
        if (subResolved.selectionEntries?.length > 0 || subResolved.entryLinks?.length > 0 || subResolved.selectionEntryGroups?.length > 0) {
          collectOptions(subResolved);
        }
        collectFromActiveSelections(subSel);
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
