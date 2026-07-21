import JSZip from 'jszip';
import {
  calculateRosterCosts, computeRosterCounts, getSelectionOwnCosts, getEffectiveSelectionName,
  findEntryInSystem, resolveEntry, childSelectionsOf, effectiveCountOf, foldSelectionTree,
  mapSelectionTree, TOP_LEVEL_PARENT_COUNT, isIndependentSubUnit, resolveCostLimitTypeId
} from '../solver/validator.js';
import { DEFAULT_ROSTER_COST_LIMIT, createInitialGameState } from './rosterDefaults.js';
// Decimal places kept when serializing costs, to strip floating-point artifacts
// introduced by cost-modifier arithmetic.
const COST_DECIMAL_PRECISION = 6;
// Indentation of a force's top-level <selection>, and the extra indentation each
// further nesting level adds.
const SELECTION_BASE_INDENT = 8;
const SELECTION_INDENT_STEP = 4;
// Each war machine / chariot split off a `number=N` selection is one independent unit.
const SPLIT_UNIT_NUMBER = 1;

// Element names of the BattleScribe roster schema this module reads.
const ROS_TAG = Object.freeze({
  forces: 'forces',
  force: 'force',
  selections: 'selections',
  selection: 'selection',
  categories: 'categories',
  category: 'category',
  costLimits: 'costLimits',
  costLimit: 'costLimit'
});

const ELEMENT_NODE_TYPE = 1;

/** All direct child elements of `node` carrying the given tag name. */
function childElementsNamed(node, tagName) {
  return Array.from(node.childNodes)
    .filter(child => child.nodeType === ELEMENT_NODE_TYPE && child.nodeName === tagName);
}

/** The first direct child element with the given tag name, or null. */
function firstChildElementNamed(node, tagName) {
  return childElementsNamed(node, tagName)[0] ?? null;
}

function roundCost(value) {
  return Number((value || 0).toFixed(COST_DECIMAL_PRECISION));
}

// Helper to escape special XML characters
function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Custom error class for when a roster is imported but its corresponding game system is missing.
 */
export class MissingSystemError extends Error {
  constructor(systemName, systemId) {
    super(`Das Spielsystem "${systemName}" (ID: ${systemId}) fehlt. Bitte importiere es zuerst.`);
    this.name = 'MissingSystemError';
    this.systemName = systemName;
    this.systemId = systemId;
  }
}

/**
 * Serializes an internal Roster object into BattleScribe-compliant .ros XML text.
 * @param {Object} roster 
 * @param {Object} system 
 * @returns {string} XML text
 */
