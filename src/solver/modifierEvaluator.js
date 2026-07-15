import { findEntryInSystem, resolveEntry } from './catalogResolver.js';

// A resolved entry belongs to a category when one of its categoryLinks targets it.
const entryHasCategoryLink = (resolvedEntry, categoryId) =>
  !!resolvedEntry?.categoryLinks?.some(cl => cl.targetId === categoryId || cl.id === categoryId);

const selectionHasCategory = (sel, categoryId, system, catalogueId) => {
  if (!sel) return false;
  const sId = sel.selectionEntryId || sel.entryLinkId;
  if (sId === categoryId) return true;

  const raw = findEntryInSystem(system, sId, catalogueId);
  const res = raw && resolveEntry(system, raw, catalogueId);
  if (res) {
    if (res.id === categoryId || res.targetId === categoryId) return true;
    if (entryHasCategoryLink(res, categoryId)) return true;
  }
  
  if (sel.selections && sel.selections.length > 0) {
    for (const sub of sel.selections) {
      if (selectionHasCategory(sub, categoryId, system, catalogueId)) {
        return true;
      }
    }
  }
  return false;
};

export const evaluateCondition = (cond, ctx = {}) => {
  if (!cond) return false;
  const { roster, selectionCounts = {}, forceCategoryCounts = {}, selection, parentSelection, system, parentCatalogueId } = ctx;
  let currentValue = 0;
  
  if (cond.field && cond.field.startsWith('limit::')) {
    currentValue = roster?.costLimit || 0;
  } else if (cond.field) {
    // For parent-scoped conditions the "parent" is the selection that holds the
    // group items. That is `parentSelection` when we descend into a child, but on a
    // top-level unit (validator: selection=unit, parentSelection=null) the unit
    // itself is the container — mirror the same fallback the repeat logic uses so
    // e.g. "you may take more than one Dispel Scroll" also resolves during
    // roster validation, not just in the editor UI.
    const parentScopeTarget = parentSelection || selection;
    if (cond.scope === 'parent' && parentScopeTarget && parentScopeTarget.selections) {
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
          // childId may reference a category (e.g. a bloodline): count selections
          // that belong to that category, not only those whose entry id matches.
          if (res && entryHasCategoryLink(res, targetId)) isMatch = true;
          if (targetId === 'model' && res && (res.type === 'model' || res.type === 'unit')) isMatch = true;
        }

        let acc = sum + (isMatch ? (s.number || 1) : 0);
        if (cond.includeChildSelections && s.selections) {
          acc += countMatches(s.selections);
        }
        return acc;
      }, 0);

      currentValue = countMatches(parentScopeTarget.selections);
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
    case 'atLeast':
    case 'greaterThanOrEqualTo':
      return currentValue >= targetValue;
    case 'atMost':
    case 'lessThanOrEqualTo':
      return currentValue <= targetValue;
    case 'instanceOf':
    case 'notInstanceOf': {
      const isNegated = cond.type === 'notInstanceOf';
      const forceEntryId = cond.scope || cond.childId;
      if (system && forceEntryId) {
        const findForceEntryInSystemLocal = (sys, id) => {
          if (!sys || !id) return null;
          const findInList = (list, targetId) => {
            for (const fe of list) {
              if (fe.id === targetId) return fe;
              if (fe.forceEntries) {
                const sub = findInList(fe.forceEntries, targetId);
                if (sub) return sub;
              }
            }
            return null;
          };
          if (sys.forceEntries) {
            const found = findInList(sys.forceEntries, id);
            if (found) return found;
          }
          if (sys.catalogues) {
            for (const cat of sys.catalogues) {
              if (cat.forceEntries) {
                const found = findInList(cat.forceEntries, id);
                if (found) return found;
              }
            }
          }
          return null;
        };

        const isForce = findForceEntryInSystemLocal(system, forceEntryId);
        if (isForce) {
          const isInstance = (ctx.force?.forceEntryId === forceEntryId) || 
                             (roster?.forces?.some(f => f.forceEntryId === forceEntryId));
          const raw = cond.value === 0 ? !isInstance : isInstance;
          return isNegated ? !raw : raw;
        }
      }

      if (!selection || !system) return isNegated;
      const targetChildId = cond.childId;
      const checkInstance = (sel) => {
        if (!sel) return false;
        const sId = sel.selectionEntryId || sel.entryLinkId;
        if (sId === targetChildId) return true;
        
        const catId = parentCatalogueId || (roster ? roster.catalogueId : null);
        const raw = findEntryInSystem(system, sId, catId);
        const res = raw && resolveEntry(system, raw, catId);
        
        if (res) {
          if (cond.scope && cond.scope !== 'parent' && cond.scope !== 'force' && cond.scope !== 'roster') {
            const hasCat = selectionHasCategory(sel, cond.scope, system, catId);
            if (!hasCat) return false;
          }
          if (res.targetId === targetChildId || res.id === targetChildId) return true;
          if (targetChildId === 'model' && (res.type === 'model' || res.type === 'unit')) return true;
          if (targetChildId === 'unit' && res.type === 'unit') return true;
          if (targetChildId === 'upgrade' && res.type === 'upgrade') return true;
        }
        return false;
      };
      
      if (checkInstance(selection)) return !isNegated;
      if (parentSelection && checkInstance(parentSelection)) return !isNegated;
      return isNegated;
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
