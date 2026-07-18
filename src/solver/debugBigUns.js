import { readFileSync } from 'fs';
import { resolveEntry } from './validator.js';
import { getModifiedConstraintValue, getEffectiveModifiers } from './modifierEvaluator.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';

import { JSDOM } from 'jsdom';
const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;

const catalogPath = './catalogs/whfb6/Orcs and Goblins.cat';
const xml = readFileSync(catalogPath, 'utf-8');
const cat = parseCatalogueXML(xml);

const bigUnsId = 'eeb1-a6c4-b57e-f08c'; // Orc Big 'Uns unit
const boyzLinkTargetId = '344f-77ef-7238-f157';

const res = resolveEntry(cat, cat.selectionEntries.find(e => e.id === bigUnsId), cat.id);
const maxCon = res.constraints.find(c => c.type === 'max' && (c.scope === 'roster' || c.scope === 'force' || !c.scope));

const displayCtx = {
  roster: { catalogueId: cat.id },
  system: cat,
  selectionCounts: {
    [boyzLinkTargetId]: 2 // Simulate 2 Orc Boyz units
  },
  parentCatalogueId: cat.id
};

console.log('Original max value:', maxCon.value);
const effectiveMax = getModifiedConstraintValue(maxCon, getEffectiveModifiers(res), displayCtx);
console.log('Effective Max (should be 2):', effectiveMax);

