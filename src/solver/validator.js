/**
 * Helper to find a selection entry or entry link by ID within a catalogue,
 * searching in direct selections, shared entries, or recursively.
 */
export function findEntryInCatalogue(catalogue, entryId) {
  if (!catalogue) return null;
  
  // Helper to search a list of entries recursively
  const searchList = (list) => {
    if (!list) return null;
    for (const entry of list) {
      if (entry.id === entryId) return entry;
      const subSearch = searchList(entry.selectionEntries) || 
                        searchList(entry.entryLinks) ||
                        searchList(entry.selectionEntryGroups);
      if (subSearch) return subSearch;
    }
    return null;
  };

  // 1. Search catalogue's primary selection entries
  let found = searchList(catalogue.selectionEntries) || searchList(catalogue.entryLinks);
  if (found) return found;

  // 2. Search shared selection entries
  found = searchList(catalogue.sharedSelectionEntries) || searchList(catalogue.sharedSelectionEntryGroups);
  return found;
}

/**
 * Searches for an entry across all catalogues inside a game system
 */
export function findEntryInSystem(system, entryId) {
  if (!system) return null;
  
  // Search gst shared items
  if (system.sharedSelectionEntries) {
    for (const se of system.sharedSelectionEntries) {
      if (se.id === entryId) return se;
    }
  }
  if (system.sharedRules) {
    for (const r of system.sharedRules) {
      if (r.id === entryId) return r;
    }
  }
  if (system.sharedProfiles) {
    for (const p of system.sharedProfiles) {
      if (p.id === entryId) return p;
    }
  }

  // Search each catalogue
  for (const cat of system.catalogues || []) {
    const entry = findEntryInCatalogue(cat, entryId);
    if (entry) return entry;
    
    if (cat.sharedRules) {
      for (const r of cat.sharedRules) {
        if (r.id === entryId) return r;
      }
    }
    if (cat.sharedProfiles) {
      for (const p of cat.sharedProfiles) {
        if (p.id === entryId) return p;
      }
    }
  }

  return null;
}

/**
 * Resolves an entryLink or returns the selectionEntry directly, resolving linked profiles/rules
 */
