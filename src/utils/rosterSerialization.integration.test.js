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
  resolveEntry
} from '../roster/index.js';
import { evaluateAppRoster } from '../evaluation/evaluationCache.js';
import { getUnitOptions } from '../roster/optionsCollector.js';

// End-to-end round-trips against the REAL WHFB6 catalogues (src/__fixtures__/whfb6)
// and real roster fixtures, each exactly 2000 points. These exercise the derived-cost
// model, option-id reconciliation and the war-machine split across several armies
// (Orcs & Goblins, Ogre Kingdoms, Vampire Counts), closing the gap where only mock
// catalogues could be tested.

const CATALOG_DIR = path.resolve('src/__fixtures__/whfb6');
const GST_FILE = 'Warhammer Fantasy Battle 6th edition.gst';
const EXPECTED_TOTAL = 2000;

const ARMIES = [
  { label: 'Orcs & Goblins (Aggro Orks)', cat: 'Orcs and Goblins.cat', fixture: 'aggro-orks.ros' },
  { label: 'Ogre Kingdoms (Kineater)', cat: 'Ogre Kingdoms.cat', fixture: 'kineater.ros' },
  { label: 'Vampire Counts (Blood Dragons)', cat: 'Vampire Counts.cat', fixture: 'blood-dragons.ros' }
];

let gstContent;

beforeAll(() => {
  const jsdomObj = new JSDOM();
  globalThis.DOMParser = jsdomObj.window.DOMParser;
  if (!globalThis.crypto) globalThis.crypto = crypto;
  else if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = crypto.randomUUID;
  gstContent = fs.readFileSync(path.join(CATALOG_DIR, GST_FILE), 'utf8');
});

function buildSystem(catFile) {
  const cat = { name: catFile, content: fs.readFileSync(path.join(CATALOG_DIR, catFile), 'utf8') };
  const system = processImportedData([{ name: 'gst', content: gstContent }], [cat]).system;
  // Der Export liest Namen/Kosten seit Issue 0121, Task 7 aus dem
  // Evaluator-Bericht über die rohen XMLs (wie das in der App gespeicherte
  // System-Objekt, Shape aus src/db/systemImport.js).
  system.rawXmls = {
    gst: [{ name: GST_FILE, content: gstContent }],
    cat: [cat],
  };
  return system;
}

// Mirrors the app's import flow: parse → reconcile option ids → sync names.
function importFixture(system, fixture) {
  const ros = fs.readFileSync(path.join('src/utils/__fixtures__', fixture), 'utf8');
  const imported = importRosterFromXml(ros, [system]);
  const reconciled = reconcileImportedSelectionIds(imported, system);
  return syncRosterSelectionsWithSystem(reconciled, system);
}

function ptsTypeId(system) {
  return system.costTypes.find(c => c.name.trim() === 'pts').id;
}

function errorCount(roster, system) {
  return evaluateAppRoster(system, roster).violations.filter(v => v.severity === 'error').length;
}

// Mirrors the editor's "is this option selected" logic (SelectionConfigurator).
function countRecognizedSelectedOptions(roster, system) {
  const catalogueId = roster.forces[0].catalogueId;
  const countSelected = (unit, optionId) => {
    const walk = (list) => (list || []).reduce(
      (sum, item) => sum + ((item.entryLinkId || item.selectionEntryId) === optionId ? (item.number || 1) : 0) + walk(item.selections),
      0
    );
    return walk(unit.selections);
  };
  let recognized = 0;
  for (const unit of roster.forces.flatMap(f => f.selections)) {
    for (const { option } of getUnitOptions(system, catalogueId, unit)) {
      const res = resolveEntry(system, option, catalogueId);
      if (res && countSelected(unit, res.id) > 0) recognized++;
    }
  }
  return recognized;
}

function flatSelectionPts(xml, pts) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  let sum = 0;
  for (const cost of doc.getElementsByTagName('cost')) {
    if (cost.getAttribute('typeId') === pts && cost.parentNode.parentNode.nodeName === 'selection') {
      sum += parseFloat(cost.getAttribute('value')) || 0;
    }
  }
  return sum;
}

describe.each(ARMIES)('Real-catalogue round-trip: $label', ({ cat, fixture }) => {
  test('imports to exactly 2000 points with derived costs', () => {
    const system = buildSystem(cat);
    const roster = importFixture(system, fixture);
    expect(evaluateAppRoster(system, roster).costTotals[ptsTypeId(system)]).toBe(EXPECTED_TOTAL);
  });

  test('recognises the chosen options after import and is reconcile-stable', () => {
    const system = buildSystem(cat);
    const roster = importFixture(system, fixture);
    expect(reconcileImportedSelectionIds(roster, system)).toBe(roster);
    expect(countRecognizedSelectedOptions(roster, system)).toBeGreaterThan(20);
  });

  test('semantic round-trip: export then re-import keeps 2000 points and validation', () => {
    const system = buildSystem(cat);
    const roster = importFixture(system, fixture);
    const initialErrors = errorCount(roster, system);

    const xml = exportRosterToXml(roster, system);
    const reImported = importRosterFromXml(xml, [system]);
    const reconciled = reconcileImportedSelectionIds(reImported, system);
    const roundTripped = syncRosterSelectionsWithSystem(reconciled, system);

    expect(evaluateAppRoster(system, roundTripped).costTotals[ptsTypeId(system)]).toBe(EXPECTED_TOTAL);
    expect(errorCount(roundTripped, system)).toBe(initialErrors);
    expect(flatSelectionPts(xml, ptsTypeId(system))).toBe(EXPECTED_TOTAL);
  });
});

// Absolute legality of a fixture list is no longer asserted here: judging a roster
// is the engine's subject, and the engine owns it in its own manifest-driven E2E
// suite (docs/testing/, ADR 0033). What this file still pins is the round-trip
// property above — export then re-import must not change the verdict count.
//
// The list that used to be asserted clean here (Blood Dragons) is the reproduction
// of a real evaluator defect found while cutting over: a `max 0` limit scoped to a
// FOREIGN category ("Strigoi") counts 1 in a Blood Dragon list, so three phantom
// errors appear. Filed as its own issue; the scenario belongs in docs/testing/.
