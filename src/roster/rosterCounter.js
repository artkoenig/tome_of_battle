import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import {
  getModifiedConstraintValue, getEffectiveModifiers, getEffectiveCategoryLinks
} from './modifierEvaluator.js';
import { childSelectionsOf, effectiveCountOf, foldSelectionTree, someSelection, traverseSelectionTree } from './rosterTree.js';
import { buildModifierEvalContext } from './modifierContext.js';

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
    ctx = buildModifierEvalContext({
      roster,
      system,
      categorySlices: {
        selectionCounts: resolvedCounts.selectionCounts,
        forceCategoryCounts
      },
      selection,
      parentSelection,
      parentCatalogueId: currentCatalogueId
    });
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

export const computeRosterCounts = (roster, system) => {
  /** @type {Record<string, number>} */
  const selectionCounts = {};
  /** @type {Record<string, Record<string, number>>} */
  const forceSelectionCounts = {};
  /** @type {Record<string, Record<string, number>>} */
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
      // Wörtliche Scheiben mitten im Zähl-Lauf: die noch veränderlichen Tabellen
      // werden als Referenz weitergereicht, nicht kopiert.
      const categoryCtx = buildModifierEvalContext({
        roster,
        system,
        selection,
        parentSelection,
        parentCatalogueId: forceCatalogueId,
        categorySlices: {
          selectionCounts,
          forceCategoryCounts: categoryCounts[forceId]
        }
      });
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

/**
 * Flattens the per-force category counts (`{ [forceId]: { [categoryId]: n } }`) into one
 * roster-wide tally (`{ [categoryId]: n }`), **summing** a category that appears in more
 * than one contingent rather than letting the last force overwrite the earlier ones. The
 * single source of truth for a roster-wide category total: every caller that needs a
 * `forceCategoryCounts` map spanning the whole roster (profile stats, mandatory-selector
 * checks, author-message and constraint evaluation, the recruit factory) goes through here.
 * @param {Record<string, Record<string, number>>} categoryCounts
 * @returns {Record<string, number>}
 */
export const aggregateRosterCategoryCounts = (categoryCounts) => {
  /** @type {Record<string, number>} */
  const rosterWide = {};
  for (const perForce of Object.values(categoryCounts || {})) {
    for (const [categoryId, count] of Object.entries(perForce)) {
      rosterWide[categoryId] = (rosterWide[categoryId] || 0) + count;
    }
  }
  return rosterWide;
};
