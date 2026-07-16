/**
 * Helper to get direct children of an element by tag name
 */
function getChildren(el, tagName) {
  const result = [];
  if (!el) return result;
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType === 1 && child.nodeName === tagName) { // Element node
      result.push(child);
    }
  }
  return result;
}

/**
 * Helper to get direct children under a wrapper tag (e.g. el > selectionEntries > selectionEntry)
 */
function getWrappedChildren(el, wrapperName, tagName) {
  const wrapper = getChildren(el, wrapperName)[0];
  return getChildren(wrapper, tagName);
}

/**
 * Reads an element's `name` attribute, trimmed. The catalogue XML the app imports
 * carries occasional stray leading/trailing whitespace (upstream authoring artifacts,
 * e.g. costType " Casting Dice" or entry names like "Armour of Damnation "); trimming
 * once here, at the parsing boundary, means nothing downstream needs to.
 */
function getName(el) {
  return el.getAttribute('name')?.trim() ?? null;
}

/**
 * Reads an element's integer `revision` attribute — BattleScribe's official update
 * signal ("if it's higher, the file will be updated"). Returns null when the
 * attribute is absent or non-numeric, so callers can treat pre-revision stored data
 * (imported before revisions were tracked) as outdated.
 */
function getRevision(el) {
  const raw = el.getAttribute('revision');
  if (raw === null || raw === '') return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Parses rules from an element, accepting 'rules' or 'sharedRules' wrappers.
 */
function parseRules(el) {
  const wrapper = getChildren(el, 'rules')[0] || getChildren(el, 'sharedRules')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'rule').map(ruleEl => ({
    id: ruleEl.getAttribute('id'),
    name: getName(ruleEl),
    publicationId: ruleEl.getAttribute('publicationId'),
    page: ruleEl.getAttribute('page'),
    hidden: ruleEl.getAttribute('hidden') === 'true',
    modifiers: parseModifiers(ruleEl),
    description: getChildren(ruleEl, 'description')[0]?.textContent || ''
  }));
}

/**
 * Parses profiles from an element, accepting 'profiles' or 'sharedProfiles' wrappers.
 */
function parseProfiles(el) {
  const wrapper = getChildren(el, 'profiles')[0] || getChildren(el, 'sharedProfiles')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'profile').map(profEl => {
    const characteristics = [];
    const charWrapper = getChildren(profEl, 'characteristics')[0];
    if (charWrapper) {
      getChildren(charWrapper, 'characteristic').forEach(cEl => {
        characteristics.push({
          name: getName(cEl),
          id: cEl.getAttribute('typeId'),
          typeId: cEl.getAttribute('typeId'),
          value: cEl.textContent || ''
        });
      });
    }
    return {
      id: profEl.getAttribute('id'),
      name: getName(profEl),
      profileTypeId: profEl.getAttribute('profileTypeId'),
      profileTypeName: profEl.getAttribute('profileTypeName') || profEl.getAttribute('typeName'),
      publicationId: profEl.getAttribute('publicationId'),
      page: profEl.getAttribute('page'),
      hidden: profEl.getAttribute('hidden') === 'true',
      modifiers: parseModifiers(profEl),
      characteristics
    };
  });
}

/**
 * Parses info links from an element.
 */
function parseInfoLinks(el) {
  const wrapper = getChildren(el, 'infoLinks')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'infoLink').map(linkEl => ({
    id: linkEl.getAttribute('id'),
    name: getName(linkEl),
    targetId: linkEl.getAttribute('targetId'),
    type: linkEl.getAttribute('type'), // profile, rule
    publicationId: linkEl.getAttribute('publicationId'),
    page: linkEl.getAttribute('page'),
    hidden: linkEl.getAttribute('hidden') === 'true',
    modifiers: parseModifiers(linkEl)
  }));
}

/**
 * Parses point/power costs from an element
 */
function parseCosts(el) {
  const wrapper = getChildren(el, 'costs')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'cost').map(costEl => ({
    name: getName(costEl),
    typeId: costEl.getAttribute('typeId'),
    value: parseFloat(costEl.getAttribute('value')) || 0
  }));
}

/**
 * Parses constraints from an element
 */
function parseConstraints(el) {
  const wrapper = getChildren(el, 'constraints')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'constraint').map(conEl => ({
    id: conEl.getAttribute('id'),
    type: conEl.getAttribute('type'), // min, max, percent
    value: parseFloat(conEl.getAttribute('value')) || 0,
    field: conEl.getAttribute('field') || 'selections', // selections, pts, etc.
    scope: conEl.getAttribute('scope') || 'parent', // parent, roster, force
    shared: conEl.getAttribute('shared') === 'true'
  }));
}

