import { getEffectiveModifiers, getModifiedConstraintValue } from './modifierEvaluator.js';
import { isSelectionEntryHidden, getEffectiveEntryCategoryLinks } from './entryVisibility.js';
import { resolveEntry } from './catalogResolver.js';
import { ConstraintKind } from '../parser/schema/battlescribeSchema.generated.js';

// Scope under which a constraint applies to the whole contingent (force).
const FORCE_SCOPE = 'force';
// Scope under which a constraint applies to the whole roster (all contingents together).
const ROSTER_SCOPE = 'roster';

/** The `min` constraint a source carries at the given scope, if any. */
function findScopedMinConstraint(source, scope) {
  return (source.constraints || []).find(
    con => con.type === ConstraintKind.MIN && con.scope === scope
  );
}

/**
 * Root selectionEntries that carry a scoped `min` constraint directly, each paired with it.
 * The raw entry is handed back so the caller evaluates the constraint against the entry's own
 * modifiers — the same object every downstream check already consumes.
 * @returns {Array<{ entry: Object, minConstraint: Object }>}
 */
function collectSelectionEntryScopedMinSelectors(catalogue, scope) {
  return (catalogue.selectionEntries || [])
    .map(entry => ({ entry, minConstraint: findScopedMinConstraint(entry, scope) }))
    .filter(candidate => candidate.minConstraint);
}

/**
 * Root entryLinks whose LINK carries a scoped `min` constraint, each paired with it. A pack
 * such as the Definitive Edition encodes a mandatory army-wide unit as a root entryLink (not a
 * selectionEntry): the duty lives in a force/roster-scoped `min` on the link, raised from 0 to 1
 * by a link modifier gated on the army variant. The constraint and the modifiers evaluated are
 * therefore the LINK's own — `getEffectiveModifiers(link)` returns exactly those, so the caller's
 * existing evaluation honours the conditional raise. The target is resolved only to borrow its
 * name when the link declares none; visibility and category resolution happen downstream, where
 * `isSelectionEntryHidden` re-resolves the link itself.
 * @returns {Array<{ entry: Object, minConstraint: Object }>}
 */
function collectEntryLinkScopedMinSelectors(system, catalogue, scope) {
  return (catalogue.entryLinks || [])
    .map(link => {
      const minConstraint = findScopedMinConstraint(link, scope);
      if (!minConstraint) return null;
      const entry = link.name ? link : { ...link, name: resolveEntry(system, link, catalogue.id)?.name };
      return { entry, minConstraint };
    })
    .filter(Boolean);
}

/**
 * The resolved target id a selector ultimately requires — its link target, or its own id for a
 * plain selectionEntry. Two selectors sharing this id are the same army-wide duty.
 */
function selectorTargetId({ entry }) {
  return entry.targetId || entry.id;
}

/**
 * Drops selectors that duplicate an earlier one's target, so a catalogue expressing the same
 * duty as both a selectionEntry and an entryLink yields a single violation (the selectionEntry
 * form, listed first, wins). In practice only one form occurs per catalogue.
 * @param {Array<{ entry: Object, minConstraint: Object }>} selectors
 */
function dedupeByTarget(selectors) {
  const seenTargets = new Set();
  return selectors.filter(selector => {
    const targetId = selectorTargetId(selector);
    if (seenTargets.has(targetId)) return false;
    seenTargets.add(targetId);
    return true;
  });
}

/**
 * Root catalogue selectors that carry a `min` constraint at the given scope — the way
 * BattleScribe encodes a mandatory army-wide choice. Both encodings are collected: a root
 * `selectionEntry` bearing the constraint directly, and a root `entryLink` bearing it on the
 * link. Each match is returned paired with its scoped min constraint. Only the catalogue's own
 * root entries and links are inspected, mirroring how the category adder reads them.
 *
 * @returns {Array<{ entry: Object, minConstraint: Object }>}
 */
function collectScopedMinSelectors(system, catalogueId, scope) {
  const catalogue = system?.catalogues?.find(c => c.id === catalogueId);
  if (!catalogue) return [];
  return dedupeByTarget([
    ...collectSelectionEntryScopedMinSelectors(catalogue, scope),
    ...collectEntryLinkScopedMinSelectors(system, catalogue, scope)
  ]);
}

/**
 * Root selectionEntries carrying a force-scoped `min` constraint — "at least one per
 * contingent" (e.g. the Vampire Counts bloodline). See {@link collectScopedMinSelectors}.
 *
 * @returns {Array<{ entry: Object, minConstraint: Object }>}
 */
export function collectForceScopedMinSelectors(system, catalogueId) {
  return collectScopedMinSelectors(system, catalogueId, FORCE_SCOPE);
}

/**
 * Root selectionEntries carrying a roster-scoped `min` constraint — "at least one per
 * roster, counted across all contingents together" (e.g. the Ogre Kingdoms "Bulls" unit).
 * See {@link collectScopedMinSelectors}.
 *
 * @returns {Array<{ entry: Object, minConstraint: Object }>}
 */
export function collectRosterScopedMinSelectors(system, catalogueId) {
  return collectScopedMinSelectors(system, catalogueId, ROSTER_SCOPE);
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
      const entryContext = { system, roster, selectionCounts, forceCategoryCounts, force, catalogueId };
      const effectiveLinks = getEffectiveEntryCategoryLinks(entry, entryContext);
      if (isReachableViaForceCategories(entry, forceDef, effectiveLinks)) return false;
      if (isSelectionEntryHidden(entry, entryContext)) return false;
      return resolveForceSelectorMinimum(entry, minConstraint, visibilityContext) > 0;
    })
    .map(({ entry }) => entry);
}
