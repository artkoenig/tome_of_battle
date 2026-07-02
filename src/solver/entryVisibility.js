import { resolveEntry } from './catalogResolver.js';
import { evaluateCondition, evaluateConditionGroup } from './modifierEvaluator.js';

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
  return evaluateHiddenFlag(link.hidden, link.modifiers, ctx);
}

export function isSelectionEntryHidden(entry, system, roster, selectionCounts, forceCategoryCounts, force) {
  const res = resolveEntry(system, entry);
  if (!res) return false;

  const isHidden = entry.hidden === true || res.hidden === true;

  const allModifiers = [
    ...(entry.modifiers || []),
    ...(entry.modifierGroups?.flatMap(g => g.modifiers || []) || []),
    ...(res.modifiers || []),
    ...(res.modifierGroups?.flatMap(g => g.modifiers || []) || [])
  ];

  const ctx = {
    roster,
    system,
    selectionCounts,
    forceCategoryCounts,
    force: force || roster?.forces?.[0],
    parentCatalogueId: roster?.catalogueId
  };

  return evaluateHiddenFlag(isHidden, allModifiers, ctx);
}
