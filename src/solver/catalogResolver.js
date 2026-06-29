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
