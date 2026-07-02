import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { evaluateCondition, evaluateConditionGroup, getModifiedConstraintValue } from './modifierEvaluator.js';
import { getOptionDisplayCost, getSelectionTotalCost, calculateRosterCosts, computeRosterCounts } from './rosterCounter.js';
import { WFB6_HEROES_CATEGORY_ID, WFB6_CHARACTERS_CATEGORY_ID } from './constants.js';
import '../types.js';

export { findEntryInSystem, resolveEntry } from './catalogResolver.js';
export { evaluateCondition, evaluateConditionGroup, getModifiedConstraintValue } from './modifierEvaluator.js';
export { getOptionDisplayCost, getSelectionTotalCost, calculateRosterCosts, computeRosterCounts } from './rosterCounter.js';

/**
 * Validates a roster against a game system's rules and constraints.
 * @param {import('../types.js').Roster} roster
 * @param {Object} system
 * @returns {import('../types.js').ValidationError[]}
 */
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
    const forceDef = findForceEntryById(system, force.forceEntryId);
    if (!forceDef) return;

    // A force entry has categoryLinks specifying constraints
    forceDef.categoryLinks?.forEach(catLink => {
      const targetCatId = catLink.targetId;
      const forceCategoryCounts = categoryCounts[force.id] || {};

      // Check if this category link is hidden
      if (isCategoryLinkHidden(catLink, system, roster, selectionCounts, forceCategoryCounts)) {
        return;
      }

      const catDef = system.categoryEntries?.find(ce => ce.id === targetCatId);
      const catName = catDef ? catDef.name : catLink.name;

      // Count selections in this force that fall under this category
      const count = forceCategoryCounts[targetCatId] || 0;

      // Check min/max constraints on the category link
      let constraintsToValidate = [...(catLink.constraints || [])];
      if (targetCatId === WFB6_HEROES_CATEGORY_ID && !constraintsToValidate.some(c => c.type === 'max')) {
        const charCatLink = forceDef.categoryLinks?.find(cl => cl.targetId === WFB6_CHARACTERS_CATEGORY_ID);
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
        const ctx = { roster, selectionCounts, forceCategoryCounts, force, system };
        const finalValue = getModifiedConstraintValue(con, con.isFallback ? con.modifiers : catLink.modifiers, ctx);
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



      if (!entry) return;

      const forceCategoryCounts = force ? (categoryCounts[force.id] || {}) : {};

       // 1. Validate individual constraints of this entry
      if (entry.constraints) {
        entry.constraints.forEach(con => {
          const ctx = { roster, selectionCounts, forceCategoryCounts: Object.values(categoryCounts).reduce((acc, counts) => ({ ...acc, ...counts }), {}), selection, parentSelection, force, system, parentCatalogueId: forceCatalogueId };
          const finalValue = getModifiedConstraintValue(con, entry.modifiers, ctx);
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
          
          if (con.scope !== 'parent' && con.scope !== 'force' && con.scope !== 'roster') {
            count = selectionCounts[con.scope] || (forceCategoryCounts ? forceCategoryCounts[con.scope] : 0) || count;
          } else if (con.scope === 'parent') {
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
          if (con.type === 'percent' && roster.costLimit) {
            const finalValuePoints = (finalValue / 100) * roster.costLimit;
            const pts = getSelectionTotalCost(selection, roster.costLimitType);
            if (pts > finalValuePoints) {
              errors.push({
                type: 'entry-percent-max',
                selectionId: selection.id,
                message: `Option "${selection.name}" darf maximal ${finalValue}% der Punkte kosten (${finalValuePoints} Pkt.), kostet aber ${pts} Pkt.`,
                severity: 'error'
              });
            }
          }

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
          const ctx = { roster, selectionCounts, forceCategoryCounts, selection, parentSelection, force, system, parentCatalogueId: forceCatalogueId };
          const finalValue = getModifiedConstraintValue(con, group.modifiers, ctx);
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
          if (con.type === 'percent' && roster.costLimit) {
            const finalValuePoints = (finalValue / 100) * roster.costLimit;
            const pts = isCostField ? totalPoints : totalPoints; // actually we use totalPoints
            if (pts > finalValuePoints) {
              errors.push({
                type: 'group-percent-max',
                selectionId: selection.id,
                message: `Kategorie "${group.name}" darf maximal ${finalValue}% der Punkte kosten (${finalValuePoints} Pkt.), kostet aber ${pts} Pkt.`,
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
    let activeForceId = null;
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
        activeForceId = activeForce.id;
        forceCategoryCounts = counts.categoryCounts[activeForceId] || {};
      } else {
        forceCategoryCounts = Object.values(counts.categoryCounts).reduce((acc, c) => ({ ...acc, ...c }), {});
      }
    }
  }

  const getConditionName = (cond) => {
    if (!cond) return '';
    const targetId = cond.scope && cond.scope !== 'parent' && cond.scope !== 'force' && cond.scope !== 'roster' ? cond.scope : (cond.childId || cond.field);
    if (!targetId) return '';
    const entry = findEntryInSystem(system, targetId, activeCatalogueId);
    if (entry) return entry.name;
    const cat = system.categoryEntries?.find(c => c.id === targetId);
    if (cat) return cat.name;
    return '';
  };

  const cloneProfile = (p) => {
    return {
      ...p,
      characteristics: p.characteristics ? p.characteristics.map(c => ({ ...c })) : []
    };
  };

  const addProfile = (p, sourceSel, parentSel) => {
    if (p && p.id && !seenProfileIds.has(p.id)) {
      const ctx = {
        roster,
        selectionCounts,
        forceCategoryCounts,
        selection: sourceSel,
        parentSelection: parentSel,
        system,
        parentCatalogueId: activeCatalogueId
      };
      
      let isHidden = p.hidden === true;
      if (p.modifiers && p.modifiers.length > 0) {
        p.modifiers.forEach(mod => {
          if (mod.field === 'hidden') {
            const condsPass = mod.conditions?.every(c => evaluateCondition(c, ctx)) !== false;
            const groupsPass = mod.conditionGroups?.every(g => evaluateConditionGroup(g, ctx)) !== false;
            if (condsPass && groupsPass) {
              const val = mod.value === 'true' || mod.value === true || mod.valueObject === true;
              if (mod.type === 'set') {
                isHidden = val;
              }
            }
          }
        });
      }
      
      if (!isHidden) {
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
      const ctx = {
        roster,
        selectionCounts,
        forceCategoryCounts,
        selection: sourceSel,
        parentSelection: parentSel,
        system,
        parentCatalogueId: activeCatalogueId
      };
      
      let isHidden = r.hidden === true;
      if (r.modifiers && r.modifiers.length > 0) {
        r.modifiers.forEach(mod => {
          if (mod.field === 'hidden') {
            const condsPass = mod.conditions?.every(c => evaluateCondition(c, ctx)) !== false;
            const groupsPass = mod.conditionGroups?.every(g => evaluateConditionGroup(g, ctx)) !== false;
            if (condsPass && groupsPass) {
              const val = mod.value === 'true' || mod.value === true || mod.valueObject === true;
              if (mod.type === 'set') {
                isHidden = val;
              }
            }
          }
        });
      }
      
      if (!isHidden) {
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

        // Apply selection-level characteristic modifiers to profiles
        if (profiles.length > 0) {
          profiles.forEach(p => {
            const charMods = (sel.modifiers || []).concat(resolved.modifiers || []);
              
            charMods.forEach(mod => {
              if (mod.type === 'increment' || mod.type === 'decrement' || mod.type === 'set') {
                const char = p.characteristics?.find(c => c.id === mod.field || c.name === mod.field);
                if (char) {
                  const ctx = {
                    roster,
                    selectionCounts,
                    forceCategoryCounts,
                    selection: sel,
                    parentSelection: parentSel,
                    system,
                    parentCatalogueId: activeCatalogueId
                  };
                  
                  const condsPass = mod.conditions?.every(c => evaluateCondition(c, ctx)) !== false;
                  const groupsPass = mod.conditionGroups?.every(g => evaluateConditionGroup(g, ctx)) !== false;
                  
                  if (condsPass && groupsPass) {
                    let modAmount = typeof mod.valueObject === 'number' ? mod.valueObject : (parseFloat(mod.value) || 0);
                    
                    if (mod.repeat) {
                      let currentValue = 0;
                      const targetParent = ctx.parentSelection || ctx.selection;
                      if (mod.repeat.scope === 'parent' && targetParent && targetParent.selections) {
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
                      } else if (mod.repeat.field && mod.repeat.field.startsWith('limit::')) {
                        currentValue = roster?.costLimit || 0;
                      } else if (mod.repeat.childId) {
                        currentValue = selectionCounts[mod.repeat.childId] || (forceCategoryCounts && forceCategoryCounts[mod.repeat.childId]) || 0;
                      } else if (mod.repeat.field) {
                        currentValue = selectionCounts[mod.repeat.field] || (forceCategoryCounts && forceCategoryCounts[mod.repeat.field]) || 0;
                      }

                      const repVal = mod.repeat.value ? (mod.repeat.roundUp ? Math.ceil(currentValue / mod.repeat.value) : Math.floor(currentValue / mod.repeat.value)) : 0;
                      modAmount = modAmount * repVal * (mod.repeat.repeats || 1);
                    }

                    if (char.originalValue === undefined) {
                      char.originalValue = char.value;
                      char.modificationBreakdown = [];
                    }

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
                    
                    const condSuffix = condNames.length > 0 ? ` (${condNames.join(', ')})` : '';
                    const displayModVal = (mod.type === 'increment' ? '+' : mod.type === 'decrement' ? '-' : '') + Math.abs(modAmount);
                    char.modificationBreakdown.push(`${displayModVal} von ${sel.name || resolved.name || 'Upgrade'}${condSuffix}`);

                    let currentVal = parseFloat(char.value) || 0;
                    if (mod.type === 'set') {
                      char.value = mod.value;
                    } else if (mod.type === 'increment') {
                      char.value = (currentVal + modAmount).toString();
                    } else if (mod.type === 'decrement') {
                      char.value = (currentVal - modAmount).toString();
                    }
                  }
                }
              }
            });
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
               (p.endsWith('s') && p.slice(0, -1) === s) ||
               s.includes(p) ||
               p.includes(s);
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
    if (p.modifiers && p.modifiers.length > 0) {
      p.modifiers.forEach(mod => {
        if (mod.type === 'increment' || mod.type === 'decrement' || mod.type === 'set') {
          const char = p.characteristics?.find(c => c.id === mod.field || c.name === mod.field);
          if (char) {
            const ctx = {
              roster,
              selectionCounts,
              forceCategoryCounts,
              selection: p._sourceSelection || selection,
              parentSelection: p._parentSelection,
              system,
              parentCatalogueId: activeCatalogueId
            };
            
            const condsPass = mod.conditions?.every(c => evaluateCondition(c, ctx)) !== false;
            const groupsPass = mod.conditionGroups?.every(g => evaluateConditionGroup(g, ctx)) !== false;
            
            if (condsPass && groupsPass) {
              let modAmount = typeof mod.valueObject === 'number' ? mod.valueObject : (parseFloat(mod.value) || 0);
              
              if (mod.repeat) {
                let currentValue = 0;
                const targetParent = ctx.parentSelection || ctx.selection;
                if (mod.repeat.scope === 'parent' && targetParent && targetParent.selections) {
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
                } else if (mod.repeat.field && mod.repeat.field.startsWith('limit::')) {
                  currentValue = roster?.costLimit || 0;
                } else if (mod.repeat.childId) {
                  currentValue = selectionCounts[mod.repeat.childId] || (forceCategoryCounts && forceCategoryCounts[mod.repeat.childId]) || 0;
                } else if (mod.repeat.field) {
                  currentValue = selectionCounts[mod.repeat.field] || (forceCategoryCounts && forceCategoryCounts[mod.repeat.field]) || 0;
                }

                const repVal = mod.repeat.value ? (mod.repeat.roundUp ? Math.ceil(currentValue / mod.repeat.value) : Math.floor(currentValue / mod.repeat.value)) : 0;
                modAmount = modAmount * repVal * (mod.repeat.repeats || 1);
              }

              if (char.originalValue === undefined) {
                char.originalValue = char.value;
                char.modificationBreakdown = [];
              }

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
              
              const condSuffix = condNames.length > 0 ? ` (${condNames.join(', ')})` : '';
              const displayModVal = (mod.type === 'increment' ? '+' : mod.type === 'decrement' ? '-' : '') + Math.abs(modAmount);
              // Use profile name as the source since this is defined on the profile itself
              char.modificationBreakdown.push(`${displayModVal} von ${p.name}${condSuffix}`);

              let currentVal = parseFloat(char.value) || 0;
              if (mod.type === 'set') {
                char.value = mod.value;
              } else if (mod.type === 'increment') {
                char.value = (currentVal + modAmount).toString();
              } else if (mod.type === 'decrement') {
                char.value = (currentVal - modAmount).toString();
              }
            }
          }
        }
      });
    }
    
    // Clean up temporary variables
    delete p._sourceSelection;
    delete p._parentSelection;
  });

  return { profiles, rules };
}

export function findForceEntryById(system, forceEntryId) {
  if (!system || !forceEntryId) return null;
  // Search in game system force entries
  if (system.forceEntries) {
    const found = findForceEntryInList(system.forceEntries, forceEntryId);
    if (found) return found;
  }
  // Search in catalogues' force entries
  if (system.catalogues) {
    for (const cat of system.catalogues) {
      if (cat.forceEntries) {
        const found = findForceEntryInList(cat.forceEntries, forceEntryId);
        if (found) return found;
      }
    }
  }
  return null;
}

function findForceEntryInList(list, id) {
  for (const fe of list) {
    if (fe.id === id) return fe;
    if (fe.forceEntries) {
      const sub = findForceEntryInList(fe.forceEntries, id);
      if (sub) return sub;
    }
  }
  return null;
}

export function isCategoryLinkHidden(link, system, roster, selectionCounts, forceCategoryCounts) {
  let isHidden = link.hidden === true;
  if (!link.modifiers || link.modifiers.length === 0) {
    return isHidden;
  }
  
  const ctx = {
    roster,
    system,
    selectionCounts,
    forceCategoryCounts,
    parentCatalogueId: roster?.catalogueId
  };

  link.modifiers.forEach(mod => {
    if (mod.field === 'hidden') {
      const condsPass = mod.conditions?.every(c => evaluateCondition(c, ctx)) !== false;
      const groupsPass = mod.conditionGroups?.every(g => evaluateConditionGroup(g, ctx)) !== false;
      if (condsPass && groupsPass) {
        const val = mod.value === 'true' || mod.value === true || mod.valueObject === true;
        if (mod.type === 'set') {
          isHidden = val;
        }
      }
    }
  });

  return isHidden;
}

export function getAvailableForceEntries(systemDef, catId) {
  if (!systemDef) return [];
  const entries = [];
  
  // Get from system definition
  if (systemDef.forceEntries) {
    systemDef.forceEntries.forEach(fe => {
      if (fe.hidden !== true) {
        entries.push(fe);
      }
    });
  }

  // Get from selected catalogue
  if (systemDef.catalogues && catId) {
    const selectedCat = systemDef.catalogues.find(c => c.id === catId);
    if (selectedCat && selectedCat.forceEntries) {
      selectedCat.forceEntries.forEach(fe => {
        if (fe.hidden !== true) {
          entries.push(fe);
        }
      });
    }
  }

  return entries;
}

export function isSelectionEntryHidden(entry, system, roster, selectionCounts, forceCategoryCounts, force) {
  const res = resolveEntry(system, entry);
  if (!res) return false;
  
  let isHidden = entry.hidden === true || res.hidden === true;
  
  const allModifiers = [
    ...(entry.modifiers || []),
    ...(entry.modifierGroups?.flatMap(g => g.modifiers || []) || []),
    ...(res.modifiers || []),
    ...(res.modifierGroups?.flatMap(g => g.modifiers || []) || [])
  ];

  if (allModifiers.length === 0) {
    return isHidden;
  }

  const ctx = {
    roster,
    system,
    selectionCounts,
    forceCategoryCounts,
    force: force || roster?.forces?.[0],
    parentCatalogueId: roster?.catalogueId
  };

  allModifiers.forEach(mod => {
    if (mod.field === 'hidden') {
      const condsPass = mod.conditions?.every(c => evaluateCondition(c, ctx)) !== false;
      const groupsPass = mod.conditionGroups?.every(g => evaluateConditionGroup(g, ctx)) !== false;
      if (condsPass && groupsPass) {
        const val = mod.value === 'true' || mod.value === true || mod.valueObject === true;
        if (mod.type === 'set') {
          isHidden = val;
        }
      }
    }
  });

  return isHidden;
}

