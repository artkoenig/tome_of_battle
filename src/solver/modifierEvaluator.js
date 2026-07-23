import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { childSelectionsOf, countSelections, countSelectionsInSubtree, someSelectionInSubtree } from './rosterTree.js';
import { findForceEntryById } from './forceEntries.js';
import { ConstraintScope, isEntryScope, isRosterLimitField, isSharedQuery } from './battlescribeConstants.js';
import {
  ModifierKind, ConditionKind, ConstraintKind, AttributeName, SelectionEntryKind
} from '../parser/schema/battlescribeSchema.generated.js';

// The BattleScribe modifiers that mutate category membership / the primary flag all
// declare `field="category"`; their `value` is the target category id.
const CATEGORY_MODIFIER_FIELD = 'category';

// A resolved entry belongs to a category when one of its categoryLinks targets it.
const entryHasCategoryLink = (resolvedEntry, categoryId) =>
  !!resolvedEntry?.categoryLinks?.some(cl => cl.targetId === categoryId || cl.id === categoryId);

// Static (catalogue-level) category membership of a single selection's own entry,
// without looking at its children.
const selectionEntryHasCategory = (sel, categoryId, system, catalogueId) => {
  const sId = sel.selectionEntryId || sel.entryLinkId;
  if (sId === categoryId) return true;

  const raw = findEntryInSystem(system, sId, catalogueId);
  const res = raw && resolveEntry(system, raw, catalogueId);
  if (!res) return false;
  return res.id === categoryId || res.targetId === categoryId || entryHasCategoryLink(res, categoryId);
};

// Searches the selection's own subtree (itself and its descendants) for static
// membership in `categoryId`.
const selectionHasCategory = (sel, categoryId, system, catalogueId) =>
  someSelectionInSubtree(sel, node => selectionEntryHasCategory(node, categoryId, system, catalogueId));

// Type-keyword childIds ("any model", "any unit", ...) are resolved by the generic
// instanceOf path, not by the self-scope subtree search, which targets a concrete
// category/entry id. The entry kinds come from the schema SSOT; `any` is the extra
// BattleScribe wildcard that has no counterpart as a selection entry type.
const ANY_INSTANCE_TYPE_CHILD_ID = 'any';
const INSTANCE_TYPE_CHILD_IDS = Object.freeze([
  ...Object.values(SelectionEntryKind), ANY_INSTANCE_TYPE_CHILD_ID
]);

// A ctx flag that marks we are already resolving effective categories for a self-scope
// instanceOf condition. It bounds recursion to one level: a category modifier whose own
// gate is (pathologically) another self-scope instanceOf falls back to static links
// instead of re-entering effective-category resolution.
const SELF_SCOPE_CATEGORY_RESOLUTION_FLAG = '_resolvingSelfScopeCategory';

/**
 * The catalogue every entry reference of an evaluation context resolves against
 * (see `findEntryInSystem`). Contexts name that catalogue by the role it plays —
 * `parentCatalogueId` in condition contexts, `currentCatalogueId` in cost contexts —
 * and a roster carries its own catalogue as the outermost default. This is the single
 * derivation of that precedence; no caller may re-implement it.
 *
 * @param {Object} ctx an evaluation context.
 * @returns {string|null} the catalogue id, or null when the context names none.
 */
export const resolveContextCatalogueId = (ctx = {}) =>
  ctx.parentCatalogueId || ctx.currentCatalogueId || ctx.roster?.catalogueId || null;

// Resolves an id down to the canonical id of the selection entry it ultimately targets:
// its own id if it isn't a link, or the id unchanged if it can't be resolved at all (a
// category id or a type keyword like "model"). BattleScribe commonly exposes one shared
// item (defined once, e.g. in the game system's common catalogue) through several
// different entryLinks — an army-specific one and a shared one — each with its own link
// id. Comparing raw ids would treat those as different items; comparing their canonical
// target ids recognises them as the same one.
const resolveCanonicalTargetId = (id, system, catalogueId) => {
  if (!id || !system) return id;
  const raw = findEntryInSystem(system, id, catalogueId);
  const res = raw && resolveEntry(system, raw, catalogueId);
  return res ? (res.targetId || res.id) : id;
};

// True when `sel` is an instance of the selection-entry `entryId`: it either directly
// carries that entry id or its resolved definition's id/targetId matches. Used to detect
// that a condition's `scope` names the very entry the condition is attached to.
const selectionIsInstanceOfEntry = (sel, entryId, system, catalogueId) => {
  if (!sel || !entryId) return false;
  const sId = sel.selectionEntryId || sel.entryLinkId;
  if (sId === entryId) return true;
  const raw = findEntryInSystem(system, sId, catalogueId);
  const res = raw && resolveEntry(system, raw, catalogueId);
  return !!(res && (res.id === entryId || res.targetId === entryId));
};

