import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
import { parseGameSystemXML, parseCatalogueXML, processImportedData } from '../parser/xmlParser.js';
import { extractZipFiles } from '../parser/zipExtractor.js';

// Setup DOMParser for JSDOM in Node environment
const jsdomObj = new JSDOM();
globalThis.DOMParser = jsdomObj.window.DOMParser;
globalThis.XMLSerializer = jsdomObj.window.XMLSerializer;

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
  } else {
    testsFailed++;
    console.error('❌ AssertionError:', message);
  }
}

console.log('--- RUNNING PARSER AND ZIP EXTRACTOR TESTS ---');

// Mock data
const mockGstXml = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="sys-123" name="Test Grimdark System">
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
  <selectionEntries>
    <selectionEntry id="unit-captain" name="Space Marine Captain" type="unit">
      <costs>
        <cost name="Points" typeId="pts" value="100" />
      </costs>
      <categoryLinks>
        <categoryLink id="cl-1" targetId="cat-hq" />
      </categoryLinks>
    </selectionEntry>
  </selectionEntries>
</catalogue>
`;

// Test 1: parseGameSystemXML
(function testParseGameSystem() {
  try {
    const sys = parseGameSystemXML(mockGstXml);
    assert(sys.id === 'sys-123', 'Game system ID should match');
    assert(sys.name === 'Test Grimdark System', 'Game system name should match');
    assert(sys.costTypes.length === 1, 'Should have exactly 1 costType');
    assert(sys.costTypes[0].id === 'pts', 'Cost type ID should be pts');
    assert(sys.profileTypes.length === 1, 'Should have exactly 1 profileType');
    assert(sys.profileTypes[0].name === 'Unit', 'Profile type name should be Unit');
    assert(sys.profileTypes[0].characteristics.length === 2, 'Profile type should have 2 characteristics');
    assert(sys.categoryEntries.length === 1, 'Should have exactly 1 categoryEntry');
    assert(sys.forceEntries.length === 1, 'Should have exactly 1 forceEntry');
  } catch (e) {
    assert(false, `testParseGameSystem threw: ${e.message}`);
  }
})();

// Test 2: parseCatalogueXML
(function testParseCatalogue() {
  try {
    const cat = parseCatalogueXML(mockCatXml);
    assert(cat.id === 'cat-marines', 'Catalogue ID should match');
    assert(cat.name === 'Space Marines', 'Catalogue name should match');
    assert(cat.gameSystemId === 'sys-123', 'Catalogue gameSystemId should match');
    assert(cat.selectionEntries.length === 1, 'Should have exactly 1 selectionEntry');
    assert(cat.selectionEntries[0].name === 'Space Marine Captain', 'Selection entry name should match');
    assert(cat.selectionEntries[0].costs.length === 1, 'Selection entry should have exactly 1 cost');
  } catch (e) {
    assert(false, `testParseCatalogue threw: ${e.message}`);
  }
})();

// Test 3: XML parser error handling for invalid root element
(function testParseInvalidXml() {
  try {
    parseGameSystemXML('<wrongRoot id="123"></wrongRoot>');
    assert(false, 'Should throw error when parsing game system with wrong root element');
  } catch (e) {
    assert(e.message.includes('Not a valid Game System file'), 'Error message should complain about invalid Game System file');
  }

  try {
    parseCatalogueXML('<wrongRoot id="123"></wrongRoot>');
    assert(false, 'Should throw error when parsing catalogue with wrong root element');
  } catch (e) {
    assert(e.message.includes('Not a valid Catalogue file'), 'Error message should complain about invalid Catalogue file');
  }
})();

// Test 4: ZIP Extraction via extractZipFiles and processImportedData
(async function testZipExtractionAndProcessing() {
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
    assert(gstFiles[0].content === mockGstXml, 'GST content should match');

    assert(catFiles.length === 1, `Should extract exactly 1 CAT file, got ${catFiles.length}`);
    assert(catFiles[0].name === 'marines.cat', `CAT file name should be marines.cat, got ${catFiles[0].name}`);
    assert(catFiles[0].content === mockCatXml, 'CAT content should match');

    // Run processImportedData on the extracted lists
    const combinedSystem = processImportedData(gstFiles, catFiles);
    assert(combinedSystem.id === 'sys-123', 'Combined system ID should match');
    assert(combinedSystem.catalogues.length === 1, 'Combined system should contain 1 catalogue');
    assert(combinedSystem.catalogues[0].id === 'cat-marines', 'Combined catalogue ID should match');
  } catch (e) {
    assert(false, `testZipExtractionAndProcessing threw: ${e.message}`);
  }

  console.log(`\nResults: ${testsPassed} passed, ${testsFailed} failed`);
  if (testsFailed > 0) {
    process.exit(1);
  } else {
    console.log('ALL PARSER & ZIP EXTRACTOR TESTS SUCCESSFUL!');
    process.exit(0);
  }
})();
