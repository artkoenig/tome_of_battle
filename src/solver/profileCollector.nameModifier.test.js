import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { collectUnitProfilesAndRules } from './profileCollector.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen Solver-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// Reproduktions-Fixture nach dem realen The-Empire-Muster: das gemeinsame
// „Empire soldier"-Profil wird per infoLink-Namens-Modifier kontextabhaengig
// zu „Halberdier" / „Spearmen" umbenannt.
const FIXTURE_DIR = './src/solver/__fixtures__/whfb6-lexicanum';
const parsedCatalogue = parseCatalogueXML(readFileSync(`${FIXTURE_DIR}/empire-name-modifier.cat.xml`, 'utf-8'));
const CATALOGUE_ID = parsedCatalogue.id;

const STATE_TROOPS_ID = parsedCatalogue.sharedSelectionEntries.find(e => e.name === 'State Troops')?.id;
// Die Waffen liegen als verschachtelte selectionEntries unter der Einheit; ihre IDs
// sind zugleich die childId-Ziele der Namens-Modifier-Bedingungen im Fixture.
const stateTroopsEntry = parsedCatalogue.sharedSelectionEntries.find(e => e.name === 'State Troops');
const weaponIdByName = name => stateTroopsEntry.selectionEntries.find(e => e.name === name)?.id;
const HALBERD_ID = weaponIdByName('Halberd');
const SPEAR_ID = weaponIdByName('Spear');

// Ein System mit genau diesem einen Katalog — collectUnitProfilesAndRules loest
// den infoLink darueber auf.
const system = { id: parsedCatalogue.gameSystemId, catalogues: [parsedCatalogue] };
const roster = { catalogueId: CATALOGUE_ID, forces: [] };

// Baut eine State-Troops-Auswahl mit optionaler Waffen-Unterauswahl.
const stateTroops = (weaponId) => ({
  id: 'sel-state-troops',
  name: 'State Troops',
  selectionEntryId: STATE_TROOPS_ID,
  number: 10,
  selections: weaponId ? [{ id: 'sel-weapon', selectionEntryId: weaponId, number: 1 }] : []
});

const soldierProfileName = (selection) => {
  const { profiles } = collectUnitProfilesAndRules(system, selection, CATALOGUE_ID, roster);
  return profiles.find(p => p.id === 'prof-empire-soldier')?.name;
};

describe('profileCollector: field="name"-Modifier auf infoLink-Profil (The Empire)', () => {
  it('zeigt den rohen Profilnamen „Empire soldier" ohne gewaehlte Waffe', () => {
    expect(soldierProfileName(stateTroops(null))).toBe('Empire soldier');
  });

  it('benennt das Profil zu „Halberdier" um, sobald eine Hellebarde gewaehlt ist', () => {
    expect(soldierProfileName(stateTroops(HALBERD_ID))).toBe('Halberdier');
  });

  it('benennt das Profil zu „Spearmen" um, sobald ein Speer gewaehlt ist', () => {
    expect(soldierProfileName(stateTroops(SPEAR_ID))).toBe('Spearmen');
  });
});
