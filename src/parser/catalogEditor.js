/**
 * Editing and searching of raw BattleScribe catalogue data.
 *
 * Two capabilities live here:
 *  - {@link updateRawXml} applies a named {@link EntryEdit} to the raw `.cat`/`.gst` XML.
 *  - {@link searchEditableEntries} and {@link findExactEntryById} both read the parsed
 *    catalogue tree through the single traversal {@link walkCatalogueTree}, so they can
 *    never drift apart in the node types they know about.
 */

const DEFAULT_GAME_SYSTEM_NAME = 'Game System';
const MIN_SEARCH_QUERY_LENGTH = 2;
const MAX_SEARCH_RESULTS = 50;
const PATH_SEPARATOR = ' -> ';
const UNNAMED_NODE_LABEL = '(unnamed)';

/**
 * Sentinel for an {@link EntryEdit} patch value: remove the attribute instead of setting it.
 * Absence of a patch key means "leave untouched"; this symbol means "delete".
 */
export const REMOVE_ATTRIBUTE = Symbol('catalogEditor.removeAttribute');

/** Patch keys that map 1:1 onto an XML attribute of the edited element. */
const PATCHABLE_ATTRIBUTE_NAMES = ['name', 'publicationId', 'page'];

const getDOMParser = () => {
  if (typeof DOMParser !== 'undefined') {
    return DOMParser;
  }
  if (typeof globalThis !== 'undefined' && globalThis.DOMParser) {
    return globalThis.DOMParser;
  }
  if (typeof window !== 'undefined' && window.DOMParser) {
    return window.DOMParser;
  }
  throw new Error('DOMParser is not available. Ensure you are in a jsdom or browser environment.');
};

const getXMLSerializer = () => {
  if (typeof XMLSerializer !== 'undefined') {
    return XMLSerializer;
  }
  if (typeof globalThis !== 'undefined' && globalThis.XMLSerializer) {
    return globalThis.XMLSerializer;
  }
  if (typeof window !== 'undefined' && window.XMLSerializer) {
    return window.XMLSerializer;
  }
  throw new Error('XMLSerializer is not available. Ensure you are in a jsdom or browser environment.');
};

const hasPatchKey = (patch, key) => Object.prototype.hasOwnProperty.call(patch, key);

const toNumericAttributeValue = (value) => parseFloat(value) || 0;

function applyAttributePatches({ element, patch }) {
  PATCHABLE_ATTRIBUTE_NAMES.forEach((attributeName) => {
    if (!hasPatchKey(patch, attributeName)) return;

    const value = patch[attributeName];
    if (value === REMOVE_ATTRIBUTE) {
      element.removeAttribute(attributeName);
    } else {
      element.setAttribute(attributeName, value);
    }
  });
}

function applyCostPatches({ element, patch }) {
  if (!hasPatchKey(patch, 'costs')) return;

  Object.entries(patch.costs).forEach(([costTypeId, value]) => {
    const costElement = element.querySelector(`cost[typeId="${costTypeId}"]`);
    costElement?.setAttribute('value', toNumericAttributeValue(value));
  });
}

function applyConstraintPatches({ element, patch }) {
  if (!hasPatchKey(patch, 'constraints')) return;

  Object.entries(patch.constraints).forEach(([constraintId, value]) => {
    const constraintElement = element.querySelector(`constraint[id="${constraintId}"]`);
    constraintElement?.setAttribute('value', toNumericAttributeValue(value));
  });
}

function applyCharacteristicPatches({ element, patch }) {
  if (!hasPatchKey(patch, 'characteristics')) return;

  const characteristicElements = Array.from(element.querySelectorAll('characteristic'));
  Object.entries(patch.characteristics).forEach(([characteristicName, value]) => {
    const characteristicElement = characteristicElements
      .find((candidate) => candidate.getAttribute('name') === characteristicName);
    if (characteristicElement) {
      characteristicElement.textContent = value;
    }
  });
}

