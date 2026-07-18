import { test, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { parseCatalogueXML } from './xmlParser';
import { findEntryInSystem, resolveEntry } from '../solver/catalogResolver';

beforeAll(() => {
  const dom = new JSDOM();
  globalThis.DOMParser = dom.window.DOMParser;
});

// A single fixture that exercises both parser gaps at once:
//  - `se-hero` carries `rules` and `sharedRules` as sibling wrappers.
//  - `ig-special` is a shared info group referenced by an infoLink of type "infoGroup".
//  - `ig-inline` is an info group nested directly under an entry's `infoGroups` wrapper.
const catalogueXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-x" name="Faction X" gameSystemId="sys-x">
  <sharedInfoGroups>
    <infoGroup id="ig-special" name="Special Abilities">
      <profiles>
        <profile id="prof-x" name="Aura" profileTypeName="Ability">
          <characteristics>
            <characteristic typeId="c-desc" name="Description">Frightens the foe.</characteristic>
          </characteristics>
        </profile>
      </profiles>
      <rules>
        <rule id="rule-y" name="Terror">
          <description>Causes terror.</description>
        </rule>
      </rules>
    </infoGroup>
  </sharedInfoGroups>
  <selectionEntries>
    <selectionEntry id="se-hero" name="Dread Hero" type="unit">
      <rules>
        <rule id="rule-own" name="Own Rule">
          <description>An entry-local rule.</description>
        </rule>
      </rules>
      <sharedRules>
        <rule id="rule-shared" name="Shared Rule">
          <description>A shared rule declared alongside the local one.</description>
        </rule>
      </sharedRules>
      <infoGroups>
        <infoGroup id="ig-inline" name="Inline Group">
          <rules>
            <rule id="rule-inline" name="Inline Rule">
              <description>Belongs to the inline group.</description>
            </rule>
          </rules>
        </infoGroup>
      </infoGroups>
      <infoLinks>
        <infoLink id="il-1" name="Special Abilities Link" targetId="ig-special" type="infoGroup" />
      </infoLinks>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

const parseFixtureCatalogue = () => parseCatalogueXML(catalogueXml);
const findHero = (catalogue) => catalogue.selectionEntries.find(se => se.id === 'se-hero');

test('an element with both rules and sharedRules yields the union of both wrappers', () => {
  const hero = findHero(parseFixtureCatalogue());
  const ruleIds = hero.rules.map(rule => rule.id);

  expect(ruleIds).toContain('rule-own');
  expect(ruleIds).toContain('rule-shared');
  expect(ruleIds).toHaveLength(2);
});

test('infoGroup elements under an infoGroups wrapper are parsed and keep their id', () => {
  const catalogue = parseFixtureCatalogue();

  const sharedGroup = catalogue.sharedInfoGroups.find(group => group.id === 'ig-special');
  expect(sharedGroup).toBeDefined();
  expect(sharedGroup.rules.map(rule => rule.id)).toContain('rule-y');
  expect(sharedGroup.profiles.map(profile => profile.id)).toContain('prof-x');

  const inlineGroup = findHero(catalogue).infoGroups.find(group => group.id === 'ig-inline');
  expect(inlineGroup).toBeDefined();
  expect(inlineGroup.rules.map(rule => rule.id)).toContain('rule-inline');
});

test('a parsed infoGroup is findable in the system index by its id', () => {
  const system = { id: 'sys-x', catalogues: [parseFixtureCatalogue()] };

  const found = findEntryInSystem(system, 'ig-special', 'cat-x');
  expect(found).not.toBeNull();
  expect(found.id).toBe('ig-special');
  expect(found.name).toBe('Special Abilities');
});

test('an infoLink of type infoGroup resolves the group and surfaces its profiles and rules', () => {
  const system = { id: 'sys-x', catalogues: [parseFixtureCatalogue()] };
  const hero = findHero(system.catalogues[0]);

  const resolved = resolveEntry(system, hero, 'cat-x');

  expect(resolved.rules.map(rule => rule.id)).toContain('rule-y');
  expect(resolved.profiles.map(profile => profile.id)).toContain('prof-x');
  // The entry's own rules survive the merge.
  expect(resolved.rules.map(rule => rule.id)).toEqual(
    expect.arrayContaining(['rule-own', 'rule-shared'])
  );
});
