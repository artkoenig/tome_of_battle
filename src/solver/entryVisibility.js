import { resolveEntry } from './catalogResolver.js';
import {
  evaluateCondition, evaluateConditionGroup, getEffectiveModifiers, getEffectiveCategoryLinks,
  resolveContextCatalogueId
} from './modifierEvaluator.js';

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

/**
 * @typedef {Object} VisibilityContext The roster/force bundle every entry-level
 *   visibility and category check evaluates against. Mirrors the context object the
 *   rest of the solver already threads (see optionsCollector / armyWideSelectors).
 * @property {Object} system   the parsed game system (gst + catalogues).
 * @property {Object} roster   the current roster.
 * @property {string} [catalogueId] the catalogue the entries under test were read from.
 *   Required whenever the entries do not come from the roster's own catalogue (ADR 0018:
 *   several catalogues are loaded side by side, and entry ids are unique only within one).
 *   Defaults to the roster's catalogue.
 * @property {Object} [selectionCounts]      per-entry selection counts.
 * @property {Object} [forceCategoryCounts]  per-force category counts.
 * @property {Object} [force]  the force being evaluated; defaults to the first force.
 */

/**
 * The catalogue this context's entries resolve against, via the solver's single
 * catalogue-precedence derivation.
 * @param {VisibilityContext} context
 */
function catalogueIdOf(context) {
  return resolveContextCatalogueId({ parentCatalogueId: context.catalogueId, roster: context.roster });
}

/**
 * True when a force's categoryLink is hidden in this context — statically or through
 * a passing `field="hidden"` modifier.
 *
 * Deliberately evaluates without the context's `force`: a categoryLink is a property of
 * the force definition itself, so its conditions never resolve against a force in the
 * roster. Only {@link isSelectionEntryHidden} threads `force` through.
 *
 * @param {Object} link the categoryLink to test.
 * @param {VisibilityContext} context
 */
export function isCategoryLinkHidden(link, context) {
  const { system, roster, selectionCounts, forceCategoryCounts } = context;
  const ctx = {
    roster,
    system,
    selectionCounts,
    forceCategoryCounts,
    parentCatalogueId: catalogueIdOf(context)
  };
  // Resolve through the shared seam so modifierGroup-gated hidden modifiers on the
  // category link are honoured, matching isSelectionEntryHidden below.
  return evaluateHiddenFlag(link.hidden, getEffectiveModifiers(link), ctx);
}

// The condition-evaluation context every helper below shares: the caller's bundle plus
// the force fallback and the catalogue id conditions resolve against.
function buildEvalContext(context) {
  const { system, roster, selectionCounts, forceCategoryCounts, force } = context;
  return {
    system,
    roster,
    selectionCounts,
    forceCategoryCounts,
    force: force || roster?.forces?.[0],
    parentCatalogueId: catalogueIdOf(context)
  };
}

// Resolves an entry against the catalogue its context names, so a same-id entry in a
// sibling catalogue can never stand in for it (ADR 0018).
function resolveEntryInContext(entry, context) {
  return resolveEntry(context.system, entry, catalogueIdOf(context));
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
  const res = resolveEntryInContext(entry, context);
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

/**
 * True when the catalogue entry is hidden in this context — statically or through a
 * passing `field="hidden"` modifier on the entry or its resolved target.
 *
 * @param {Object} entry the entry/link to test.
 * @param {VisibilityContext} context
 */
export function isSelectionEntryHidden(entry, context) {
  const res = resolveEntryInContext(entry, context);
  if (!res) return false;

  const isHidden = entry.hidden === true || res.hidden === true;
  const ctx = buildEvalContext(context);

  // Group modifiers carry their group conditions, so evaluateHiddenFlag's per-modifier
  // condition check applies the group gate: a group's hidden modifier only fires when
  // both its own and its group's conditions pass.
  return evaluateHiddenFlag(isHidden, collectEntryModifiers(entry, res), ctx);
}

/**
 * Sammelt die (nicht-versteckten) Katalog-Einträge, die in `categoryId` **primär**
 * sind, jeweils mit ihrem aufgelösten Eintrag. Gemeinsame Grundlage des
 * „+"-Adders (CategoryUnitAdder) und der Listenregel-Erkennung — beide gruppieren
 * datengetrieben über die effektive Primärkategorie (ADR 0003 §4), nicht über
 * Kategorienamen. Dedupliziert per aufgelöster Entry-ID.
 */
export function collectPrimaryCategoryEntries(system, catalogue, categoryId, { roster, selectionCounts = {}, force } = {}) {
  const found = [];
  if (!system || !catalogue) return found;

  const pools = [
    ...(catalogue.selectionEntries || []),
    ...(catalogue.entryLinks || []),
    ...(catalogue.sharedSelectionEntries || []),
  ];
  const seenResolvedIds = new Set();
  // The catalogue being enumerated is the one its entries resolve against — not the
  // roster's, which may well be a different one of the loaded catalogues (ADR 0018).
  const categoryContext = { system, roster, selectionCounts, force, catalogueId: catalogue.id };
  // Category counts are deliberately withheld from the hidden check: the adder lists a
  // catalogue's entries before any force is fixed, so no per-force tally applies here.
  const hiddenContext = { ...categoryContext, forceCategoryCounts: null };

  for (const entry of pools) {
    const resolved = resolveEntryInContext(entry, categoryContext);
    if (!resolved) continue;
    if (!isEntryPrimaryInCategory(entry, categoryId, categoryContext)) continue;
    if (isSelectionEntryHidden(entry, hiddenContext)) continue;
    if (seenResolvedIds.has(resolved.id)) continue;
    seenResolvedIds.add(resolved.id);
    found.push({ entry, resolved });
  }
  return found;
}