export function exportRosterToXml(roster, system) {
  const systemName = system?.name || 'Unbekanntes System';
  const systemId = system?.id || roster.systemId;
  
  const computedCosts = system ? calculateRosterCosts(roster, system) : {};
  // Shared solver context so per-selection costs match the total block exactly.
  const ctx = { system, roster, counts: (system && roster) ? computeRosterCounts(roster, system) : null };

  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  xml += `<roster id="${escapeXml(roster.id)}" name="${escapeXml(roster.name)}" battleScribeVersion="2.03" gameSystemId="${escapeXml(systemId)}" gameSystemRevision="1" gameSystemName="${escapeXml(systemName)}" xmlns="http://www.battlescribe.net/schema/rosterSchema">\n`;
  
  // Costs block
  // A cost type only exists if the game system declares it — a system without any
  // yields an empty block rather than an invented one.
  xml += '  <costs>\n';
  (system?.costTypes ?? []).forEach(ct => {
    const val = computedCosts[ct.id] || 0;
    xml += `    <cost name="${escapeXml(ct.name)}" typeId="${escapeXml(ct.id)}" value="${val}"/>\n`;
  });
  xml += '  </costs>\n';

  // Cost limits block (BattleScribe stores the point limit here, not as a roster attribute)
  const limitType = resolveCostLimitTypeId(roster, system);
  xml += '  <costLimits>\n';
  if (limitType) {
    const limitName = system?.costTypes?.find(ct => ct.id === limitType)?.name ?? limitType;
    const limitValue = roster.costLimit ?? DEFAULT_ROSTER_COST_LIMIT;
    xml += `    <costLimit name="${escapeXml(limitName)}" typeId="${escapeXml(limitType)}" value="${limitValue}"/>\n`;
  }
  xml += '  </costLimits>\n';

  // Forces block
  xml += '  <forces>\n';
  if (roster.forces) {
    roster.forces.forEach(force => {
      const cat = system?.catalogues?.find(c => c.id === force.catalogueId);
      const catName = cat?.name || 'Keine Fraktion';
      const catId = force.catalogueId || '';
      const forceEntryId = force.forceEntryId || '';
      
      const forceEntryDef = system?.forceEntries?.find(fe => fe.id === forceEntryId);
      const forceName = forceEntryDef?.name || 'Standard';

      xml += `    <force id="${escapeXml(force.id)}" name="${escapeXml(forceName)}" entryId="${escapeXml(forceEntryId)}" catalogueId="${escapeXml(catId)}" catalogueRevision="1" catalogueName="${escapeXml(catName)}">\n`;
      xml += '      <publications/>\n';
      xml += '      <categories/>\n';
      xml += '      <selections>\n';
      
      const catalogueId = force.catalogueId || roster.catalogueId;
      childSelectionsOf(force).forEach(sel => {
        xml += serializeSelection(sel, SELECTION_BASE_INDENT, ctx, TOP_LEVEL_PARENT_COUNT, catalogueId, null);
      });

      xml += '      </selections>\n';
      xml += '    </force>\n';
    });
  }
  xml += '  </forces>\n';
  xml += '</roster>';
  return xml;
}

/**
 * Helper to recursively serialize roster selections.
 *
 * Costs and the `type` attribute are derived from the catalogue (SSOT): each
 * selection's <cost> is its own modifier-aware contribution (base × effective
 * count), so the flat sum of all selection costs equals the roster total block.
 */
function serializeSelection(rootSelection, indent, ctx, parentCount, currentCatalogueId, parentSelection) {
  const { system, roster, counts } = ctx;

  return foldSelectionTree(rootSelection, {
    descend: (sel, context) => ({
      indent: context.indent + SELECTION_INDENT_STEP,
      parentCount: effectiveCountOf(sel, context.parentCount),
      parentSelection: sel
    }),
    combine: (sel, context, childXml) => {
      const ind = ' '.repeat(context.indent);
      const nodeContext = {
        system, roster, currentCatalogueId, parentSelection: context.parentSelection, counts
      };
      const entryId = sel.selectionEntryId || '';
      const entryLinkId = sel.entryLinkId || '';
      const effectiveCount = effectiveCountOf(sel, context.parentCount);

      const resolved = resolveSelectionEntry(system, sel, currentCatalogueId);
      const selType = resolved?.type || 'upgrade';
      const isCollective = sel.collective ? 'true' : 'false';
      const effectiveName = getEffectiveSelectionName(sel, nodeContext);

      let sXml = `${ind}<selection id="${escapeXml(sel.id)}" name="${escapeXml(effectiveName)}" entryId="${escapeXml(entryId)}" entryLinkId="${escapeXml(entryLinkId)}" number="${sel.number || 1}" type="${escapeXml(selType)}" collective="${isCollective}">\n`;

      // Category Link block (only for top-level selections that carry categories)
      if (sel.category) {
        const catDef = system?.categoryEntries?.find(ce => ce.id === sel.category);
        const catName = catDef?.name || 'Category';
        sXml += `${ind}  <categories>\n`;
        sXml += `${ind}    <category id="${escapeXml(sel.category)}" name="${escapeXml(catName)}" entryId="${escapeXml(sel.category)}" primary="true"/>\n`;
        sXml += `${ind}  </categories>\n`;
      }

      // Costs: the selection's own, modifier-aware contribution (derived from the catalogue).
      const ownCosts = getSelectionOwnCosts(sel, effectiveCount, nodeContext);
      sXml += `${ind}  <costs>\n`;
      Object.entries(ownCosts).forEach(([typeId, value]) => {
        const costName = system?.costTypes?.find(c => c.id === typeId)?.name ?? typeId;
        sXml += `${ind}    <cost name="${escapeXml(costName)}" typeId="${escapeXml(typeId)}" value="${roundCost(value)}"/>\n`;
      });
      sXml += `${ind}  </costs>\n`;

      if (childXml.length > 0) {
        sXml += `${ind}  <selections>\n${childXml.join('')}${ind}  </selections>\n`;
      }

      sXml += `${ind}</selection>\n`;
      return sXml;
    }
  }, { indent, parentCount, parentSelection });
}

