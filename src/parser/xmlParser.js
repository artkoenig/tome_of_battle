import { AttributeName, SelectionEntryKind } from './schema/battlescribeSchema.generated.js';

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
  return el.getAttribute(AttributeName.NAME)?.trim() ?? null;
}

/**
 * Reads an element's integer `revision` attribute — BattleScribe's official update
 * signal ("if it's higher, the file will be updated"). Returns null when the
 * attribute is absent or non-numeric, so callers can treat pre-revision stored data
 * (imported before revisions were tracked) as outdated.
 */
function getRevision(el) {
  const raw = el.getAttribute(AttributeName.REVISION);
  if (raw === null || raw === '') return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * The wrapper tag names under which an element may carry rules. Per the
 * BattleScribe schema `rules` and `sharedRules` may appear side by side on the
 * same element, so both must be read.
 */
const RULE_WRAPPER_NAMES = ['rules', 'sharedRules'];

/**
 * Maps a single `<rule>` element to a plain rule object.
 */
function parseRule(ruleEl) {
  return {
    id: ruleEl.getAttribute(AttributeName.ID),
    name: getName(ruleEl),
    publicationId: ruleEl.getAttribute(AttributeName.PUBLICATION_ID),
    page: ruleEl.getAttribute(AttributeName.PAGE),
    hidden: getBooleanAttribute(ruleEl, AttributeName.HIDDEN),
    modifiers: parseModifiers(ruleEl),
    modifierGroups: parseModifierGroups(ruleEl),
    description: getChildren(ruleEl, 'description')[0]?.textContent || ''
  };
}

/**
 * Parses rules from an element, returning the union of the rules found under
 * every present wrapper (`rules` and `sharedRules`). Merging both — rather than
 * keeping only the first-found wrapper — prevents shared rules from being
 * silently dropped whenever an element also declares its own `rules`.
 */
function parseRules(el) {
  return RULE_WRAPPER_NAMES.flatMap(wrapperName =>
    getChildren(getChildren(el, wrapperName)[0], 'rule').map(parseRule)
  );
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
          id: cEl.getAttribute(AttributeName.TYPE_ID),
          typeId: cEl.getAttribute(AttributeName.TYPE_ID),
          value: cEl.textContent || ''
        });
      });
    }
    return {
      id: profEl.getAttribute(AttributeName.ID),
      name: getName(profEl),
      profileTypeId: profEl.getAttribute(AttributeName.TYPE_ID),
      profileTypeName: profEl.getAttribute(AttributeName.TYPE_NAME),
      publicationId: profEl.getAttribute(AttributeName.PUBLICATION_ID),
      page: profEl.getAttribute(AttributeName.PAGE),
      hidden: getBooleanAttribute(profEl, AttributeName.HIDDEN),
      modifiers: parseModifiers(profEl),
      modifierGroups: parseModifierGroups(profEl),
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
    id: linkEl.getAttribute(AttributeName.ID),
    name: getName(linkEl),
    targetId: linkEl.getAttribute(AttributeName.TARGET_ID),
    type: linkEl.getAttribute(AttributeName.TYPE), // profile, rule
    publicationId: linkEl.getAttribute(AttributeName.PUBLICATION_ID),
    page: linkEl.getAttribute(AttributeName.PAGE),
    hidden: getBooleanAttribute(linkEl, AttributeName.HIDDEN),
    modifiers: parseModifiers(linkEl),
    modifierGroups: parseModifierGroups(linkEl)
  }));
}

/**
 * The wrapper tag names under which an element may carry info groups. `infoGroups`
 * holds an element's own groups, `sharedInfoGroups` the catalogue/system-level
 * reusable ones; both are read so no group is missed (same class of bug as
 * `rules`/`sharedRules` above).
 */
const INFO_GROUP_WRAPPER_NAMES = ['infoGroups', 'sharedInfoGroups'];

/**
 * Parses a single `<infoGroup>` element. An info group bundles profiles, rules,
 * further info links and nested info groups, and is itself a valid `infoLink`
 * target (type "infoGroup"), so it must carry an `id` to be found in the index.
 */