/**
 * Parses conditions/conditionGroups
 */
function parseCondition(condEl) {
  return {
    type: condEl.getAttribute('type'), // equalTo, lessThan, greaterThan, etc.
    value: parseFloat(condEl.getAttribute('value')) || 0,
    field: condEl.getAttribute('field') || 'selections',
    scope: condEl.getAttribute('scope') || 'parent',
    childId: condEl.getAttribute('childId'),
    shared: condEl.getAttribute('shared') === 'true'
  };
}

function parseConditionGroup(groupEl) {
  return {
    type: groupEl.getAttribute('type') || 'and', // and, or, not
    conditions: getWrappedChildren(groupEl, 'conditions', 'condition').map(parseCondition),
    conditionGroups: getWrappedChildren(groupEl, 'conditionGroups', 'conditionGroup').map(parseConditionGroup)
  };
}

/**
 * Parses modifiers and modifierGroups
 */
function parseSingleModifier(modEl) {
  const conditions = getWrappedChildren(modEl, 'conditions', 'condition').map(parseCondition);
  const conditionGroups = getWrappedChildren(modEl, 'conditionGroups', 'conditionGroup').map(parseConditionGroup);
  
  const repeatsEl = getWrappedChildren(modEl, 'repeats', 'repeat')[0];
  const repeat = repeatsEl ? {
    field: repeatsEl.getAttribute('field'),
    childId: repeatsEl.getAttribute('childId'),
    scope: repeatsEl.getAttribute('scope'),
    value: parseFloat(repeatsEl.getAttribute('value')) || 0,
    repeats: parseFloat(repeatsEl.getAttribute('repeats')) || 1,
    roundUp: repeatsEl.getAttribute('roundUp') === 'true'
  } : null;

  return {
    type: modEl.getAttribute('type'), // set, increment, decrement
    field: modEl.getAttribute('field'), // cost, hidden, constraint
    value: modEl.getAttribute('value'),
    valueObject: parseFloat(modEl.getAttribute('value')) || 0,
    conditions,
    conditionGroups,
    repeat
  };
}

function parseModifiers(el) {
  const list = [];
  const wrapper = getChildren(el, 'modifiers')[0];
  if (wrapper) {
    getChildren(wrapper, 'modifier').forEach(modEl => {
      list.push(parseSingleModifier(modEl));
    });
  }
  const groupsWrapper = getChildren(el, 'modifierGroups')[0];
  if (groupsWrapper) {
    getChildren(groupsWrapper, 'modifierGroup').forEach(groupEl => {
      const groupModsWrapper = getChildren(groupEl, 'modifiers')[0];
      if (groupModsWrapper) {
        getChildren(groupModsWrapper, 'modifier').forEach(modEl => {
          list.push(parseSingleModifier(modEl));
        });
      }
    });
  }
  return list;
}

/**
 * Parses category links from an element
 */
function parseCategoryLinks(el) {
  const wrapper = getChildren(el, 'categoryLinks')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'categoryLink').map(linkEl => ({
    id: linkEl.getAttribute('id'),
    name: getName(linkEl),
    targetId: linkEl.getAttribute('targetId'),
    primary: linkEl.getAttribute('primary') === 'true',
    constraints: parseConstraints(linkEl),
    modifiers: parseModifiers(linkEl)
  }));
}

/**
 * Parses entry links
 */
function parseEntryLinks(el) {
  const wrapper = getChildren(el, 'entryLinks')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'entryLink').map(linkEl => ({
    id: linkEl.getAttribute('id'),
    name: getName(linkEl),
    targetId: linkEl.getAttribute('targetId'),
    type: linkEl.getAttribute('type'), // selectionEntry, selectionEntryGroup
    publicationId: linkEl.getAttribute('publicationId'),
    page: linkEl.getAttribute('page'),
    collective: linkEl.getAttribute('collective') === 'true',
    hidden: linkEl.getAttribute('hidden') === 'true',
    constraints: parseConstraints(linkEl),
    costs: parseCosts(linkEl),
    modifiers: parseModifiers(linkEl),
    profiles: parseProfiles(linkEl),
    rules: parseRules(linkEl),
    infoLinks: parseInfoLinks(linkEl),
    categoryLinks: parseCategoryLinks(linkEl),
    // An entryLink may inline its own child options (e.g. a "Barding" nested under a
    // "Nightmare" mount link). These must be parsed too, otherwise they never enter
    // the catalogue index and their (link-level) costs are lost.
    selectionEntries: getWrappedChildren(linkEl, 'selectionEntries', 'selectionEntry').map(parseSelectionEntry),
    selectionEntryGroups: getWrappedChildren(linkEl, 'selectionEntryGroups', 'selectionEntryGroup').map(parseSelectionEntryGroup),
    entryLinks: parseEntryLinks(linkEl)
  }));
}

