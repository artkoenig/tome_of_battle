import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogueXML } from '../parser/xmlParser.js';
import { resolveEntry, findEntryInSystem } from './catalogResolver.js';
import { collectUnitProfilesAndRules } from './profileCollector.js';

const jsdomObj = new JSDOM();
globalThis.DOMParser = jsdomObj.window.DOMParser;
globalThis.XMLSerializer = jsdomObj.window.XMLSerializer;

// End-to-end coverage for BattleScribe infoGroups / sharedInfoGroups and
// infoLink type="infoGroup". Uses a generic, schema-valid fixture (validated
// against src/parser/schema/Catalogue.xsd) rather than production WHFB6 data.
describe('infoGroups / sharedInfoGroups end-to-end', () => {
  const catalogueXml = readFileSync(
    './src/solver/__fixtures__/generic/generic-infogroups.cat',
    'utf-8'
  );
  const catalogue = parseCatalogueXML(catalogueXml);
  const system = { id: 'sys-generic-1', name: 'Generic Test System', catalogues: [catalogue] };
  const catalogueId = catalogue.id;
  const guardianId = 'unit-guardian';

  it('parses inline infoGroups without dropping their bundled profiles', () => {
    const unit = catalogue.selectionEntries.find(entry => entry.id === guardianId);
    expect(unit.infoGroups).toHaveLength(1);
    expect(unit.infoGroups[0].id).toBe('ig-loadout');
    expect(unit.infoGroups[0].profiles.map(p => p.id)).toEqual(['prof-staff']);
  });

  it('parses catalogue-level sharedInfoGroups with their nested infoLinks', () => {
    expect(catalogue.sharedInfoGroups).toHaveLength(1);
    const blessings = catalogue.sharedInfoGroups[0];
    expect(blessings.id).toBe('ig-blessings');
    expect(blessings.rules.map(r => r.id)).toEqual(['rule-blessed']);
    expect(blessings.infoLinks.map(l => l.type)).toEqual(['rule']);
  });

  it('parses an infoLink of type infoGroup on the unit', () => {
    const unit = catalogue.selectionEntries.find(entry => entry.id === guardianId);
    const groupLink = unit.infoLinks.find(link => link.type === 'infoGroup');
    expect(groupLink).toBeDefined();
    expect(groupLink.targetId).toBe('ig-blessings');
  });

  it('resolveEntry flattens inline infoGroups and infoGroup links into profiles and rules', () => {
    const rawUnit = findEntryInSystem(system, guardianId, catalogueId);
    const resolved = resolveEntry(system, rawUnit, catalogueId);

    expect(resolved.profiles.map(p => p.id).sort()).toEqual(['prof-guardian', 'prof-staff']);
    expect(resolved.rules.map(r => r.id).sort()).toEqual(['rule-blessed', 'rule-ward']);
  });

  it('surfaces infoGroup-bundled profiles and rules on the unit selection', () => {
    const selection = { id: 'sel-guardian', selectionEntryId: guardianId, name: 'Arcane Guardian', number: 1, selections: [] };
    const { profiles, rules } = collectUnitProfilesAndRules(system, selection, catalogueId);

    expect(profiles.map(p => p.id).sort()).toEqual(['prof-guardian', 'prof-staff']);
    expect(rules.map(r => r.id).sort()).toEqual(['rule-blessed', 'rule-ward']);
  });
});
