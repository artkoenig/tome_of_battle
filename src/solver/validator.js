import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { evaluateCondition, evaluateConditionGroup, getModifiedConstraintValue } from './modifierEvaluator.js';
import { getOptionDisplayCost, getSelectionTotalCost, calculateRosterCosts, computeRosterCounts } from './rosterCounter.js';

export { findEntryInSystem, resolveEntry } from './catalogResolver.js';
export { evaluateCondition, evaluateConditionGroup, getModifiedConstraintValue } from './modifierEvaluator.js';
export { getOptionDisplayCost, getSelectionTotalCost, calculateRosterCosts, computeRosterCounts } from './rosterCounter.js';

export function validateRoster(roster, system) {
  const errors = [];
  if (!roster || !system) return errors;


  const { selectionCounts, forceSelectionCounts, categoryCounts } = computeRosterCounts(roster, system);
  // 1. Calculate points vs limit
  const costs = calculateRosterCosts(roster, system);
  if (roster.costLimit && roster.costLimitType) {
    const limit = roster.costLimit;
    const current = costs[roster.costLimitType] || 0;
    if (current > limit) {
      errors.push({
        type: 'roster-limit',
        message: `Punkteüberschreitung: Du hast ${current} von maximal ${limit} Punkten verwendet.`,
        severity: 'error'
      });
    }
  }


  // 2. Validate Detachment / Force category limits
  roster.forces.forEach(force => {
    // Find force definition in system
    const forceDef = system.forceEntries?.find(fe => fe.id === force.forceEntryId);
    if (!forceDef) return;

    // A force entry has categoryLinks specifying constraints
    forceDef.categoryLinks?.forEach(catLink => {
      const targetCatId = catLink.targetId;
      const catDef = system.categoryEntries?.find(ce => ce.id === targetCatId);
      const catName = catDef ? catDef.name : catLink.name;

      // Count selections in this force that fall under this category
      const forceCategoryCounts = categoryCounts[force.id] || {};
      const count = forceCategoryCounts[targetCatId] || 0;

      // Check min/max constraints on the category link
      let constraintsToValidate = [...(catLink.constraints || [])];
      if (targetCatId === 'c16b-f319-2c62-2c12' && !constraintsToValidate.some(c => c.type === 'max')) {
        const charCatLink = forceDef.categoryLinks?.find(cl => cl.targetId === '7a1c-d611-c2dc-def1');
        const charMaxCon = charCatLink?.constraints?.find(c => c.type === 'max');
        if (charMaxCon) {
          constraintsToValidate.push({
            ...charMaxCon,
            id: 'fallback-heroes-max',
            type: 'max',
            isFallback: true,
            modifiers: charCatLink.modifiers
          });
        }
      }

      constraintsToValidate.forEach(con => {
        const finalValue = getModifiedConstraintValue(con, con.isFallback ? con.modifiers : catLink.modifiers, roster, selectionCounts, forceCategoryCounts);
        if (finalValue < 0) return;
        
        if (con.type === 'min' && count < finalValue) {
          errors.push({
            type: 'category-min',
            forceId: force.id,
            categoryId: targetCatId,
            message: `Mindestens ${finalValue} Auswahlen für "${catName}" in ${forceDef.name} benötigt (aktuell: ${count}).`,
            severity: 'error'
          });
        }
        if (con.type === 'max' && count > finalValue) {
          errors.push({
            type: 'category-max',
            forceId: force.id,
            categoryId: targetCatId,
            message: `Maximal ${finalValue} Auswahlen für "${catName}" in ${forceDef.name} erlaubt (aktuell: ${count}).`,
            severity: 'error'
          });
        }
      });
    });

    const validateSelectionConstraints = (selection, parentSelection = null, force = null) => {
      const entryId = selection.entryLinkId || selection.selectionEntryId;
      const forceCatalogueId = force?.catalogueId || roster.catalogueId;
      const rawEntry = findEntryInSystem(system, entryId, forceCatalogueId);
      const entry = resolveEntry(system, rawEntry, forceCatalogueId);

      console.log(`Validating selection ${selection.name}, entryId ${entryId}, found: ${!!entry}`);

      if (!entry) return;

      const forceCategoryCounts = force ? (categoryCounts[force.id] || {}) : {};

       // 1. Validate individual constraints of this entry
      if (entry.constraints) {
        entry.constraints.forEach(con => {
          const finalValue = getModifiedConstraintValue(con, entry.modifiers, roster, selectionCounts, forceCategoryCounts);
          if (finalValue < 0) return;
          
          // Check scope applicability for specific category/entry scoped constraints
          if (con.scope !== 'parent' && con.scope !== 'force' && con.scope !== 'roster') {
            const belongsToScope = (selection.selectionEntryId === con.scope || selection.entryLinkId === con.scope) ||
                                  (entry.categoryLinks?.some(cl => cl.targetId === con.scope)) ||
                                  (parentSelection && (parentSelection.selectionEntryId === con.scope || parentSelection.entryLinkId === con.scope));
            if (!belongsToScope) return;
          }

          // Determine current count in scope
          let count = selection.number || 1;
          
          if (con.scope === 'parent') {
            if (parentSelection) {
              const childMatch = parentSelection.selections?.filter(s => {
                const subId = s.entryLinkId || s.selectionEntryId;
                if (subId === entryId) return true;
                if (entry.targetId) {
                  const sDef = findEntryInSystem(system, subId, force ? force.catalogueId : null);
                  const sRes = resolveEntry(system, sDef, force ? force.catalogueId : null);
                  return subId === entry.targetId || (sRes && sRes.targetId === entry.targetId);
                }
                return false;
              }) || [];
              count = childMatch.reduce((sum, s) => sum + (s.number || 1), 0);
            } else if (force) {
              const forceMatch = force.selections?.filter(s => {
                const subId = s.entryLinkId || s.selectionEntryId;
                if (subId === entryId) return true;
                if (entry.targetId) {
                  const sDef = findEntryInSystem(system, subId, force.catalogueId);
                  const sRes = resolveEntry(system, sDef, force.catalogueId);
                  return subId === entry.targetId || (sRes && sRes.targetId === entry.targetId);
                }
                return false;
              }) || [];
              count = forceMatch.reduce((sum, s) => sum + (s.number || 1), 0);
            }
          } else if (con.scope === 'roster') {
            count = Math.max(selectionCounts[entryId] || 0, (entry.targetId ? selectionCounts[entry.targetId] || 0 : 0));
          } else if (con.scope === 'force') {
            const fCounts = force ? forceSelectionCounts[force.id] || {} : {};
            count = Math.max(fCounts[entryId] || 0, (entry.targetId ? fCounts[entry.targetId] || 0 : 0));
          }

          if (con.type === 'min' && count < finalValue) {
            errors.push({
              type: 'entry-min',
              selectionId: selection.id,
              message: `Option "${selection.name}" erfordert mindestens ${finalValue} Auswahlen (aktuell: ${count}).`,
              severity: 'error'
            });
          }
          if (con.type === 'max' && count > finalValue) {
            errors.push({
              type: 'entry-max',
              selectionId: selection.id,
              message: `Option "${selection.name}" erlaubt maximal ${finalValue} Auswahlen (aktuell: ${count}).`,
              severity: 'error'
            });
          }
          console.log(`Validating constraint ${con.type} ${con.value} for ${selection.name}, scope ${con.scope}, count ${count}, finalValue ${finalValue}`);
        });
      }

      // 2. Validate group constraints for any groups defined on this entry
      const groups = [];
      const collectGroups = (def) => {
        if (!def) return;
        def.selectionEntryGroups?.forEach(g => {
          groups.push(g);
          collectGroups(g);
        });
        def.entryLinks?.forEach(el => {
          if (el.type === 'selectionEntryGroup') {
            const resolvedGroup = resolveEntry(system, el, forceCatalogueId);
            if (resolvedGroup) {
              groups.push(resolvedGroup);
              collectGroups(resolvedGroup);
            }
          }
        });
        def.selectionEntries?.forEach(se => {
          const resolvedSE = resolveEntry(system, se, forceCatalogueId);
          if (resolvedSE && resolvedSE.type !== 'model') {
            collectGroups(resolvedSE);
          }
        });
      };

      collectGroups(entry);

      groups.forEach(group => {
        const groupItemIds = new Set();
        const visitedDefs = new Set();
        const collectGroupItemIds = (gDef) => {
          if (!gDef || visitedDefs.has(gDef.id)) return;
          if (gDef.id) visitedDefs.add(gDef.id);

          gDef.selectionEntries?.forEach(item => {
            groupItemIds.add(item.id);
            const res = resolveEntry(system, item, forceCatalogueId);
            if (res) groupItemIds.add(res.id);
          });
          gDef.entryLinks?.forEach(link => {
            groupItemIds.add(link.id);
            groupItemIds.add(link.targetId);
            const res = resolveEntry(system, link, forceCatalogueId);
            if (res) {
              groupItemIds.add(res.id);
              collectGroupItemIds(res);
            }
          });
          gDef.selectionEntryGroups?.forEach(subG => {
            collectGroupItemIds(subG);
          });
        };

        collectGroupItemIds(group);

        const matchingSelections = selection.selections?.filter(s => {
          const sId = s.entryLinkId || s.selectionEntryId;
          return groupItemIds.has(sId);
        }) || [];

        const totalCount = matchingSelections.reduce((sum, s) => sum + (s.number || 1), 0);
        const totalPoints = matchingSelections.reduce((sum, s) => {
          const pts = getSelectionTotalCost(s, roster.costLimitType);
          return sum + pts;
        }, 0);

        group.constraints?.forEach(con => {
          const finalValue = getModifiedConstraintValue(con, group.modifiers, roster, selectionCounts, forceCategoryCounts);
          if (finalValue < 0) return;
          
          // Check scope applicability for specific category/entry scoped constraints
          if (con.scope !== 'parent' && con.scope !== 'force' && con.scope !== 'roster') {
            const belongsToScope = (selection.selectionEntryId === con.scope || selection.entryLinkId === con.scope) ||
                                  (entry.categoryLinks?.some(cl => cl.targetId === con.scope));
            if (!belongsToScope) return;
          }
          const isCostField = con.field === 'pts' || con.field === 'ecfa-8486-4f6c-c249' || con.field === roster.costLimitType || system.costTypes?.some(ct => ct.id === con.field);
          if (isCostField) {
            if (con.type === 'max' && totalPoints > finalValue) {
              errors.push({
                type: 'group-points-max',
                selectionId: selection.id,
                message: `Kategorie "${group.name}" erlaubt maximal ${finalValue} Punkte (aktuell: ${totalPoints} Pkt. für ${selection.name}).`,
                severity: 'error'
              });
            }
            if (con.type === 'min' && totalPoints < finalValue && totalPoints > 0) {
              errors.push({
                type: 'group-points-min',
                selectionId: selection.id,
                message: `Kategorie "${group.name}" erfordert mindestens ${finalValue} Punkte (aktuell: ${totalPoints} Pkt. für ${selection.name}).`,
                severity: 'error'
              });
            }
          } else {
            if (con.type === 'max' && totalCount > finalValue) {
              errors.push({
                type: 'group-count-max',
                selectionId: selection.id,
                message: `Kategorie "${group.name}" erlaubt maximal ${finalValue} Auswahlen (aktuell: ${totalCount} für ${selection.name}).`,
                severity: 'error'
              });
            }
            if (con.type === 'min' && totalCount < finalValue && totalCount > 0) {
              errors.push({
                type: 'group-count-min',
                selectionId: selection.id,
                message: `Kategorie "${group.name}" erfordert mindestens ${finalValue} Auswahlen (aktuell: ${totalCount} für ${selection.name}).`,
                severity: 'error'
              });
            }
          }
        });
      });

      // Check children
      if (selection.selections) {
        selection.selections.forEach(child => validateSelectionConstraints(child, selection, force));
      }
    };

    if (force.selections) {
      force.selections.forEach(sel => validateSelectionConstraints(sel, null, force));
    }
  });

  return errors;
}