export function resolveEntry(system, entry) {
  if (!entry) return null;
  
  let resolved = { ...entry };
  if (entry.targetId) {
    const target = findEntryInSystem(system, entry.targetId);
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
      const target = findEntryInSystem(system, link.targetId);
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

  // Helper: map of entry id/category id -> total counts in roster
  const selectionCounts = {};
  const categoryCounts = {}; // categoryId -> count

  const countSelection = (selection, forceCatalogueId) => {
    const entryId = selection.entryLinkId || selection.selectionEntryId;
    if (entryId) {
      selectionCounts[entryId] = (selectionCounts[entryId] || 0) + (selection.number || 1);
    }

    // Find the definition of this selection to determine its categories
    const catalogue = system.catalogues.find(c => c.id === forceCatalogueId);
    const entryDef = findEntryInCatalogue(catalogue, entryId);
    
    // Check categories (in BattleScribe, entries can have categoryLinks or categories directly)
    // To keep it simple, we check category links or direct indicators.
    // Also, units are usually mapped to a category in builder by category link.
    if (selection.category) {
      categoryCounts[selection.category] = (categoryCounts[selection.category] || 0) + 1;
    }

    // Count children
    if (selection.selections) {
      selection.selections.forEach(child => countSelection(child, forceCatalogueId));
    }
  };

  // Run counts
  roster.forces.forEach(force => {
    if (force.selections) {
      force.selections.forEach(sel => countSelection(sel, force.catalogueId));
    }
  });

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
      const count = force.selections?.filter(sel => sel.category === targetCatId).length || 0;

      // Check min/max constraints on the category link
      catLink.constraints?.forEach(con => {
        if (con.value < 0) return;
        if (con.type === 'min' && count < con.value) {
          errors.push({
            type: 'category-min',
            forceId: force.id,
            categoryId: targetCatId,
            message: `Mindestens ${con.value} Auswahlen für "${catName}" in ${forceDef.name} benötigt (aktuell: ${count}).`,
            severity: 'error'
          });
        }
        if (con.type === 'max' && count > con.value) {
          errors.push({
            type: 'category-max',
            forceId: force.id,
            categoryId: targetCatId,
            message: `Maximal ${con.value} Auswahlen für "${catName}" in ${forceDef.name} erlaubt (aktuell: ${count}).`,
            severity: 'error'
          });
        }
      });
    });

    // 3. Validate individual unit selections and upgrades constraints
    const validateSelectionConstraints = (selection, parentSelection = null) => {
      const entryId = selection.entryLinkId || selection.selectionEntryId;
      const rawEntry = findEntryInSystem(system, entryId);
      const entry = resolveEntry(system, rawEntry);

      if (!entry) return;

       // 1. Validate individual constraints of this entry
      if (entry.constraints) {
        entry.constraints.forEach(con => {
          if (con.value < 0) return;
          
          // Check scope applicability for specific category/entry scoped constraints
          if (con.scope !== 'parent' && con.scope !== 'force' && con.scope !== 'roster') {
            const belongsToScope = (selection.selectionEntryId === con.scope || selection.entryLinkId === con.scope) ||
                                  (entry.categoryLinks?.some(cl => cl.targetId === con.scope)) ||
                                  (parentSelection && (parentSelection.selectionEntryId === con.scope || parentSelection.entryLinkId === con.scope));
            if (!belongsToScope) return;
          }

          // Determine current count in scope
          let count = selection.number || 1;
          
          if (con.scope === 'parent' && parentSelection) {
            // How many times is this sub-entry selected in this parent instance?
            const childMatch = parentSelection.selections?.filter(s => 
              (s.entryLinkId || s.selectionEntryId) === entryId
            ) || [];
            count = childMatch.reduce((sum, s) => sum + (s.number || 1), 0);
          } else if (con.scope === 'roster' || con.scope === 'force') {
            count = selectionCounts[entryId] || 0;
          }

          if (con.type === 'min' && count < con.value) {
            errors.push({
              type: 'entry-min',
              selectionId: selection.id,
              message: `Option "${selection.name}" erfordert mindestens ${con.value} Auswahlen (aktuell: ${count}).`,
              severity: 'error'
            });
          }
          if (con.type === 'max' && count > con.value) {
            errors.push({
              type: 'entry-max',
              selectionId: selection.id,
              message: `Option "${selection.name}" erlaubt maximal ${con.value} Auswahlen (aktuell: ${count}).`,
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
            const resolvedGroup = resolveEntry(system, el);
            if (resolvedGroup) {
              groups.push(resolvedGroup);
              collectGroups(resolvedGroup);
            }
          }
        });
        def.selectionEntries?.forEach(se => {
          const resolvedSE = resolveEntry(system, se);
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
            const res = resolveEntry(system, item);
            if (res) groupItemIds.add(res.id);
          });
          gDef.entryLinks?.forEach(link => {
            groupItemIds.add(link.id);
            groupItemIds.add(link.targetId);
            const res = resolveEntry(system, link);
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
          const pts = s.costs?.find(c => c.typeId === roster.costLimitType || c.typeId === 'pts')?.value || 0;
          return sum + (pts * (s.number || 1));
        }, 0);

        group.constraints?.forEach(con => {
          if (con.value < 0) return;
          
          // Check scope applicability for specific category/entry scoped constraints
          if (con.scope !== 'parent' && con.scope !== 'force' && con.scope !== 'roster') {
            const belongsToScope = (selection.selectionEntryId === con.scope || selection.entryLinkId === con.scope) ||
                                  (entry.categoryLinks?.some(cl => cl.targetId === con.scope));
            if (!belongsToScope) return;
          }
          const isCostField = con.field === 'pts' || con.field === 'ecfa-8486-4f6c-c249' || con.field === roster.costLimitType || system.costTypes?.some(ct => ct.id === con.field);
          if (isCostField) {
            if (con.type === 'max' && totalPoints > con.value) {
              errors.push({
                type: 'group-points-max',
                selectionId: selection.id,
                message: `Kategorie "${group.name}" erlaubt maximal ${con.value} Punkte (aktuell: ${totalPoints} Pkt. für ${selection.name}).`,
                severity: 'error'
              });
            }
            if (con.type === 'min' && totalPoints < con.value && totalPoints > 0) {
              errors.push({
                type: 'group-points-min',
                selectionId: selection.id,
                message: `Kategorie "${group.name}" erfordert mindestens ${con.value} Punkte (aktuell: ${totalPoints} Pkt. für ${selection.name}).`,
                severity: 'error'
              });
            }
          } else {
            if (con.type === 'max' && totalCount > con.value) {
              errors.push({
                type: 'group-count-max',
                selectionId: selection.id,
                message: `Kategorie "${group.name}" erlaubt maximal ${con.value} Auswahlen (aktuell: ${totalCount} für ${selection.name}).`,
                severity: 'error'
              });
            }
            if (con.type === 'min' && totalCount < con.value && totalCount > 0) {
              errors.push({
                type: 'group-count-min',
                selectionId: selection.id,
                message: `Kategorie "${group.name}" erfordert mindestens ${con.value} Auswahlen (aktuell: ${totalCount} für ${selection.name}).`,
                severity: 'error'
              });
            }
          }
        });
      });

      // Check children
      if (selection.selections) {
        selection.selections.forEach(child => validateSelectionConstraints(child, selection));
      }
    };

    if (force.selections) {
      force.selections.forEach(sel => validateSelectionConstraints(sel, null));
    }
  });

  // 4. Validate army general constraint (exactly 1 General is required)
  let generalCount = 0;
  const countGenerals = (selection) => {
    const entryId = selection.entryLinkId || selection.selectionEntryId;
    if (entryId === '1b7c-2c90-6d96-28c9' || selection.name === 'General') {
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