function applyDescriptionPatch({ element, patch, doc }) {
  if (!hasPatchKey(patch, 'description')) return;

  let descriptionElement = element.querySelector('description');
  if (!descriptionElement) {
    descriptionElement = doc.createElement('description');
    element.appendChild(descriptionElement);
  }
  descriptionElement.textContent = patch.description;
}

/**
 * Which patch appliers a given entry type supports. Supporting a new entry type means
 * adding a row here — {@link updateRawXml} itself never changes.
 */
const PATCH_APPLIERS_BY_ENTRY_TYPE = {
  entry: [applyCostPatches, applyConstraintPatches],
  group: [applyConstraintPatches],
  categoryLink: [applyConstraintPatches],
  forceEntry: [applyConstraintPatches],
  profile: [applyCharacteristicPatches],
  rule: [applyDescriptionPatch],
};

/** Appliers that run for every entry type, since every element carries these attributes. */
const UNIVERSAL_PATCH_APPLIERS = [applyAttributePatches];

const findRawXmlFileContaining = (system, entryId) =>
  system.rawXmls.cat?.find((file) => file.content.includes(entryId))
  ?? system.rawXmls.gst?.find((file) => file.content.includes(entryId))
  ?? null;

/**
 * @typedef {object} EntryEdit
 * @property {string} entryId    id of the element to edit.
 * @property {string} type       entry type, keying into {@link PATCH_APPLIERS_BY_ENTRY_TYPE}.
 * @property {object} [patch]    only the fields to change. A missing key leaves the value
 *                               untouched; {@link REMOVE_ATTRIBUTE} deletes an attribute.
 *                               Supported keys: `name`, `publicationId`, `page`, `costs`,
 *                               `constraints`, `characteristics`, `description`.
 */

/**
 * Applies an edit to the raw XML held in `system.rawXmls`, in place.
 *
 * @param {object} system the parsed game system carrying `rawXmls`.
 * @param {EntryEdit} edit the change to apply.
 * @returns {boolean} whether a matching element was found and rewritten.
 */
export function updateRawXml(system, edit) {
  if (!edit || !edit.entryId) {
    throw new TypeError('updateRawXml requires an edit object with an entryId.');
  }
  if (!system?.rawXmls) return false;

  const { entryId, type, patch = {} } = edit;

  const file = findRawXmlFileContaining(system, entryId);
  if (!file) return false;

  const DOMParserClass = getDOMParser();
  const doc = new DOMParserClass().parseFromString(file.content, 'text/xml');

  const element = doc.querySelector(`[id="${entryId}"]`);
  if (!element) return false;

  const appliers = [
    ...UNIVERSAL_PATCH_APPLIERS,
    ...(PATCH_APPLIERS_BY_ENTRY_TYPE[type] ?? []),
  ];
  appliers.forEach((applyPatch) => applyPatch({ element, patch, doc }));

  const XMLSerializerClass = getXMLSerializer();
  file.content = new XMLSerializerClass().serializeToString(doc);
  return true;
}

/**
 * Every child collection of a catalogue-tree node, with the node type and path label its
 * members carry. This is the single place a new node type has to be registered.
 */
const CHILD_NODE_COLLECTIONS = [
  { property: 'selectionEntries', nodeType: 'entry', pathPrefix: '' },
  { property: 'entryLinks', nodeType: 'entryLink', pathPrefix: 'Link: ' },
  { property: 'selectionEntryGroups', nodeType: 'group', pathPrefix: 'Group: ' },
  { property: 'profiles', nodeType: 'profile', pathPrefix: 'Profile: ' },
  { property: 'rules', nodeType: 'rule', pathPrefix: 'Rule: ' },
  { property: 'categoryEntries', nodeType: 'category', pathPrefix: 'Category: ' },
  { property: 'infoLinks', nodeType: 'infoLink', pathPrefix: 'InfoLink: ' },
  { property: 'forceEntries', nodeType: 'forceEntry', pathPrefix: 'Force: ' },
  { property: 'categoryLinks', nodeType: 'categoryLink', pathPrefix: 'CatLink: ' },
  { property: 'sharedSelectionEntries', nodeType: 'entry', pathPrefix: 'Shared: ' },
  { property: 'sharedSelectionEntryGroups', nodeType: 'group', pathPrefix: 'Shared Group: ' },
  { property: 'sharedProfiles', nodeType: 'profile', pathPrefix: 'Shared Profile: ' },
  { property: 'sharedRules', nodeType: 'rule', pathPrefix: 'Shared Rule: ' },
];

