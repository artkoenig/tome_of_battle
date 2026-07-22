import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import {
  getModifiedConstraintValue, getEffectiveModifiers, getEffectiveCategoryLinks,
  resolveContextCatalogueId
} from './modifierEvaluator.js';
import { childSelectionsOf, effectiveCountOf, foldSelectionTree, someSelection, traverseSelectionTree } from './rosterTree.js';
import { ConstraintKind } from '../parser/schema/battlescribeSchema.generated.js';
import { resolveGroupDefaultMember } from './selectionMembers.js';

/**
 * The multiplier applied to a top-level (subject) selection when its cost is
 * summed on its own — it has no counted parent, so its parent count is one.
 */
export const TOP_LEVEL_PARENT_COUNT = 1;

/**
 * The id of the cost type a roster is measured in.
 *
 * `cost/@typeId` always references `costType/@id`, never `costType/@name`, and
 * that id is chosen freely by the catalogue author (GUIDs in the WHFB6 fork,
 * `points` in wh40k-9e). No id is reserved for points, so none may be assumed:
 * the roster's own setting is the source of truth, and the only defensible
 * substitute is the first cost type the game system declares.
 *
 * @returns {string|null} the cost-type id, or null if the system declares none
 */
export function resolveCostLimitTypeId(roster, system) {
  return roster?.costLimitType ?? system?.costTypes?.[0]?.id ?? null;
}

/**
 * The display name of a cost type, taken verbatim from the game system's
 * declaration. This is the single derivation "cost-type id → label"; nothing
 * else in the application may name a cost type.
 *
 * Catalogue authors pad these names with a leading space (`" Casting Dice"`,
 * `" Dispel Dice"`, `" PL"` in wh40k-9e), so trimming is the *only* alteration
 * made: the name is never translated, abbreviated or otherwise normalised.
 *
 * @returns {string} the trimmed name, or '' if the system declares no such type
 */
export function resolveCostTypeLabel(system, costTypeId) {
  const costType = system?.costTypes?.find(candidate => candidate.id === costTypeId);
  return costType?.name?.trim() ?? '';
}

/** The display name of the cost type a roster is measured in. */
export function resolveCostLimitLabel(roster, system) {
  return resolveCostTypeLabel(system, resolveCostLimitTypeId(roster, system));
}

/**
 * @typedef {Object} EvaluationContext
 * The roster-wide state a cost/modifier evaluation needs, threaded as one object
 * instead of as separate positional arguments (matches getSelectionOwnCosts).
 * @property {Object|null} [system] resolved game system
 * @property {Object|null} [roster] the roster being evaluated
 * @property {string|null} [currentCatalogueId] catalogue the selection belongs to
 * @property {Object|null} [parentSelection] the selection's parent, for conditions
 * @property {Object|null} [counts] pre-computed roster counts (computeRosterCounts)
 */

/**
 * Recursively computes the display cost of an option definition, including its base cost
 * and the costs of any mandatory sub-selections (min > 0).
 *
 * `ctx` supplies the catalogue the entry was read from (see `resolveContextCatalogueId`);
 * without it the same-id entry of another loaded catalogue could be priced instead
 * (ADR 0018).
 */