/**
 * Recursive selection entry parser
 */
function parseSelectionEntry(el) {
  const subEntries = getWrappedChildren(el, 'selectionEntries', 'selectionEntry').map(parseSelectionEntry);
  const subGroups = getWrappedChildren(el, 'selectionEntryGroups', 'selectionEntryGroup').map(parseSelectionEntryGroup);
  const entryLinks = parseEntryLinks(el);

  return {
    id: el.getAttribute('id'),
    name: getName(el),
    type: el.getAttribute('type') || 'upgrade', // unit, model, upgrade
    publicationId: el.getAttribute('publicationId'),
    page: el.getAttribute('page'),
    collective: el.getAttribute('collective') === 'true',
    hidden: el.getAttribute('hidden') === 'true',
    constraints: parseConstraints(el),
    costs: parseCosts(el),
    profiles: parseProfiles(el),
    rules: parseRules(el),
    infoLinks: parseInfoLinks(el),
    selectionEntries: subEntries,
    selectionEntryGroups: subGroups,
    entryLinks: entryLinks,
    modifiers: parseModifiers(el),
    categoryLinks: parseCategoryLinks(el)
  };
}

/**
 * Parses selection entry groups
 */
function parseSelectionEntryGroup(el) {
  const subEntries = getWrappedChildren(el, 'selectionEntries', 'selectionEntry').map(parseSelectionEntry);
  const subGroups = getWrappedChildren(el, 'selectionEntryGroups', 'selectionEntryGroup').map(parseSelectionEntryGroup);
  const entryLinks = parseEntryLinks(el);

  return {
    id: el.getAttribute('id'),
    name: getName(el),
    defaultSelectionEntryId: el.getAttribute('defaultSelectionEntryId'),
    publicationId: el.getAttribute('publicationId'),
    page: el.getAttribute('page'),
    collective: el.getAttribute('collective') === 'true',
    hidden: el.getAttribute('hidden') === 'true',
    constraints: parseConstraints(el),
    entryLinks: entryLinks,
    selectionEntries: subEntries,
    selectionEntryGroups: subGroups,
    infoLinks: parseInfoLinks(el),
    modifiers: parseModifiers(el),
    categoryLinks: parseCategoryLinks(el)
  };
}

// Force Entries (Detachments etc.)
const parseForceEntry = (el) => {
  const catLinks = getWrappedChildren(el, 'categoryLinks', 'categoryLink').map(link => ({
    id: link.getAttribute('id'),
    name: getName(link),
    hidden: link.getAttribute('hidden') === 'true',
    targetId: link.getAttribute('targetId'),
    constraints: parseConstraints(link),
    modifiers: parseModifiers(link)
  }));

  const subForces = getWrappedChildren(el, 'forceEntries', 'forceEntry').map(parseForceEntry);

  return {
    id: el.getAttribute('id'),
    name: getName(el),
    hidden: el.getAttribute('hidden') === 'true',
    categoryLinks: catLinks,
    forceEntries: subForces,
    constraints: parseConstraints(el)
  };
};

/**
 * Parses a game system XML content
 */
export function parseGameSystemXML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const root = doc.documentElement;
  
  if (root.nodeName !== 'gameSystem') {
    throw new Error('Not a valid Game System file');
  }

  // Cost Types
  const costTypes = getWrappedChildren(root, 'costTypes', 'costType').map(el => ({
    id: el.getAttribute('id'),
    name: getName(el),
    defaultCostLimit: parseFloat(el.getAttribute('defaultCostLimit')) || 0
  }));

  // Profile Types
  const profileTypes = getWrappedChildren(root, 'profileTypes', 'profileType').map(el => {
    const charWrapper = getChildren(el, 'characteristicTypes')[0];
    const characteristics = getChildren(charWrapper, 'characteristicType').map(c => ({
      id: c.getAttribute('id'),
      name: getName(c)
    }));
    return {
      id: el.getAttribute('id'),
      name: getName(el),
      characteristics
    };
  });

  // Category Entries
  const categoryEntries = getWrappedChildren(root, 'categoryEntries', 'categoryEntry').map(el => ({
    id: el.getAttribute('id'),
    name: getName(el),
    hidden: el.getAttribute('hidden') === 'true',
    constraints: parseConstraints(el),
    modifiers: parseModifiers(el)
  }));
  
  const forceEntries = getWrappedChildren(root, 'forceEntries', 'forceEntry').map(parseForceEntry);
  const sharedSelectionEntries = getWrappedChildren(root, 'sharedSelectionEntries', 'selectionEntry').map(parseSelectionEntry);
  const sharedSelectionEntryGroups = getWrappedChildren(root, 'sharedSelectionEntryGroups', 'selectionEntryGroup').map(parseSelectionEntryGroup);
  const publications = getWrappedChildren(root, 'publications', 'publication').map(el => ({
    id: el.getAttribute('id'),
    name: getName(el),
    shortName: el.getAttribute('shortName'),
    publisher: el.getAttribute('publisher'),
    publicationDate: el.getAttribute('publicationDate'),
    website: el.getAttribute('website')
  }));

  return {
    id: root.getAttribute('id'),
    name: getName(root),
    revision: getRevision(root),
    costTypes,
    profileTypes,
    categoryEntries,
    forceEntries,
    sharedSelectionEntries,
    sharedSelectionEntryGroups,
    sharedProfiles: parseProfiles(root),
    sharedRules: parseRules(root),
    publications
  };
}