// Effective category membership of a single selection's own entry, evaluated in `ctx` so
// that categories a modifier adds conditionally (e.g. the bloodline category a Vampire
// gains once its bloodline is chosen) count. Reuses getEffectiveCategoryLinks — the same
// category resolution the category axis applies — so instanceOf sees exactly the
// categories the rest of the app sees (single source of truth). Also matches a `childId`
// that names the entry itself rather than a category.
const selectionHasEffectiveCategory = (sel, categoryId, ctx) => {
  if (!sel || !categoryId) return false;
  const { system } = ctx;
  const catalogueId = resolveContextCatalogueId(ctx);
  const sId = sel.selectionEntryId || sel.entryLinkId;
  if (sId === categoryId) return true;

  const raw = findEntryInSystem(system, sId, catalogueId);
  const res = raw && resolveEntry(system, raw, catalogueId);
  if (!res) return false;
  if (res.id === categoryId || res.targetId === categoryId) return true;

  const categoryResolutionCtx = { ...ctx, selection: sel, [SELF_SCOPE_CATEGORY_RESOLUTION_FLAG]: true };
  const effectiveLinks = getEffectiveCategoryLinks(res.categoryLinks, getEffectiveModifiers(res), categoryResolutionCtx);
  return effectiveLinks.some(cl => cl.targetId === categoryId || cl.id === categoryId);
};

// Searches the selection's own subtree (itself and its descendant selections) for an
// instance of `childId`, using effective (post-modifier) category membership.
const subtreeHasInstanceOf = (sel, childId, ctx) =>
  someSelectionInSubtree(sel, node => selectionHasEffectiveCategory(node, childId, ctx));

// The BattleScribe target keyword that matches any model-like selection rather
// than one concrete entry id.
const MODEL_TARGET_KEYWORD = SelectionEntryKind.MODEL;

/**
 * Builds the predicate that decides whether a selection counts towards a
 * parent-scoped quantity for `targetId` — an entry id, a link id, a category id,
 * or the "model" type keyword.
 *
 * BattleScribe defines two such parent-scoped counts (a condition's and a
 * modifier repeat's) that differ only in how wide they cast the net, so the two
 * differences are explicit options instead of two copies of the matching rules:
 * `matchCategoryMembership` also accepts a selection whose entry merely links to
 * the target category, and `matchUnitsAsModels` lets the "model" keyword cover
 * `unit` entries as well.
 */
const createTargetSelectionMatcher = (targetId, system, catalogueId, { matchCategoryMembership, matchUnitsAsModels }) => {
  const canonicalTargetId = resolveCanonicalTargetId(targetId, system, catalogueId);
  const modelLikeTypes = matchUnitsAsModels
    ? [MODEL_TARGET_KEYWORD, SelectionEntryKind.UNIT]
    : [MODEL_TARGET_KEYWORD];

  return (sel) => {
    const sId = sel.entryLinkId || sel.selectionEntryId;
    if (sId === targetId) return true;
    if (!system) return false;

    const raw = findEntryInSystem(system, sId, catalogueId);
    const res = raw && resolveEntry(system, raw, catalogueId);
    if (!res) return false;

    if (res.targetId === targetId || res.id === targetId) return true;
    // Two different entryLinks (e.g. an army-specific one and the shared/common
    // catalogue's own one) can both alias the same underlying item.
    if (resolveCanonicalTargetId(sId, system, catalogueId) === canonicalTargetId) return true;
    // childId may reference a category (e.g. a bloodline): count selections that
    // belong to that category, not only those whose entry id matches.
    if (matchCategoryMembership && entryHasCategoryLink(res, targetId)) return true;
    return targetId === MODEL_TARGET_KEYWORD && modelLikeTypes.includes(res.type);
  };
};

/**
 * Der Zählwert einer **nicht geteilten** Bedingung (`shared="false"`): gezählt wird
 * ausschließlich innerhalb der Instanz, an der die Bedingung hängt, statt über alle
 * Vorkommen des Eintrags im Roster (ADR 0003, Abschnitt 4). `includeChildSelections`
 * behält dabei seine Bedeutung und entscheidet, ob unterhalb der Instanz
 * weitergezählt wird.
 *
 * Ohne bekannte Instanz im Kontext (z. B. bei der Prüfung eines Eintrags, der noch
 * gar nicht im Roster liegt) gibt es nichts zu zählen: das Ergebnis ist 0. Der
 * armeeweite Zählwert wäre hier gerade die falsche Antwort, denn genau dessen
 * Aggregation schließt `shared="false"` aus.
 */
const countWithinConditionInstance = (cond, ctx) => {
  const { selection, system } = ctx;
  if (!selection) return 0;

  const catalogueId = resolveContextCatalogueId(ctx);
  const matchesTarget = createTargetSelectionMatcher(cond.childId || cond.field, system, catalogueId, {
    matchCategoryMembership: true,
    matchUnitsAsModels: true
  });

  return countSelectionsInSubtree(selection, {
    includeChildSelections: !!cond.includeChildSelections,
    predicate: matchesTarget
  });
};

