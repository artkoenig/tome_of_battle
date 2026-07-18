import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { parseCatalogueXML } from '../parser/xmlParser.js';
import {
  getEffectiveModifiers,
  getEffectiveCategoryLinks,
  getModifiedConstraintValue,
  evaluateCondition,
  computeRosterCounts
} from './validator.js';

// JSDOM provides DOMParser for the parser in the Node test environment.
beforeAll(() => {
  const jsdomObj = new JSDOM();
  globalThis.DOMParser = jsdomObj.window.DOMParser;
  globalThis.XMLSerializer = jsdomObj.window.XMLSerializer;
});

// ---------------------------------------------------------------------------
// Gap #1 — modifierGroup gating: the parser preserves a group's own conditions,
// and contained modifiers only fire when the group's condition passes.
// ---------------------------------------------------------------------------
describe('modifierGroup gating (gap #1)', () => {
  // A generic, schema-valid catalogue: a "Champion" upgrade whose +5 pts cost
  // modifier lives inside a modifierGroup gated on "at least one Banner selected".
  const catalogueXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-1" name="Generic Catalogue">
  <selectionEntries>
    <selectionEntry id="champion" name="Champion" type="upgrade">
      <costs>
        <cost name="pts" typeId="pts" value="10" />
      </costs>
      <modifierGroups>
        <modifierGroup>
          <conditions>
            <condition type="atLeast" value="1" field="banner" scope="parent" childId="banner" />
          </conditions>
          <modifiers>
            <modifier type="increment" field="pts" value="5" />
          </modifiers>
        </modifierGroup>
      </modifierGroups>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

  let champion;
  beforeAll(() => {
    const cat = parseCatalogueXML(catalogueXml);
    champion = cat.selectionEntries.find(e => e.id === 'champion');
  });

  it('does not flatten modifierGroups into the flat modifier list', () => {
    expect(champion.modifiers).toEqual([]);
    expect(champion.modifierGroups).toHaveLength(1);
    expect(champion.modifierGroups[0].conditions).toHaveLength(1);
    expect(champion.modifierGroups[0].modifiers).toHaveLength(1);
  });

  it('folds the group condition into contained modifiers', () => {
    const effective = getEffectiveModifiers(champion);
    expect(effective).toHaveLength(1);
    // The contained modifier now carries the group's gating condition.
    expect(effective[0].conditions).toHaveLength(1);
    expect(effective[0].conditions[0].field).toBe('banner');
  });

  const costConstraint = { id: 'pts', value: 10 };

  it('applies the contained modifier only when the group condition is met', () => {
    const parentWithBanner = { selections: [{ selectionEntryId: 'banner', number: 1 }] };
    const ctx = { selection: {}, parentSelection: parentWithBanner };
    const cost = getModifiedConstraintValue(costConstraint, getEffectiveModifiers(champion), ctx);
    expect(cost).toBe(15);
  });

  it('withholds the contained modifier when the group condition fails', () => {
    const parentWithoutBanner = { selections: [] };
    const ctx = { selection: {}, parentSelection: parentWithoutBanner };
    const cost = getModifiedConstraintValue(costConstraint, getEffectiveModifiers(champion), ctx);
    expect(cost).toBe(10);
  });

  it('gates nested modifierGroups by compounding their conditions', () => {
    const nestedXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-2" name="Nested Catalogue">
  <selectionEntries>
    <selectionEntry id="unit" name="Unit" type="unit">
      <modifierGroups>
        <modifierGroup>
          <conditions>
            <condition type="atLeast" value="1" field="a" scope="parent" childId="a" />
          </conditions>
          <modifierGroups>
            <modifierGroup>
              <conditions>
                <condition type="atLeast" value="1" field="b" scope="parent" childId="b" />
              </conditions>
              <modifiers>
                <modifier type="set" field="hidden" value="true" />
              </modifiers>
            </modifierGroup>
          </modifierGroups>
        </modifierGroup>
      </modifierGroups>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;
    const cat = parseCatalogueXML(nestedXml);
    const unit = cat.selectionEntries.find(e => e.id === 'unit');
    const effective = getEffectiveModifiers(unit);
    expect(effective).toHaveLength(1);
    // Both the outer and the inner group condition are folded in.
    expect(effective[0].conditions.map(c => c.field).sort()).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// Gap #2 — includeChildSelections is parsed and honored during evaluation.
// ---------------------------------------------------------------------------
describe('includeChildSelections (gap #2)', () => {
  const catalogueXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-3" name="Child Selections Catalogue">
  <selectionEntries>
    <selectionEntry id="host" name="Host" type="unit">
      <modifiers>
        <modifier type="set" field="hidden" value="true">
          <conditions>
            <condition type="atLeast" value="2" field="grunt" scope="parent" childId="grunt" includeChildSelections="true" />
          </conditions>
        </modifier>
      </modifiers>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

  it('parses includeChildSelections on a condition', () => {
    const cat = parseCatalogueXML(catalogueXml);
    const host = cat.selectionEntries.find(e => e.id === 'host');
    expect(host.modifiers[0].conditions[0].includeChildSelections).toBe(true);
  });

  it('parses includeChildSelections on a repeat, defaulting to false', () => {
    const repeatXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-4" name="Repeat Catalogue">
  <selectionEntries>
    <selectionEntry id="e" name="E" type="upgrade">
      <modifiers>
        <modifier type="increment" field="pts" value="1">
          <repeats>
            <repeat repeats="1" value="1" field="grunt" scope="parent" childId="grunt" includeChildSelections="true" />
          </repeats>
        </modifier>
        <modifier type="increment" field="pts" value="1">
          <repeats>
            <repeat repeats="1" value="1" field="grunt" scope="parent" childId="grunt" />
          </repeats>
        </modifier>
      </modifiers>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;
    const cat = parseCatalogueXML(repeatXml);
    const e = cat.selectionEntries.find(x => x.id === 'e');
    expect(e.modifiers[0].repeat.includeChildSelections).toBe(true);
    expect(e.modifiers[1].repeat.includeChildSelections).toBe(false);
  });

  it('counts nested child selections when includeChildSelections is set', () => {
    const cat = parseCatalogueXML(catalogueXml);
    const condition = cat.selectionEntries.find(e => e.id === 'host').modifiers[0].conditions[0];
    // One direct grunt plus one nested grunt = 2 => condition (atLeast 2) is met.
    const parentSelection = {
      selections: [
        { selectionEntryId: 'grunt', number: 1, selections: [{ selectionEntryId: 'grunt', number: 1 }] }
      ]
    };
    expect(evaluateCondition(condition, { parentSelection })).toBe(true);
  });

  it('ignores nested selections when includeChildSelections is not set', () => {
    const cat = parseCatalogueXML(catalogueXml);
    const condition = { ...cat.selectionEntries.find(e => e.id === 'host').modifiers[0].conditions[0], includeChildSelections: false };
    const parentSelection = {
      selections: [
        { selectionEntryId: 'grunt', number: 1, selections: [{ selectionEntryId: 'grunt', number: 1 }] }
      ]
    };
    // Only the one direct grunt is counted => condition (atLeast 2) is not met.
    expect(evaluateCondition(condition, { parentSelection })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Gap #4 (Issue 17/07) — a non-parent scoped condition counts by its childId, not by
// the generic field ("selections"). This is what lets a force-scoped bloodline gate
// ("atLeast 1 selections scope=force childId=<bloodline>") fire off the selection count.
// ---------------------------------------------------------------------------
describe('force-scoped childId conditions (gap #4)', () => {
  const BLOODLINE_ID = 'bloodline-blood-dragon';
  const forceChildIdCondition = {
    type: 'atLeast', value: 1, field: 'selections', scope: 'force', childId: BLOODLINE_ID
  };

  it('counts the childId entry, so a selected bloodline satisfies the condition', () => {
    const ctx = { selectionCounts: { [BLOODLINE_ID]: 1 }, forceCategoryCounts: {} };
    expect(evaluateCondition(forceChildIdCondition, ctx)).toBe(true);
  });

  it('fails when the childId entry is not selected', () => {
    const ctx = { selectionCounts: {}, forceCategoryCounts: {} };
    expect(evaluateCondition(forceChildIdCondition, ctx)).toBe(false);
  });

  it('still counts by field when no childId is present (category force condition)', () => {
    const categoryForceCondition = { type: 'atLeast', value: 1, field: 'cat-core', scope: 'force' };
    const ctx = { selectionCounts: {}, forceCategoryCounts: { 'cat-core': 2 } };
    expect(evaluateCondition(categoryForceCondition, ctx)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Gap #3 — dynamic categories via add/remove/set-primary/unset-primary.
// ---------------------------------------------------------------------------
describe('dynamic category modifiers (gap #3)', () => {
  const baseLinks = [{ targetId: 'cat-troops', primary: true }];

  it('adds a category membership when the modifier condition passes', () => {
    const modifiers = [{ type: 'add', field: 'category', value: 'cat-elite', conditions: [] }];
    const links = getEffectiveCategoryLinks(baseLinks, modifiers, {});
    expect(links.map(l => l.targetId).sort()).toEqual(['cat-elite', 'cat-troops']);
    expect(links.find(l => l.targetId === 'cat-elite').primary).toBe(false);
  });

  it('does not add a category when the modifier condition fails', () => {
    const modifiers = [{
      type: 'add', field: 'category', value: 'cat-elite',
      conditions: [{ type: 'atLeast', value: 1, field: 'badge', scope: 'parent', childId: 'badge' }]
    }];
    const ctx = { parentSelection: { selections: [] } };
    const links = getEffectiveCategoryLinks(baseLinks, modifiers, ctx);
    expect(links.map(l => l.targetId)).toEqual(['cat-troops']);
  });

  it('removes a category membership', () => {
    const modifiers = [{ type: 'remove', field: 'category', value: 'cat-troops', conditions: [] }];
    const links = getEffectiveCategoryLinks(baseLinks, modifiers, {});
    expect(links).toEqual([]);
  });

  it('sets the primary flag on an existing category link', () => {
    const links = getEffectiveCategoryLinks(
      [{ targetId: 'cat-troops', primary: true }, { targetId: 'cat-elite', primary: false }],
      [{ type: 'set-primary', field: 'category', value: 'cat-elite', conditions: [] }],
      {}
    );
    expect(links.find(l => l.targetId === 'cat-elite').primary).toBe(true);
  });

  it('creates a primary category link when set-primary targets a missing category', () => {
    const links = getEffectiveCategoryLinks(baseLinks, [
      { type: 'set-primary', field: 'category', value: 'cat-elite', conditions: [] }
    ], {});
    expect(links.find(l => l.targetId === 'cat-elite').primary).toBe(true);
  });

  it('clears the primary flag with unset-primary', () => {
    const links = getEffectiveCategoryLinks(baseLinks, [
      { type: 'unset-primary', field: 'category', value: 'cat-troops', conditions: [] }
    ], {});
    expect(links.find(l => l.targetId === 'cat-troops').primary).toBe(false);
  });

  it('ignores modifiers whose field is not "category"', () => {
    const links = getEffectiveCategoryLinks(baseLinks, [
      { type: 'add', field: 'pts', value: 'cat-elite', conditions: [] }
    ], {});
    expect(links.map(l => l.targetId)).toEqual(['cat-troops']);
  });

  it('reflects a conditional add-category modifier in computeRosterCounts', () => {
    // A generic system: the "Warrior" unit gains the "Veteran" category only when
    // it carries at least one "Medal" upgrade.
    const system = {
      catalogues: [{
        id: 'cat-1',
        selectionEntries: [
          {
            id: 'warrior', name: 'Warrior', type: 'unit',
            categoryLinks: [{ targetId: 'cat-troops', primary: true }],
            modifiers: [{
              type: 'add', field: 'category', value: 'cat-veteran',
              conditions: [{ type: 'atLeast', value: 1, field: 'medal', scope: 'parent', childId: 'medal' }],
              conditionGroups: []
            }]
          }
        ]
      }]
    };

    const rosterWithMedal = {
      forces: [{
        id: 'f-1', catalogueId: 'cat-1',
        selections: [{
          id: 's-1', selectionEntryId: 'warrior', number: 1,
          selections: [{ id: 's-2', selectionEntryId: 'medal', number: 1 }]
        }]
      }]
    };
    const withMedal = computeRosterCounts(rosterWithMedal, system);
    expect(withMedal.categoryCounts['f-1']['cat-veteran']).toBe(1);
    expect(withMedal.categoryCounts['f-1']['cat-troops']).toBe(1);

    const rosterWithoutMedal = {
      forces: [{
        id: 'f-1', catalogueId: 'cat-1',
        selections: [{ id: 's-1', selectionEntryId: 'warrior', number: 1, selections: [] }]
      }]
    };
    const withoutMedal = computeRosterCounts(rosterWithoutMedal, system);
    expect(withoutMedal.categoryCounts['f-1']['cat-veteran']).toBeUndefined();
    expect(withoutMedal.categoryCounts['f-1']['cat-troops']).toBe(1);
  });
});
