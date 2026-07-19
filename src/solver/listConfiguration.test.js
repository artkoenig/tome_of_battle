import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { isListConfiguration, isListConfigurationEntry } from './listConfiguration.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';

// JSDOM stellt DOMParser für den Node-Testlauf bereit (wie in den übrigen Solver-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const readFixture = path => readFileSync(path, 'utf-8');

// Echte, verbatim übernommene Schalter aus der WHFB6 Definitive Edition (`.gst`).
const switchCatalogue = parseCatalogueXML(
  readFixture('./src/solver/__fixtures__/whfb6-lexicanum/list-configuration-switches.cat.xml')
);
// Echter, vollständiger Ergofarg-Katalog (alte Datenquelle, kennt keine
// Listenkonfigurationen) — Grundlage der No-op-Prüfung (AC #5).
const ergofargCatalogue = parseCatalogueXML(
  readFixture('./src/solver/__fixtures__/whfb6/Orcs and Goblins.cat')
);

const POINTS_COST_TYPE_ID = 'ecfa-8486-4f6c-c249';

const system = {
  id: switchCatalogue.gameSystemId,
  costTypes: [{ id: POINTS_COST_TYPE_ID, name: 'pts' }],
  categoryEntries: [],
  forceEntries: [],
  catalogues: [switchCatalogue, ergofargCatalogue]
};

// IDs datengetrieben aus den echten Auszügen lesen, statt sie zu wiederholen (ADR-0003).
const switchEntryIdByName = name =>
  switchCatalogue.sharedSelectionEntries.find(entry => entry.name === name)?.id;
const ALLOW_EXPERIMENTAL_ID = switchEntryIdByName('Allow experimental rules?');
const ALLOW_SPECIALS_ID = switchEntryIdByName('Allow special characters?');
const BOLT_THROWER_ID = switchEntryIdByName('Bolt Thrower');
const MAGIC_LEVEL_4_ID = switchEntryIdByName('Magic Level 4');

const NIGHT_GOBLIN_UNIT_ID = 'ed65-df1a-50a2-c3ac';
const NETTERS_OPTION_ID = '630b-5fed-e243-f9a1';

// Baut eine Selection, die per selectionEntryId auf einen Katalogeintrag zeigt —
// spiegelt die Roster-Selection-Form (siehe types.js / profileCollector.js).
const selection = (id, entryId, children = []) => ({
  id,
  selectionEntryId: entryId,
  name: id,
  number: 1,
  selections: children
});

// Force, dessen Top-Level-Selections exakt die übergebenen sind.
const forceWith = (selections, catalogueId) => ({
  id: 'force-under-test',
  catalogueId,
  selections
});

const classify = (force, sel, catalogueId) =>
  isListConfiguration({ system, force, selection: sel, catalogueId });

describe('Fixture-Integrität', () => {
  it('liest die realen Schalter-IDs und den Definitive-Edition-gameSystemId aus dem echten .gst-Auszug', () => {
    expect(switchCatalogue.gameSystemId).toBe('0d13-7737-ea86-4662');
    expect(ALLOW_EXPERIMENTAL_ID).toBe('8b76-92c4-23f9-54b1');
    expect(ALLOW_SPECIALS_ID).toBe('8923-5946-7b10-8957');
  });

  it('verankert den Ergofarg-Katalog als alte Datenquelle ohne Listenkonfigurationen', () => {
    expect(ergofargCatalogue.gameSystemId).toBe('6d8e-38d9-3c69-febf');
    expect(ergofargCatalogue.selectionEntries.some(e => e.id === NIGHT_GOBLIN_UNIT_ID)).toBe(true);
  });
});

describe('isListConfiguration – erkennt echte Listenkonfigurations-Schalter', () => {
  it('erkennt „Allow experimental rules?" als Listenkonfiguration', () => {
    const sel = selection('sel-experimental', ALLOW_EXPERIMENTAL_ID);
    const force = forceWith([sel], switchCatalogue.id);
    expect(classify(force, sel, switchCatalogue.id)).toBe(true);
  });

  it('erkennt „Allow special characters?" als Listenkonfiguration', () => {
    const sel = selection('sel-specials', ALLOW_SPECIALS_ID);
    const force = forceWith([sel], switchCatalogue.id);
    expect(classify(force, sel, switchCatalogue.id)).toBe(true);
  });
});