function parseInfoGroup(groupEl) {
  return {
    id: groupEl.getAttribute(AttributeName.ID),
    name: getName(groupEl),
    publicationId: groupEl.getAttribute(AttributeName.PUBLICATION_ID),
    page: groupEl.getAttribute(AttributeName.PAGE),
    hidden: getBooleanAttribute(groupEl, AttributeName.HIDDEN),
    profiles: parseProfiles(groupEl),
    rules: parseRules(groupEl),
    infoLinks: parseInfoLinks(groupEl),
    infoGroups: parseInfoGroups(groupEl),
    modifiers: parseModifiers(groupEl)
  };
}

/**
 * Parses info groups from an element, returning the union of the groups found
 * under every present wrapper (`infoGroups` and `sharedInfoGroups`).
 */
function parseInfoGroups(el) {
  return INFO_GROUP_WRAPPER_NAMES.flatMap(wrapperName =>
    getChildren(getChildren(el, wrapperName)[0], 'infoGroup').map(parseInfoGroup)
  );
}

/**
 * Parses point/power costs from an element
 */
function parseCosts(el) {
  const wrapper = getChildren(el, 'costs')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'cost').map(costEl => ({
    name: getName(costEl),
    typeId: costEl.getAttribute(AttributeName.TYPE_ID),
    value: parseFloat(costEl.getAttribute(AttributeName.VALUE)) || 0
  }));
}

/**
 * The BattleScribe QueryBase default `field`: a constraint/condition counts
 * selections unless it names a cost-type id instead. Exported as the single
 * source of truth so the solver's cost/selection distinction (constraintScope.js)
 * and this parser default cannot drift apart.
 */
export const SELECTIONS_FIELD = 'selections';
const DEFAULT_CONSTRAINT_SCOPE = 'parent'; // parent, force, roster, or an ancestor id

/**
 * Reads a boolean XSD attribute, treating an absent attribute as `false`
 * (the schema default for the constraint inclusion/percent flags).
 */
function getBooleanAttribute(el, attributeName) {
  return el.getAttribute(attributeName) === 'true';
}

/**
 * Parses constraints from an element. Attribute names come from the schema SSOT
 * (see battlescribeSchema.generated.js) so they cannot silently drift from the
 * vendored XSD. `percentValue` marks the value as a percentage of a reference
 * quantity; `includeChildSelections`/`includeChildForces` control whether nested
 * selections / sibling (child) forces are counted for the constraint.
 */
function parseConstraints(el) {
  const wrapper = getChildren(el, 'constraints')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'constraint').map(conEl => ({
    id: conEl.getAttribute(AttributeName.ID),
    type: conEl.getAttribute(AttributeName.TYPE), // min, max
    value: parseFloat(conEl.getAttribute(AttributeName.VALUE)) || 0,
    field: conEl.getAttribute(AttributeName.FIELD) || SELECTIONS_FIELD,
    scope: conEl.getAttribute(AttributeName.SCOPE) || DEFAULT_CONSTRAINT_SCOPE,
    shared: getBooleanAttribute(conEl, AttributeName.SHARED),
    percentValue: getBooleanAttribute(conEl, AttributeName.PERCENT_VALUE),
    includeChildSelections: getBooleanAttribute(conEl, AttributeName.INCLUDE_CHILD_SELECTIONS),
    includeChildForces: getBooleanAttribute(conEl, AttributeName.INCLUDE_CHILD_FORCES)
  }));
}

/**
 * Parses conditions/conditionGroups
 */
function parseCondition(condEl) {
  return {
    type: condEl.getAttribute(AttributeName.TYPE), // equalTo, lessThan, greaterThan, etc.
    value: parseFloat(condEl.getAttribute(AttributeName.VALUE)) || 0,
    field: condEl.getAttribute(AttributeName.FIELD) || SELECTIONS_FIELD,
    scope: condEl.getAttribute(AttributeName.SCOPE) || DEFAULT_CONSTRAINT_SCOPE,
    childId: condEl.getAttribute(AttributeName.CHILD_ID),
    shared: getBooleanAttribute(condEl, AttributeName.SHARED),
    // When true, selections nested below the scope target are counted as well,
    // not only the direct children (BattleScribe QueryBase attribute).
    includeChildSelections: getBooleanAttribute(condEl, AttributeName.INCLUDE_CHILD_SELECTIONS)
  };
}

function parseConditionGroup(groupEl) {
  return {
    type: groupEl.getAttribute(AttributeName.TYPE) || 'and', // and, or, not
    conditions: getWrappedChildren(groupEl, 'conditions', 'condition').map(parseCondition),
    conditionGroups: getWrappedChildren(groupEl, 'conditionGroups', 'conditionGroup').map(parseConditionGroup)
  };
}

