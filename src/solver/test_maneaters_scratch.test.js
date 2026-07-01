import { readFileSync } from 'fs';
import { resolveEntry, getModifiedConstraintValue } from './validator.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';
import { describe, it } from 'vitest';

describe('Maneaters Scratch Test', () => {
  it('prints constraints', () => {
    const catalogPath = './catalogs/whfb6/Ogre Kingdoms.cat';
    const xml = readFileSync(catalogPath, 'utf-8');
    const cat = parseCatalogueXML(xml);

    // Find Maneaters unit
    const maneatersUnit = cat.selectionEntries.find(e => e.name === 'Maneaters');
    console.log('Maneaters Unit Entry ID:', maneatersUnit.id);

    // Find Weapons Selection group
    const weaponsGroup = maneatersUnit.selectionEntryGroups.find(g => g.name === 'Weapons Selection');
    console.log('Weapons Group ID:', weaponsGroup.id);

    const maxCon = weaponsGroup.constraints.find(c => c.type === 'max');
    console.log('Weapons Group Max Constraint ID:', maxCon.id, 'Value:', maxCon.value);

    // Let's mock a selection
    // The selection representing the Maneaters unit
    const unitSelection = {
      id: 'sel-unit-1',
      entryLinkId: maneatersUnit.id,
      name: 'Maneaters',
      number: 1,
      selections: [
        // 3 Maneater models
        {
          id: 'sel-model-1',
          entryLinkId: '482e-1ec0-561c-ab93', // Maneaters model ID
          name: 'Maneaters',
          number: 3,
          selections: []
        }
      ]
    };

    const displayCtx = {
      roster: { catalogueId: cat.id },
      system: cat,
      selectionCounts: {
        [maneatersUnit.id]: 1,
        '482e-1ec0-561c-ab93': 3
      },
      forceCategoryCounts: {},
      selection: null,
      parentSelection: unitSelection,
      parentCatalogueId: cat.id
    };

    console.log('Modifiers:', JSON.stringify(weaponsGroup.modifiers, null, 2));

    const effectiveMax = getModifiedConstraintValue(maxCon, weaponsGroup.modifiers, displayCtx);
    console.log('Effective Max for Weapons Selection:', effectiveMax);
  });
});
