import { test, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
import { parseGameSystemXML, parseCatalogueXML, processImportedData } from '../parser/xmlParser.js';
import { extractZipFiles } from '../parser/zipExtractor.js';

// Setup DOMParser for JSDOM in Node environment
const jsdomObj = new JSDOM();
globalThis.DOMParser = jsdomObj.window.DOMParser;
globalThis.XMLSerializer = jsdomObj.window.XMLSerializer;





// Mock data
const mockGstXml = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="sys-123" name="Test Grimdark System">
  <publications>
    <publication id="pub-brb" name="Big Rule Book" shortName="BRB" />
  </publications>
  <costTypes>
    <costType id="pts" name="Points" defaultCostLimit="2000" />
  </costTypes>
  <profileTypes>
    <profileType id="prof-unit" name="Unit">
      <characteristicTypes>
        <characteristicType id="char-m" name="M" />
        <characteristicType id="char-ws" name="WS" />
      </characteristicTypes>
    </profileType>
  </profileTypes>
  <categoryEntries>
    <categoryEntry id="cat-hq" name="HQ" />
  </categoryEntries>
  <forceEntries>
    <forceEntry id="force-patrol" name="Patrol Force">
      <categoryLinks>
        <categoryLink id="cl-hq" targetId="cat-hq" name="HQ Link" />
      </categoryLinks>
    </forceEntry>
  </forceEntries>
</gameSystem>
`;

const mockCatXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-marines" name="Space Marines" gameSystemId="sys-123">
  <publications>
    <publication id="pub-codex" name="Space Marines Codex" />
  </publications>
  <selectionEntries>
    <selectionEntry id="unit-captain" name="Space Marine Captain" type="unit" publicationId="pub-codex" page="55">
      <costs>
        <cost name="Points" typeId="pts" value="100" />
      </costs>
      <categoryLinks>
        <categoryLink id="cl-1" targetId="cat-hq" />
      </categoryLinks>
      <selectionEntryGroups>
        <selectionEntryGroup id="group-weapons" name="Weapons Selection" defaultSelectionEntryId="weapon-sword">
          <entryLinks>
            <entryLink id="weapon-sword" name="Power Sword" targetId="item-sword" type="selectionEntry" />
            <entryLink id="weapon-axe" name="Power Axe" targetId="item-axe" type="selectionEntry" />
          </entryLinks>
        </selectionEntryGroup>
      </selectionEntryGroups>
      <rules>
        <rule id="rule-rite" name="Rites of Battle" publicationId="pub-codex" page="12">
          <description>Re-roll 1s</description>
        </rule>
      </rules>
      <profiles>
        <profile id="prof-captain" name="Captain Stats" profileTypeId="prof-unit" publicationId="pub-codex" page="99">
          <characteristics>
            <characteristic typeId="char-m" name="M">6"</characteristic>
          </characteristics>
        </profile>
      </profiles>
    </selectionEntry>
  </selectionEntries>
</catalogue>
`;

test('parseGameSystemXML', () => {
  try {
    const sys = parseGameSystemXML(mockGstXml);
    expect(sys.id).toBe('sys-123');
    expect(sys.name).toBe('Test Grimdark System');
    expect(sys.costTypes.length).toBe(1);
    expect(sys.costTypes[0].id).toBe('pts');
    expect(sys.profileTypes.length).toBe(1);
    expect(sys.profileTypes[0].name).toBe('Unit');
    expect(sys.profileTypes[0].characteristics.length).toBe(2);
    expect(sys.categoryEntries.length).toBe(1);
    expect(sys.forceEntries.length).toBe(1);
    expect(sys.publications.length).toBe(1);
    expect(sys.publications[0].id).toBe('pub-brb');
    expect(sys.publications[0].name).toBe('Big Rule Book');
  } catch (e) {
    expect.fail(`testParseGameSystem threw: ${e.message}`);
  }
});

test('parseCatalogueXML', () => {
  try {
    const cat = parseCatalogueXML(mockCatXml);
    expect(cat.id).toBe('cat-marines');
    expect(cat.name).toBe('Space Marines');
    expect(cat.gameSystemId).toBe('sys-123');
    expect(cat.selectionEntries.length).toBe(1);
    expect(cat.selectionEntries[0].name).toBe('Space Marine Captain');
    expect(cat.selectionEntries[0].costs.length).toBe(1);
    
    // Assert defaultSelectionEntryId parsing
    const groups = cat.selectionEntries[0].selectionEntryGroups;
    expect(groups.length).toBe(1);
    expect(groups[0].id).toBe('group-weapons');
    expect(groups[0].defaultSelectionEntryId).toBe('weapon-sword');

    // Assert publications and attributes parsing
    expect(cat.publications.length).toBe(1);
    expect(cat.publications[0].id).toBe('pub-codex');
    expect(cat.publications[0].name).toBe('Space Marines Codex');
    expect(cat.selectionEntries[0].publicationId).toBe('pub-codex');
    expect(cat.selectionEntries[0].page).toBe('55');
    expect(cat.selectionEntries[0].rules[0].publicationId).toBe('pub-codex');
    expect(cat.selectionEntries[0].rules[0].page).toBe('12');
    expect(cat.selectionEntries[0].profiles[0].publicationId).toBe('pub-codex');
    expect(cat.selectionEntries[0].profiles[0].page).toBe('99');
  } catch (e) {
    expect.fail(`testParseCatalogue threw: ${e.message}`);
  }
});

test('XML parser error handling for invalid root element', () => {
  try {
    parseGameSystemXML('<wrongRoot id="123"></wrongRoot>');
    expect.fail('Should throw error when parsing game system with wrong root element');
  } catch (e) {
    expect(e.message).toContain('Not a valid Game System file');
  }

  try {
    parseCatalogueXML('<wrongRoot id="123"></wrongRoot>');
    expect.fail('Should throw error when parsing catalogue with wrong root element');
  } catch (e) {
    expect(e.message).toContain('Not a valid Catalogue file');
  }
});

test('ZIP Extraction via extractZipFiles and processImportedData', async () => {
  try {
    const zip = new JSZip();
    zip.file('system.gst', mockGstXml);
    zip.file('marines.cat', mockCatXml);
    // Add some random/ignored files
    zip.file('.DS_Store', 'garbage');
    zip.file('__MACOSX/nested', 'garbage');

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const { gstFiles, catFiles } = await extractZipFiles(zipBuffer);

    assert(gstFiles.length === 1, `Should extract exactly 1 GST file, got ${gstFiles.length}`);
    assert(gstFiles[0].name === 'system.gst', `GST file name should be system.gst, got ${gstFiles[0].name}`);
    expect(gstFiles[0].content).toBe(mockGstXml);

    assert(catFiles.length === 1, `Should extract exactly 1 CAT file, got ${catFiles.length}`);
    assert(catFiles[0].name === 'marines.cat', `CAT file name should be marines.cat, got ${catFiles[0].name}`);
    expect(catFiles[0].content).toBe(mockCatXml);

    // Run processImportedData on the extracted lists
    const combinedSystem = processImportedData(gstFiles, catFiles);
    expect(combinedSystem.id).toBe('sys-123');
    expect(combinedSystem.catalogues.length).toBe(1);
    expect(combinedSystem.catalogues[0].id).toBe('cat-marines');
  } catch (e) {
    expect.fail(`testZipExtractionAndProcessing threw: ${e.message}`);
  }

});
