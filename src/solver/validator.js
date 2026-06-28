export function findEntryInCatalogue(catalogue, entryId) {
  if (!catalogue) return null;
  
  if (!catalogue._entryCache) {
    catalogue._entryCache = new Map();
    
    const indexObject = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (obj.id) {
        catalogue._entryCache.set(obj.id, obj);
      }
      for (const key in obj) {
        const val = obj[key];
        if (Array.isArray(val)) {
          for (let i = 0; i < val.length; i++) {
            indexObject(val[i]);
          }
        } else if (val && typeof val === 'object') {
          if (key !== '_entryCache') {
            indexObject(val);
          }
        }
      }
    };

    indexObject(catalogue);
  }

  return catalogue._entryCache.get(entryId) || null;
}

export function findEntryInSystem(system, entryId, catalogueId = null) {
  if (!system) return null;
  
  if (!system._entryCache || system._entryCacheSource !== system.catalogues) {
    system._entryCache = new Map();
    system._entryCacheSource = system.catalogues;
    
    const indexCatalogue = (cat, catId) => {
      if (!cat) return;
      if (!system._entryCache.has(catId)) {
        system._entryCache.set(catId, new Map());
      }
      const cacheMap = system._entryCache.get(catId);
      
      const indexObject = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.id) {
          cacheMap.set(obj.id, obj);
        }
        for (const key in obj) {
          const val = obj[key];
          if (Array.isArray(val)) {
            for (let i = 0; i < val.length; i++) {
              indexObject(val[i]);
            }
          } else if (val && typeof val === 'object') {
            if (key !== '_entryCache' && key !== 'catalogues') {
              indexObject(val);
            }
          }
        }
      };
      
      indexObject(cat);
    };

    // Index the game system itself (using system.id)
    indexCatalogue(system, system.id);
    
    // Index all catalogues
    system.catalogues?.forEach(cat => {
      indexCatalogue(cat, cat.id);
    });
  }

  // Lookup logic
  if (catalogueId) {
    const catMap = system._entryCache.get(catalogueId);
    if (catMap && catMap.has(entryId)) {
      return catMap.get(entryId);
    }
  }

  // Fallback: search all maps if catalogueId is not provided or entry not found in preferred catalogue
  for (const [catId, catMap] of system._entryCache.entries()) {
    if (catMap.has(entryId)) {
      return catMap.get(entryId);
    }
  }

  return null;
}

/**
 * Resolves an entryLink or returns the selectionEntry directly, resolving linked profiles/rules
 */
export function resolveEntry(system, entry, catalogueId = null) {
  if (!entry) return null;
  
  let resolved = { ...entry };
  if (entry.targetId) {
    const target = findEntryInSystem(system, entry.targetId, catalogueId);
    if (target) {
      resolved = {
        ...target,
        id: entry.id, // Keep the link's id for roster mapping
        targetId: entry.targetId,
        name: entry.name || target.name,
        constraints: [...(entry.constraints || []), ...(target.constraints || [])],
        costs: (entry.costs && entry.costs.length > 0) ? entry.costs : (target.costs || []),
        categoryLinks: [...(entry.categoryLinks || []), ...(target.categoryLinks || [])],
        profiles: [...(entry.profiles || []), ...(target.profiles || [])],
        rules: [...(entry.rules || []), ...(target.rules || [])],
        infoLinks: [...(entry.infoLinks || []), ...(target.infoLinks || [])],
        selectionEntries: [...(entry.selectionEntries || []), ...(target.selectionEntries || [])],
        selectionEntryGroups: [...(entry.selectionEntryGroups || []), ...(target.selectionEntryGroups || [])],
        entryLinks: [...(entry.entryLinks || []), ...(target.entryLinks || [])]
      };
    }
  }

  // Resolve infoLinks of the resolved entry
  if (resolved.infoLinks && resolved.infoLinks.length > 0) {
    resolved.infoLinks.forEach(link => {
      const target = findEntryInSystem(system, link.targetId, catalogueId);
      if (!target) return;

      if (link.type === 'rule') {
        if (!resolved.rules) resolved.rules = [];
        if (!resolved.rules.some(r => r.id === target.id)) {
          resolved.rules = [...resolved.rules, target];
        }
      } else if (link.type === 'profile') {
        if (!resolved.profiles) resolved.profiles = [];
        if (!resolved.profiles.some(p => p.id === target.id)) {
          resolved.profiles = [...resolved.profiles, target];
        }
      }
    });
  }

  return resolved;
}