/**
 * Resolves the catalogue entry a selection references (link id or entry id).
 */
function resolveSelectionEntry(system, selection, catalogueId) {
  if (!system) return null;
  const entryId = selection.selectionEntryId || selection.entryLinkId;
  if (!entryId) return null;
  const entryDef = findEntryInSystem(system, entryId, catalogueId);
  return entryDef ? resolveEntry(system, entryDef, catalogueId) : null;
}

/**
 * Compresses raw XML text into a BattleScribe-compliant .rosz (ZIP) Blob.
 * @param {string} fileName 
 * @param {string} xmlText 
 * @returns {Promise<Blob>} ZIP Blob
 */
export async function compressXmlToRosz(fileName, xmlText) {
  const zip = new JSZip();
  const baseName = fileName.replace(/\.rosz$/i, '').replace(/\.ros$/i, '');
  zip.file(`${baseName}.ros`, xmlText);
  // Explicit octet-stream avoids browsers appending a ".zip" suffix to the
  // ".rosz" download name based on JSZip's default "application/zip" blob type.
  return await zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' });
}

/**
 * The local file header signature every ZIP archive starts with ("PK\x03\x04"). It tells
 * an archive apart from raw .ros XML, so a failure to unpack it can be reported as real
 * damage instead of being mistaken for "this file was never a ZIP".
 */
const ZIP_FILE_SIGNATURE = Object.freeze([0x50, 0x4b, 0x03, 0x04]);

const ROSTER_XML_EXTENSION = '.ros';

const ROSZ_ERROR_MESSAGE = Object.freeze({
  damagedArchive: 'Die Datei ist ein beschädigtes ZIP-Archiv und konnte nicht entpackt werden.',
  missingRosterEntry: `Das ZIP-Archiv enthält keine ${ROSTER_XML_EXTENSION}-Datei.`,
});

/**
 * Whether the blob starts with the ZIP local file header signature. Only the first
 * bytes are read, so the check stays cheap regardless of the archive's size.
 */
async function hasZipFileSignature(fileBlob) {
  const header = new Uint8Array(
    await fileBlob.slice(0, ZIP_FILE_SIGNATURE.length).arrayBuffer()
  );
  return ZIP_FILE_SIGNATURE.every((byte, index) => header[index] === byte);
}

function readBlobAsText(fileBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(fileBlob);
  });
}

/**
 * Unpacks a .rosz archive and returns the contained roster XML.
 * @throws {Error} when the archive is damaged or carries no .ros entry.
 */
async function extractRosterXmlFromZip(fileBlob) {
  let zip;
  try {
    zip = await JSZip.loadAsync(fileBlob);
  } catch (error) {
    // The signature identified this as a ZIP, so a load failure is genuine damage
    // and must not be papered over by the raw-XML fallback below.
    throw new Error(`${ROSZ_ERROR_MESSAGE.damagedArchive} (${error.message})`);
  }

  const rosFileName = Object.keys(zip.files).find(name => name.endsWith(ROSTER_XML_EXTENSION));
  if (!rosFileName) {
    throw new Error(ROSZ_ERROR_MESSAGE.missingRosterEntry);
  }
  return zip.files[rosFileName].async('text');
}

/**
 * Decompresses a BattleScribe .rosz ZIP Blob (or handles raw .ros XML directly) and returns
 * the XML text. Which of the two it is, is decided by the ZIP signature rather than by a
 * failed unpacking attempt — so a damaged archive surfaces as an error instead of being
 * read as text and failing later with a misleading "invalid file format".
 * @param {Blob|File} fileBlob
 * @returns {Promise<string>} XML text
 */
