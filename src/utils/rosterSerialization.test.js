import { describe, test, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import crypto from 'crypto';
import {
  exportRosterToXml,
  importRosterFromXml,
  compressXmlToRosz,
  decompressRoszToXml,
  MissingSystemError
} from './rosterSerialization.js';
import { calculateRosterCosts } from '../solver/validator.js';

// Setup DOMParser and Crypto for the test Node environment
beforeAll(() => {
  const jsdomObj = new JSDOM();
  globalThis.DOMParser = jsdomObj.window.DOMParser;
  
  if (!globalThis.crypto) {
    globalThis.crypto = crypto;
  } else if (!globalThis.crypto.randomUUID) {
    globalThis.crypto.randomUUID = crypto.randomUUID;
  }
});

// Mock Systems Database
const mockSystems = [
  {
    id: 'system-id-123',
    name: 'Warhammer Fantasy 6th Edition',
    costTypes: [
      { id: 'pts-id-999', name: 'pts', defaultCostLimit: 2000 }
    ],
    forceEntries: [
      { id: 'force-entry-id-1', name: 'Standard ' }
    ],
    categoryEntries: [
      { id: 'cat-lord-id', name: 'Lord' },
      { id: 'cat-core-id', name: 'Core' }
    ],
    catalogues: [
      {
        id: 'cat-tomb-kings',
        name: 'Tomb Kings',
        selectionEntries: [
          {
            id: 'child-id',
            name: 'Goblin Spear Chukka',
            type: 'model',
            collective: false,
            selectionEntries: [
              { id: 'crew-id', name: 'Goblin Crew', type: 'model' },
              { id: 'bully-id', name: 'Orc Bully', type: 'upgrade' }
            ]
          },
          {
            id: 'parent-id',
            name: 'Goblin Spear Chukka',
            type: 'unit',
            collective: false,
            entryLinks: [
              { id: 'child-link-id', targetId: 'child-id', type: 'selectionEntry' }
            ]
          }
        ]
      }
    ]
  }
];

// Mock Roster Object (matching types.js Roster schema)
const mockRoster = {
  id: 'roster-uuid-1',
  name: 'My Undead Army',
  systemId: 'system-id-123',
  catalogueId: 'cat-tomb-kings',
  costLimit: 2000,
  costLimitType: 'pts-id-999',
  forces: [
    {
      id: 'force-uuid-1',
      forceEntryId: 'force-entry-id-1',
      catalogueId: 'cat-tomb-kings',
      selections: [
        {
          id: 'selection-uuid-1',
          name: 'Tomb King',
          entryLinkId: 'link-tomb-king-id',
          selectionEntryId: null,
          number: 1,
          category: 'cat-lord-id',
          collective: false,
          costs: [
            { typeId: 'pts-id-999', value: 150 }
          ],
          selections: [
            {
              id: 'selection-uuid-2',
              name: 'Great Weapon',
              entryLinkId: null,
              selectionEntryId: 'weapon-gw-id',
              number: 1,
              category: null,
              collective: false,
              costs: [
                { typeId: 'pts-id-999', value: 6 }
              ],
              selections: []
            }
          ]
        }
      ]
    }
  ]
};

describe('Roster Serialization & Deserialization', () => {
  test('serialize roster to XML and deserialize back successfully', () => {
    // 1. Export roster to XML string
    const xmlText = exportRosterToXml(mockRoster, mockSystems[0]);
    
    expect(xmlText).toContain('<?xml version="1.0"');
    expect(xmlText).toContain('<roster id="roster-uuid-1" name="My Undead Army"');
    expect(xmlText).toContain('gameSystemId="system-id-123"');
    expect(xmlText).toContain('xmlns="http://www.battlescribe.net/schema/rosterSchema"');
    expect(xmlText).toContain('<cost name="pts" typeId="pts-id-999" value="156"/>'); // 150 + 6
    expect(xmlText).toContain('<force id="force-uuid-1" name="Standard " entryId="force-entry-id-1"');
    expect(xmlText).toContain('<selection id="selection-uuid-1" name="Tomb King"');
    expect(xmlText).toContain('<category id="cat-lord-id" name="Lord" entryId="cat-lord-id" primary="true"');
    expect(xmlText).toContain('<selection id="selection-uuid-2" name="Great Weapon" entryId="weapon-gw-id"');

    // 2. Deserialize XML text back into a Roster object
    const importedRoster = importRosterFromXml(xmlText, mockSystems);
    
    expect(importedRoster).toBeDefined();
    expect(importedRoster.name).toBe('My Undead Army');
    expect(importedRoster.systemId).toBe('system-id-123');
    expect(importedRoster.costLimit).toBe(2000);
    
    // UUIDs should be freshly generated to avoid key clashes
    expect(importedRoster.id).not.toBe(mockRoster.id);
    expect(importedRoster.forces[0].id).not.toBe(mockRoster.forces[0].id);
    expect(importedRoster.forces[0].selections[0].id).not.toBe(mockRoster.forces[0].selections[0].id);
    
    // Hierarchy & data checks
    const importedKing = importedRoster.forces[0].selections[0];
    expect(importedKing.name).toBe('Tomb King');
    expect(importedKing.entryLinkId).toBe('link-tomb-king-id');
    expect(importedKing.category).toBe('cat-lord-id');
    // Costs are derived from the catalogue (ADR-0011), not stored on imported selections.
    expect(importedKing.costs).toBeUndefined();
    expect(importedKing.selections[0].name).toBe('Great Weapon');
    expect(importedKing.selections[0].selectionEntryId).toBe('weapon-gw-id');
    expect(importedKing.selections[0].costs).toBeUndefined();
  });

  test('exports multi-model selection costs as their quantity-multiplied total (round-trip preserves points)', () => {
    // A unit of 10 models at 5 pts each: internally stored as per-item value 5, number 10.
    const multiModelRoster = {
      ...mockRoster,
      id: 'roster-multimodel',
      forces: [
        {
          id: 'force-multimodel',
          forceEntryId: 'force-entry-id-1',
          catalogueId: 'cat-tomb-kings',
          selections: [
            {
              id: 'unit-skeletons',
              name: 'Skeletons',
              entryLinkId: null,
              selectionEntryId: 'skeleton-id',
              number: 10,
              category: 'cat-core-id',
              collective: false,
              costs: [{ typeId: 'pts-id-999', value: 5 }],
              selections: []
            }
          ]
        }
      ]
    };

    const xmlText = exportRosterToXml(multiModelRoster, mockSystems[0]);
    // The selection's <cost> must carry the total (5 * 10 = 50), not the per-item value.
    expect(xmlText).toContain('number="10" type="upgrade"');
    expect(xmlText).toContain('<cost name="pts" typeId="pts-id-999" value="50"/>');

    // Round-trip preserves the quantity; costs are derived from the catalogue, not stored.
    const reimported = importRosterFromXml(xmlText, mockSystems);
    const unit = reimported.forces[0].selections[0];
    expect(unit.number).toBe(10);
    expect(unit.costs).toBeUndefined();
  });

  test('round-trips the point limit through the costLimits block', () => {
    const limitedRoster = { ...mockRoster, id: 'roster-limit', costLimit: 3000 };

    const xmlText = exportRosterToXml(limitedRoster, mockSystems[0]);
    expect(xmlText).toContain('<costLimits>');
    expect(xmlText).toContain('<costLimit name="pts" typeId="pts-id-999" value="3000"/>');

    const reimported = importRosterFromXml(xmlText, mockSystems);
    expect(reimported.costLimit).toBe(3000);
    expect(reimported.costLimitType).toBe('pts-id-999');
  });

  test('correctly imports rosters with path-based IDs (::) and already-multiplied costs', () => {
    const xmlWithPaths = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<roster id="roster-path-test" name="Path Test Army" gameSystemId="system-id-123" gameSystemRevision="1" gameSystemName="Warhammer Fantasy 6th Edition" xmlns="http://www.battlescribe.net/schema/rosterSchema">
  <costs>
    <cost name="pts" typeId="pts-id-999" value="165"/>
  </costs>
  <forces>
    <force id="force-path-test" name="Standard" entryId="force-entry-id-1" catalogueId="cat-tomb-kings" catalogueRevision="1" catalogueName="Tomb Kings">
      <selections>
        <selection id="sel-path-test-1" name="Dispel Scroll" entryId="some-parent::some-group::weapon-gw-id" number="2" type="upgrade">
          <costs>
            <cost name="pts" typeId="pts-id-999" value="50"/>
          </costs>
        </selection>
      </selections>
    </force>
  </forces>
</roster>`;

    const imported = importRosterFromXml(xmlWithPaths, mockSystems);
    expect(imported).toBeDefined();
    expect(imported.name).toBe('Path Test Army');
    
    const selection = imported.forces[0].selections[0];
    // The path-based entryId is collapsed to its target leaf id.
    expect(selection.selectionEntryId).toBe('weapon-gw-id');
    expect(selection.number).toBe(2);
    // Costs are derived from the catalogue (ADR-0011), not parsed/stored on import.
    expect(selection.costs).toBeUndefined();
  });

  test('splits war machine/chariot selections on import when quantity > 1', () => {
    const xmlWithWarMachine = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<roster id="roster-split-test" name="Split Test Army" gameSystemId="system-id-123" gameSystemRevision="1" gameSystemName="Warhammer Fantasy 6th Edition" xmlns="http://www.battlescribe.net/schema/rosterSchema">
  <forces>
    <force id="force-split-test" name="Standard" entryId="force-entry-id-1" catalogueId="cat-tomb-kings" catalogueRevision="1" catalogueName="Tomb Kings">
      <selections>
        <selection id="parent-chukka" name="Goblin Spear Chukka" entryId="parent-id" number="1" type="unit">
          <selections>
            <selection id="child-chukka" name="Goblin Spear Chukka" entryId="child-id" number="2" type="model">
              <costs>
                <cost name="pts" typeId="pts-id-999" value="70"/>
              </costs>
              <selections>
                <selection id="crew" name="Goblin Crew" entryId="crew-id" number="6" type="model" />
                <selection id="bully" name="Orc Bully" entryId="bully-id" number="1" type="upgrade" />
              </selections>
            </selection>
          </selections>
        </selection>
      </selections>
    </force>
  </forces>
</roster>`;

    const imported = importRosterFromXml(xmlWithWarMachine, mockSystems);
    expect(imported).toBeDefined();
    
    const selections = imported.forces[0].selections;
    expect(selections.length).toBe(1);
    
    const parent = selections[0];
    expect(parent.name).toBe('Goblin Spear Chukka');
    expect(parent.number).toBe(1);
    expect(parent.selections.length).toBe(2);
    
    const ch1 = parent.selections[0];
    expect(ch1.name).toBe('Goblin Spear Chukka');
    expect(ch1.number).toBe(1);
    // Costs are derived from the catalogue (ADR-0011); the split preserves structure/quantities.
    expect(ch1.costs).toBeUndefined();

    const crew1 = ch1.selections.find(s => s.name === 'Goblin Crew');
    expect(crew1.number).toBe(3);
    
    const bully1 = ch1.selections.find(s => s.name === 'Orc Bully');
    expect(bully1).toBeDefined();
    expect(bully1.number).toBe(1);

    const ch2 = parent.selections[1];
    expect(ch2.name).toBe('Goblin Spear Chukka');
    expect(ch2.number).toBe(1);
    
    const crew2 = ch2.selections.find(s => s.name === 'Goblin Crew');
    expect(crew2.number).toBe(3);
    
    const bully2 = ch2.selections.find(s => s.name === 'Orc Bully');
    expect(bully2).toBeUndefined();
  });

  test('decompressing and compressing ZIP files (JSZip layer)', async () => {
    const xmlText = exportRosterToXml(mockRoster, mockSystems[0]);
    
    // Compress to ZIP
    const zipBlob = await compressXmlToRosz('my_test_roster', xmlText);
    expect(zipBlob).toBeDefined();
    expect(zipBlob.size).toBeGreaterThan(0);
    
    // Decompress ZIP back to XML
    const decompressedXml = await decompressRoszToXml(zipBlob);
    expect(decompressedXml).toBe(xmlText);
  });

  test('decompressing unzipped raw XML falls back to reading as text', async () => {
    const xmlText = '<?xml version="1.0"?><roster name="Raw XML Roster"></roster>';
    const blob = new Blob([xmlText], { type: 'text/xml' });
    
    const decompressedXml = await decompressRoszToXml(blob);
    expect(decompressedXml).toBe(xmlText);
  });

  test('throws MissingSystemError if game system is not found in systems database', () => {
    const xmlText = exportRosterToXml(mockRoster, mockSystems[0]);
    
    // Call parser with an empty systems list
    expect(() => importRosterFromXml(xmlText, [])).toThrow(MissingSystemError);
    
    try {
      importRosterFromXml(xmlText, []);
    } catch (err) {
      expect(err.systemId).toBe('system-id-123');
      expect(err.systemName).toBe('Warhammer Fantasy 6th Edition');
      expect(err.message).toContain('Warhammer Fantasy 6th Edition');
    }
  });

  test('throws Error for malformed XML or incorrect root elements', () => {
    const malformedXml = '<?xml version="1.0"?><wrongRoot name="Malformed Roster"></wrongRoot>';
    expect(() => importRosterFromXml(malformedXml, mockSystems)).toThrow('Ungültiges Dateiformat');
  });
});

describe('Export derives cost and type from the catalogue', () => {
  // Catalogue-complete system; the roster below carries NO selection.costs.
  const catSystem = {
    id: 'sys2', name: 'Sys2',
    costTypes: [{ id: 'pts', name: 'pts' }],
    forceEntries: [{ id: 'fe', name: 'Standard' }],
    categoryEntries: [],
    catalogues: [
      {
        id: 'c',
        name: 'Cat',
        selectionEntries: [
          {
            id: 'boyz',
            name: 'Orc Boyz',
            type: 'unit',
            costs: [{ typeId: 'pts', value: 5 }],
            selectionEntries: [
              {
                id: 'choppa',
                name: 'Choppa',
                type: 'upgrade',
                costs: [{ typeId: 'pts', value: 2 }],
                modifiers: [{ type: 'increment', field: 'pts', value: '1', conditions: [], conditionGroups: [] }]
              }
            ]
          }
        ]
      }
    ]
  };

  const roster = {
    id: 'r2', name: 'Derived', systemId: 'sys2', catalogueId: 'c', costLimit: 2000, costLimitType: 'pts',
    forces: [
      {
        id: 'f', forceEntryId: 'fe', catalogueId: 'c',
        selections: [
          {
            id: 'u', name: 'Orc Boyz', selectionEntryId: 'boyz', entryLinkId: null, number: 1, collective: false,
            selections: [
              { id: 'ch', name: 'Choppa', selectionEntryId: 'choppa', entryLinkId: null, number: 3, collective: false, selections: [] }
            ]
          }
        ]
      }
    ]
  };

  const flatSelectionPts = (xml) => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    let sum = 0;
    for (const c of doc.getElementsByTagName('cost')) {
      if (c.getAttribute('typeId') === 'pts' && c.parentNode.parentNode.nodeName === 'selection') {
        sum += parseFloat(c.getAttribute('value')) || 0;
      }
    }
    return sum;
  };

  test('per-selection cost flat-sum equals the computed roster total (no stored costs)', () => {
    const xml = exportRosterToXml(roster, catSystem);
    // 5 (unit) + (2 + 1 modifier) * 3 = 5 + 9 = 14
    expect(calculateRosterCosts(roster, catSystem).pts).toBe(14);
    expect(flatSelectionPts(xml)).toBe(14);
  });

  test('serializes the modifier-aware value per selection', () => {
    const xml = exportRosterToXml(roster, catSystem);
    // Choppa base 2 + modifier 1 = 3, times its 3 count = 9 (not 6).
    expect(xml).toContain('<cost name="pts" typeId="pts" value="9"/>');
  });

  test('derives the type attribute from the catalogue entry', () => {
    const xml = exportRosterToXml(roster, catSystem);
    expect(xml).toContain('name="Orc Boyz" entryId="boyz" entryLinkId="" number="1" type="unit"');
    expect(xml).toContain('name="Choppa" entryId="choppa" entryLinkId="" number="3" type="upgrade"');
  });
});