/**
 * Recursively computes the display cost of an option definition, including its base cost
 * and the costs of any mandatory sub-selections (min > 0).
 */
export function getOptionDisplayCost(system, entry, costLimitType) {
  let resolved = resolveEntry(system, entry);
  if (!resolved) return 0;

  // If resolved is a skeleton or reference, look up the full entry in the system
  if (resolved.id && (!resolved.costs || resolved.costs.length === 0) && (!resolved.selectionEntries || resolved.selectionEntries.length === 0) && (!resolved.entryLinks || resolved.entryLinks.length === 0) && (!resolved.selectionEntryGroups || resolved.selectionEntryGroups.length === 0)) {
    const fullEntry = findEntryInSystem(system, resolved.id);
    if (fullEntry) {
      resolved = resolveEntry(system, fullEntry);
    }
  }

  let total = 0;
  
  // 1. Direct cost of this entry
  const directCost = resolved.costs?.find(c => c.typeId === costLimitType || c.typeId === 'pts')?.value || 0;
  total += directCost;

  // 2. Direct costs of mandatory child selection entries
  resolved.selectionEntries?.forEach(child => {
    const minCon = child.constraints?.find(c => c.type === 'min')?.value || 0;
    if (minCon > 0) {
      total += getOptionDisplayCost(system, child, costLimitType) * minCon;
    }
  });

  // 3. Direct costs of mandatory child entry links
  resolved.entryLinks?.forEach(child => {
    const minCon = child.constraints?.find(c => c.type === 'min')?.value || 0;
    if (minCon > 0) {
      total += getOptionDisplayCost(system, child, costLimitType) * minCon;
    }
  });

  // 4. Direct costs of mandatory groups
  resolved.selectionEntryGroups?.forEach(group => {
    const minCon = group.constraints?.find(c => c.type === 'min')?.value || 0;
    if (minCon > 0 && (group.selectionEntries?.length > 0 || group.entryLinks?.length > 0)) {
      const firstOption = group.selectionEntries?.[0] || group.entryLinks?.[0];
      total += getOptionDisplayCost(system, firstOption, costLimitType) * minCon;
    }
  });

  return total;
}

/**
 * Recursively calculates the total cost of a selection node and all its child selections.
 */
export function getSelectionTotalCost(selection, costLimitType) {
  let total = 0;
  if (selection.costs) {
    const cost = selection.costs.find(c => c.typeId === costLimitType || c.typeId === 'pts');
    if (cost) {
      total += (cost.value || 0) * (selection.number || 1);
    }
  }
  if (selection.selections) {
    selection.selections.forEach(child => {
      total += getSelectionTotalCost(child, costLimitType);
    });
  }
  return total;
}

/**
 * Traverses a roster's nested selections and computes total costs,
 * returning flat stats and a resolved points total.
 */
export function calculateRosterCosts(roster, system) {
  const totals = {};
  
  // Initialize cost types from system
  if (system && system.costTypes) {
    system.costTypes.forEach(ct => {
      totals[ct.id] = 0;
    });
  }

  const addSelectionCosts = (selection) => {
    // A selection has a list of costs (usually parsed from its template)
    if (selection.costs) {
      selection.costs.forEach(cost => {
        const val = (cost.value || 0) * (selection.number || 1);
        totals[cost.typeId] = (totals[cost.typeId] || 0) + val;
      });
    }

    // Traverse children
    if (selection.selections) {
      selection.selections.forEach(child => {
        // Multiply child costs by parent's count if collective is false,
        // but typically in BS child selection count stands on its own.
        addSelectionCosts(child);
      });
    }
  };

  if (roster && roster.forces) {
    roster.forces.forEach(force => {
      if (force.selections) {
        force.selections.forEach(sel => addSelectionCosts(sel));
      }
    });
  }

  return totals;
}

