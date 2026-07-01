import { findEntryInSystem, resolveEntry } from './catalogResolver.js';

export const evaluateCondition = (cond, ctx = {}) => {
  if (!cond) return false;
  const { roster, selectionCounts = {}, forceCategoryCounts = {}, selection, parentSelection, system, parentCatalogueId } = ctx;
  let currentValue = 0;
  
  if (cond.field && cond.field.startsWith('limit::')) {
    currentValue = roster?.costLimit || 0;
  } else if (cond.field) {
    if (cond.scope === 'parent' && parentSelection && parentSelection.selections) {
      const catId = parentCatalogueId || (roster ? roster.catalogueId : null);
      const targetId = cond.childId || cond.field;
      
      const countMatches = (list) => (list || []).reduce((sum, s) => {
        let isMatch = false;
        const sId = s.entryLinkId || s.selectionEntryId;
        if (sId === targetId) {
          isMatch = true;
        } else if (system) {
          const raw = findEntryInSystem(system, sId, catId);
          const res = raw && resolveEntry(system, raw, catId);
          if (res && (res.targetId === targetId || res.id === targetId)) isMatch = true;
          if (targetId === 'model' && res && res.type === 'model') isMatch = true;
        }
        
        let acc = sum + (isMatch ? (s.number || 1) : 0);
        if (cond.includeChildSelections && s.selections) {
          acc += countMatches(s.selections);
        }
        return acc;
      }, 0);
      
      currentValue = countMatches(parentSelection.selections);
    } else {
      let categoryTotal = 0;
      if (forceCategoryCounts && forceCategoryCounts[cond.field]) {
        categoryTotal = forceCategoryCounts[cond.field];
      }
      currentValue = selectionCounts[cond.field] || categoryTotal || 0;
    }
  }
  const targetValue = cond.value;

  switch (cond.type) {
    case 'equalTo':
      return currentValue === targetValue;
    case 'lessThan':
      return currentValue < targetValue;
    case 'greaterThan':
      return currentValue > targetValue;
    case 'notEqualTo':
      return currentValue !== targetValue;
    case 'lessThanOrEqualTo':
      return currentValue <= targetValue;
    case 'greaterThanOrEqualTo':
      return currentValue >= targetValue;
    case 'instanceOf': {
      if (!selection || !system) return false;
      const targetChildId = cond.childId;
      const checkInstance = (sel) => {
        if (!sel) return false;
        const sId = sel.selectionEntryId || sel.entryLinkId;
        if (sId === targetChildId) return true;
        
        const catId = parentCatalogueId || (roster ? roster.catalogueId : null);
        const raw = findEntryInSystem(system, sId, catId);
        const res = raw && resolveEntry(system, raw, catId);
        
        if (res) {
          if (res.targetId === targetChildId || res.id === targetChildId) return true;
          if (targetChildId === 'model' && res.type === 'model') return true;
          if (targetChildId === 'unit' && res.type === 'unit') return true;
          if (targetChildId === 'upgrade' && res.type === 'upgrade') return true;
        }
        return false;
      };
      
      if (checkInstance(selection)) return true;
      if (parentSelection && checkInstance(parentSelection)) return true;
      return false;
    }
    default:
      return false;
  }
};

export const evaluateConditionGroup = (group, ctx = {}) => {
  if (!group) return true;
  const condResults = group.conditions?.map(c => evaluateCondition(c, ctx)) || [];
  const groupResults = group.conditionGroups?.map(g => evaluateConditionGroup(g, ctx)) || [];
  
  const allResults = [...condResults, ...groupResults];
  if (allResults.length === 0) return true;

  if (group.type === 'or') {
    return allResults.some(r => r);
  } else if (group.type === 'not') {
    return !allResults.every(r => r);
  } else {
    return allResults.every(r => r);
  }
};

export const getModifiedConstraintValue = (con, modifiers, ctx = {}) => {
  let finalValue = con.value;

  const sortedModifiers = [...(modifiers || [])].sort((a, b) => {
    if (a.type === 'set' && b.type !== 'set') return -1;
    if (a.type !== 'set' && b.type === 'set') return 1;
    return 0;
  });

  sortedModifiers.forEach(mod => {
    if (mod.field !== con.id) return;

    const condsPass = mod.conditions?.every(c => evaluateCondition(c, ctx)) !== false;
    const groupsPass = mod.conditionGroups?.every(g => evaluateConditionGroup(g, ctx)) !== false;

    if (condsPass && groupsPass) {
      let modAmount = typeof mod.valueObject === 'number' ? mod.valueObject : (parseFloat(mod.value) || 0);

      if (mod.repeat) {
        let currentValue = 0;
        const { roster, selectionCounts = {}, forceCategoryCounts = {} } = ctx;
        const targetParent = ctx.parentSelection || ctx.selection;
        if (mod.repeat.scope === 'parent' && targetParent && targetParent.selections) {
          const { parentCatalogueId, system } = ctx;
          const catId = parentCatalogueId || (roster ? roster.catalogueId : null);
          const targetId = mod.repeat.childId || mod.repeat.field;

          const countMatches = (list) => (list || []).reduce((sum, s) => {
            let isMatch = false;
            const sId = s.entryLinkId || s.selectionEntryId;
            if (sId === targetId) {
              isMatch = true;
            } else if (system) {
              const raw = findEntryInSystem(system, sId, catId);
              const res = raw && resolveEntry(system, raw, catId);
              if (res && (res.targetId === targetId || res.id === targetId)) isMatch = true;
              if (targetId === 'model' && res && res.type === 'model') isMatch = true;
            }
            
            let acc = sum + (isMatch ? (s.number || 1) : 0);
            if (mod.repeat.includeChildSelections && s.selections) {
              acc += countMatches(s.selections);
            }
            return acc;
          }, 0);
          
          currentValue = countMatches(targetParent.selections);
        } else if (mod.repeat.field && mod.repeat.field.startsWith('limit::')) {
          currentValue = roster?.costLimit || 0;
        } else if (mod.repeat.childId) {
          currentValue = selectionCounts[mod.repeat.childId] || (forceCategoryCounts && forceCategoryCounts[mod.repeat.childId]) || 0;
        } else if (mod.repeat.field) {
          currentValue = selectionCounts[mod.repeat.field] || (forceCategoryCounts && forceCategoryCounts[mod.repeat.field]) || 0;
        }

        const repVal = mod.repeat.value ? (mod.repeat.roundUp ? Math.ceil(currentValue / mod.repeat.value) : Math.floor(currentValue / mod.repeat.value)) : 0;
        modAmount = modAmount * repVal * (mod.repeat.repeats || 1);
      }

      if (mod.type === 'set') {
        finalValue = modAmount;
      } else if (mod.type === 'increment') {
        finalValue += modAmount;
      } else if (mod.type === 'decrement') {
        finalValue -= modAmount;
      }
    }
  });

  return finalValue;
};
