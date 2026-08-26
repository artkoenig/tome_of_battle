import { RosterFileError } from './rosterFileError.js';
import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { childSelectionsOf, mapSelectionTree } from './rosterTree.js';
import { isIndependentSubUnit } from './subUnit.js';
import { resolveCostLimitTypeId } from './costTypeLabels.js';
import { DEFAULT_ROSTER_COST_LIMIT } from './rosterDefaults.js';

/**
 * `.ros`-Serialisierung des Schreibmodells (ADR-0037: Fachlogik).
 *
 * Die Schicht übersetzt nicht: ein Fehler trägt seinen Übersetzungsschlüssel
 * (`messageKey`) und dessen Platzhalter (`messageParams`) und wird erst in der
 * Oberfläche formuliert (`describeRosterFileError` in `src/ui/viewmodels/`).
 * Das Ein- und Auspacken der `.rosz`-Datei ist Datei-Ein-/Ausgabe und liegt in
 * der Datenschicht (`src/contexts/armylist/application/rosterTransfer.js`).
 */
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
 * Trägt den Übersetzungsschlüssel statt des Textes — formuliert wird in der Oberfläche.
 */
export class MissingSystemError extends Error {
  constructor(systemName, systemId) {
    super('serialization.missingSystem');
    this.name = 'MissingSystemError';
    this.messageKey = 'serialization.missingSystem';
    this.messageParams = { name: systemName, id: systemId };
    this.systemName = systemName;
    this.systemId = systemId;
  }
}

/**
 * Serializes an internal Roster object into BattleScribe-compliant .ros XML text.
 *
 * Namen und Kosten kommen aus dem Evaluator-Bericht (Issue 0121, Task 7):
 * jede Selektion trägt den effektiven Slot-`name` und ihre eigene,
 * modifikator-bewusste Kostenzeile (`capability.costs` × `number`); der
 * Roster-Summenblock ist `costTotals` — beide aus **derselben** Auswertung,
 * die flache Summe der Selektionskosten deckt sich damit mit dem Summenblock.
 *
 * Der Bericht wird **hereingereicht** (Issue 0174, ADR-0039): das Schreibmodell
 * wertet nichts aus und ruft die Auswertungs-Brücke `src/contexts/ruleengine/`
 * nicht mehr auf. Der Aufrufer liegt in der Oberfläche und besorgt den Bericht
 * dort, wo er ihn ohnehin haben darf (`evaluateAppRoster(system, roster)`).
 *
 * @param {Object} roster
 * @param {Object} system
 * @param {{costTotals: Object, slots: Object}} report Auswertung zu genau
 *   diesem `(system, roster)`-Paar.
 * @returns {string} XML text
 */
