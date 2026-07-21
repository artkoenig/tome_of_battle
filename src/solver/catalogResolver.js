import { InfoLinkKind } from '../parser/schema/battlescribeSchema.generated.js';

// A Battlescribe entry id may be qualified with the catalogue it came from
// ("<catalogueId>::<entryId>"); only the trailing part identifies the entry.
const ENTRY_ID_QUALIFIER_SEPARATOR = '::';

/**
 * Entry indexes live in module-scoped WeakMaps rather than as a field on the
 * indexed object, because systems and catalogues are persisted to IndexedDB
 * verbatim — a field would be written along with them. Keying weakly also lets
 * an index be collected as soon as the system or catalogue it belongs to is.
 * @type {WeakMap<object, {source: *, index: Map}>}
 */
const catalogueEntryIndexes = new WeakMap();
const systemEntryIndexes = new WeakMap();

function stripEntryIdQualifier(entryId) {
  return entryId && entryId.includes(ENTRY_ID_QUALIFIER_SEPARATOR)
    ? entryId.split(ENTRY_ID_QUALIFIER_SEPARATOR).pop()
    : entryId;
}

/**
 * Returns the cached index of `indexedObject`, rebuilding it whenever the
 * content it was derived from (`indexSource`) is no longer the same reference.
 * Both lookup paths share this rule, so both invalidate alike.
 */
function getOrBuildIndex(indexes, indexedObject, indexSource, buildIndex) {
  const cached = indexes.get(indexedObject);
  if (cached && cached.source === indexSource) {
    return cached.index;
  }
  const index = buildIndex();
  indexes.set(indexedObject, { source: indexSource, index });
  return index;
}

/** Recursively indexes every object carrying an `id` under that id. */
function indexEntriesById(node, index) {
  if (!node || typeof node !== 'object') return;
  if (node.id) {
    index.set(node.id, node);
  }
  for (const key in node) {
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach(item => indexEntriesById(item, index));
    } else if (value && typeof value === 'object') {
      indexEntriesById(value, index);
    }
  }
}

function getCatalogueEntryIndex(catalogue) {
  return getOrBuildIndex(catalogueEntryIndexes, catalogue, catalogue, () => {
    const index = new Map();
    indexEntriesById(catalogue, index);
    return index;
  });
}

/**
 * Builds one entry index per catalogue, plus one for the game system's own
 * shared data (keyed by `system.id`). Rebuilt when `system.catalogues` is
 * replaced.
 * @returns {Map<string, Map<string, object>>}
 */
function getSystemEntryIndexesByCatalogueId(system) {
  return getOrBuildIndex(systemEntryIndexes, system, system.catalogues, () => {
    const indexesByCatalogueId = new Map();

    const indexCatalogue = (catalogue, catalogueId) => {
      if (!catalogue) return;
      if (!indexesByCatalogueId.has(catalogueId)) {
        indexesByCatalogueId.set(catalogueId, new Map());
      }
      indexEntriesById(catalogue, indexesByCatalogueId.get(catalogueId));
    };

    indexCatalogue(system, system.id);
    system.catalogues?.forEach(catalogue => indexCatalogue(catalogue, catalogue.id));

    return indexesByCatalogueId;
  });
}

export function findEntryInCatalogue(catalogue, entryId) {
  if (!catalogue) return null;
  return getCatalogueEntryIndex(catalogue).get(stripEntryIdQualifier(entryId)) || null;
}

export function findEntryInSystem(system, entryId, catalogueId = null) {
  if (!system) return null;
  const cleanId = stripEntryIdQualifier(entryId);
  const indexesByCatalogueId = getSystemEntryIndexesByCatalogueId(system);

  const preferredIndex = catalogueId ? indexesByCatalogueId.get(catalogueId) : null;
  if (preferredIndex && preferredIndex.has(cleanId)) {
    return preferredIndex.get(cleanId);
  }

  // Fallback: the preferred catalogue was not given, or does not hold the entry.
  for (const index of indexesByCatalogueId.values()) {
    if (index.has(cleanId)) {
      return index.get(cleanId);
    }
  }

  return null;
}

/**
 * Builds a linked profile or rule from its resolution target, applying an
 * inherited hidden flag and merging the link's modifiers and modifier groups
 * ahead of the target's. Only sets `hidden`/`modifiers`/`modifierGroups` when
 * they carry information, so a plain target is copied verbatim.
 */
function buildLinkedInfoNode(target, inheritedHidden, linkModifiers = [], linkModifierGroups = []) {
  const node = { ...target };
  if (inheritedHidden || target.hidden === true) {
    node.hidden = true;
  }
  const mergedModifiers = [...linkModifiers, ...(target.modifiers || [])];
  if (mergedModifiers.length > 0) {
    node.modifiers = mergedModifiers;
  }
  const mergedModifierGroups = [...linkModifierGroups, ...(target.modifierGroups || [])];
  if (mergedModifierGroups.length > 0) {
    node.modifierGroups = mergedModifierGroups;
  }
  return node;
}

/**
 * Recursively flattens an infoGroup into the profiles and rules it bundles,
 * following nested infoGroups and infoLinks. A hidden group (or an ancestor
 * group being hidden) marks every bundled node hidden, mirroring how a hidden
 * infoLink propagates to its target.
 */
