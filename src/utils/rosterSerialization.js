import JSZip from 'jszip';
import { calculateRosterCosts, findEntryInSystem, resolveEntry } from '../solver/validator.js';

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

  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  xml += `<roster id="${escapeXml(roster.id)}" name="${escapeXml(roster.name)}" battleScribeVersion="2.03" gameSystemId="${escapeXml(systemId)}" gameSystemRevision="1" gameSystemName="${escapeXml(systemName)}" xmlns="http://www.battlescribe.net/schema/rosterSchema">\n`;
  
  // Costs block
  xml += '  <costs>\n';
  if (system?.costTypes) {
    system.costTypes.forEach(ct => {
      const val = computedCosts[ct.id] || 0;
      xml += `    <cost name="${escapeXml(ct.name)}" typeId="${escapeXml(ct.id)}" value="${val}"/>\n`;
    });
  } else {
    xml += `    <cost name="pts" typeId="pts" value="0"/>\n`;
  }
  xml += '  </costs>\n';

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
      
      if (force.selections) {
        force.selections.forEach(sel => {
          xml += serializeSelection(sel, 8, system);
        });
      }
      
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
 */
function serializeSelection(sel, indent, system) {
  const ind = ' '.repeat(indent);
  const entryId = sel.selectionEntryId || '';
  const entryLinkId = sel.entryLinkId || '';
  const selType = sel.type || 'upgrade';
  const isCollective = sel.collective ? 'true' : 'false';
  
  let sXml = `${ind}<selection id="${escapeXml(sel.id)}" name="${escapeXml(sel.name)}" entryId="${escapeXml(entryId)}" entryLinkId="${escapeXml(entryLinkId)}" number="${sel.number || 1}" type="${escapeXml(selType)}" collective="${isCollective}">\n`;
  
  // Category Link block (only for top-level selections that carry categories)
  if (sel.category) {
    const catDef = system?.categoryEntries?.find(ce => ce.id === sel.category);
    const catName = catDef?.name || 'Category';
    sXml += `${ind}  <categories>\n`;
    sXml += `${ind}    <category id="${escapeXml(sel.category)}" name="${escapeXml(catName)}" entryId="${escapeXml(sel.category)}" primary="true"/>\n`;
    sXml += `${ind}  </categories>\n`;
  }

  // Costs
  sXml += `${ind}  <costs>\n`;
  if (sel.costs) {
    sel.costs.forEach(cost => {
      const ct = system?.costTypes?.find(c => c.id === cost.typeId);
      const costName = cost.name || ct?.name || 'pts';
      sXml += `${ind}    <cost name="${escapeXml(costName)}" typeId="${escapeXml(cost.typeId)}" value="${cost.value || 0}"/>\n`;
    });
  }
  sXml += `${ind}  </costs>\n`;

  // Sub-selections
  if (sel.selections && sel.selections.length > 0) {
    sXml += `${ind}  <selections>\n`;
    sel.selections.forEach(sub => {
      sXml += serializeSelection(sub, indent + 4, system);
    });
    sXml += `${ind}  </selections>\n`;
  }

  sXml += `${ind}</selection>\n`;
  return sXml;
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
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Decompresses a BattleScribe .rosz ZIP Blob (or handles raw .ros XML directly) and returns the XML text.
 * @param {Blob|File} fileBlob 
 * @returns {Promise<string>} XML text
 */
export async function decompressRoszToXml(fileBlob) {
  try {
    const zip = await JSZip.loadAsync(fileBlob);
    const rosFile = Object.keys(zip.files).find(name => name.endsWith('.ros'));
    if (rosFile) {
      return await zip.files[rosFile].async('text');
    }
  } catch (e) {
    // Not a ZIP file, or decompression failed; fall back to reading as raw text
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(fileBlob);
  });
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
  const costLimit = parseInt(root.getAttribute('costLimit')) || 2000;
  const costLimitType = system.costTypes?.[0]?.id || 'pts';
  
  const forces = [];
  const forcesWrapper = Array.from(root.childNodes).find(node => node.nodeType === 1 && node.nodeName === 'forces');
  if (forcesWrapper) {
    const forceNodes = Array.from(forcesWrapper.childNodes).filter(node => node.nodeType === 1 && node.nodeName === 'force');
    forceNodes.forEach(forceNode => {
      const forceId = crypto.randomUUID();
      const catalogueId = forceNode.getAttribute('catalogueId');
      const forceEntryId = forceNode.getAttribute('entryId') || forceNode.getAttribute('forceEntryId') || system.forceEntries?.[0]?.id || null;
      
      const selections = [];
      const selectionsWrapper = Array.from(forceNode.childNodes).find(node => node.nodeType === 1 && node.nodeName === 'selections');
      if (selectionsWrapper) {
        const selectionNodes = Array.from(selectionsWrapper.childNodes).filter(node => node.nodeType === 1 && node.nodeName === 'selection');
        selectionNodes.forEach(selNode => {
          const parsed = parseSelectionNode(selNode, system);
          if (checkNeedsSplit(parsed, system)) {
            const splitCount = parsed.number;
            for (let i = 0; i < splitCount; i++) {
              selections.push(createSplitSelection(parsed, i, splitCount));
            }
          } else {
            selections.push(parsed);
          }
        });
      }
      
      forces.push({
        id: forceId,
        forceEntryId,
        catalogueId,
        selections
      });
    });
  }

  return {
    id: crypto.randomUUID(),
    name: rosterName,
    systemId,
    catalogueId: forces[0]?.catalogueId || system.catalogues?.[0]?.id || '',
    costLimit,
    costLimitType,
    forces,
    gameState: {
      round: 1,
      vp: 0,
      cp: 0,
      wounds: {}
    }
  };
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
  const num = Math.max(1, number);
  const selType = node.getAttribute('type') || 'upgrade';
  const isCollective = node.getAttribute('collective') === 'true';

  let category = null;
  const categoriesWrapper = Array.from(node.childNodes).find(c => c.nodeType === 1 && c.nodeName === 'categories');
  if (categoriesWrapper) {
    const categoryNode = Array.from(categoriesWrapper.childNodes).find(c => c.nodeType === 1 && c.nodeName === 'category' && c.getAttribute('primary') === 'true');
    if (categoryNode) {
      category = categoryNode.getAttribute('entryId') || categoryNode.getAttribute('id');
      if (category && category.includes('::')) {
        category = category.split('::').pop();
      }
    }
  }

  const costs = [];
  const costsWrapper = Array.from(node.childNodes).find(c => c.nodeType === 1 && c.nodeName === 'costs');
  if (costsWrapper) {
    const costNodes = Array.from(costsWrapper.childNodes).filter(c => c.nodeType === 1 && c.nodeName === 'cost');
    costNodes.forEach(costNode => {
      costs.push({
        name: costNode.getAttribute('name'),
        typeId: costNode.getAttribute('typeId'),
        value: (parseFloat(costNode.getAttribute('value')) || 0) / num
      });
    });
  }

  const subSelections = [];
  const selectionsWrapper = Array.from(node.childNodes).find(c => c.nodeType === 1 && c.nodeName === 'selections');
  if (selectionsWrapper) {
    const selectionNodes = Array.from(selectionsWrapper.childNodes).filter(c => c.nodeType === 1 && c.nodeName === 'selection');
    selectionNodes.forEach(subNode => {
      const parsedChild = parseSelectionNode(subNode, system);
      if (checkNeedsSplit(parsedChild, system)) {
        const splitCount = parsedChild.number;
        for (let i = 0; i < splitCount; i++) {
          subSelections.push(createSplitSelection(parsedChild, i, splitCount));
        }
      } else {
        subSelections.push(parsedChild);
      }
    });
  }

  return {
    id: crypto.randomUUID(),
    name,
    entryLinkId: entryLinkId || null,
    selectionEntryId: entryId || null,
    number,
    category,
    costs,
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

  // Split if type is unit/model, collective is false (default), and it has catalog options/children
  const isIndependent = (resolved.type === 'unit' || resolved.type === 'model') &&
                        (resolved.collective !== true && resolved.collective !== 'true');
  if (!isIndependent) return false;

  const hasCatalogChildren = (resolved.selectionEntries && resolved.selectionEntries.length > 0) ||
                             (resolved.entryLinks && resolved.entryLinks.length > 0) ||
                             (resolved.selectionEntryGroups && resolved.selectionEntryGroups.length > 0);
  
  return !!hasCatalogChildren;
}



/**
 * Creates a split copy of a selection for a given split index.
 */
function createSplitSelection(original, index, totalSplit) {
  const clone = (sel, isRoot = false) => {
    const newNumber = isRoot ? 1 : (index === 0 ? Math.ceil(sel.number / totalSplit) : Math.floor(sel.number / totalSplit));
    
    const newSelections = [];
    if (sel.selections) {
      sel.selections.forEach(child => {
        const clonedChild = clone(child);
        if (clonedChild.number > 0) {
          newSelections.push(clonedChild);
        }
      });
    }
    
    return {
      ...sel,
      id: crypto.randomUUID(), // Generate a fresh UUID to prevent ID clashes
      number: newNumber,
      selections: newSelections
    };
  };

  return clone(original, true);
}