export function getOptionDisplayCost(system, entry, costLimitType, ctx = {}) {
  const catalogueId = resolveContextCatalogueId(ctx);
  let resolved = resolveEntry(system, entry, catalogueId);
  if (!resolved) return 0;

  // If resolved is a skeleton or reference, look up the full entry in the system
  if (resolved.id && (!resolved.costs || resolved.costs.length === 0) && (!resolved.selectionEntries || resolved.selectionEntries.length === 0) && (!resolved.entryLinks || resolved.entryLinks.length === 0) && (!resolved.selectionEntryGroups || resolved.selectionEntryGroups.length === 0)) {
    const fullEntry = findEntryInSystem(system, resolved.id, catalogueId);
    if (fullEntry) {
      resolved = resolveEntry(system, fullEntry, catalogueId);
    }
  }

  let total = 0;

  // 1. Direct cost of this entry, in the requested cost type only. An entry that
  // carries no cost of that type contributes 0 — never the value of another type.
  const costOfLimitType = resolved.costs?.find(c => c.typeId === costLimitType);
  let directCost = costOfLimitType?.value || 0;

  // Apply cost modifiers if any
  let modifiers = getEffectiveModifiers(resolved);
  if (entry.modifiers !== resolved.modifiers || entry.modifierGroups !== resolved.modifierGroups) {
    modifiers = modifiers.concat(getEffectiveModifiers(entry));
  }
  if (costOfLimitType && modifiers.length > 0 && ctx && Object.keys(ctx).length > 0) {
    const tempCon = { id: costOfLimitType.typeId, value: directCost };
    directCost = getModifiedConstraintValue(tempCon, modifiers, ctx);
  }

  total += directCost;

  // The mandatory-child minimums below are read as their EFFECTIVE (modifier-adjusted)
  // value in `ctx`, so a conditionally-raised `min` — a pick a modifier forces — is
  // priced exactly as the selection factory will populate it.
  const effectiveMin = (source) => {
    const minConstraint = source.constraints?.find(c => c.type === ConstraintKind.MIN);
    if (!minConstraint) return 0;
    const value = getModifiedConstraintValue(minConstraint, getEffectiveModifiers(source), ctx);
    return value > 0 ? value : 0;
  };

  // 2. Direct costs of mandatory child selection entries
  resolved.selectionEntries?.forEach(child => {
    const minCon = effectiveMin(child);
    if (minCon > 0) {
      total += getOptionDisplayCost(system, child, costLimitType, ctx) * minCon;
    }
  });

  // 3. Direct costs of mandatory child entry links
  resolved.entryLinks?.forEach(child => {
    const minCon = effectiveMin(child);
    if (minCon > 0) {
      total += getOptionDisplayCost(system, child, costLimitType, ctx) * minCon;
    }
  });

  // 4. Direct costs of mandatory groups. Which option a group contributes is
  // decided by the shared derivation the selection factory uses, so the price
  // shown here is the price the actual recruitment will incur.
  resolved.selectionEntryGroups?.forEach(group => {
    const minCon = effectiveMin(group);
    if (minCon <= 0) return;
    const defaultOption = resolveGroupDefaultMember(group);
    if (!defaultOption) return;
    total += getOptionDisplayCost(system, defaultOption, costLimitType, ctx) * minCon;
  });

  return total;
}

/**
 * Locates the id of the force that contains the given selection.
 */