/**
 * Parses a single `repeat` element (BattleScribe Repeat, extends the filtered
 * query base — hence `childId` and `includeChildSelections`).
 */
function parseRepeat(repeatsEl) {
  return {
    field: repeatsEl.getAttribute(AttributeName.FIELD),
    childId: repeatsEl.getAttribute(AttributeName.CHILD_ID),
    scope: repeatsEl.getAttribute(AttributeName.SCOPE),
    value: parseFloat(repeatsEl.getAttribute(AttributeName.VALUE)) || 0,
    repeats: parseFloat(repeatsEl.getAttribute(AttributeName.REPEATS)) || 1,
    roundUp: getBooleanAttribute(repeatsEl, AttributeName.ROUND_UP),
    includeChildSelections: getBooleanAttribute(repeatsEl, AttributeName.INCLUDE_CHILD_SELECTIONS)
  };
}

/**
 * Parses a single modifier element.
 */
function parseSingleModifier(modEl) {
  const conditions = getWrappedChildren(modEl, 'conditions', 'condition').map(parseCondition);
  const conditionGroups = getWrappedChildren(modEl, 'conditionGroups', 'conditionGroup').map(parseConditionGroup);

  const repeatsEl = getWrappedChildren(modEl, 'repeats', 'repeat')[0];
  const repeat = repeatsEl ? parseRepeat(repeatsEl) : null;

  return {
    type: modEl.getAttribute(AttributeName.TYPE), // set, increment, decrement, add, remove, set-primary, unset-primary
    field: modEl.getAttribute(AttributeName.FIELD), // cost, hidden, constraint, category
    value: modEl.getAttribute(AttributeName.VALUE),
    valueObject: parseFloat(modEl.getAttribute(AttributeName.VALUE)) || 0,
    conditions,
    conditionGroups,
    repeat
  };
}

/**
 * Parses a single modifierGroup, preserving its own gating conditions/repeat and
 * its contained modifiers and nested modifierGroups (BattleScribe ModifierGroup,
 * extends ModifierBase). Groups are NOT flattened: the evaluator applies the
 * group's conditions as a gate over the contained modifiers.
 */
function parseModifierGroup(groupEl) {
  const repeatsEl = getWrappedChildren(groupEl, 'repeats', 'repeat')[0];
  return {
    conditions: getWrappedChildren(groupEl, 'conditions', 'condition').map(parseCondition),
    conditionGroups: getWrappedChildren(groupEl, 'conditionGroups', 'conditionGroup').map(parseConditionGroup),
    repeat: repeatsEl ? parseRepeat(repeatsEl) : null,
    modifiers: getWrappedChildren(groupEl, 'modifiers', 'modifier').map(parseSingleModifier),
    modifierGroups: getWrappedChildren(groupEl, 'modifierGroups', 'modifierGroup').map(parseModifierGroup)
  };
}

/**
 * Parses the direct `modifiers` of an element (not the modifierGroups — those are
 * parsed separately via parseModifierGroups so the group's own conditions survive).
 */
function parseModifiers(el) {
  return getWrappedChildren(el, 'modifiers', 'modifier').map(parseSingleModifier);
}

/**
 * Parses the `modifierGroups` of an element, keeping their structure intact.
 */
function parseModifierGroups(el) {
  return getWrappedChildren(el, 'modifierGroups', 'modifierGroup').map(parseModifierGroup);
}

/**
 * Parses a single `categoryLink`. Shared by selection entries (which care about
 * `primary`, the display bucket) and force entries (which care about `hidden`);
 * both attributes are read for every link so the two call sites use one parser.
 */
function parseCategoryLink(linkEl) {
  return {
    id: linkEl.getAttribute(AttributeName.ID),
    name: getName(linkEl),
    targetId: linkEl.getAttribute(AttributeName.TARGET_ID),
    primary: getBooleanAttribute(linkEl, AttributeName.PRIMARY),
    hidden: getBooleanAttribute(linkEl, AttributeName.HIDDEN),
    constraints: parseConstraints(linkEl),
    modifiers: parseModifiers(linkEl),
    modifierGroups: parseModifierGroups(linkEl)
  };
}

