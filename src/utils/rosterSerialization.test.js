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
      { id: 'cat-tomb-kings', name: 'Tomb Kings' }
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