export const evaluateCondition = (cond, roster, selectionCounts, forceCategoryCounts) => {
  if (!cond) return false;
  let currentValue = 0;
  if (cond.field && cond.field.startsWith('limit::')) {
    currentValue = roster.costLimit || 0;
  } else if (cond.field) {
    currentValue = selectionCounts[cond.field] || forceCategoryCounts[cond.field] || 0;
  }

  const targetValue = cond.value;

  switch (cond.type) {
    case 'equalTo':
      return currentValue === targetValue;
    case 'lessThan':
      return currentValue < targetValue;
    case 'greaterThan':
      return currentValue > targetValue;
    case 'notEqualTo':
      return currentValue !== targetValue;
    case 'lessThanOrEqualTo':
      return currentValue <= targetValue;
    case 'greaterThanOrEqualTo':
      return currentValue >= targetValue;
    default:
      return false;
  }
};

export const evaluateConditionGroup = (group, roster, selectionCounts, forceCategoryCounts) => {
  if (!group) return true;
  const condResults = group.conditions?.map(c => evaluateCondition(c, roster, selectionCounts, forceCategoryCounts)) || [];
  const groupResults = group.conditionGroups?.map(g => evaluateConditionGroup(g, roster, selectionCounts, forceCategoryCounts)) || [];
  
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

export const getModifiedConstraintValue = (con, modifiers, roster, selectionCounts, forceCategoryCounts) => {
  let finalValue = con.value;

  const sortedModifiers = [...(modifiers || [])].sort((a, b) => {
    if (a.type === 'set' && b.type !== 'set') return -1;
    if (a.type !== 'set' && b.type === 'set') return 1;
    return 0;
  });

  sortedModifiers.forEach(mod => {
    if (mod.field !== con.id) return;

    const condsPass = mod.conditions?.every(c => evaluateCondition(c, roster, selectionCounts, forceCategoryCounts)) !== false;
    const groupsPass = mod.conditionGroups?.every(g => evaluateConditionGroup(g, roster, selectionCounts, forceCategoryCounts)) !== false;

    if (condsPass && groupsPass) {
      let modAmount = mod.valueObject;

      if (mod.repeat) {
        let currentValue = 0;
        if (mod.repeat.field && mod.repeat.field.startsWith('limit::')) {
          currentValue = roster.costLimit || 0;
        } else if (mod.repeat.field) {
          currentValue = selectionCounts[mod.repeat.field] || forceCategoryCounts[mod.repeat.field] || 0;
        }

        const repVal = mod.repeat.value ? Math.floor(currentValue / mod.repeat.value) : 0;
        modAmount = mod.valueObject * repVal * (mod.repeat.repeats || 1);
      }

      if (mod.type === 'set') {
        finalValue = modAmount;
      } else if (mod.type === 'increment') {
        finalValue += modAmount;
      } else if (mod.type === 'decrement') {
        finalValue -= modAmount;
      }
    }
  });

  return finalValue;
};

export function computeRosterCounts(roster, system) {
  const selectionCounts = {};
  const categoryCounts = {}; // forceId -> { categoryId -> count }

  const countSelection = (selection, forceId, forceCatalogueId) => {
    const entryId = selection.entryLinkId || selection.selectionEntryId;
    if (entryId) {
      selectionCounts[entryId] = (selectionCounts[entryId] || 0) + (selection.number || 1);
    }

    if (!categoryCounts[forceId]) {
      categoryCounts[forceId] = {};
    }

    const catalogue = system.catalogues.find(c => c.id === forceCatalogueId);
    const entryDef = findEntryInCatalogue(catalogue, entryId);
    
    if (entryDef) {
      const resolved = resolveEntry(system, entryDef, forceCatalogueId);
      if (resolved && resolved.targetId && resolved.targetId !== entryId) {
        selectionCounts[resolved.targetId] = (selectionCounts[resolved.targetId] || 0) + (selection.number || 1);
      }
      
      const seenCategories = new Set();
      resolved?.categoryLinks?.forEach(cl => {
        if (cl.targetId && !seenCategories.has(cl.targetId)) {
          seenCategories.add(cl.targetId);
          categoryCounts[forceId][cl.targetId] = (categoryCounts[forceId][cl.targetId] || 0) + 1;

          // Auto-fix catalog typos for extra slot selections (e.g. "hero extra cost" with duplicate Characters links)
          if (cl.targetId === '7a1c-d611-c2dc-def1') { // Characters
            const entryName = resolved.name?.toLowerCase() || '';
            if (entryName.includes('hero extra cost') || entryName.includes('heldenauswahl')) {
              const heroCatId = 'c16b-f319-2c62-2c12';
              if (!seenCategories.has(heroCatId)) {
                seenCategories.add(heroCatId);
                categoryCounts[forceId][heroCatId] = (categoryCounts[forceId][heroCatId] || 0) + 1;
              }
            }
            if (entryName.includes('lord extra cost') || entryName.includes('kommandantenauswahl')) {
              const lordCatId = 'd024-d25b-a9b4-73b6';
              if (!seenCategories.has(lordCatId)) {
                seenCategories.add(lordCatId);
                categoryCounts[forceId][lordCatId] = (categoryCounts[forceId][lordCatId] || 0) + 1;
              }
            }
          }
        }
      });
    }

    if (selection.category) {
      const hasCat = entryDef?.categoryLinks?.some(cl => cl.targetId === selection.category);
      if (!hasCat) {
        categoryCounts[forceId][selection.category] = (categoryCounts[forceId][selection.category] || 0) + 1;
      }
    }

    if (selection.selections) {
      selection.selections.forEach(child => countSelection(child, forceId, forceCatalogueId));
    }
  };

  if (roster && roster.forces) {
    roster.forces.forEach(force => {
      if (force.selections) {
        force.selections.forEach(sel => countSelection(sel, force.id, force.catalogueId));
      }
    });
  }

  return { selectionCounts, categoryCounts };
}

/**
 * Full constraint validator
 */
export function validateRoster(roster, system) {
  const errors = [];
  if (!roster || !system) return errors;

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

  const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);

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
                return subId === entryId || (entry.targetId && subId === entry.targetId);
              }) || [];
              count = childMatch.reduce((sum, s) => sum + (s.number || 1), 0);
            } else if (force) {
              const forceMatch = force.selections?.filter(s => {
                const subId = s.entryLinkId || s.selectionEntryId;
                return subId === entryId || (entry.targetId && subId === entry.targetId);
              }) || [];
              count = forceMatch.reduce((sum, s) => sum + (s.number || 1), 0);
            }
          } else if (con.scope === 'roster' || con.scope === 'force') {
            count = Math.max(selectionCounts[entryId] || 0, (entry.targetId ? selectionCounts[entry.targetId] || 0 : 0));
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

  // 4. Validate army general constraint (exactly 1 General is required)
  let generalCount = 0;
  const countGenerals = (selection) => {
    const entryId = selection.entryLinkId || selection.selectionEntryId;
    const nameLower = selection.name?.toLowerCase() || '';
    if (
      entryId === '1b7c-2c90-6d96-28c9' ||
      nameLower === 'general' ||
      nameLower === 'armeegeneral' ||
      nameLower === 'army general' ||
      nameLower === 'warlord' ||
      nameLower === 'general der armee'
    ) {
      generalCount += (selection.number || 1);
    }
    if (selection.selections) {
      selection.selections.forEach(child => countGenerals(child));
    }
  };

  roster.forces.forEach(force => {
    if (force.selections) {
      force.selections.forEach(sel => countGenerals(sel));
    }
  });

  if (generalCount === 0) {
    errors.push({
      type: 'general-missing',
      message: `Kein General ausgewählt: Jede Armee benötigt genau einen General.`,
      severity: 'error'
    });
  } else if (generalCount > 1) {
    errors.push({
      type: 'general-multiple',
      message: `Zu viele Generäle: Eine Armee darf maximal einen General besitzen (aktuell: ${generalCount}).`,
      severity: 'error'
    });
  }

  return errors;
}