export function syncRosterSelectionsWithSystem(roster, system) {
  if (!roster || !system) return false;
  let rosterModified = false;

  const syncSelection = (selection, catalogueId) => {
    const entryId = selection.selectionEntryId || selection.entryLinkId;
    if (entryId) {
      const entryDef = findEntryInSystem(system, entryId, catalogueId);
      if (entryDef) {
        const resolved = resolveEntry(system, entryDef, catalogueId);
        if (resolved) {
          if (selection.name !== resolved.name) {
            selection.name = resolved.name;
            rosterModified = true;
          }
          const oldCostsJson = JSON.stringify(selection.costs || []);
          const newCostsJson = JSON.stringify(resolved.costs || []);
          if (oldCostsJson !== newCostsJson) {
            selection.costs = resolved.costs || [];
            rosterModified = true;
          }
        }
      }
    }
    if (selection.selections) {
      selection.selections.forEach(child => syncSelection(child, catalogueId));
    }
  };

  roster.forces?.forEach(force => {
    force.selections?.forEach(sel => syncSelection(sel, force.catalogueId || roster.catalogueId));
  });

  return rosterModified;
}

/**
 * Recursively collects all unique profiles and rules for a given selection.
 * Including from its sub-selections and their resolved catalog entries.
 */
export function collectUnitProfilesAndRules(system, selection, activeCatalogueId = null) {
  const profiles = [];
  const rules = [];
  const seenProfileIds = new Set();
  const seenRuleIds = new Set();

  const addProfile = (p) => {
    if (p && p.id && !seenProfileIds.has(p.id)) {
      seenProfileIds.add(p.id);
      profiles.push(p);
    }
  };

  const addRule = (r) => {
    if (r && r.id && !seenRuleIds.has(r.id)) {
      seenRuleIds.add(r.id);
      rules.push(r);
    }
  };

  const traverse = (sel) => {
    if (sel.profiles) sel.profiles.forEach(addProfile);
    if (sel.rules) sel.rules.forEach(addRule);

    const entryId = sel.entryLinkId || sel.selectionEntryId;
    const rawEntry = findEntryInSystem(system, entryId, activeCatalogueId);
    if (rawEntry) {
      const resolved = resolveEntry(system, rawEntry, activeCatalogueId);
      if (resolved) {
        if (resolved.profiles) resolved.profiles.forEach(addProfile);
        if (resolved.rules) resolved.rules.forEach(addRule);

        // Accumulate from catalog child elements (default profiles)
        resolved.selectionEntries?.forEach(child => {
          const childResolved = resolveEntry(system, child, activeCatalogueId);
          if (childResolved) {
            if (childResolved.profiles) childResolved.profiles.forEach(addProfile);
            if (childResolved.rules) childResolved.rules.forEach(addRule);
          }
        });
      }
    }

    if (sel.selections) {
      sel.selections.forEach(traverse);
    }
  };

  traverse(selection);

  return { profiles, rules };
}
