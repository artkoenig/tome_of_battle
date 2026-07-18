import { resolveEntry } from './catalogResolver.js';
import { evaluateCondition, evaluateConditionGroup, getEffectiveModifiers } from './modifierEvaluator.js';

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

export function isSelectionEntryHidden(entry, system, roster, selectionCounts, forceCategoryCounts, force) {
  const res = resolveEntry(system, entry);
  if (!res) return false;

  const isHidden = entry.hidden === true || res.hidden === true;

  const ctx = {
    roster,
    system,
    selectionCounts,
    forceCategoryCounts,
    force: force || roster?.forces?.[0],
    parentCatalogueId: roster?.catalogueId
  };

  // Group modifiers carry their group conditions, so evaluateHiddenFlag's per-modifier
  // condition check applies the group gate: a group's hidden modifier only fires when
  // both its own and its group's conditions pass.
  const allModifiers = [
    ...getEffectiveModifiers(entry),
    ...getEffectiveModifiers(res)
  ];

  return evaluateHiddenFlag(isHidden, allModifiers, ctx);
}
