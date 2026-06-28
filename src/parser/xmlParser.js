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
 * Parses rules from an element, accepting 'rules' or 'sharedRules' wrappers.
 */
function parseRules(el) {
  const wrapper = getChildren(el, 'rules')[0] || getChildren(el, 'sharedRules')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'rule').map(ruleEl => ({
    id: ruleEl.getAttribute('id'),
    name: ruleEl.getAttribute('name'),
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
          name: cEl.getAttribute('name'),
          value: cEl.textContent || ''
        });
      });
    }
    return {
      id: profEl.getAttribute('id'),
      name: profEl.getAttribute('name'),
      profileTypeId: profEl.getAttribute('profileTypeId'),
      profileTypeName: profEl.getAttribute('profileTypeName') || profEl.getAttribute('typeName'),
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
    name: linkEl.getAttribute('name'),
    targetId: linkEl.getAttribute('targetId'),
    type: linkEl.getAttribute('type'), // profile, rule
    hidden: linkEl.getAttribute('hidden') === 'true'
  }));
}

/**
 * Parses point/power costs from an element
 */
function parseCosts(el) {
  const wrapper = getChildren(el, 'costs')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'cost').map(costEl => ({
    name: costEl.getAttribute('name'),
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
    name: linkEl.getAttribute('name'),
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
    name: linkEl.getAttribute('name'),
    targetId: linkEl.getAttribute('targetId'),
    type: linkEl.getAttribute('type'), // selectionEntry, selectionEntryGroup
    collective: linkEl.getAttribute('collective') === 'true',
    hidden: linkEl.getAttribute('hidden') === 'true',
    constraints: parseConstraints(linkEl),
    costs: parseCosts(linkEl),
    modifiers: parseModifiers(linkEl),
    profiles: parseProfiles(linkEl),
    rules: parseRules(linkEl),
    infoLinks: parseInfoLinks(linkEl),
    categoryLinks: parseCategoryLinks(linkEl)
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
    name: el.getAttribute('name'),
    type: el.getAttribute('type') || 'upgrade', // unit, model, upgrade
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
    name: el.getAttribute('name'),
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
    name: el.getAttribute('name'),
    defaultCostLimit: parseFloat(el.getAttribute('defaultCostLimit')) || 0
  }));

  // Profile Types
  const profileTypes = getWrappedChildren(root, 'profileTypes', 'profileType').map(el => {
    const charWrapper = getChildren(el, 'characteristicTypes')[0];
    const characteristics = getChildren(charWrapper, 'characteristicType').map(c => ({
      id: c.getAttribute('id'),
      name: c.getAttribute('name')
    }));
    return {
      id: el.getAttribute('id'),
      name: el.getAttribute('name'),
      characteristics
    };
  });

  // Category Entries
  const categoryEntries = getWrappedChildren(root, 'categoryEntries', 'categoryEntry').map(el => ({
    id: el.getAttribute('id'),
    name: el.getAttribute('name'),
    hidden: el.getAttribute('hidden') === 'true'
  }));

  // Force Entries (Detachments etc.)
  const parseForceEntry = (el) => {
    const catLinks = getWrappedChildren(el, 'categoryLinks', 'categoryLink').map(link => ({
      id: link.getAttribute('id'),
      name: link.getAttribute('name'),
      targetId: link.getAttribute('targetId'),
      constraints: parseConstraints(link),
      modifiers: parseModifiers(link)
    }));

    const subForces = getWrappedChildren(el, 'forceEntries', 'forceEntry').map(parseForceEntry);

    return {
      id: el.getAttribute('id'),
      name: el.getAttribute('name'),
      categoryLinks: catLinks,
      forceEntries: subForces,
      constraints: parseConstraints(el)
    };
  };
  
  const forceEntries = getWrappedChildren(root, 'forceEntries', 'forceEntry').map(parseForceEntry);
  const sharedSelectionEntries = getWrappedChildren(root, 'sharedSelectionEntries', 'selectionEntry').map(parseSelectionEntry);
  const sharedSelectionEntryGroups = getWrappedChildren(root, 'sharedSelectionEntryGroups', 'selectionEntryGroup').map(parseSelectionEntryGroup);

  return {
    id: root.getAttribute('id'),
    name: root.getAttribute('name'),
    costTypes,
    profileTypes,
    categoryEntries,
    forceEntries,
    sharedSelectionEntries,
    sharedSelectionEntryGroups,
    sharedProfiles: parseProfiles(root),
    sharedRules: parseRules(root)
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
  
  // Catalogs can also declare catalogLinks to other catalogues
  const catalogueLinks = getWrappedChildren(root, 'catalogueLinks', 'catalogueLink').map(el => ({
    id: el.getAttribute('id'),
    name: el.getAttribute('name'),
    targetId: el.getAttribute('targetId'),
    type: el.getAttribute('type') // subRange, etc.
  }));

  return {
    id: root.getAttribute('id'),
    name: root.getAttribute('name'),
    gameSystemId: root.getAttribute('gameSystemId'),
    gameSystemRevision: root.getAttribute('gameSystemRevision'),
    selectionEntries,
    entryLinks,
    sharedSelectionEntries,
    sharedSelectionEntryGroups,
    sharedProfiles: parseProfiles(root),
    sharedRules: parseRules(root),
    catalogueLinks
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
    costTypes: parsedGst.costTypes,
    profileTypes: parsedGst.profileTypes,
    categoryEntries: parsedGst.categoryEntries,
    forceEntries: parsedGst.forceEntries,
    sharedSelectionEntries: parsedGst.sharedSelectionEntries,
    sharedSelectionEntryGroups: parsedGst.sharedSelectionEntryGroups,
    sharedProfiles: parsedGst.sharedProfiles,
    sharedRules: parsedGst.sharedRules,
    catalogues: parsedCats
  };

  return systemsData;
}
