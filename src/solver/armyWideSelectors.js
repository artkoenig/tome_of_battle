import { getEffectiveModifiers, getModifiedConstraintValue } from './modifierEvaluator.js';
import { isSelectionEntryHidden, getEffectiveEntryCategoryLinks } from './entryVisibility.js';
import { ConstraintKind } from '../parser/schema/battlescribeSchema.generated.js';

// Scope under which a constraint applies to the whole contingent (force).
const FORCE_SCOPE = 'force';

/**
 * Root selectionEntries of a catalogue that carry a force-scoped `min` constraint.
 * BattleScribe encodes an army-wide mandatory choice this way — e.g. the Vampire Counts
 * bloodline: "at least one bloodline per force". Each match is returned paired with its
 * force-scoped min constraint. Only the catalogue's own root entries are inspected,
 * mirroring how the category adder reads `catalogue.selectionEntries`.
 *
 * @returns {Array<{ entry: Object, minConstraint: Object }>}
 */
export function collectForceScopedMinSelectors(system, catalogueId) {
  const catalogue = system?.catalogues?.find(c => c.id === catalogueId);
  if (!catalogue) return [];
  return (catalogue.selectionEntries || [])
    .map(entry => ({
      entry,
      minConstraint: (entry.constraints || []).find(
        con => con.type === ConstraintKind.MIN && con.scope === FORCE_SCOPE
      )
    }))
    .filter(candidate => candidate.minConstraint);
}

/**
 * True when a selectionEntry can be reached through one of the force's category adders,
 * i.e. one of its categoryLinks targets a category the force offers. A force-scoped root
 * selector that is NOT reachable this way (e.g. an entry with no matching categoryLink)
 * needs a dedicated army-wide configurator, since no category surfaces it.
 *
 * `categoryLinks` lets the caller pass the entry's effective (post-modifier) links so a
 * modifier-recategorised entry is judged against the same categories the adder surfaces
 * it under (ADR 0003 §4); it defaults to the entry's static links.
 */
export function isReachableViaForceCategories(entry, forceDef, categoryLinks = null) {
  const forceCategoryIds = new Set((forceDef?.categoryLinks || []).map(link => link.targetId));
  return (categoryLinks || entry?.categoryLinks || []).some(link => forceCategoryIds.has(link.targetId));
}

/**
 * The effective (modifier-resolved) minimum a force-scoped min constraint requires in the
 * current roster context. Zero or negative means "not currently mandatory".
 */
export function resolveForceSelectorMinimum(entry, minConstraint, visibilityContext) {
  const { roster, selectionCounts, forceCategoryCounts, force, catalogueId } = visibilityContext;
  const ctx = { roster, system: visibilityContext.system, selectionCounts, forceCategoryCounts, force, parentCatalogueId: catalogueId };
  return getModifiedConstraintValue(minConstraint, getEffectiveModifiers(entry), ctx);
}

/**
 * Army-wide mandatory selectors that need a dedicated configurator because no force
 * category surfaces them: visible (not hidden), effectively mandatory (min > 0),
 * force-scoped root entries whose categoryLinks match none of the force's categories.
 * The common case — a selector that DOES carry a matching categoryLink, e.g. Bloodlines
 * on "Special list rules" — is excluded, because the category adder already handles it.
 *
 * @param {Object} visibilityContext - `{ system, catalogueId, forceDef, roster,
 *   selectionCounts, forceCategoryCounts, force }`.
 * @returns {Object[]} the root selectionEntry definitions to offer.
 */
export function collectUnreachableArmyWideSelectors(visibilityContext) {
  const { system, catalogueId, forceDef, roster, selectionCounts, forceCategoryCounts, force } = visibilityContext;
  return collectForceScopedMinSelectors(system, catalogueId)
    .filter(({ entry, minConstraint }) => {
      const effectiveLinks = getEffectiveEntryCategoryLinks(entry, { system, roster, selectionCounts, forceCategoryCounts, force });
      if (isReachableViaForceCategories(entry, forceDef, effectiveLinks)) return false;
      if (isSelectionEntryHidden(entry, { system, roster, selectionCounts, forceCategoryCounts, force })) return false;
      return resolveForceSelectorMinimum(entry, minConstraint, visibilityContext) > 0;
    })
    .map(({ entry }) => entry);
}