/**
 * Parses category links from an element
 */
function parseCategoryLinks(el) {
  const wrapper = getChildren(el, 'categoryLinks')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'categoryLink').map(parseCategoryLink);
}

/**
 * Parses entry links
 */
function parseEntryLinks(el) {
  const wrapper = getChildren(el, 'entryLinks')[0];
  if (!wrapper) return [];
  return getChildren(wrapper, 'entryLink').map(linkEl => ({
    id: linkEl.getAttribute(AttributeName.ID),
    name: getName(linkEl),
    targetId: linkEl.getAttribute(AttributeName.TARGET_ID),
    type: linkEl.getAttribute(AttributeName.TYPE), // selectionEntry, selectionEntryGroup
    publicationId: linkEl.getAttribute(AttributeName.PUBLICATION_ID),
    page: linkEl.getAttribute(AttributeName.PAGE),
    collective: getBooleanAttribute(linkEl, AttributeName.COLLECTIVE),
    hidden: getBooleanAttribute(linkEl, AttributeName.HIDDEN),
    constraints: parseConstraints(linkEl),
    costs: parseCosts(linkEl),
    modifiers: parseModifiers(linkEl),
    modifierGroups: parseModifierGroups(linkEl),
    profiles: parseProfiles(linkEl),
    rules: parseRules(linkEl),
    infoLinks: parseInfoLinks(linkEl),
    infoGroups: parseInfoGroups(linkEl),
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
    id: el.getAttribute(AttributeName.ID),
    name: getName(el),
    type: el.getAttribute(AttributeName.TYPE) || SelectionEntryKind.UPGRADE, // unit, model, upgrade
    publicationId: el.getAttribute(AttributeName.PUBLICATION_ID),
    page: el.getAttribute(AttributeName.PAGE),
    collective: getBooleanAttribute(el, AttributeName.COLLECTIVE),
    hidden: getBooleanAttribute(el, AttributeName.HIDDEN),
    constraints: parseConstraints(el),
    costs: parseCosts(el),
    profiles: parseProfiles(el),
    rules: parseRules(el),
    infoLinks: parseInfoLinks(el),
    infoGroups: parseInfoGroups(el),
    selectionEntries: subEntries,
    selectionEntryGroups: subGroups,
    entryLinks: entryLinks,
    modifiers: parseModifiers(el),
    modifierGroups: parseModifierGroups(el),
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
    id: el.getAttribute(AttributeName.ID),
    name: getName(el),
    defaultSelectionEntryId: el.getAttribute(AttributeName.DEFAULT_SELECTION_ENTRY_ID),
    publicationId: el.getAttribute(AttributeName.PUBLICATION_ID),
    page: el.getAttribute(AttributeName.PAGE),
    collective: getBooleanAttribute(el, AttributeName.COLLECTIVE),
    hidden: getBooleanAttribute(el, AttributeName.HIDDEN),
    constraints: parseConstraints(el),
    entryLinks: entryLinks,
    selectionEntries: subEntries,
    selectionEntryGroups: subGroups,
    infoLinks: parseInfoLinks(el),
    infoGroups: parseInfoGroups(el),
    modifiers: parseModifiers(el),
    modifierGroups: parseModifierGroups(el),
    categoryLinks: parseCategoryLinks(el)
  };
}

// Force Entries (Detachments etc.)
const parseForceEntry = (el) => {
  const subForces = getWrappedChildren(el, 'forceEntries', 'forceEntry').map(parseForceEntry);

  return {
    id: el.getAttribute(AttributeName.ID),
    name: getName(el),
    hidden: getBooleanAttribute(el, AttributeName.HIDDEN),
    categoryLinks: parseCategoryLinks(el),
    forceEntries: subForces,
    constraints: parseConstraints(el),
    // A forceEntry can carry its own modifiers/modifierGroups that raise one of its
    // own constraints when the force is chosen (e.g. the Vampire-Counts special armies
    // lifting their roster points minimum to 2000). Deliberately not the full
    // ContainerEntryBase — rules/profiles/infoLinks have no real occurrence here (YAGNI).
    modifiers: parseModifiers(el),
    modifierGroups: parseModifierGroups(el)
  };
};

/**
 * Parses the `categoryEntries` of a game system or catalogue root — the category
 * definitions themselves (not the links to them). Identical in both file kinds.
 */
function parseCategoryEntries(el) {
  return getWrappedChildren(el, 'categoryEntries', 'categoryEntry').map(catEl => ({
    id: catEl.getAttribute(AttributeName.ID),
    name: getName(catEl),
    hidden: getBooleanAttribute(catEl, AttributeName.HIDDEN),
    constraints: parseConstraints(catEl),
    modifiers: parseModifiers(catEl),
    modifierGroups: parseModifierGroups(catEl)
  }));
}

/**
 * Parses the `publications` (source references) of a game system or catalogue
 * root. Identical in both file kinds.
 */
function parsePublications(el) {
  return getWrappedChildren(el, 'publications', 'publication').map(pubEl => ({
    id: pubEl.getAttribute(AttributeName.ID),
    name: getName(pubEl),
    shortName: pubEl.getAttribute(AttributeName.SHORT_NAME),
    publisher: pubEl.getAttribute(AttributeName.PUBLISHER),
    publicationDate: pubEl.getAttribute(AttributeName.PUBLICATION_DATE),
    publisherUrl: pubEl.getAttribute(AttributeName.PUBLISHER_URL)
  }));
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
    id: el.getAttribute(AttributeName.ID),
    name: getName(el),
    defaultCostLimit: parseFloat(el.getAttribute(AttributeName.DEFAULT_COST_LIMIT)) || 0,
    hidden: getBooleanAttribute(el, AttributeName.HIDDEN)
  }));

  // Profile Types
  const profileTypes = getWrappedChildren(root, 'profileTypes', 'profileType').map(el => {
    const charWrapper = getChildren(el, 'characteristicTypes')[0];
    const characteristics = getChildren(charWrapper, 'characteristicType').map(c => ({
      id: c.getAttribute(AttributeName.ID),
      name: getName(c)
    }));
    return {
      id: el.getAttribute(AttributeName.ID),
      name: getName(el),
      characteristics
    };
  });

  const categoryEntries = parseCategoryEntries(root);
  const forceEntries = getWrappedChildren(root, 'forceEntries', 'forceEntry').map(parseForceEntry);
  const sharedSelectionEntries = getWrappedChildren(root, 'sharedSelectionEntries', 'selectionEntry').map(parseSelectionEntry);
  const sharedSelectionEntryGroups = getWrappedChildren(root, 'sharedSelectionEntryGroups', 'selectionEntryGroup').map(parseSelectionEntryGroup);
  const publications = parsePublications(root);

  return {
    id: root.getAttribute(AttributeName.ID),
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
    sharedInfoGroups: parseInfoGroups(root),
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
  
  const categoryEntries = parseCategoryEntries(root);

  // Catalogs can also declare catalogLinks to other catalogues. `importRootEntries`
  // is parsed for schema completeness but not consumed: acting on it means the
  // library-import / targetId resolution path, which is out of scope per the PRD
  // (ADR 0016). See docs/battlescribe-data-format.md §6.
  const catalogueLinks = getWrappedChildren(root, 'catalogueLinks', 'catalogueLink').map(el => ({
    id: el.getAttribute(AttributeName.ID),
    name: getName(el),
    targetId: el.getAttribute(AttributeName.TARGET_ID),
    type: el.getAttribute(AttributeName.TYPE), // catalogue
    importRootEntries: getBooleanAttribute(el, AttributeName.IMPORT_ROOT_ENTRIES)
  }));

  const forceEntries = getWrappedChildren(root, 'forceEntries', 'forceEntry').map(parseForceEntry);
  const publications = parsePublications(root);

  return {
    id: root.getAttribute(AttributeName.ID),
    name: getName(root),
    revision: getRevision(root),
    gameSystemId: root.getAttribute(AttributeName.GAME_SYSTEM_ID),
    gameSystemRevision: root.getAttribute(AttributeName.GAME_SYSTEM_REVISION),
    selectionEntries,
    entryLinks,
    sharedSelectionEntries,
    sharedSelectionEntryGroups,
    categoryEntries,
    forceEntries,
    sharedProfiles: parseProfiles(root),
    sharedRules: parseRules(root),
    sharedInfoGroups: parseInfoGroups(root),
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
    sharedInfoGroups: parsedGst.sharedInfoGroups,
    publications: parsedGst.publications || [],
    catalogues: parsedCats
  };

  return systemsData;
}