function findForceIdContaining(roster, selection) {
  const isSearchedSelection = candidate => candidate.id === selection.id;
  return roster.forces?.find(
    force => someSelection(childSelectionsOf(force), isSearchedSelection)
  )?.id || null;
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

  // Group modifiers carry their group conditions, so downstream gating applies them.
  let modifiers = getEffectiveModifiers(resolved);
  if (selection.modifiers !== resolved?.modifiers || selection.modifierGroups !== resolved?.modifierGroups) {
    modifiers = modifiers.concat(getEffectiveModifiers(selection));
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
 * Recursively calculates the total cost of a selection node and all its child
 * selections. The roster-wide state travels as one {@link EvaluationContext}
 * object rather than as a long tail of positional arguments.
 * @param {Object} selection
 * @param {string} costLimitType
 * @param {number} [parentCount]
 * @param {EvaluationContext} [context]
 */
export function getSelectionTotalCost(selection, costLimitType, parentCount = TOP_LEVEL_PARENT_COUNT, context = {}) {
  return foldSelectionTree(selection, {
    descend: (node, { parentCount: count, evaluationContext }) => ({
      parentCount: effectiveCountOf(node, count),
      evaluationContext: { ...evaluationContext, parentSelection: node }
    }),
    combine: (node, { parentCount: count, evaluationContext }, childTotals) => {
      const ownCosts = getSelectionOwnCosts(node, effectiveCountOf(node, count), evaluationContext);
      const ownTotal = ownCosts[costLimitType] ?? 0;
      return childTotals.reduce((sum, childTotal) => sum + childTotal, ownTotal);
    }
  }, { parentCount, evaluationContext: context });
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

  const addSelectionCosts = (selection, { parentCount, parentSelection }, currentCatalogueId) => {
    const effectiveCount = effectiveCountOf(selection, parentCount);

    const ownCosts = getSelectionOwnCosts(selection, effectiveCount, { system, roster, currentCatalogueId, parentSelection, counts });
    Object.entries(ownCosts).forEach(([typeId, value]) => {
      totals[typeId] = (totals[typeId] || 0) + value;
    });

    return { parentCount: effectiveCount, parentSelection: selection };
  };

  (roster?.forces ?? []).forEach(force => {
    const currentCatalogueId = force.catalogueId || roster.catalogueId;
    traverseSelectionTree(
      childSelectionsOf(force),
      (selection, context) => addSelectionCosts(selection, context, currentCatalogueId),
      { parentCount: TOP_LEVEL_PARENT_COUNT, parentSelection: null }
    );
  });

  return totals;
}

/**
 * Non-primary cost types (e.g. "Casting Dice"/"Dispel Dice") that carry a nonzero
 * total in the given roster's already-computed cost totals. Cost types flagged
 * `hidden` in the game system are never surfaced, per the BattleScribe schema.
 */
export function getExtraResourceTotals(system, roster, costs) {
  if (!system?.costTypes || !roster) return [];
  return system.costTypes
    .filter(ct => ct.id !== roster.costLimitType)
    .filter(ct => !ct.hidden)
    .map(ct => ({ id: ct.id, name: ct.name, total: costs?.[ct.id] || 0 }))
    .filter(ct => ct.total > 0);
}

export const computeRosterCounts = (roster, system) => {
  const selectionCounts = {};
  const forceSelectionCounts = {};
  const categoryCounts = {};

  const countSelection = (selection, { parentCount, isRoot, parentSelection }, force) => {
    const forceId = force.id;
    const forceCatalogueId = force.catalogueId;
    const effectiveCount = effectiveCountOf(selection, parentCount);
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

    // Tracks which category ids this selection has already been counted under,
    // so the roster-stored fallback below never re-counts a category the
    // catalogue-driven resolution already covered (see the fallback's own
    // comment for why that distinction matters).
    const seenCategories = new Set();

    if (entryDef) {
      const resolved = resolveEntry(system, entryDef, forceCatalogueId);
      if (resolved && resolved.targetId && resolved.targetId !== entryId) {
        selectionCounts[resolved.targetId] = (selectionCounts[resolved.targetId] || 0) + effectiveCount;
        forceSelectionCounts[forceId][resolved.targetId] = (forceSelectionCounts[forceId][resolved.targetId] || 0) + effectiveCount;
      }

      // Category membership can be changed conditionally by add/remove/set-primary/
      // unset-primary modifiers, so resolve the effective links (gated on the same
      // conditions) before counting rather than reading the static catalogue links.
      const categoryCtx = {
        roster,
        system,
        selection,
        parentSelection,
        parentCatalogueId: forceCatalogueId,
        selectionCounts,
        forceCategoryCounts: categoryCounts[forceId]
      };
      const effectiveModifiers = getEffectiveModifiers(resolved);
      const effectiveCategoryLinks = getEffectiveCategoryLinks(resolved?.categoryLinks, effectiveModifiers, categoryCtx);

      effectiveCategoryLinks.forEach(cl => {
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

    // Fallback for a selection whose catalogue entry no longer resolves at all
    // (a since-deleted or since-relinked entry): fall back to the category the
    // roster itself recorded at export time. Guarded by `seenCategories` rather
    // than `entryDef`'s own static categoryLinks — an entry reached via an
    // entryLink carries no categoryLinks of its own (its category lives on the
    // link's target, or is assigned dynamically by a modifier), so checking the
    // unresolved entryDef would double-count a category the block above already
    // counted through the effective/resolved links.
    if (selection.category && isRoot && !seenCategories.has(selection.category)) {
      categoryCounts[forceId][selection.category] = (categoryCounts[forceId][selection.category] || 0) + effectiveCount;
      selectionCounts[selection.category] = (selectionCounts[selection.category] || 0) + effectiveCount;
    }

    return { parentCount: effectiveCount, isRoot: false, parentSelection: selection };
  };

  (roster?.forces ?? []).forEach(force => {
    traverseSelectionTree(
      childSelectionsOf(force),
      (selection, context) => countSelection(selection, context, force),
      { parentCount: TOP_LEVEL_PARENT_COUNT, isRoot: true, parentSelection: null }
    );
  });

  return { selectionCounts, forceSelectionCounts, categoryCounts };
};
