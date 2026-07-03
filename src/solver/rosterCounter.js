import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { getModifiedConstraintValue } from './modifierEvaluator.js';

/**
 * Recursively computes the display cost of an option definition, including its base cost
 * and the costs of any mandatory sub-selections (min > 0).
 */
export function getOptionDisplayCost(system, entry, costLimitType, ctx = {}) {
  let resolved = resolveEntry(system, entry);
  if (!resolved) return 0;

  // If resolved is a skeleton or reference, look up the full entry in the system
  if (resolved.id && (!resolved.costs || resolved.costs.length === 0) && (!resolved.selectionEntries || resolved.selectionEntries.length === 0) && (!resolved.entryLinks || resolved.entryLinks.length === 0) && (!resolved.selectionEntryGroups || resolved.selectionEntryGroups.length === 0)) {
    const fullEntry = findEntryInSystem(system, resolved.id);
    if (fullEntry) {
      resolved = resolveEntry(system, fullEntry);
    }
  }

  let total = 0;
  
  // 1. Direct cost of this entry
  let directCost = resolved.costs?.find(c => c.typeId === costLimitType || c.typeId === 'pts')?.value || 0;

  // Apply cost modifiers if any
  const costType = resolved.costs?.find(c => c.typeId === costLimitType || c.typeId === 'pts');
  let modifiers = resolved.modifiers || [];
  if (entry.modifiers && entry.modifiers !== resolved.modifiers) {
    modifiers = modifiers.concat(entry.modifiers);
  }
  if (costType && modifiers.length > 0 && ctx && Object.keys(ctx).length > 0) {
    const tempCon = { id: costType.typeId, value: directCost };
    directCost = getModifiedConstraintValue(tempCon, modifiers, ctx);
  }

  total += directCost;

  // 2. Direct costs of mandatory child selection entries
  resolved.selectionEntries?.forEach(child => {
    const minCon = child.constraints?.find(c => c.type === 'min')?.value || 0;
    if (minCon > 0) {
      total += getOptionDisplayCost(system, child, costLimitType, ctx) * minCon;
    }
  });

  // 3. Direct costs of mandatory child entry links
  resolved.entryLinks?.forEach(child => {
    const minCon = child.constraints?.find(c => c.type === 'min')?.value || 0;
    if (minCon > 0) {
      total += getOptionDisplayCost(system, child, costLimitType, ctx) * minCon;
    }
  });

  // 4. Direct costs of mandatory groups
  resolved.selectionEntryGroups?.forEach(group => {
    const minCon = group.constraints?.find(c => c.type === 'min')?.value || 0;
    if (minCon > 0 && (group.selectionEntries?.length > 0 || group.entryLinks?.length > 0)) {
      const firstOption = group.selectionEntries?.[0] || group.entryLinks?.[0];
      total += getOptionDisplayCost(system, firstOption, costLimitType, ctx) * minCon;
    }
  });

  return total;
}

/**
 * Recursively calculates the total cost of a selection node and all its child selections.
 */
export function getSelectionTotalCost(selection, costLimitType, parentCount = 1, system = null, roster = null, currentCatalogueId = null, parentSelection = null, counts = null) {
  let total = 0;
  const effectiveCount = (selection.number || 1) * parentCount;
  if (selection.costs) {
    const cost = selection.costs.find(c => c.typeId === costLimitType || c.typeId === 'pts');
    if (cost) {
      let costValue = cost.value || 0;
      if (system && roster) {
        const entryId = selection.selectionEntryId || selection.entryLinkId;
        const entryDef = entryId ? findEntryInSystem(system, entryId, currentCatalogueId) : null;
        const resolved = entryDef ? resolveEntry(system, entryDef, currentCatalogueId) : null;
        let modifiers = resolved?.modifiers || [];
        if (selection.modifiers && selection.modifiers !== resolved?.modifiers) {
          modifiers = modifiers.concat(selection.modifiers);
        }
        
        if (modifiers.length > 0) {
          const { selectionCounts, categoryCounts } = counts || computeRosterCounts(roster, system);
          const activeForceId = roster.forces ? roster.forces.find(force => {
            const containsSel = (list) => {
              if (!list) return false;
              for (const s of list) {
                if (s.id === selection.id) return true;
                if (containsSel(s.selections)) return true;
              }
              return false;
            };
            return containsSel(force.selections);
          })?.id : null;
          const forceCategoryCounts = activeForceId ? (categoryCounts[activeForceId] || {}) : {};

          const ctx = {
            roster,
            system,
            selectionCounts,
            forceCategoryCounts,
            selection,
            parentSelection,
            parentCatalogueId: currentCatalogueId
          };

          const tempCon = { id: cost.typeId, value: costValue };
          costValue = getModifiedConstraintValue(tempCon, modifiers, ctx);
        }
      }
      total += costValue * effectiveCount;
    }
  }
  if (selection.selections) {
    selection.selections.forEach(child => {
      total += getSelectionTotalCost(child, costLimitType, effectiveCount, system, roster, currentCatalogueId, selection, counts);
    });
  }
  return total;
}

/**
 * Traverses a roster's nested selections and computes total costs,
 * returning flat stats and a resolved points total.
 */
