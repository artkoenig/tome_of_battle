import { describe, it, test, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { parseCatalogueXML } from '../parser/xmlParser.js';
import {
  getEffectiveModifiers,
  getModifiedConstraintValue,
  calculateRosterCosts,
  getSelectionOwnCosts
} from './validator.js';

// JSDOM provides DOMParser for the parser in the Node test environment.
beforeAll(() => {
  const jsdomObj = new JSDOM();
  globalThis.DOMParser = jsdomObj.window.DOMParser;
  globalThis.XMLSerializer = jsdomObj.window.XMLSerializer;
});

// ---------------------------------------------------------------------------
// Regression for the WHFB6 Definitive-Edition "Traditional Army" pattern
// (Dwarfs 2001 / 2005, DW1-AB p.53): a `modifier type="multiply" value="2"
// field="pts"` doubles a unit's points cost once an army-wide condition holds.
// Before the fix, getModifiedConstraintValue's switch ignored `multiply`, so the
// unit was priced at half the correct total everywhere (editor, sum, XML export).
// ---------------------------------------------------------------------------
describe('multiply cost modifier — "Traditional Army" doubling (realdatennah XML fixture)', () => {
  const POINTS_COST_TYPE_ID = 'pts';
  const BASE_UNIT_COST = 100;
  const TRADITIONAL_ARMY_CATEGORY_ID = 'cat-traditional-army';

  // A generic, schema-valid catalogue mirroring the real Dwarf-warrior unit: a base
  // points cost plus a multiply-by-2 modifier gated on an army-wide (force-scoped)
  // "Traditional Army" category being present.
  const catalogueXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-dwarfs" name="Dwarfs 2001">
  <selectionEntries>
    <selectionEntry id="dwarf-warriors" name="Dwarf Warriors" type="unit">
      <costs>
        <cost name="pts" typeId="${POINTS_COST_TYPE_ID}" value="${BASE_UNIT_COST}" />
      </costs>
      <modifiers>
        <modifier type="multiply" field="${POINTS_COST_TYPE_ID}" value="2">
          <conditions>
            <condition type="atLeast" value="1" field="${TRADITIONAL_ARMY_CATEGORY_ID}" scope="force" childId="${TRADITIONAL_ARMY_CATEGORY_ID}" />
          </conditions>
        </modifier>
      </modifiers>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

  let warriors;
  beforeAll(() => {
    const cat = parseCatalogueXML(catalogueXml);
    warriors = cat.selectionEntries.find(e => e.id === 'dwarf-warriors');
  });

  const pointsConstraint = { id: POINTS_COST_TYPE_ID, value: BASE_UNIT_COST };

  it('parses the multiply modifier with a numeric factor', () => {
    const modifiers = getEffectiveModifiers(warriors);
    expect(modifiers).toHaveLength(1);
    expect(modifiers[0].type).toBe('multiply');
    expect(modifiers[0].valueObject).toBe(2);
  });

  it('doubles the points cost when the army condition is met', () => {
    // The "Traditional Army" category is present in the force.
    const ctx = { forceCategoryCounts: { [TRADITIONAL_ARMY_CATEGORY_ID]: 1 } };
    const cost = getModifiedConstraintValue(pointsConstraint, getEffectiveModifiers(warriors), ctx);
    expect(cost).toBe(BASE_UNIT_COST * 2);
  });

  it('leaves the base points cost unchanged when the army condition is not met', () => {
    const ctx = { forceCategoryCounts: {} };
    const cost = getModifiedConstraintValue(pointsConstraint, getEffectiveModifiers(warriors), ctx);
    expect(cost).toBe(BASE_UNIT_COST);
  });
});

// ---------------------------------------------------------------------------
// The multiply operator shares one evaluation path with set/increment/decrement,
// so a multiply on any constraint — not only a cost — is applied identically.
// ---------------------------------------------------------------------------
describe('multiply modifier on a non-cost constraint', () => {
  it('multiplies a plain constraint value by the modifier factor', () => {
    const maxModelsConstraint = { id: 'max-models', value: 10 };
    const multiplyModifier = {
      type: 'multiply',
      field: 'max-models',
      value: '3',
      valueObject: 3,
      conditions: [],
      conditionGroups: []
    };
    const value = getModifiedConstraintValue(maxModelsConstraint, [multiplyModifier], {});
    expect(value).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// End-to-end through the roster cost pipeline: the doubled price must surface in
// the roster total (calculateRosterCosts) — the same per-selection cost the XML
// export serializes and the editor displays — not only at the raw constraint level.
// ---------------------------------------------------------------------------
describe('multiply cost modifier flows through the roster total (editor / sum / export)', () => {
  const BASE_UNIT_COST = 100;
  const BANNER_LINK_ID = 'banner';

  // A unit whose points cost doubles once a Battle Standard is taken (parent-scoped
  // condition on its own subtree), giving a deterministic met/not-met toggle that
  // exercises the exact getSelectionOwnCosts → getModifiedConstraintValue path used
  // by the roster total and the .ros export.
  const system = {
    id: 'sys',
    costTypes: [{ id: 'pts', name: 'pts' }],
    catalogues: [
      {
        id: 'cat',
        selectionEntries: [
          {
            id: 'unit',
            name: 'Dwarf Warriors',
            type: 'unit',
            costs: [{ typeId: 'pts', value: BASE_UNIT_COST }],
            modifiers: [
              {
                type: 'multiply',
                field: 'pts',
                value: '2',
                valueObject: 2,
                conditions: [{ type: 'atLeast', value: 1, scope: 'parent', field: BANNER_LINK_ID, childId: BANNER_LINK_ID }],
                conditionGroups: []
              }
            ],
            entryLinks: [
              { id: BANNER_LINK_ID, name: 'Battle Standard', targetId: 't-banner', type: 'selectionEntry', costs: [] }
            ]
          }
        ],
        sharedSelectionEntries: [
          { id: 't-banner', name: 'Battle Standard', type: 'upgrade', costs: [] }
        ]
      }
    ]
  };

  const makeRoster = (withBanner) => ({
    id: 'r', catalogueId: 'cat', costLimitType: 'pts',
    forces: [
      {
        id: 'f', catalogueId: 'cat',
        selections: [
          {
            id: 'u', name: 'Dwarf Warriors', selectionEntryId: 'unit', entryLinkId: null, number: 1,
            selections: withBanner
              ? [{ id: 'b', name: 'Battle Standard', entryLinkId: BANNER_LINK_ID, selectionEntryId: null, number: 1, selections: [] }]
              : []
          }
        ]
      }
    ]
  });

  test('roster total is doubled when the condition is met', () => {
    expect(calculateRosterCosts(makeRoster(true), system).pts).toBe(BASE_UNIT_COST * 2);
  });

  test('roster total stays at the base cost when the condition is not met', () => {
    expect(calculateRosterCosts(makeRoster(false), system).pts).toBe(BASE_UNIT_COST);
  });

  test('per-selection own cost (as serialized to XML export) reflects the doubling', () => {
    const roster = makeRoster(true);
    const unit = roster.forces[0].selections[0];
    expect(getSelectionOwnCosts(unit, 1, { system, roster, currentCatalogueId: 'cat' })).toEqual({ pts: BASE_UNIT_COST * 2 });
  });
});