/**
 * Parses a Catalogue XML content
 */
export function parseCatalogueXML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const root = doc.documentElement;
  
  if (root.nodeName !== 'catalogue') {
    throw new Error('Not a valid Catalogue file');
  }

  const selectionEntries = getWrappedChildren(root, 'selectionEntries', 'selectionEntry').map(parseSelectionEntry);
  const entryLinks = parseEntryLinks(root);
  const sharedSelectionEntries = getWrappedChildren(root, 'sharedSelectionEntries', 'selectionEntry').map(parseSelectionEntry);
  const sharedSelectionEntryGroups = getWrappedChildren(root, 'sharedSelectionEntryGroups', 'selectionEntryGroup').map(parseSelectionEntryGroup);
  
  const categoryEntries = getWrappedChildren(root, 'categoryEntries', 'categoryEntry').map(el => ({
    id: el.getAttribute('id'),
    name: getName(el),
    hidden: el.getAttribute('hidden') === 'true',
    constraints: parseConstraints(el),
    modifiers: parseModifiers(el)
  }));
  
  // Catalogs can also declare catalogLinks to other catalogues
  const catalogueLinks = getWrappedChildren(root, 'catalogueLinks', 'catalogueLink').map(el => ({
    id: el.getAttribute('id'),
    name: getName(el),
    targetId: el.getAttribute('targetId'),
    type: el.getAttribute('type') // subRange, etc.
  }));

  const forceEntries = getWrappedChildren(root, 'forceEntries', 'forceEntry').map(parseForceEntry);
  const publications = getWrappedChildren(root, 'publications', 'publication').map(el => ({
    id: el.getAttribute('id'),
    name: getName(el),
    shortName: el.getAttribute('shortName'),
    publisher: el.getAttribute('publisher'),
    publicationDate: el.getAttribute('publicationDate'),
    website: el.getAttribute('website')
  }));

  return {
    id: root.getAttribute('id'),
    name: getName(root),
    revision: getRevision(root),
    gameSystemId: root.getAttribute('gameSystemId'),
    gameSystemRevision: root.getAttribute('gameSystemRevision'),
    selectionEntries,
    entryLinks,
    sharedSelectionEntries,
    sharedSelectionEntryGroups,
    categoryEntries,
    forceEntries,
    sharedProfiles: parseProfiles(root),
    sharedRules: parseRules(root),
    catalogueLinks,
    publications
  };
}

/**
 * Combines Game System and its catalogues into a unified game dataset for local storage
 */
export function processImportedData(gstFiles, catFiles) {
  if (gstFiles.length === 0) {
    throw new Error('No Game System (.gst) file found in the ZIP archive.');
  }
  
  // Usually there's exactly 1 gst in a ZIP, but we take the first
  const parsedGst = parseGameSystemXML(gstFiles[0].content);
  
  const parsedCats = [];
  for (const catFile of catFiles) {
    try {
      const parsedCat = parseCatalogueXML(catFile.content);
      parsedCats.push(parsedCat);
    } catch (e) {
      console.warn(`Failed parsing catalog ${catFile.name}:`, e);
    }
  }

  // Index everything for easy lookup
  const systemsData = {
    id: parsedGst.id,
    name: parsedGst.name,
    revision: parsedGst.revision,
    costTypes: parsedGst.costTypes,
    profileTypes: parsedGst.profileTypes,
    categoryEntries: parsedGst.categoryEntries,
    forceEntries: parsedGst.forceEntries,
    sharedSelectionEntries: parsedGst.sharedSelectionEntries,
    sharedSelectionEntryGroups: parsedGst.sharedSelectionEntryGroups,
    sharedProfiles: parsedGst.sharedProfiles,
    sharedRules: parsedGst.sharedRules,
    publications: parsedGst.publications || [],
    catalogues: parsedCats
  };

  return systemsData;
}
