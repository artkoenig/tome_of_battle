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
 * Locates the id of the force that contains the given selection.
 */
function findForceIdContaining(roster, selection) {
  const containsSelection = (list) => {
    if (!list) return false;
    for (const candidate of list) {
      if (candidate.id === selection.id) return true;
      if (containsSelection(candidate.selections)) return true;
    }
    return false;
  };
  return roster.forces?.find(force => containsSelection(force.selections))?.id || null;
}

/**
 * Computes a single selection node's OWN, modifier-aware costs (excluding its
 * children), multiplied by its effective count. Base costs are sourced from the
 * catalogue (`resolveEntry(entry).costs`, which includes link-level costs); the
 * stored `selection.costs` is only used as a fallback when no system/catalogue
 * entry is available. Returns a map of `{ [costTypeId]: value }`.
 */
export function getSelectionOwnCosts(selection, effectiveCount, { system = null, roster = null, currentCatalogueId = null, parentSelection = null, counts = null } = {}) {
  const entryId = selection.selectionEntryId || selection.entryLinkId;
  const entryDef = (system && entryId) ? findEntryInSystem(system, entryId, currentCatalogueId) : null;
  const resolved = entryDef ? resolveEntry(system, entryDef, currentCatalogueId) : null;

  // Catalogue is the source of truth for base costs; fall back to any stored costs.
  const baseCosts = (resolved?.costs?.length ? resolved.costs : (selection.costs || []));
  if (!baseCosts.length) return {};

  let modifiers = resolved?.modifiers || [];
  if (selection.modifiers && selection.modifiers !== resolved?.modifiers) {
    modifiers = modifiers.concat(selection.modifiers);
  }

  let ctx = null;
  if (system && roster && modifiers.length > 0) {
    const resolvedCounts = counts || computeRosterCounts(roster, system);
    const activeForceId = findForceIdContaining(roster, selection);
    const forceCategoryCounts = activeForceId ? (resolvedCounts.categoryCounts[activeForceId] || {}) : {};
    ctx = {
      roster,
      system,
      selectionCounts: resolvedCounts.selectionCounts,
      forceCategoryCounts,
      selection,
      parentSelection,
      parentCatalogueId: currentCatalogueId
    };
  }

  const ownCosts = {};
  baseCosts.forEach(cost => {
    let value = cost.value || 0;
    if (ctx) {
      value = getModifiedConstraintValue({ id: cost.typeId, value }, modifiers, ctx);
    }
    ownCosts[cost.typeId] = (ownCosts[cost.typeId] || 0) + value * effectiveCount;
  });
  return ownCosts;
}

/**
 * Recursively calculates the total cost of a selection node and all its child selections.
 */
export function getSelectionTotalCost(selection, costLimitType, parentCount = 1, system = null, roster = null, currentCatalogueId = null, parentSelection = null, counts = null) {
  const effectiveCount = (selection.number || 1) * parentCount;
  const ownCosts = getSelectionOwnCosts(selection, effectiveCount, { system, roster, currentCatalogueId, parentSelection, counts });
  let total = ownCosts[costLimitType] ?? ownCosts['pts'] ?? 0;

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

    const ownCosts = getSelectionOwnCosts(selection, effectiveCount, { system, roster, currentCatalogueId, parentSelection, counts });
    Object.entries(ownCosts).forEach(([typeId, value]) => {
      totals[typeId] = (totals[typeId] || 0) + value;
    });

    if (selection.selections) {
      selection.selections.forEach(child => {
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
    .map(ct => ({ id: ct.id, name: ct.name, total: costs?.[ct.id] || 0 }))
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
