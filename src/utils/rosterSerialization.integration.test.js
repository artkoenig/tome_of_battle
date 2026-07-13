import { describe, test, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { processImportedData } from '../parser/xmlParser.js';
import { importRosterFromXml, exportRosterToXml } from './rosterSerialization.js';
import {
  reconcileImportedSelectionIds,
  syncRosterSelectionsWithSystem,
  calculateRosterCosts,
  validateRoster,
  resolveEntry
} from '../solver/validator.js';
import { getUnitOptions } from '../solver/optionsCollector.js';

// End-to-end round-trip against the REAL WHFB6 catalogue (public/catalogs/whfb6)
// and the real "Aggro Orks" roster fixture (exactly 2000 points). This closes the
// verification gap where reconcile/cost derivation could only be checked against
// mock catalogues.

const CATALOG_DIR = path.resolve('public/catalogs/whfb6');
const EXPECTED_TOTAL = 2000;

let system;
let ptsTypeId;

beforeAll(() => {
  const jsdomObj = new JSDOM();
  globalThis.DOMParser = jsdomObj.window.DOMParser;
  if (!globalThis.crypto) globalThis.crypto = crypto;
  else if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = crypto.randomUUID;

  const gst = { name: 'wfb6.gst', content: fs.readFileSync(path.join(CATALOG_DIR, 'Warhammer Fantasy Battle 6th edition.gst'), 'utf8') };
  const cat = { name: 'og.cat', content: fs.readFileSync(path.join(CATALOG_DIR, 'Orcs and Goblins.cat'), 'utf8') };
  system = processImportedData([gst], [cat]);
  ptsTypeId = system.costTypes.find(c => c.name.trim() === 'pts').id;
});

// Mirrors the app's import flow: parse → reconcile option ids → sync names.
function importAggroOrks() {
  const ros = fs.readFileSync(path.resolve('src/utils/__fixtures__/aggro-orks.ros'), 'utf8');
  const roster = importRosterFromXml(ros, [system]);
  reconcileImportedSelectionIds(roster, system);
  syncRosterSelectionsWithSystem(roster, system);
  return roster;
}

// Mirrors the editor's "is this option selected" logic (SelectionConfigurator).
function countRecognizedSelectedOptions(roster) {
  const catalogueId = roster.forces[0].catalogueId;
  const countSelected = (unit, optionId) => {
    const walk = (list) => (list || []).reduce(
      (sum, item) => sum + ((item.entryLinkId || item.selectionEntryId) === optionId ? (item.number || 1) : 0) + walk(item.selections),
      0
    );
    return walk(unit.selections);
  };
  let recognized = 0;
  for (const unit of roster.forces[0].selections) {
    for (const { option } of getUnitOptions(system, catalogueId, unit)) {
      const res = resolveEntry(system, option, catalogueId);
      if (res && countSelected(unit, res.id) > 0) recognized++;
    }
  }
  return recognized;
}

describe('Real-catalogue round-trip (WHFB6 / Aggro Orks)', () => {
  test('imports to exactly 2000 points with derived costs', () => {
    const roster = importAggroOrks();
    expect(calculateRosterCosts(roster, system)[ptsTypeId]).toBe(EXPECTED_TOTAL);
  });

  test('recognises the chosen options after import (option-id reconciliation)', () => {
    const roster = importAggroOrks();
    // Every option selection maps to a catalogue option id, so a second reconcile is a no-op.
    expect(reconcileImportedSelectionIds(roster, system)).toBe(false);
    // The editor's matcher finds the selected options across the army.
    expect(countRecognizedSelectedOptions(roster)).toBeGreaterThan(20);
  });

  test('semantic round-trip: export then re-import keeps 2000 points and validation', () => {
    const roster = importAggroOrks();
    const initialErrors = validateRoster(roster, system).filter(e => e.severity === 'error').length;

    const xml = exportRosterToXml(roster, system);
    const roundTripped = importRosterFromXml(xml, [system]);
    reconcileImportedSelectionIds(roundTripped, system);
    syncRosterSelectionsWithSystem(roundTripped, system);

    expect(calculateRosterCosts(roundTripped, system)[ptsTypeId]).toBe(EXPECTED_TOTAL);
    expect(validateRoster(roundTripped, system).filter(e => e.severity === 'error').length).toBe(initialErrors);
  });

  test('exported .ros selection costs flat-sum to the total', () => {
    const roster = importAggroOrks();
    const xml = exportRosterToXml(roster, system);
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    let flatSum = 0;
    for (const cost of doc.getElementsByTagName('cost')) {
      if (cost.getAttribute('typeId') === ptsTypeId && cost.parentNode.parentNode.nodeName === 'selection') {
        flatSum += parseFloat(cost.getAttribute('value')) || 0;
      }
    }
    expect(flatSum).toBe(EXPECTED_TOTAL);
  });
});