describe('isListConfiguration – schließt spielbare Einträge aus (die drei Bedingungen)', () => {
  it('liefert false für eine echte Einheiten-Selection (Typ ist nicht upgrade)', () => {
    const sel = selection('sel-night-goblin', NIGHT_GOBLIN_UNIT_ID);
    const force = forceWith([sel], ergofargCatalogue.id);
    expect(classify(force, sel, ergofargCatalogue.id)).toBe(false);
  });

  it('liefert false für eine reguläre Ausrüstungs-Option innerhalb einer Einheit (nicht Top-Level)', () => {
    const netters = selection('sel-netters', NETTERS_OPTION_ID);
    const unit = selection('sel-night-goblin', NIGHT_GOBLIN_UNIT_ID, [netters]);
    const force = forceWith([unit], ergofargCatalogue.id);
    // Die Ausrüstungs-Option hängt unter der Einheit, nicht direkt an der Force.
    expect(classify(force, netters, ergofargCatalogue.id)).toBe(false);
  });

  it('liefert false für einen upgrade-Eintrag, der ein Profil trägt (kein profilfreier Teilbaum)', () => {
    const sel = selection('sel-bolt-thrower', BOLT_THROWER_ID);
    const force = forceWith([sel], switchCatalogue.id);
    expect(classify(force, sel, switchCatalogue.id)).toBe(false);
  });

  it('liefert false für einen upgrade-Eintrag, der Kosten trägt (kein kostenloser Teilbaum)', () => {
    const sel = selection('sel-magic-level', MAGIC_LEVEL_4_ID);
    const force = forceWith([sel], switchCatalogue.id);
    expect(classify(force, sel, switchCatalogue.id)).toBe(false);
  });

  it('liefert false für einen ansonsten passenden Schalter, der nicht Top-Level ist', () => {
    const nestedSwitch = selection('sel-nested-switch', ALLOW_EXPERIMENTAL_ID);
    const hostUnit = selection('sel-host', NIGHT_GOBLIN_UNIT_ID, [nestedSwitch]);
    const force = forceWith([hostUnit], switchCatalogue.id);
    // Typ upgrade + profil-/kostenfreier Teilbaum, aber unter einer Einheit verschachtelt.
    expect(classify(force, nestedSwitch, switchCatalogue.id)).toBe(false);
  });
});

describe('isListConfiguration – Ergofarg-Datenquelle bleibt unverändert (AC #5)', () => {
  it('klassifiziert keinen der realen Top-Level-Einträge des Ergofarg-Katalogs als Listenkonfiguration', () => {
    const realTopLevelEntries = ergofargCatalogue.selectionEntries.slice(0, 20);
    const selections = realTopLevelEntries.map(entry => selection(`sel-${entry.id}`, entry.id));
    const force = forceWith(selections, ergofargCatalogue.id);

    selections.forEach(sel => {
      expect(classify(force, sel, ergofargCatalogue.id)).toBe(false);
    });
  });
});

// Katalog-Pendant (main-issue 35): dasselbe Strukturkriterium, aber gegen die
// rohe Katalog-Eintragsdefinition geprüft, ohne dass je eine Roster-Selection
// existiert haben muss — Grundlage für eine noch komplett leere
// Listenkonfigurations-Kategorie, die sofort als Kachel rendert.
describe('isListConfigurationEntry – Katalog-Pendant ohne Roster-Selection', () => {
  const findSharedEntry = name => switchCatalogue.sharedSelectionEntries.find(e => e.name === name);

  it('erkennt „Allow experimental rules?" direkt aus der Katalogdefinition', () => {
    const entry = findSharedEntry('Allow experimental rules?');
    expect(isListConfigurationEntry({ system, entry, catalogueId: switchCatalogue.id })).toBe(true);
  });

  it('erkennt „Allow special characters?" direkt aus der Katalogdefinition', () => {
    const entry = findSharedEntry('Allow special characters?');
    expect(isListConfigurationEntry({ system, entry, catalogueId: switchCatalogue.id })).toBe(true);
  });

  it('liefert false für einen Katalog-Eintrag mit Profil (Bolt Thrower)', () => {
    const entry = findSharedEntry('Bolt Thrower');
    expect(isListConfigurationEntry({ system, entry, catalogueId: switchCatalogue.id })).toBe(false);
  });

  it('liefert false für einen Katalog-Eintrag mit Kosten (Magic Level 4)', () => {
    const entry = findSharedEntry('Magic Level 4');
    expect(isListConfigurationEntry({ system, entry, catalogueId: switchCatalogue.id })).toBe(false);
  });

  it('liefert false für eine echte Einheit (Night Goblins, Ergofarg-Katalog)', () => {
    const entry = ergofargCatalogue.selectionEntries.find(e => e.id === NIGHT_GOBLIN_UNIT_ID);
    expect(isListConfigurationEntry({ system, entry, catalogueId: ergofargCatalogue.id })).toBe(false);
  });

  it('liefert false ohne Eintrag oder ohne System', () => {
    expect(isListConfigurationEntry({ system, entry: null })).toBe(false);
    expect(isListConfigurationEntry({ system: null, entry: findSharedEntry('Allow experimental rules?') })).toBe(false);
  });
});