export const evaluateCondition = (cond, ctx = {}) => {
  if (!cond) return false;
  const { roster, selectionCounts = {}, forceCategoryCounts = {}, selection, parentSelection, system } = ctx;
  let currentValue = 0;
  
  if (isRosterLimitField(cond.field)) {
    currentValue = roster?.costLimit || 0;
  } else if (cond.field) {
    // For parent-scoped conditions the "parent" is the selection that holds the
    // group items. That is `parentSelection` when we descend into a child, but on a
    // top-level unit (validator: selection=unit, parentSelection=null) the unit
    // itself is the container — mirror the same fallback the repeat logic uses so
    // e.g. "you may take more than one Dispel Scroll" also resolves during
    // roster validation, not just in the editor UI.
    const parentScopeTarget = parentSelection || selection;
    if (cond.scope === ConstraintScope.PARENT && parentScopeTarget && parentScopeTarget.selections) {
      const catId = resolveContextCatalogueId(ctx);
      const targetId = cond.childId || cond.field;
      const matchesTarget = createTargetSelectionMatcher(targetId, system, catId, {
        matchCategoryMembership: true,
        matchUnitsAsModels: true
      });

      currentValue = countSelections(childSelectionsOf(parentScopeTarget), {
        includeChildSelections: !!cond.includeChildSelections,
        predicate: matchesTarget
      });
    } else if (!isSharedQuery(cond)) {
      // Eine nicht geteilte Bedingung zählt je Instanz statt armeeweit. Der
      // parent-Scope oben ist davon unberührt: er ist bereits an genau eine
      // Instanz — den Eltern-Container — gebunden.
      currentValue = countWithinConditionInstance(cond, ctx);
    } else {
      // Non-parent scopes (force/roster/entry/category) count by the specific target
      // the condition names. A childId identifies that target explicitly (e.g. a
      // bloodline entry id in "atLeast 1 selections scope=force childId=<bloodline>");
      // plain category conditions carry the id in field and no childId. Preferring
      // childId mirrors the parent branch's `cond.childId || cond.field`, so a
      // force-scoped childId condition resolves against the actual selection count
      // instead of the generic field name ("selections"), which is never a count key.
      const countKey = cond.childId || cond.field;
      let categoryTotal = 0;
      if (forceCategoryCounts && forceCategoryCounts[countKey]) {
        categoryTotal = forceCategoryCounts[countKey];
      }
      currentValue = selectionCounts[countKey] || categoryTotal || 0;
    }
  }
  const targetValue = cond.value;

  switch (cond.type) {
    case ConditionKind.EQUAL_TO:
      return currentValue === targetValue;
    case ConditionKind.LESS_THAN:
      return currentValue < targetValue;
    case ConditionKind.GREATER_THAN:
      return currentValue > targetValue;
    case ConditionKind.NOT_EQUAL_TO:
      return currentValue !== targetValue;
    case 'lessThanOrEqualTo':
    case ConditionKind.AT_MOST:
      return currentValue <= targetValue;
    case 'greaterThanOrEqualTo':
    case ConditionKind.AT_LEAST:
      return currentValue >= targetValue;
    case ConditionKind.INSTANCE_OF:
    case ConditionKind.NOT_INSTANCE_OF: {
      const isNegated = cond.type === ConditionKind.NOT_INSTANCE_OF;
      const evaluateInstanceOf = () => {
        // A force instanceOf names its forceEntry either directly in `scope` (the
        // self-gated idiom, `scope=<forceId>`) or in `childId` while `scope` carries the
        // literal "force" keyword (BattleScribe's canonical shape, e.g. the Definitive
        // Edition's "notInstanceOf Ironskin Tribe" gate). Pick whichever actually resolves
        // to a real forceEntry, so both encodings enter the force branch instead of the
        // literal keyword falling through to the selection search below.
        const forceEntryId = system
          ? [cond.scope, cond.childId].find(id => findForceEntryById(system, id))
          : null;
        if (forceEntryId) {
          const isInstance = (ctx.force?.forceEntryId === forceEntryId) ||
                             (roster?.forces?.some(f => f.forceEntryId === forceEntryId));
          return cond.value === 0 ? !isInstance : isInstance;
        }

        if (!selection || !system) return false;

        // Self-scope: `scope` names the selection-entry this condition is attached to
        // (a BattleScribe idiom meaning "search within my own subtree"), not a category
        // id. When the current or parent selection is that entry, search its own subtree
        // for the childId-referenced instance — including categories added by modifiers
        // (e.g. a bloodline category the unit gains once its bloodline is chosen) —
        // instead of the generic category-membership check, which never matches here and
        // would leave the attached modifier permanently inactive. Mirrors the existing
        // parent/force/roster special-casing.
        const scopeNamesEntry = !!cond.scope && isEntryScope(cond.scope);
        const childIsConcreteId = cond.childId && !INSTANCE_TYPE_CHILD_IDS.includes(cond.childId);
        if (scopeNamesEntry && childIsConcreteId && !ctx[SELF_SCOPE_CATEGORY_RESOLUTION_FLAG]) {
          const catId = resolveContextCatalogueId(ctx);
          const selfInstance = [selection, parentSelection].find(candidate =>
            selectionIsInstanceOfEntry(candidate, cond.scope, system, catId));
          if (selfInstance) {
            return subtreeHasInstanceOf(selfInstance, cond.childId, ctx);
          }
        }

        const targetChildId = cond.childId;
        const checkInstance = (sel) => {
          if (!sel) return false;
          const sId = sel.selectionEntryId || sel.entryLinkId;
          if (sId === targetChildId) return true;
          
          const catId = resolveContextCatalogueId(ctx);
          const raw = findEntryInSystem(system, sId, catId);
          const res = raw && resolveEntry(system, raw, catId);
          
          if (res) {
            if (cond.scope && isEntryScope(cond.scope)) {
              const hasCat = selectionHasCategory(sel, cond.scope, system, catId);
              if (!hasCat) return false;
            }
            if (res.targetId === targetChildId || res.id === targetChildId) return true;
            // The `model` keyword deliberately also covers `unit` entries; the other
            // two keywords match their own entry kind exactly.
            if (targetChildId === SelectionEntryKind.MODEL &&
                (res.type === SelectionEntryKind.MODEL || res.type === SelectionEntryKind.UNIT)) return true;
            if (targetChildId === SelectionEntryKind.UNIT && res.type === SelectionEntryKind.UNIT) return true;
            if (targetChildId === SelectionEntryKind.UPGRADE && res.type === SelectionEntryKind.UPGRADE) return true;
          }
          return false;
        };
        
        if (checkInstance(selection)) return true;
        if (parentSelection && checkInstance(parentSelection)) return true;
        return false;
      };
      return isNegated ? !evaluateInstanceOf() : evaluateInstanceOf();
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

/**
 * True when a modifier's own conditions/conditionGroups all pass in `ctx`.
 * Mirrors the AND-of-conditions gating BattleScribe applies to every modifier.
 */
const modifierConditionsPass = (source, ctx) => {
  const condsPass = source.conditions?.every(c => evaluateCondition(c, ctx)) !== false;
  const groupsPass = source.conditionGroups?.every(g => evaluateConditionGroup(g, ctx)) !== false;
  return condsPass && groupsPass;
};

/**
 * The number of times a `repeat` modifier fires in `ctx`: how often its counted
 * quantity fits into the repeat's `value`, times its `repeats` multiplier.
 */
const countRepeatOccurrences = (repeat, ctx) => {
  const { roster, selectionCounts = {}, forceCategoryCounts = {} } = ctx;
  const targetParent = ctx.parentSelection || ctx.selection;
  let countedQuantity = 0;

  if (repeat.scope === ConstraintScope.PARENT && targetParent && targetParent.selections) {
    const { system } = ctx;
    const catId = resolveContextCatalogueId(ctx);
    const targetId = repeat.childId || repeat.field;
    const matchesTarget = createTargetSelectionMatcher(targetId, system, catId, {
      matchCategoryMembership: false,
      matchUnitsAsModels: false
    });

    countedQuantity = countSelections(childSelectionsOf(targetParent), {
      includeChildSelections: !!repeat.includeChildSelections,
      predicate: matchesTarget
    });
  } else if (isRosterLimitField(repeat.field)) {
    countedQuantity = roster?.costLimit || 0;
  } else if (repeat.childId) {
    countedQuantity = selectionCounts[repeat.childId] || (forceCategoryCounts && forceCategoryCounts[repeat.childId]) || 0;
  } else if (repeat.field) {
    countedQuantity = selectionCounts[repeat.field] || (forceCategoryCounts && forceCategoryCounts[repeat.field]) || 0;
  }

  const fitCount = repeat.value
    ? (repeat.roundUp ? Math.ceil(countedQuantity / repeat.value) : Math.floor(countedQuantity / repeat.value))
    : 0;
  return fitCount * (repeat.repeats || 1);
};

// The amount a modifier contributes: its own numeric value, scaled by how often a
// `repeat` makes it fire.
const getModifierAmount = (mod, ctx) => {
  const baseAmount = typeof mod.valueObject === 'number' ? mod.valueObject : (parseFloat(mod.value) || 0);
  return mod.repeat ? baseAmount * countRepeatOccurrences(mod.repeat, ctx) : baseAmount;
};

const applyValueModifier = (currentValue, mod, ctx) => {
  const amount = getModifierAmount(mod, ctx);
  switch (mod.type) {
    case ModifierKind.SET:
      return amount;
    case ModifierKind.INCREMENT:
      return currentValue + amount;
    case ModifierKind.DECREMENT:
      return currentValue - amount;
    // A `multiply` modifier scales the running value by its factor (e.g. the
    // "Traditional Army" army-wide condition that doubles a unit's points cost).
    // It shares this single evaluation path with set/increment/decrement, so a
    // multiply on any constraint — not only a cost — is handled identically.
    case ModifierKind.MULTIPLY:
      return currentValue * amount;
    default:
      return currentValue;
  }
};

// A modifier is conditional when it only fires under a condition of its own or an
// enclosing modifierGroup's (folded into it by getEffectiveModifiers). Unconditional
// modifiers are part of the base rule, never a "because you chose X" cause (ADR 0027).
const modifierIsConditional = (mod) =>
  (mod.conditions?.length > 0) || (mod.conditionGroups?.length > 0);

/**
 * @typedef {Object} ConstraintEvaluation
 * @property {number} value  the effective constraint value after all condition-met modifiers.
 * @property {Object[]} contributingConditionalModifiers  the subset of those modifiers that are
 *   themselves conditional AND actually changed the running value, in document order — the
 *   modifiers a violation of this constraint can be blamed on (ADR 0027). A condition-met
 *   modifier that leaves the value unchanged, and every unconditional modifier, is excluded.
 */

/**
 * Evaluates a constraint exactly like {@link getModifiedConstraintValue} — same condition-met
 * modifiers, same document order, same math — but additionally captures the conditional
 * modifiers that actively changed the value. The numeric result is byte-for-byte identical
 * (getModifiedConstraintValue delegates here), so exposing the intermediate list adds no
 * behaviour to the value path; it only surfaces the causes ADR 0027 needs.
 * @param {Object} con a constraint (`{ id, value }`).
 * @param {Object[]} modifiers the source's effective modifiers.
 * @param {Object} ctx an evaluation context.
 * @returns {ConstraintEvaluation}
 */
export const evaluateConstraint = (con, modifiers, ctx = {}) => {
  const applicableModifiers = (modifiers || [])
    .filter(mod => mod.field === con.id && modifierConditionsPass(mod, ctx));
  const contributingConditionalModifiers = [];
  const value = applicableModifiers.reduce((currentValue, mod) => {
    const nextValue = applyValueModifier(currentValue, mod, ctx);
    if (nextValue !== currentValue && modifierIsConditional(mod)) {
      contributingConditionalModifiers.push(mod);
    }
    return nextValue;
  }, con.value);
  return { value, contributingConditionalModifiers };
};

/**
 * Returns the effective value of a constraint by applying its condition-met modifiers
 * to `con.value`, in document order — the order the catalogue authored them in, which
 * is the order BattleScribe itself evaluates. No modifier type is reordered: a
 * catalogue that writes `increment 2` and then `set 5` means 5, and one that writes
 * `set 5` and then `increment 2` means 7. This is the same ordering rule
 * getEffectiveName applies to name modifiers.
 */
export const getModifiedConstraintValue = (con, modifiers, ctx = {}) =>
  evaluateConstraint(con, modifiers, ctx).value;

// The childIds that name an entry *kind* ("model"/"unit"/"upgrade"/"any") rather than one
// concrete, selectable entry. A condition targeting one of these points at no namable choice.
const SELECTABLE_ENTRY_KINDS = new Set(Object.values(SelectionEntryKind));

// A resolved entry is a namable, selectable choice only when its type is a real
// selection-entry kind — this excludes categories, force entries and other id-bearing
// nodes the entry index also holds (ADR 0027: "nur benennbare Auswahl").
const isSelectableEntry = (resolvedEntry) =>
  !!resolvedEntry && SELECTABLE_ENTRY_KINDS.has(resolvedEntry.type);

/**
 * Resolves a single gating condition to the selectable choice it points at, or null when it
 * points at none ("nicht auflösbar", ADR 0027). A condition names its target through
 * `childId`; that target is a cause only when it resolves to a real selection entry, whose
 * catalogue name is then passed through (ADR 0003). A condition with no childId (a pure
 * comparison or quantity reference), or one whose childId names a category or a type keyword,
 * yields null — so the caller shows no cause rather than a cryptic one.
 * @param {Object} cond a BattleScribe condition.
 * @param {Object} ctx an evaluation context (must carry `system`).
 * @returns {import('../types.js').ValidationCause|null}
 */
export const resolveConditionTrigger = (cond, ctx = {}) => {
  const targetId = cond?.childId;
  if (!targetId || INSTANCE_TYPE_CHILD_IDS.includes(targetId)) return null;
  const { system } = ctx;
  if (!system) return null;
  const catalogueId = resolveContextCatalogueId(ctx);
  const rawEntry = findEntryInSystem(system, targetId, catalogueId);
  const resolvedEntry = rawEntry && resolveEntry(system, rawEntry, catalogueId);
  if (!isSelectableEntry(resolvedEntry) || !resolvedEntry.name) return null;
  return { entryId: targetId, name: resolvedEntry.name };
};

// Flattens a condition group's own conditions and those of its nested groups into one list,
// so a modifier gated through a group is resolved to the same triggers as a directly-gated one.
const collectGroupConditions = (group) => [
  ...(group.conditions || []),
  ...(group.conditionGroups || []).flatMap(collectGroupConditions)
];

// Every condition that gates a modifier: its own plus those nested in its conditionGroups.
const collectModifierConditions = (mod) => [
  ...(mod.conditions || []),
  ...(mod.conditionGroups || []).flatMap(collectGroupConditions)
];

// Keeps the first occurrence of each triggering selection, dropping later duplicates so
// several modifiers (or conditions) gated on the same choice list it once.
const dedupeCausesByEntryId = (causes) => {
  const seenEntryIds = new Set();
  return causes.filter(({ entryId }) => {
    if (seenEntryIds.has(entryId)) return false;
    seenEntryIds.add(entryId);
    return true;
  });
};

/**
 * @typedef {Object} ConstraintValueWithCauses
 * @property {number} value  the effective constraint value (see {@link getModifiedConstraintValue}).
 * @property {import('../types.js').ValidationCause[]} causes  the namable selections whose
 *   active conditional modifiers changed that value; empty when the value comes from the base
 *   or unconditional modifiers only, or when no gating condition resolves to a namable choice.
 */

/**
 * Evaluates a constraint and derives, in one pass, the causes of a violation of it (ADR 0027):
 * the namable selections triggering the conditional modifiers that actively changed its value.
 * The whole chain is reported — every contributing conditional modifier — deduplicated by the
 * selection it names. Returns `causes: []` when there is no namable cause, so the caller can
 * omit the optional field entirely and stay backward-compatible.
 * @param {Object} con a constraint (`{ id, value }`).
 * @param {Object[]} modifiers the source's effective modifiers.
 * @param {Object} ctx an evaluation context (must carry `system` for name resolution).
 * @returns {ConstraintValueWithCauses}
 */
export const evaluateConstraintWithCauses = (con, modifiers, ctx = {}) => {
  const { value, contributingConditionalModifiers } = evaluateConstraint(con, modifiers, ctx);
  const causes = contributingConditionalModifiers
    .flatMap(collectModifierConditions)
    .map(cond => resolveConditionTrigger(cond, ctx))
    .filter(Boolean);
  return { value, causes: dedupeCausesByEntryId(causes) };
};

/**
 * Recursively pulls the modifiers out of a modifierGroup, folding the group's own
 * conditions/conditionGroups into every contained modifier so that later condition
 * evaluation applies the group as a gate: a contained modifier fires only when both
 * its own and its group's conditions pass. A group-level repeat is inherited by
 * contained modifiers that declare none. Nested groups compound their conditions.
 */
const collectGroupModifiers = (group, inheritedConditions, inheritedConditionGroups) => {
  const conditions = [...inheritedConditions, ...(group.conditions || [])];
  const conditionGroups = [...inheritedConditionGroups, ...(group.conditionGroups || [])];

  const ownModifiers = (group.modifiers || []).map(mod => ({
    ...mod,
    conditions: [...conditions, ...(mod.conditions || [])],
    conditionGroups: [...conditionGroups, ...(mod.conditionGroups || [])],
    repeat: group.repeat && !mod.repeat ? group.repeat : mod.repeat
  }));

  const nestedModifiers = (group.modifierGroups || [])
    .flatMap(nested => collectGroupModifiers(nested, conditions, conditionGroups));

  return [...ownModifiers, ...nestedModifiers];
};

/**
 * Returns the effective modifier list of an entry/link/resolved definition: its
 * direct modifiers plus the modifiers contained in its modifierGroups, with each
 * group modifier carrying the AND of its enclosing group conditions. This is the
 * single place group gating is resolved, so every modifier consumer (cost, hidden,
 * characteristics, categories) shares one rule and gates group modifiers correctly
 * through the same condition evaluation it already applies to direct modifiers.
 */
export const getEffectiveModifiers = (source) => {
  if (!source) return [];
  const groupModifiers = (source.modifierGroups || []).flatMap(group => collectGroupModifiers(group, [], []));
  return [...(source.modifiers || []), ...groupModifiers];
};

// A group whose max constraint is capped at exactly this value offers a single
// mutually-exclusive choice (a radio). A modifier able to lift that max past this
// cap turns the group into a multi-select — the "max-raisable ⇒ multi-select" rule.
const SINGLE_CHOICE_GROUP_MAX = 1;

/**
 * True when `mod` targets `maxConstraint` and, applied to its base value, would push
 * it past the single-choice cap. The already-handled `increment`+`<repeat>` pattern
 * (§9.7 — one cap lift per copy taken of the *same* item, e.g. Dispel Scroll) is
 * excluded: it signals a repeatable item, not an inherently multi-select group.
 * Reuses applyValueModifier — the exact math getModifiedConstraintValue applies at
 * runtime — so the potential value can never drift from the evaluated one.
 */
const modifierRaisesMaxAboveSingleChoice = (mod, maxConstraint) => {
  if (mod.field !== maxConstraint.id) return false;
  if (mod.repeat) return false;
  return applyValueModifier(maxConstraint.value, mod, {}) > SINGLE_CHOICE_GROUP_MAX;
};

/**
 * Statically decides whether any modifier of `group` can raise one of its `max`
 * constraints above the single-choice cap, irrespective of whether that modifier's
 * condition currently holds.
 *
 * This is the basis for the "max-raisable ⇒ multi-select" rule that breaks the
 * armour+shield deadlock: an armour group is capped at `max=1` but carries a
 * conditional `increment` on that max, gated on a sibling shield selection. Judging
 * the *current* effective max would keep the group a radio (without a shield the max
 * is 1), so the shield could never be picked to satisfy the condition. Judging the
 * *potential* max instead resolves the circular dependency.
 *
 * Purely static: modifier conditions are intentionally ignored. The `increment`+
 * `<repeat>` pattern is distinguished and never counts as this signal (see
 * modifierRaisesMaxAboveSingleChoice).
 *
 * @param {Object} group a selectionEntryGroup definition (its constraints + modifiers).
 * @returns {boolean} true when a non-repeat modifier can raise a max constraint above 1.
 */
export const canGroupMaxBeRaisedAboveSingleChoice = (group) => {
  const maxConstraints = (group?.constraints || []).filter(con => con.type === ConstraintKind.MAX);
  if (maxConstraints.length === 0) return false;

  const modifiers = getEffectiveModifiers(group);
  return maxConstraints.some(maxConstraint =>
    modifiers.some(mod => modifierRaisesMaxAboveSingleChoice(mod, maxConstraint)));
};

// BattleScribe lets catalogue authors surface context-gated, plain-text hints to the
// player through a modifier whose `field` names a severity channel and whose `value`
// carries the message text (e.g. `field="error" value="Please enable ..."`). These three
// field names are also the canonical validation severities used across the app: an
// `error` blocks the list, `warning`/`info` are purely informational.
export const ValidationSeverity = Object.freeze({ ERROR: 'error', WARNING: 'warning', INFO: 'info' });

/** @typedef {typeof ValidationSeverity[keyof typeof ValidationSeverity]} SeverityLevel */

const MESSAGE_MODIFIER_FIELDS = new Set(Object.values(ValidationSeverity));

// A BattleScribe text token embedded in an author-written message value, captured by name.
const AUTHOR_MESSAGE_TOKEN_PATTERN = /\{(\w+)\}/g;

/**
 * Renders the BattleScribe text tokens in an author-written message: each `{token}` present
 * in `tokenValues` is replaced by its value, and every unknown token is left verbatim (ADR
 * 0028: token rendering, not translation — the text stays in its catalogue language). Pure
 * string→string, generic over the token map so a newly attested token is one more entry, not
 * a special case.
 * @param {string} text the raw author message value.
 * @param {Record<string, string>} tokenValues token name → rendered value (e.g. `{ this: 'Gnoblars' }`).
 * @returns {string}
 */
export const resolveAuthorMessageTokens = (text, tokenValues) =>
  text.replace(AUTHOR_MESSAGE_TOKEN_PATTERN, (token, name) =>
    name in tokenValues ? tokenValues[name] : token);

/**
 * Collects the author-written messages of a source's error/warning/info modifiers
 * whose conditions currently pass in `ctx`, each tagged with the severity its field
 * names. Reuses getEffectiveModifiers + modifierConditionsPass, so modifierGroup gating
 * and the full condition semantics apply exactly as for every other modifier consumer.
 * The message text has its BattleScribe tokens rendered (ADR 0028): `{this}` becomes the
 * source entry's effective name, computed once and only when a message actually fired.
 * @returns {{severity: SeverityLevel, message: string}[]}
 */
export const collectTriggeredMessages = (source, ctx = {}) => {
  const triggered = getEffectiveModifiers(source)
    .filter(mod => MESSAGE_MODIFIER_FIELDS.has(mod.field) && mod.value && modifierConditionsPass(mod, ctx));
  if (triggered.length === 0) return [];
  const tokenValues = { this: getEffectiveName(source, ctx) };
  return triggered.map(mod => ({
    severity: /** @type {SeverityLevel} */ (mod.field),
    message: resolveAuthorMessageTokens(mod.value, tokenValues)
  }));
};

/**
 * Applies the category-mutating modifiers (`add`/`remove`/`set-primary`/
 * `unset-primary`) to a set of base categoryLinks and returns the effective links.
 * Only modifiers whose conditions pass in `ctx` take effect, so a group's gate (via
 * getEffectiveModifiers) or a modifier's own conditions make membership conditional.
 * Semantics follow the BattleScribe reference: `value` is the target category id;
 * `add`/`set-primary`/`unset-primary` create the link when it is missing.
 */
export const getEffectiveCategoryLinks = (baseCategoryLinks, modifiers, ctx = {}) => {
  let links = (baseCategoryLinks || []).map(cl => ({ ...cl }));

  (modifiers || []).forEach(mod => {
    if (mod.field !== CATEGORY_MODIFIER_FIELD) return;
    if (!modifierConditionsPass(mod, ctx)) return;

    const categoryId = mod.value;
    if (!categoryId) return;

    switch (mod.type) {
      case ModifierKind.ADD:
        if (!links.some(cl => cl.targetId === categoryId)) {
          links = [...links, { targetId: categoryId, primary: false }];
        }
        break;
      case ModifierKind.REMOVE:
        links = links.filter(cl => cl.targetId !== categoryId);
        break;
      case ModifierKind.SET_PRIMARY:
      case ModifierKind.UNSET_PRIMARY: {
        const isPrimary = mod.type === ModifierKind.SET_PRIMARY;
        if (links.some(cl => cl.targetId === categoryId)) {
          links = links.map(cl => cl.targetId === categoryId ? { ...cl, primary: isPrimary } : cl);
        } else {
          links = [...links, { targetId: categoryId, primary: isPrimary }];
        }
        break;
      }
      default:
        break;
    }
  });

  return links;
};

// BattleScribe name modifiers rewrite a source's display name via `field="name"`:
//  - set:     replace the name outright with the modifier's `value`
//  - append:  base name, then the `join` separator, then `value`
//  - prepend: `value`, then the `join` separator, then the base name
// `join` is a verbatim separator authored in the catalogue (a plain space, a
// non-breaking space, " + ", ...) and defaults to no separator when the attribute is
// absent — it must be read from the modifier, never assumed to be a space.
const NAME_MODIFIER_FIELD = AttributeName.NAME;
const NO_JOIN_SEPARATOR = '';

const applyNameModifier = (currentName, mod) => {
  const value = mod.value ?? '';
  const join = mod.join ?? NO_JOIN_SEPARATOR;
  switch (mod.type) {
    case ModifierKind.SET:
      return value;
    case ModifierKind.APPEND:
      return `${currentName}${join}${value}`;
    case ModifierKind.PREPEND:
      return `${value}${join}${currentName}`;
    default:
      return currentName;
  }
};

/**
 * Returns the effective display name of a source (selection entry, entry link, or
 * profile) by applying its condition-met `field="name"` modifiers to the base
 * `source.name`, in document order. Only modifiers whose conditions pass in `ctx` take
 * effect, so an unmet condition leaves the raw catalogue name unchanged (AC3). Reuses
 * getEffectiveModifiers + modifierConditionsPass, so modifierGroup gating and the full
 * condition semantics apply exactly as for every other modifier consumer.
 */
export const getEffectiveName = (source, ctx = {}) => {
  const baseName = source?.name ?? '';
  return getEffectiveModifiers(source)
    .filter(mod => mod.field === NAME_MODIFIER_FIELD && modifierConditionsPass(mod, ctx))
    .reduce(applyNameModifier, baseName);
};

/**
 * Resolves the effective display name of a roster selection. Looks up the selection's
 * catalogue definition — whose merged modifiers carry both the entryLink's and the
 * target's name modifiers — and applies them to the selection's stored raw name in
 * `ctx`. The stored `selection.name` deliberately stays the raw catalogue name (the
 * single source of truth that name-based matching relies on, AC4); this derives the
 * display name without mutating it. Falls back to the raw name when the definition
 * can't be resolved.
 */
export const getEffectiveSelectionName = (selection, ctx = {}) => {
  const baseName = selection?.name ?? '';
  const { system } = ctx;
  const entryId = selection?.selectionEntryId || selection?.entryLinkId;
  if (!system || !entryId) return baseName;

  const catalogueId = resolveContextCatalogueId(ctx);
  const rawEntry = findEntryInSystem(system, entryId, catalogueId);
  const resolved = rawEntry && resolveEntry(system, rawEntry, catalogueId);
  if (!resolved) return baseName;

  const nameSource = { name: baseName, modifiers: resolved.modifiers, modifierGroups: resolved.modifierGroups };
  const nameCtx = { ...ctx, selection, parentCatalogueId: catalogueId };
  return getEffectiveName(nameSource, nameCtx);
};
