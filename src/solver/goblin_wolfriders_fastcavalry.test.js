import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { processImportedData } from '../parser/xmlParser.js';
import { collectUnitProfilesAndRules } from './profileCollector.js';

const jsdomObj = new JSDOM();
globalThis.DOMParser = jsdomObj.window.DOMParser;
globalThis.XMLSerializer = jsdomObj.window.XMLSerializer;

// Goblin Wolf Riders lose "Fast Cavalry" while wearing (Light) Armour.
describe('Goblin Wolf Riders — Fast Cavalry vs. Armour', () => {
  const base = './src/solver/__fixtures__/whfb6';
  const cat = processImportedData(
    [{ name: 'whfb6.gst', content: readFileSync(`${base}/Warhammer Fantasy Battle 6th edition.gst`, 'utf-8') }],
    [{ name: 'Orcs and Goblins.cat', content: readFileSync(`${base}/Orcs and Goblins.cat`, 'utf-8') }]
  );

  const wolfRidersId = '3e13-7d88-fc17-1ecb';
  const lightArmourId = '5161-ba57-90b9-2364';
  const wolfRiderModelId = 'b94a-ac63-6afa-7a79';

  const makeUnit = (extraSelections = []) => ({
    id: 'sel-unit',
    selectionEntryId: wolfRidersId,
    name: 'Goblin Wolf Riders',
    number: 1,
    selections: [
      { id: 'sel-model', selectionEntryId: wolfRiderModelId, name: 'Goblin Wolf rider', number: 5, selections: [] },
      ...extraSelections
    ]
  });

  const catalogueId = cat.catalogues[0].id;
  const rulesFor = (unit) => {
    const roster = { catalogueId, forces: [{ id: 'f1', selections: [unit] }] };
    return collectUnitProfilesAndRules(cat, unit, catalogueId, roster).rules.map(r => r.name);
  };

  it('has Fast Cavalry when no armour is worn', () => {
    expect(rulesFor(makeUnit())).toContain('Fast Cavalry');
  });

  it('loses Fast Cavalry when Light Armour is selected', () => {
    const armoured = makeUnit([
      { id: 'sel-armour', selectionEntryId: lightArmourId, name: 'Light Armour', number: 1, selections: [] }
    ]);
    expect(rulesFor(armoured)).not.toContain('Fast Cavalry');
  });
});
