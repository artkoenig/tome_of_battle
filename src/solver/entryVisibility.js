import { resolveEntry } from './catalogResolver.js';
import { evaluateCondition, evaluateConditionGroup, getEffectiveModifiers, getEffectiveCategoryLinks } from './modifierEvaluator.js';

/**
 * Wertet den effektiven hidden-Status eines Elements aus: statisches
 * hidden-Attribut plus alle `field="hidden"`-Modifier, deren Bedingungen
 * im gegebenen Kontext erfüllt sind.
 */
export function evaluateHiddenFlag(initialHidden, modifiers, ctx) {
  let isHidden = initialHidden === true;
  (modifiers || []).forEach(mod => {
    if (mod.field !== 'hidden') return;
    const condsPass = mod.conditions?.every(c => evaluateCondition(c, ctx)) !== false;
    const groupsPass = mod.conditionGroups?.every(g => evaluateConditionGroup(g, ctx)) !== false;
    if (condsPass && groupsPass && mod.type === 'set') {
      isHidden = mod.value === 'true' || mod.value === true || mod.valueObject === true;
    }
  });
  return isHidden;
}

export function isCategoryLinkHidden(link, system, roster, selectionCounts, forceCategoryCounts) {
  const ctx = {
    roster,
    system,
    selectionCounts,
    forceCategoryCounts,
    parentCatalogueId: roster?.catalogueId
  };
  // Resolve through the shared seam so modifierGroup-gated hidden modifiers on the
  // category link are honoured, matching isSelectionEntryHidden below.
  return evaluateHiddenFlag(link.hidden, getEffectiveModifiers(link), ctx);
}

/**
 * @typedef {Object} VisibilityContext The roster/force bundle every entry-level
 *   visibility and category check evaluates against. Mirrors the context object the
 *   rest of the solver already threads (see optionsCollector / armyWideSelectors).
 * @property {Object} system   the parsed game system (gst + catalogues).
 * @property {Object} roster   the current roster.
 * @property {Object} [selectionCounts]      per-entry selection counts.
 * @property {Object} [forceCategoryCounts]  per-force category counts.
 * @property {Object} [force]  the force being evaluated; defaults to the first force.
 */

// The condition-evaluation context every helper below shares: the caller's bundle plus
// the force fallback and the catalogue id conditions resolve against.
function buildEvalContext({ system, roster, selectionCounts, forceCategoryCounts, force }) {
  return {
    system,
    roster,
    selectionCounts,
    forceCategoryCounts,
    force: force || roster?.forces?.[0],
    parentCatalogueId: roster?.catalogueId
  };
}

// A link plus its resolved target share their modifiers, so a group-gated modifier only
// fires when its group's conditions pass. Combining both keeps category and hidden
// resolution consistent regardless of which side carries the modifier.
function collectEntryModifiers(entry, resolvedEntry) {
  return [...getEffectiveModifiers(entry), ...getEffectiveModifiers(resolvedEntry)];
}

/**
 * The effective categoryLinks of an entry in a given roster/force context: its
 * static categoryLinks (link plus resolved target) after applying the
 * `field="category"` modifiers (`add`/`remove`/`set-primary`/`unset-primary`)
 * whose conditions pass. This is the single source of truth for "which category
 * does this unit belong to", replacing static categoryLinks reads that ignored
 * modifier-driven recategorisation — e.g. a shared library unit an army imports
 * into its own "Core" via a `set-primary` modifier (ADR 0003 §4).
 *
 * @param {Object} entry the entry/link to categorise.
 * @param {VisibilityContext} context
 */
export function getEffectiveEntryCategoryLinks(entry, context) {
  const res = resolveEntry(context.system, entry);
  if (!res) return [];

  const ctx = buildEvalContext(context);
  return getEffectiveCategoryLinks(res.categoryLinks, collectEntryModifiers(entry, res), ctx);
}

/**
 * True when the entry's effective primary category is `categoryId` in this context,
 * i.e. the unit is sorted into that category's UI section (ADR 0003 §4), honouring
 * modifier-driven recategorisation.
 *
 * @param {Object} entry the entry/link to test.
 * @param {string} categoryId the category id the UI section represents.
 * @param {VisibilityContext} context
 */
export function isEntryPrimaryInCategory(entry, categoryId, context) {
  return getEffectiveEntryCategoryLinks(entry, context)
    .some(link => link.targetId === categoryId && link.primary);
}

export function isSelectionEntryHidden(entry, system, roster, selectionCounts, forceCategoryCounts, force) {
  const res = resolveEntry(system, entry);
  if (!res) return false;

  const isHidden = entry.hidden === true || res.hidden === true;
  const ctx = buildEvalContext({ system, roster, selectionCounts, forceCategoryCounts, force });

  // Group modifiers carry their group conditions, so evaluateHiddenFlag's per-modifier
  // condition check applies the group gate: a group's hidden modifier only fires when
  // both its own and its group's conditions pass.
  return evaluateHiddenFlag(isHidden, collectEntryModifiers(entry, res), ctx);
}