export async function decompressRoszToXml(fileBlob) {
  if (await hasZipFileSignature(fileBlob)) {
    return extractRosterXmlFromZip(fileBlob);
  }
  return readBlobAsText(fileBlob);
}

/**
 * Deserializes raw BattleScribe XML text into our internal Roster object.
 * Maps XML node attributes and tags recursively, verifying the presence of the Game System.
 * Generates fresh unique UUIDs to prevent clashing with local rosters in IndexedDB.
 * @param {string} xmlText 
 * @param {Array} systems 
 * @returns {Object} Internal Roster object
 * @throws {MissingSystemError} If gameSystemId is not found in systems
 */
export function importRosterFromXml(xmlText, systems) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const root = doc.documentElement;
  
  if (root.nodeName !== 'roster') {
    throw new Error('Ungültiges Dateiformat: Das Wurzelelement muss <roster> sein.');
  }

  const systemId = root.getAttribute('gameSystemId');
  const systemName = root.getAttribute('gameSystemName') || 'Unbekanntes System';
  
  const system = systems.find(s => s.id === systemId);
  if (!system) {
    throw new MissingSystemError(systemName, systemId);
  }

  const rosterName = root.getAttribute('name') || 'Importierte Liste';
  const costLimitType = resolveCostLimitTypeId(null, system);
  const costLimit = parseCostLimit(root, costLimitType);
  
  const forcesWrapper = firstChildElementNamed(root, ROS_TAG.forces);
  const forces = forcesWrapper ? flattenForceList(forcesWrapper, system) : [];

  return {
    id: crypto.randomUUID(),
    name: rosterName,
    systemId,
    catalogueId: forces[0]?.catalogueId || system.catalogues?.[0]?.id || '',
    costLimit,
    costLimitType,
    forces,
    gameState: createInitialGameState()
  };
}

/**
 * Reads a `<forces>` list into a flat array of forces.
 *
 * The roster schema lets a `<force>` nest a further `<forces>` list — sub-contingents
 * such as detachments inside a detachment. Our roster model knows no force hierarchy,
 * so nested forces are flattened into roster-level siblings in document order (a force
 * before its sub-forces). This is a deliberate, lossless-for-selections import
 * transformation (ADR-0011 §5): flattening drops the nesting relation, never a
 * selection. Each flattened force keeps its own catalogue and force-entry reference.
 */
function flattenForceList(forcesWrapper, system) {
  return childElementsNamed(forcesWrapper, ROS_TAG.force).flatMap(forceNode => {
    const nestedWrapper = firstChildElementNamed(forceNode, ROS_TAG.forces);
    const nestedForces = nestedWrapper ? flattenForceList(nestedWrapper, system) : [];
    return [parseForceNode(forceNode, system), ...nestedForces];
  });
}

/** Reads one `<force>` element into a force of our roster model (without its sub-forces). */
function parseForceNode(forceNode, system) {
  const selectionsWrapper = firstChildElementNamed(forceNode, ROS_TAG.selections);
  return {
    id: crypto.randomUUID(),
    forceEntryId: forceNode.getAttribute('entryId')
      || forceNode.getAttribute('forceEntryId')
      || system.forceEntries?.[0]?.id
      || null,
    catalogueId: forceNode.getAttribute('catalogueId'),
    selections: selectionsWrapper ? parseSelectionList(selectionsWrapper, system) : []
  };
}

/**
 * Reads a `<selections>` list, applying the war-machine split (ADR-0011 §3) to every
 * selection that needs it.
 */
function parseSelectionList(selectionsWrapper, system) {
  return childElementsNamed(selectionsWrapper, ROS_TAG.selection).flatMap(selectionNode => {
    const parsed = parseSelectionNode(selectionNode, system);
    return checkNeedsSplit(parsed, system) ? splitIntoIndependentUnits(parsed) : [parsed];
  });
}

/** Splits a `number=N` selection into N independently configurable units. */
function splitIntoIndependentUnits(selection) {
  const splitCount = selection.number;
  return Array.from(
    { length: splitCount },
    (_unused, index) => createSplitSelection(selection, index, splitCount)
  );
}

