import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { evaluateCondition, evaluateConditionGroup, getEffectiveModifiers, getEffectiveName } from './modifierEvaluator.js';
import { computeRosterCounts } from './rosterCounter.js';
import { evaluateHiddenFlag } from './entryVisibility.js';
import { ConstraintScope, isEntryScope, isRosterLimitField } from './battlescribeConstants.js';
import '../types.js';

/**
 * Recursively collects all unique profiles and rules for a given selection.
 * Including from its sub-selections and their resolved catalog entries.
 */
export function collectUnitProfilesAndRules(system, selection, activeCatalogueId = null, roster = null) {
  const profiles = [];
  const rules = [];
  const seenProfileIds = new Set();
  const seenRuleIds = new Set();

  let selectionCounts = {};
  let forceCategoryCounts = {};
  if (roster) {
    const counts = computeRosterCounts(roster, system);
    selectionCounts = counts.selectionCounts;
    if (roster.forces) {
      const containsSel = (list) => {
        if (!list) return false;
        for (const s of list) {
          if (s.id === selection.id) return true;
          if (containsSel(s.selections)) return true;
        }
        return false;
      };
      const activeForce = roster.forces.find(f => containsSel(f.selections));
      if (activeForce) {
        forceCategoryCounts = counts.categoryCounts[activeForce.id] || {};
      } else {
        forceCategoryCounts = Object.values(counts.categoryCounts).reduce((acc, c) => ({ ...acc, ...c }), {});
      }
    }
  }

  const makeCtx = (sourceSel, parentSel) => ({
    roster,
    selectionCounts,
    forceCategoryCounts,
    selection: sourceSel,
    parentSelection: parentSel,
    system,
    parentCatalogueId: activeCatalogueId
  });

  const getConditionName = (cond) => {
    if (!cond) return '';
    const targetId = cond.scope && isEntryScope(cond.scope) ? cond.scope : (cond.childId || cond.field);
    if (!targetId) return '';
    const entry = findEntryInSystem(system, targetId, activeCatalogueId);
    if (entry) return entry.name;
    const cat = system.categoryEntries?.find(c => c.id === targetId);
    if (cat) return cat.name;
    return '';
  };

  const collectConditionNames = (mod) => {
    const condNames = [];
    if (mod.conditions) {
      mod.conditions.forEach(c => {
        const name = getConditionName(c);
        if (name) condNames.push(name);
      });
    }
    if (mod.conditionGroups) {
      const collectNames = (g) => {
        g.conditions?.forEach(c => {
          const name = getConditionName(c);
          if (name) condNames.push(name);
        });
        g.conditionGroups?.forEach(collectNames);
      };
      mod.conditionGroups.forEach(collectNames);
    }
    return condNames;
  };

  // Wie oft greift ein repeat-Modifier im gegebenen Kontext?
  const computeRepeatCount = (mod, ctx) => {
    let currentValue = 0;
    const targetParent = ctx.parentSelection || ctx.selection;
    if (mod.repeat.scope === ConstraintScope.PARENT && targetParent && targetParent.selections) {
      const catId = activeCatalogueId || (roster ? roster.catalogueId : null);
      const targetId = mod.repeat.childId || mod.repeat.field;

      const countMatches = (list) => (list || []).reduce((sum, s) => {
        let isMatch = false;
        const sId = s.entryLinkId || s.selectionEntryId;
        if (sId === targetId) {
          isMatch = true;
        } else if (system) {
          const raw = findEntryInSystem(system, sId, catId);
          const res = raw && resolveEntry(system, raw, catId);
          if (res && (res.targetId === targetId || res.id === targetId)) isMatch = true;
          if (targetId === 'model' && res && (res.type === 'model' || res.type === 'unit')) isMatch = true;
        }

        let acc = sum + (isMatch ? (s.number || 1) : 0);
        if (mod.repeat.includeChildSelections && s.selections) {
          acc += countMatches(s.selections);
        }
        return acc;
      }, 0);

      currentValue = countMatches(targetParent.selections);
    } else if (isRosterLimitField(mod.repeat.field)) {
      currentValue = roster?.costLimit || 0;
    } else if (mod.repeat.childId) {
      currentValue = selectionCounts[mod.repeat.childId] || (forceCategoryCounts && forceCategoryCounts[mod.repeat.childId]) || 0;
    } else if (mod.repeat.field) {
      currentValue = selectionCounts[mod.repeat.field] || (forceCategoryCounts && forceCategoryCounts[mod.repeat.field]) || 0;
    }

    const repVal = mod.repeat.value ? (mod.repeat.roundUp ? Math.ceil(currentValue / mod.repeat.value) : Math.floor(currentValue / mod.repeat.value)) : 0;
    return repVal * (mod.repeat.repeats || 1);
  };

  // Wendet einen increment/decrement/set-Modifier auf die passende
  // Characteristic eines Profils an und pflegt den Breakdown-Verlauf.
  const applyCharacteristicModifier = (mod, profile, ctx, sourceName) => {
    if (mod.type !== 'increment' && mod.type !== 'decrement' && mod.type !== 'set') return;
    const char = profile.characteristics?.find(c => c.id === mod.field || c.name === mod.field);
    if (!char) return;

    const condsPass = mod.conditions?.every(c => evaluateCondition(c, ctx)) !== false;
    const groupsPass = mod.conditionGroups?.every(g => evaluateConditionGroup(g, ctx)) !== false;
    if (!condsPass || !groupsPass) return;

    let modAmount = typeof mod.valueObject === 'number' ? mod.valueObject : (parseFloat(mod.value) || 0);
    if (mod.repeat) {
      modAmount = modAmount * computeRepeatCount(mod, ctx);
    }

    if (char.originalValue === undefined) {
      char.originalValue = char.value;
      char.modificationBreakdown = [];
    }

    const condNames = collectConditionNames(mod);
    const condSuffix = condNames.length > 0 ? ` (${condNames.join(', ')})` : '';
    const displayModVal = (mod.type === 'increment' ? '+' : mod.type === 'decrement' ? '-' : '') + Math.abs(modAmount);
    char.modificationBreakdown.push(`${displayModVal} von ${sourceName}${condSuffix}`);

    const currentVal = parseFloat(char.value) || 0;
    if (mod.type === 'set') {
      char.value = mod.value;
    } else if (mod.type === 'increment') {
      char.value = (currentVal + modAmount).toString();
    } else if (mod.type === 'decrement') {
      char.value = (currentVal - modAmount).toString();
    }
  };

  const cloneProfile = (p) => {
    return {
      ...p,
      characteristics: p.characteristics ? p.characteristics.map(c => ({ ...c })) : []
    };
  };

  const addProfile = (p, sourceSel, parentSel) => {
    if (p && p.id && !seenProfileIds.has(p.id)) {
      const hiddenCtx = makeCtx(sourceSel, parentSel);
      if (!evaluateHiddenFlag(p.hidden, getEffectiveModifiers(p), hiddenCtx)) {
        seenProfileIds.add(p.id);
        const cloned = cloneProfile(p);
        cloned._sourceSelection = sourceSel;
        cloned._parentSelection = parentSel;
        profiles.push(cloned);
      }
    }
  };

  const addRule = (r, sourceSel, parentSel) => {
    if (r && r.id && !seenRuleIds.has(r.id)) {
      const hiddenCtx = makeCtx(sourceSel, parentSel);
      if (!evaluateHiddenFlag(r.hidden, getEffectiveModifiers(r), hiddenCtx)) {
        seenRuleIds.add(r.id);
        rules.push(r);
      }
    }
  };

  const traverse = (sel, parentSel = null) => {
    const initialProfilesCount = profiles.length;

    if (sel.profiles) sel.profiles.forEach(p => addProfile(p, sel, parentSel));
    if (sel.rules) sel.rules.forEach(r => addRule(r, sel, parentSel));

    const entryId = sel.entryLinkId || sel.selectionEntryId;
    const rawEntry = findEntryInSystem(system, entryId, activeCatalogueId);
    if (rawEntry) {
      const resolved = resolveEntry(system, rawEntry, activeCatalogueId);
      if (resolved) {
        if (resolved.profiles) resolved.profiles.forEach(p => addProfile(p, sel, parentSel));
        if (resolved.rules) resolved.rules.forEach(r => addRule(r, sel, parentSel));

        // Accumulate from catalog child elements (default profiles)
        resolved.selectionEntries?.forEach(child => {
          const childResolved = resolveEntry(system, child, activeCatalogueId);
          if (childResolved) {
            const minCon = childResolved.constraints?.find(c => c.type === 'min')?.value || 0;
            const isMandatory = minCon > 0;
            const isUpgrade = (childResolved.type || 'upgrade') === 'upgrade';
            if (!isUpgrade || isMandatory) {
              if (childResolved.profiles) childResolved.profiles.forEach(p => addProfile(p, sel, parentSel));
              if (childResolved.rules) childResolved.rules.forEach(r => addRule(r, sel, parentSel));
            }
          }
        });

        // Apply selection-level characteristic modifiers to profiles. Group
        // modifiers are folded in only when their group conditions pass (gating).
        const ctx = makeCtx(sel, parentSel);
        const charMods = getEffectiveModifiers(sel).concat(getEffectiveModifiers(resolved));
        if (profiles.length > 0 && charMods.length > 0) {
          const sourceName = sel.name || resolved.name || 'Upgrade';
          profiles.forEach(p => {
            charMods.forEach(mod => applyCharacteristicModifier(mod, p, ctx, sourceName));
          });
        }
      }
    }

    // Name-based fallback for profiles (e.g. "Short Bows" -> "Short Bow")
    const profilesAdded = profiles.length - initialProfilesCount;
    if (profilesAdded === 0 && sel.name) {
      const isNameMatch = (selN, profN) => {
        if (!selN || !profN) return false;
        const s = selN.toLowerCase().trim();
        const p = profN.toLowerCase().trim();
        return s === p ||
               (s.endsWith('s') && s.slice(0, -1) === p) ||
               (p.endsWith('s') && p.slice(0, -1) === s);
      };

      let foundProfiles = system.sharedProfiles?.filter(p => isNameMatch(sel.name, p.name)) || [];
      if (foundProfiles.length === 0 && system.catalogues) {
        for (const cat of system.catalogues) {
          foundProfiles = cat.sharedProfiles?.filter(p => isNameMatch(sel.name, p.name)) || [];
          if (foundProfiles.length > 0) break;
        }
      }
      foundProfiles.forEach(p => addProfile(p, sel, parentSel));
    }

    if (sel.selections) {
      sel.selections.forEach(child => traverse(child, sel));
    }
  };

  traverse(selection);

  // Apply profile-level modifiers exactly once per profile at the end of collection
  profiles.forEach(p => {
    const ctx = makeCtx(p._sourceSelection || selection, p._parentSelection);
    const profileModifiers = getEffectiveModifiers(p);
    if (profileModifiers.length > 0) {
      // Use profile name as the source since these are defined on the profile itself
      profileModifiers.forEach(mod => applyCharacteristicModifier(mod, p, ctx, p.name));
    }

    // Apply any condition-met `field="name"` modifiers to the (cloned) profile name,
    // so an infoLink that renames a shared profile (e.g. The Empire "Empire soldier"
    // -> "Halberdier"/"Spearmen") surfaces the effective name wherever profiles show.
    p.name = getEffectiveName(p, ctx);

    delete p._sourceSelection;
    delete p._parentSelection;
  });

  return { profiles, rules };
}
