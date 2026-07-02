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
        modifiers: [...(entry.modifiers || []), ...(target.modifiers || [])],
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
          const linkedRule = { ...target };
          if (link.hidden === true || target.hidden === true) {
            linkedRule.hidden = true;
          }
          const mergedMods = [...(link.modifiers || []), ...(target.modifiers || [])];
          if (mergedMods.length > 0) {
            linkedRule.modifiers = mergedMods;
          }
          resolved.rules = [...resolved.rules, linkedRule];
        }
      } else if (link.type === 'profile') {
        if (!resolved.profiles) resolved.profiles = [];
        if (!resolved.profiles.some(p => p.id === target.id)) {
          const linkedProfile = { ...target };
          if (link.hidden === true || target.hidden === true) {
            linkedProfile.hidden = true;
          }
          const mergedMods = [...(link.modifiers || []), ...(target.modifiers || [])];
          if (mergedMods.length > 0) {
            linkedProfile.modifiers = mergedMods;
          }
          resolved.profiles = [...resolved.profiles, linkedProfile];
        }
      }
    });
  }

  // Resolve publicationRef for the entry and all its rules/profiles
  const finalPubId = entry.publicationId || resolved.publicationId;
  const finalPage = entry.page || resolved.page;
  const entryPubRef = getPublicationRef(system, finalPubId, finalPage, catalogueId);
  if (entryPubRef) {
    resolved.publicationRef = entryPubRef;
  }

  if (resolved.rules) {
    resolved.rules.forEach(r => {
      const rulePubRef = getPublicationRef(system, r.publicationId, r.page, catalogueId);
      if (rulePubRef) {
        r.publicationRef = rulePubRef;
      }
    });
  }

  if (resolved.profiles) {
    resolved.profiles.forEach(p => {
      const profPubRef = getPublicationRef(system, p.publicationId, p.page, catalogueId);
      if (profPubRef) {
        p.publicationRef = profPubRef;
      }
    });
  }

  return resolved;
}

export function findPublicationById(system, publicationId, catalogueId = null) {
  if (!system || !publicationId) return null;
  
  // 1. Search in the gameSystem publications
  if (system.publications) {
    const pub = system.publications.find(p => p.id === publicationId);
    if (pub) return pub;
  }
  
  // 2. Search in the specified catalogue
  if (catalogueId && system.catalogues) {
    const cat = system.catalogues.find(c => c.id === catalogueId);
    if (cat && cat.publications) {
      const pub = cat.publications.find(p => p.id === publicationId);
      if (pub) return pub;
    }
  }
  
  // 3. Fallback: Search all catalogues
  if (system.catalogues) {
    for (const cat of system.catalogues) {
      if (cat.publications) {
        const pub = cat.publications.find(p => p.id === publicationId);
        if (pub) return pub;
      }
    }
  }
  
  return null;
}

export function getPublicationRef(system, publicationId, page, catalogueId = null) {
  if (!publicationId && !page) return '';
  
  let pubName = '';
  if (publicationId) {
    const pub = findPublicationById(system, publicationId, catalogueId);
    if (pub) {
      pubName = pub.name || pub.shortName || '';
    }
  }
  
  if (pubName && page) {
    return `[${pubName}, S. ${page}]`;
  } else if (pubName) {
    return `[${pubName}]`;
  } else if (page) {
    return `[S. ${page}]`;
  }
  return '';
}