/**
 * Reads the point limit for the given cost type from a roster's <costLimits> block,
 * falling back to the legacy costLimit attribute and finally the default limit.
 */
function parseCostLimit(root, costLimitType) {
  const costLimitsWrapper = firstChildElementNamed(root, ROS_TAG.costLimits);
  if (costLimitsWrapper) {
    const limitNodes = childElementsNamed(costLimitsWrapper, ROS_TAG.costLimit);
    const matchingLimit = limitNodes.find(node => node.getAttribute('typeId') === costLimitType) || limitNodes[0];
    if (matchingLimit) {
      const value = parseFloat(matchingLimit.getAttribute('value'));
      if (Number.isFinite(value) && value >= 0) return value;
    }
  }

  const attributeValue = parseInt(root.getAttribute('costLimit'), 10);
  return Number.isFinite(attributeValue) ? attributeValue : DEFAULT_ROSTER_COST_LIMIT;
}

/**
 * Helper to recursively parse selection XML nodes.
 */
function parseSelectionNode(node, system) {
  const name = node.getAttribute('name') || '';
  let entryId = node.getAttribute('entryId');
  if (entryId && entryId.includes('::')) {
    entryId = entryId.split('::').pop();
  }
  let entryLinkId = node.getAttribute('entryLinkId');
  if (entryLinkId && entryLinkId.includes('::')) {
    entryLinkId = entryLinkId.split('::').pop();
  }
  const number = parseInt(node.getAttribute('number')) || 1;
  const isCollective = node.getAttribute('collective') === 'true';

  let category = null;
  const categoriesWrapper = firstChildElementNamed(node, ROS_TAG.categories);
  if (categoriesWrapper) {
    const categoryNode = childElementsNamed(categoriesWrapper, ROS_TAG.category)
      .find(c => c.getAttribute('primary') === 'true');
    if (categoryNode) {
      category = categoryNode.getAttribute('entryId') || categoryNode.getAttribute('id');
      if (category && category.includes('::')) {
        category = category.split('::').pop();
      }
    }
  }

  // Costs are not stored on the roster; they are derived from the catalogue at read
  // time (ADR-0011). The <cost> elements in the .ros are therefore ignored on import.

  const selectionsWrapper = firstChildElementNamed(node, ROS_TAG.selections);
  const subSelections = selectionsWrapper ? parseSelectionList(selectionsWrapper, system) : [];

  return {
    id: crypto.randomUUID(),
    name,
    entryLinkId: entryLinkId || null,
    selectionEntryId: entryId || null,
    number,
    category,
    collective: isCollective,
    selections: subSelections
  };
}

/**
 * Checks if a parsed selection represents a war machine or chariot unit that needs to be split
 * into separate independent units (e.g. 2 Spear Chukkas for 1 choice).
 */
function checkNeedsSplit(selection, system) {
  if (!system || !selection.number || selection.number <= 1) return false;

  const entryId = selection.selectionEntryId || selection.entryLinkId;
  if (!entryId) return false;

  const entry = findEntryInSystem(system, entryId);
  const resolved = resolveEntry(system, entry);
  if (!resolved) return false;

  // Aufteilen, wenn der Eintrag eine eigenständige Untereinheit ist — also je
  // Instanz einzeln konfiguriert wird statt als eine kollektive Auswahl.
  return isIndependentSubUnit(resolved);
}



/**
 * Creates a split copy of a selection for a given split index.
 */
function createSplitSelection(original, index, totalSplit) {
  // The first split unit absorbs the remainder, so the shares add up to the original.
  const splitShareOf = (selection) => (index === 0
    ? Math.ceil(selection.number / totalSplit)
    : Math.floor(selection.number / totalSplit));

  return mapSelectionTree(original, (selection, splitChildren) => ({
    ...selection,
    id: crypto.randomUUID(), // Generate a fresh UUID to prevent ID clashes
    number: selection === original ? SPLIT_UNIT_NUMBER : splitShareOf(selection),
    // A child whose share rounds down to nothing is not part of this split unit.
    selections: splitChildren.filter(child => child.number > 0)
  }));
}
