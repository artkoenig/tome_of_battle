import { findEntryInSystem, resolveEntry } from './catalogResolver.js';

/**
 * Recursively computes the display cost of an option definition, including its base cost
 * and the costs of any mandatory sub-selections (min > 0).
 */
export function getOptionDisplayCost(system, entry, costLimitType) {
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
  const directCost = resolved.costs?.find(c => c.typeId === costLimitType || c.typeId === 'pts')?.value || 0;
  total += directCost;

  // 2. Direct costs of mandatory child selection entries
  resolved.selectionEntries?.forEach(child => {
    const minCon = child.constraints?.find(c => c.type === 'min')?.value || 0;
    if (minCon > 0) {
      total += getOptionDisplayCost(system, child, costLimitType) * minCon;
    }
  });

  // 3. Direct costs of mandatory child entry links
  resolved.entryLinks?.forEach(child => {
    const minCon = child.constraints?.find(c => c.type === 'min')?.value || 0;
    if (minCon > 0) {
      total += getOptionDisplayCost(system, child, costLimitType) * minCon;
    }
  });

  // 4. Direct costs of mandatory groups
  resolved.selectionEntryGroups?.forEach(group => {
    const minCon = group.constraints?.find(c => c.type === 'min')?.value || 0;
    if (minCon > 0 && (group.selectionEntries?.length > 0 || group.entryLinks?.length > 0)) {
      const firstOption = group.selectionEntries?.[0] || group.entryLinks?.[0];
      total += getOptionDisplayCost(system, firstOption, costLimitType) * minCon;
    }
  });

  return total;
}

/**
 * Recursively calculates the total cost of a selection node and all its child selections.
 */
export function getSelectionTotalCost(selection, costLimitType, parentCount = 1) {
  let total = 0;
  const effectiveCount = (selection.number || 1) * (selection.collective ? parentCount : 1);
  if (selection.costs) {
    const cost = selection.costs.find(c => c.typeId === costLimitType || c.typeId === 'pts');
    if (cost) {
      total += (cost.value || 0) * effectiveCount;
    }
  }
  if (selection.selections) {
    selection.selections.forEach(child => {
      total += getSelectionTotalCost(child, costLimitType, effectiveCount);
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

  const addSelectionCosts = (selection, parentCount = 1) => {
    const effectiveCount = (selection.number || 1) * (selection.collective ? parentCount : 1);
    // A selection has a list of costs (usually parsed from its template)
    if (selection.costs) {
      selection.costs.forEach(cost => {
        const val = (cost.value || 0) * effectiveCount;
        totals[cost.typeId] = (totals[cost.typeId] || 0) + val;
      });
    }

    // Traverse children
    if (selection.selections) {
      selection.selections.forEach(child => {
        // Multiply child costs by parent's count if collective is false,
        // but typically in BS child selection count stands on its own.
        addSelectionCosts(child, effectiveCount);
      });
    }
  };

  if (roster && roster.forces) {
    roster.forces.forEach(force => {
      if (force.selections) {
        force.selections.forEach(sel => addSelectionCosts(sel));
      }
    });
  }

  return totals;
}

export const computeRosterCounts = (roster, system) => {
  const selectionCounts = {};
  const forceSelectionCounts = {};
  const categoryCounts = {};

  const countSelection = (selection, forceId, forceCatalogueId, parentCount = 1, isRoot = false) => {
    const effectiveCount = (selection.number || 1) * (selection.collective ? parentCount : 1);
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

          // Replaced hardcoded string matching for 'hero extra cost' etc.
        }
      });
    }

    if (selection.category && isRoot) {
      const hasCat = entryDef?.categoryLinks?.some(cl => cl.targetId === selection.category);
      if (!hasCat) {
        categoryCounts[forceId][selection.category] = (categoryCounts[forceId][selection.category] || 0) + effectiveCount;
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
