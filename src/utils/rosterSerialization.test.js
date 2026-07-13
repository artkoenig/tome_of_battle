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
    expect(importedKing.costs[0].value).toBe(150);
    expect(importedKing.selections[0].name).toBe('Great Weapon');
    expect(importedKing.selections[0].selectionEntryId).toBe('weapon-gw-id');
    expect(importedKing.selections[0].costs[0].value).toBe(6);
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

    // Round-trip: import must recover the original per-item value 5 (50 / 10), not 0.5.
    const reimported = importRosterFromXml(xmlText, mockSystems);
    const unit = reimported.forces[0].selections[0];
    expect(unit.number).toBe(10);
    expect(unit.costs[0].value).toBe(5);
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
    expect(selection.selectionEntryId).toBe('weapon-gw-id');
    expect(selection.number).toBe(2);
    expect(selection.costs[0].value).toBe(25); // 50 / 2 = 25
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
    expect(ch1.costs[0].value).toBe(35); // 70 / 2 = 35
    
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
