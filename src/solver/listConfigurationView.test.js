import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { isListConfigurationCategory, buildConfigurationRadioGroups } from './listConfigurationView.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';

// JSDOM provides DOMParser for the Node test run (as in the other solver tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const readFixture = path => readFileSync(path, 'utf-8');

// The same real WHFB6 Definitive-Edition switches Child-Issue 01 anchored its
// classification against — reused here so the category/view layer is verified
// against verbatim upstream data, not a hand-built mock.
const switchCatalogue = parseCatalogueXML(
  readFixture('./src/solver/__fixtures__/whfb6-lexicanum/list-configuration-switches.cat.xml')
);
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

const switchEntryIdByName = name =>
  switchCatalogue.sharedSelectionEntries.find(entry => entry.name === name)?.id;
const ALLOW_EXPERIMENTAL_ID = switchEntryIdByName('Allow experimental rules?');
const ALLOW_SPECIALS_ID = switchEntryIdByName('Allow special characters?');

// A real playable unit from the old data source — used to prove that a category
// containing even one real unit does not collapse into a configuration card.
const NIGHT_GOBLIN_UNIT_ID = 'ed65-df1a-50a2-c3ac';

const selection = (id, entryId, children = []) => ({
  id,
  selectionEntryId: entryId,
  name: id,
  number: 1,
  selections: children
});

const forceWith = (selections, catalogueId) => ({
  id: 'force-under-test',
  catalogueId,
  selections
});

describe('isListConfigurationCategory', () => {
  it('is true when every selection of the category is a list configuration', () => {
    const experimental = selection('sel-experimental', ALLOW_EXPERIMENTAL_ID);
    const specials = selection('sel-specials', ALLOW_SPECIALS_ID);
    const force = forceWith([experimental, specials], switchCatalogue.id);
    expect(isListConfigurationCategory({
      system, force, selections: [experimental, specials], catalogueId: switchCatalogue.id
    })).toBe(true);
  });

  it('is false when a real unit is mixed into the category', () => {
    const experimental = selection('sel-experimental', ALLOW_EXPERIMENTAL_ID);
    const nightGoblin = selection('sel-night-goblin', NIGHT_GOBLIN_UNIT_ID);
    const force = forceWith([experimental, nightGoblin], ergofargCatalogue.id);
    expect(isListConfigurationCategory({
      system, force, selections: [experimental, nightGoblin], catalogueId: ergofargCatalogue.id
    })).toBe(false);
  });

  it('is false for an empty category', () => {
    const force = forceWith([], switchCatalogue.id);
    expect(isListConfigurationCategory({
      system, force, selections: [], catalogueId: switchCatalogue.id
    })).toBe(false);
  });
});

describe('buildConfigurationRadioGroups', () => {
  it('exposes every option of each main entry with none active by default', () => {
    const experimental = selection('sel-experimental', ALLOW_EXPERIMENTAL_ID);
    const [group] = buildConfigurationRadioGroups({
      system, selections: [experimental], catalogueId: switchCatalogue.id
    });

    // The real switch carries five source-of-rules options.
    expect(group.mainEntrySelectionId).toBe('sel-experimental');
    expect(group.options).toHaveLength(5);
    expect(group.options.map(o => o.name)).toContain('Allow experimental rules from GW-website');
    expect(group.options.every(o => o.selected === false)).toBe(true);
    expect(group.selectedOption).toBeNull();
  });

  it('marks the stored option as the active selection', () => {
    const chosenOptionId = '5dac-1d03-5bb7-730b'; // "…from GW-website"
    const child = selection('sub-1', chosenOptionId);
    const experimental = selection('sel-experimental', ALLOW_EXPERIMENTAL_ID, [child]);

    const [group] = buildConfigurationRadioGroups({
      system, selections: [experimental], catalogueId: switchCatalogue.id
    });

    expect(group.selectedOption).not.toBeNull();
    expect(group.selectedOption.optionId).toBe(chosenOptionId);
    expect(group.selectedOption.name).toBe('Allow experimental rules from GW-website');
    expect(group.options.filter(o => o.selected)).toHaveLength(1);
  });

  it('builds one radio group per main entry of the category', () => {
    const experimental = selection('sel-experimental', ALLOW_EXPERIMENTAL_ID);
    const specials = selection('sel-specials', ALLOW_SPECIALS_ID);
    const groups = buildConfigurationRadioGroups({
      system, selections: [experimental, specials], catalogueId: switchCatalogue.id
    });
    expect(groups).toHaveLength(2);
    expect(groups[1].options.length).toBeGreaterThan(0);
  });
});
