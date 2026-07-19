import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { collectUnitProfilesAndRules } from './profileCollector.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen Solver-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// Verbatim-Fixture nach dem realen The-Empire-Muster: das gemeinsame
// „Empire soldier"-Profil wird per infoLink-Namens-Modifier je Einheit
// unbedingt auf den eigenen Einheitsnamen umbenannt.
const FIXTURE_DIR = './src/solver/__fixtures__/whfb6-lexicanum';
const parsedCatalogue = parseCatalogueXML(readFileSync(`${FIXTURE_DIR}/empire-name-modifier.cat.xml`, 'utf-8'));
const CATALOGUE_ID = parsedCatalogue.id;
const PROFILE_ID = 'b777-4b66-0f67-d717';

const entryIdByName = name => parsedCatalogue.selectionEntries.find(e => e.name === name)?.id;
const HALBERDIERS_ID = entryIdByName('Halberdiers');
const SPEARMEN_ID = entryIdByName('Spearmen');

// Ein System mit genau diesem einen Katalog — collectUnitProfilesAndRules loest
// den infoLink darueber auf.
const system = { id: parsedCatalogue.gameSystemId, catalogues: [parsedCatalogue] };
const roster = { catalogueId: CATALOGUE_ID, forces: [] };

const soldierProfileName = (selectionEntryId) => {
  const selection = { id: 'sel', selectionEntryId, number: 1, selections: [] };
  const { profiles } = collectUnitProfilesAndRules(system, selection, CATALOGUE_ID, roster);
  return profiles.find(p => p.id === PROFILE_ID)?.name;
};

describe('profileCollector: field="name"-Modifier auf infoLink-Profil (The Empire)', () => {
  it('benennt das geteilte „Empire soldier"-Profil bei den Halberdiers zu „Halberdier" um', () => {
    expect(soldierProfileName(HALBERDIERS_ID)).toBe('Halberdier');
  });

  it('benennt dasselbe geteilte Profil bei den Spearmen zu „Spearmen" um', () => {
    expect(soldierProfileName(SPEARMEN_ID)).toBe('Spearmen');
  });
});