export function calculateRosterCosts(roster, system) {
  const totals = {};
  
  // Initialize cost types from system
  if (system && system.costTypes) {
    system.costTypes.forEach(ct => {
      totals[ct.id] = 0;
    });
  }

  const counts = (roster && system) ? computeRosterCounts(roster, system) : null;

  const addSelectionCosts = (selection, parentCount = 1, currentCatalogueId = null, parentSelection = null) => {
    const effectiveCount = (selection.number || 1) * parentCount;
    // A selection has a list of costs (usually parsed from its template)
    if (selection.costs) {
      selection.costs.forEach(cost => {
        let costValue = cost.value || 0;

        if (system && roster && counts) {
          const entryId = selection.selectionEntryId || selection.entryLinkId;
          const entryDef = entryId ? findEntryInSystem(system, entryId, currentCatalogueId) : null;
          const resolved = entryDef ? resolveEntry(system, entryDef, currentCatalogueId) : null;
          let modifiers = resolved?.modifiers || [];
          if (selection.modifiers && selection.modifiers !== resolved?.modifiers) {
            modifiers = modifiers.concat(selection.modifiers);
          }
          if (modifiers.length > 0) {
            const activeForceId = roster.forces ? roster.forces.find(force => {
              const containsSel = (list) => {
                if (!list) return false;
                for (const s of list) {
                  if (s.id === selection.id) return true;
                  if (containsSel(s.selections)) return true;
                }
                return false;
              };
              return containsSel(force.selections);
            })?.id : null;
            const forceCategoryCounts = activeForceId ? (counts.categoryCounts[activeForceId] || {}) : {};

            const ctx = {
              roster,
              system,
              selectionCounts: counts.selectionCounts,
              forceCategoryCounts,
              selection,
              parentSelection,
              parentCatalogueId: currentCatalogueId
            };

            const tempCon = { id: cost.typeId, value: costValue };
            costValue = getModifiedConstraintValue(tempCon, modifiers, ctx);
          }
        }

        const val = costValue * effectiveCount;
        totals[cost.typeId] = (totals[cost.typeId] || 0) + val;
      });
    }

    // Traverse children
    if (selection.selections) {
      selection.selections.forEach(child => {
        // Multiply child costs by parent's count if collective is false,
        // but typically in BS child selection count stands on its own.
        addSelectionCosts(child, effectiveCount, currentCatalogueId, selection);
      });
    }
  };

  if (roster && roster.forces) {
    roster.forces.forEach(force => {
      const currentCatalogueId = force.catalogueId || roster.catalogueId;
      if (force.selections) {
        force.selections.forEach(sel => addSelectionCosts(sel, 1, currentCatalogueId, null));
      }
    });
  }

  return totals;
}

/**
 * Non-primary cost types (e.g. "Casting Dice"/"Dispel Dice") that carry a nonzero
 * total in the given roster's already-computed cost totals.
 */
export function getExtraResourceTotals(system, roster, costs) {
  if (!system?.costTypes || !roster) return [];
  return system.costTypes
    .filter(ct => ct.id !== roster.costLimitType)
    .map(ct => ({ id: ct.id, name: ct.name.trim(), total: costs?.[ct.id] || 0 }))
    .filter(ct => ct.total > 0);
}

export const computeRosterCounts = (roster, system) => {
  const selectionCounts = {};
  const forceSelectionCounts = {};
  const categoryCounts = {};

  const countSelection = (selection, forceId, forceCatalogueId, parentCount = 1, isRoot = false) => {
    const effectiveCount = (selection.number || 1) * parentCount;
    const entryId = selection.entryLinkId || selection.selectionEntryId;
    
    if (!forceSelectionCounts[forceId]) {
      forceSelectionCounts[forceId] = {};
    }

    if (entryId) {
      selectionCounts[entryId] = (selectionCounts[entryId] || 0) + effectiveCount;
      forceSelectionCounts[forceId][entryId] = (forceSelectionCounts[forceId][entryId] || 0) + effectiveCount;
    }

    if (!categoryCounts[forceId]) {
      categoryCounts[forceId] = {};
    }

    const entryDef = findEntryInSystem(system, entryId, forceCatalogueId);
    
    if (entryDef) {
      const resolved = resolveEntry(system, entryDef, forceCatalogueId);
      if (resolved && resolved.targetId && resolved.targetId !== entryId) {
        selectionCounts[resolved.targetId] = (selectionCounts[resolved.targetId] || 0) + effectiveCount;
        forceSelectionCounts[forceId][resolved.targetId] = (forceSelectionCounts[forceId][resolved.targetId] || 0) + effectiveCount;
      }
      
      const seenCategories = new Set();
      resolved?.categoryLinks?.forEach(cl => {
        // Skip primary category links for nested (non-root) selections
        if (cl.primary && !isRoot) {
          return;
        }
        if (cl.targetId && !seenCategories.has(cl.targetId)) {
          seenCategories.add(cl.targetId);
          categoryCounts[forceId][cl.targetId] = (categoryCounts[forceId][cl.targetId] || 0) + effectiveCount;
          selectionCounts[cl.targetId] = (selectionCounts[cl.targetId] || 0) + effectiveCount;
        }
      });
    }

    if (selection.category && isRoot) {
      const hasCat = entryDef?.categoryLinks?.some(cl => cl.targetId === selection.category);
      if (!hasCat) {
        categoryCounts[forceId][selection.category] = (categoryCounts[forceId][selection.category] || 0) + effectiveCount;
        selectionCounts[selection.category] = (selectionCounts[selection.category] || 0) + effectiveCount;
      }
    }

    if (selection.selections) {
      selection.selections.forEach(child => countSelection(child, forceId, forceCatalogueId, effectiveCount, false));
    }
  };

  if (roster && roster.forces) {
    roster.forces.forEach(force => {
      if (force.selections) {
        force.selections.forEach(sel => countSelection(sel, force.id, force.catalogueId, 1, true));
      }
    });
  }

  return { selectionCounts, forceSelectionCounts, categoryCounts };
};