function flattenInfoGroup(system, infoGroup, catalogueId, inheritedHidden = false) {
  const profiles = [];
  const rules = [];
  if (!infoGroup) return { profiles, rules };

  const groupHidden = inheritedHidden || infoGroup.hidden === true;

  (infoGroup.profiles || []).forEach(profile => {
    profiles.push(buildLinkedInfoNode(profile, groupHidden));
  });
  (infoGroup.rules || []).forEach(rule => {
    rules.push(buildLinkedInfoNode(rule, groupHidden));
  });

  (infoGroup.infoLinks || []).forEach(link => {
    const contributed = resolveInfoLink(system, link, catalogueId, groupHidden);
    profiles.push(...contributed.profiles);
    rules.push(...contributed.rules);
  });

  (infoGroup.infoGroups || []).forEach(nested => {
    const contributed = flattenInfoGroup(system, nested, catalogueId, groupHidden);
    profiles.push(...contributed.profiles);
    rules.push(...contributed.rules);
  });

  return { profiles, rules };
}

/**
 * Resolves a single infoLink to the profiles and rules it contributes. Handles
 * all three InfoLinkKind values: a profile/rule link contributes one node; an
 * infoGroup link contributes the whole flattened group.
 */
function resolveInfoLink(system, link, catalogueId, inheritedHidden = false) {
  const empty = { profiles: [], rules: [] };
  const target = findEntryInSystem(system, link.targetId, catalogueId);
  if (!target) return empty;

  const linkHidden = inheritedHidden || link.hidden === true;

  if (link.type === InfoLinkKind.RULE) {
    return { profiles: [], rules: [buildLinkedInfoNode(target, linkHidden, link.modifiers, link.modifierGroups)] };
  }
  if (link.type === InfoLinkKind.PROFILE) {
    return { profiles: [buildLinkedInfoNode(target, linkHidden, link.modifiers, link.modifierGroups)], rules: [] };
  }
  if (link.type === InfoLinkKind.INFO_GROUP) {
    return flattenInfoGroup(system, target, catalogueId, linkHidden);
  }
  return empty;
}

/**
 * Gathers every profile and rule an entry bundles indirectly — through its
 * infoLinks (profile/rule/infoGroup) and its inline infoGroups — as two flat lists.
 */
function collectBundledInfoNodes(system, entry, catalogueId) {
  const profiles = [];
  const rules = [];

  (entry.infoLinks || []).forEach(link => {
    const contributed = resolveInfoLink(system, link, catalogueId);
    profiles.push(...contributed.profiles);
    rules.push(...contributed.rules);
  });

  (entry.infoGroups || []).forEach(group => {
    const contributed = flattenInfoGroup(system, group, catalogueId);
    profiles.push(...contributed.profiles);
    rules.push(...contributed.rules);
  });

  return { profiles, rules };
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
        modifierGroups: [...(entry.modifierGroups || []), ...(target.modifierGroups || [])],
        costs: (entry.costs && entry.costs.length > 0) ? entry.costs : (target.costs || []),
        categoryLinks: [...(entry.categoryLinks || []), ...(target.categoryLinks || [])],
        profiles: [...(entry.profiles || []), ...(target.profiles || [])],
        rules: [...(entry.rules || []), ...(target.rules || [])],
        infoLinks: [...(entry.infoLinks || []), ...(target.infoLinks || [])],
        infoGroups: [...(entry.infoGroups || []), ...(target.infoGroups || [])],
        selectionEntries: [...(entry.selectionEntries || []), ...(target.selectionEntries || [])],
        selectionEntryGroups: [...(entry.selectionEntryGroups || []), ...(target.selectionEntryGroups || [])],
        entryLinks: [...(entry.entryLinks || []), ...(target.entryLinks || [])]
      };
    }
  }

  // Flatten infoLinks (profile/rule/infoGroup) and inline infoGroups of the
  // resolved entry into its profiles/rules, so downstream collection needs to
  // read only those two lists.
  const bundled = collectBundledInfoNodes(system, resolved, catalogueId);
  if (bundled.profiles.length > 0) {
    if (!resolved.profiles) resolved.profiles = [];
    bundled.profiles.forEach(profile => {
      if (!resolved.profiles.some(existing => existing.id === profile.id)) {
        resolved.profiles = [...resolved.profiles, profile];
      }
    });
  }
  if (bundled.rules.length > 0) {
    if (!resolved.rules) resolved.rules = [];
    bundled.rules.forEach(rule => {
      if (!resolved.rules.some(existing => existing.id === rule.id)) {
        resolved.rules = [...resolved.rules, rule];
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

  // The rule/profile objects reached here are shared with the catalogue cache
  // (spread into a new array, but the elements are the same references). Clone
  // each before stamping `publicationRef` so repeated resolution never mutates
  // cached state and leaks a stale reference across selections.
  if (resolved.rules) {
    resolved.rules = resolved.rules.map(r => {
      const rulePubRef = getPublicationRef(system, r.publicationId, r.page, catalogueId);
      return rulePubRef ? { ...r, publicationRef: rulePubRef } : r;
    });
  }

  if (resolved.profiles) {
    resolved.profiles = resolved.profiles.map(p => {
      const profPubRef = getPublicationRef(system, p.publicationId, p.page, catalogueId);
      return profPubRef ? { ...p, publicationRef: profPubRef } : p;
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