const displayNameOf = (node) => node.name || node.targetId || node.id || UNNAMED_NODE_LABEL;

/**
 * @typedef {object} CatalogueTreeVisit
 * @property {object} node           the visited node itself.
 * @property {string} nodeType       its type, e.g. `entry`, `group`, `categoryLink`.
 * @property {string} catalogueName  the catalogue (or game system) the node belongs to.
 * @property {string} path           a human-readable path down to the node.
 */

function* walkNode(node, visitContext) {
  if (!node) return;

  yield { ...visitContext, node };

  for (const collection of CHILD_NODE_COLLECTIONS) {
    const children = node[collection.property];
    if (!children) continue;

    for (const child of children) {
      yield* walkNode(child, {
        nodeType: collection.nodeType,
        catalogueName: visitContext.catalogueName,
        path: `${visitContext.path}${PATH_SEPARATOR}${collection.pathPrefix}${displayNameOf(child)}`,
      });
    }
  }
}

/**
 * The one traversal of the catalogue tree. Lazily yields every node of the game system and
 * of each catalogue, so callers can stop as soon as they have what they need.
 *
 * @param {object} system the parsed game system.
 * @returns {Generator<CatalogueTreeVisit>}
 */
export function* walkCatalogueTree(system) {
  if (!system) return;

  const gameSystemName = system.name || DEFAULT_GAME_SYSTEM_NAME;
  yield* walkNode(system, {
    nodeType: 'system',
    catalogueName: gameSystemName,
    path: gameSystemName,
  });

  for (const catalogue of system.catalogues ?? []) {
    yield* walkNode(catalogue, {
      nodeType: 'catalogue',
      catalogueName: catalogue.name,
      path: catalogue.name,
    });
  }
}

const toSearchResult = ({ node, nodeType, catalogueName, path }) => ({
  type: nodeType,
  id: node.id,
  name: node.name || node.id,
  catalogueName,
  path,
  ref: node,
});

/**
 * Finds every catalogue node whose name or id contains `query`, over the same node set that
 * {@link findExactEntryById} searches.
 *
 * @returns {object[]} at most {@link MAX_SEARCH_RESULTS} results.
 */
export function searchEditableEntries(system, query) {
  if (!query || query.length < MIN_SEARCH_QUERY_LENGTH) return [];

  const normalizedQuery = query.toLowerCase();
  const matchesQuery = ({ node }) =>
    Boolean(node.name?.toLowerCase().includes(normalizedQuery))
    || Boolean(node.id?.toLowerCase().includes(normalizedQuery));

  const results = [];
  for (const visit of walkCatalogueTree(system)) {
    if (!matchesQuery(visit)) continue;
    results.push(toSearchResult(visit));
    if (results.length === MAX_SEARCH_RESULTS) break;
  }
  return results;
}

/**
 * Finds the single catalogue node carrying exactly this id.
 *
 * @returns {object|null} the search result, or `null` if no node carries that id.
 */
export function findExactEntryById(system, id) {
  if (!id) return null;

  const normalizedId = id.toLowerCase();
  for (const visit of walkCatalogueTree(system)) {
    if (visit.node.id?.toLowerCase() === normalizedId) {
      return toSearchResult(visit);
    }
  }
  return null;
}