export function exportRosterToXml(roster, system, report) {
  const systemName = system?.name || 'Unbekanntes System';
  const systemId = system?.id || roster.systemId;

  const { costTotals, slots } = report;
  // Shared report context so per-selection names/costs match the total block exactly.
  const ctx = { system, slots };

  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  xml += `<roster id="${escapeXml(roster.id)}" name="${escapeXml(roster.name)}" battleScribeVersion="2.03" gameSystemId="${escapeXml(systemId)}" gameSystemRevision="1" gameSystemName="${escapeXml(systemName)}" xmlns="http://www.battlescribe.net/schema/rosterSchema">\n`;
  
  // Costs block
  // A cost type only exists if the game system declares it — a system without any
  // yields an empty block rather than an invented one.
  xml += '  <costs>\n';
  (system?.costTypes ?? []).forEach(ct => {
    const val = roundCost(costTotals[ct.id]);
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
        xml += serializeSelection(sel, SELECTION_BASE_INDENT, ctx, catalogueId);
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
 * Name und Kosten kommen aus dem Fähigkeitsdatensatz des Slots der Selektion
 * (Evaluator-Bericht, aufgelöst über den Slot-Index): der Name ist der
 * **effektive** Slot-Name, die <cost>-Zeile der eigene, modifikator-bewusste
 * Beitrag der Selektion (`capability.costs` je Instanz × absolute `number`) —
 * die flache Summe aller Selektionskosten deckt sich mit dem Summenblock des
 * Rosters (`costTotals`, dieselbe eine Auswertung). Das `type`-Attribut bleibt
 * aus dem Katalog abgeleitet (Struktur, bis Task 8 Solver-basiert).
 */
function serializeSelection(sel, indent, ctx, currentCatalogueId) {
  const { system, slots } = ctx;
  const ind = ' '.repeat(indent);

  const capability = slots.slotOfSelection(sel);
  const entryId = sel.selectionEntryId || '';
  const entryLinkId = sel.entryLinkId || '';
  const count = sel.number || 1;

  const resolved = resolveSelectionEntry(system, sel, currentCatalogueId);
  const selType = resolved?.type || 'upgrade';
  const isCollective = sel.collective ? 'true' : 'false';
  // Ohne Slot (kein auswertbarer Datensatz) bleibt der rohe Selektionsname.
  const effectiveName = capability?.name ?? sel.name;

  let sXml = `${ind}<selection id="${escapeXml(sel.id)}" name="${escapeXml(effectiveName)}" entryId="${escapeXml(entryId)}" entryLinkId="${escapeXml(entryLinkId)}" number="${count}" type="${escapeXml(selType)}" collective="${isCollective}">\n`;

  // Category Link block (only for top-level selections that carry categories)
  if (sel.category) {
    const catDef = system?.categoryEntries?.find(ce => ce.id === sel.category);
    const catName = catDef?.name || 'Category';
    sXml += `${ind}  <categories>\n`;
    sXml += `${ind}    <category id="${escapeXml(sel.category)}" name="${escapeXml(catName)}" entryId="${escapeXml(sel.category)}" primary="true"/>\n`;
    sXml += `${ind}  </categories>\n`;
  }

  // Costs: the selection's own, modifier-aware contribution from the report.
  sXml += `${ind}  <costs>\n`;
  Object.entries(capability?.costs ?? {}).forEach(([typeId, perInstance]) => {
    const costName = system?.costTypes?.find(c => c.id === typeId)?.name ?? typeId;
    sXml += `${ind}    <cost name="${escapeXml(costName)}" typeId="${escapeXml(typeId)}" value="${roundCost(perInstance * count)}"/>\n`;
  });
  sXml += `${ind}  </costs>\n`;

  const childXml = (sel.selections ?? []).map(child =>
    serializeSelection(child, indent + SELECTION_INDENT_STEP, ctx, currentCatalogueId));
  if (childXml.length > 0) {
    sXml += `${ind}  <selections>\n${childXml.join('')}${ind}  </selections>\n`;
  }

  sXml += `${ind}</selection>\n`;
  return sXml;
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
    throw new RosterFileError('serialization.invalidFormat');
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
    forces
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
  const catalogueId = forceNode.getAttribute('catalogueId');
  return {
    id: crypto.randomUUID(),
    forceEntryId: forceNode.getAttribute('entryId')
      || forceNode.getAttribute('forceEntryId')
      || system.forceEntries?.[0]?.id
      || null,
    catalogueId,
    selections: selectionsWrapper ? parseSelectionList(selectionsWrapper, system, catalogueId) : []
  };
}

/**
 * Reads a `<selections>` list, applying the war-machine split (ADR-0011 §3) to every
 * selection that needs it.
 */
function parseSelectionList(selectionsWrapper, system, catalogueId) {
  return childElementsNamed(selectionsWrapper, ROS_TAG.selection).flatMap(selectionNode => {
    const parsed = parseSelectionNode(selectionNode, system, catalogueId);
    return checkNeedsSplit(parsed, system, catalogueId) ? splitIntoIndependentUnits(parsed) : [parsed];
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
 * @param {string|null} catalogueId the catalogue of the force being parsed; entry ids in a
 *   `.ros` are only unique within it (ADR 0018).
 */
function parseSelectionNode(node, system, catalogueId) {
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
  const subSelections = selectionsWrapper ? parseSelectionList(selectionsWrapper, system, catalogueId) : [];

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
 * into separate independent units (e.g. 2 Spear Chukkas for 1 choice), resolving its entry
 * against the catalogue of the force it was parsed from.
 */
function checkNeedsSplit(selection, system, catalogueId) {
  if (!system || !selection.number || selection.number <= 1) return false;

  const entryId = selection.selectionEntryId || selection.entryLinkId;
  if (!entryId) return false;

  const entry = findEntryInSystem(system, entryId, catalogueId);
  const resolved = resolveEntry(system, entry, catalogueId);
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
