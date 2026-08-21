import { test, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { parseGameSystemXML, parseCatalogueXML, processImportedData } from './xmlParser';

beforeAll(() => {
  const dom = new JSDOM();
  globalThis.DOMParser = dom.window.DOMParser;
});

const gstWithRevision = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="sys-1" name="Test System" revision="9" />`;

const gstWithoutRevision = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="sys-1" name="Test System" />`;

const catWithRevision = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-1" name="Faction" revision="14" gameSystemId="sys-1" />`;

test('parseGameSystemXML reads the integer revision attribute', () => {
  expect(parseGameSystemXML(gstWithRevision).revision).toBe(9);
});

test('parseCatalogueXML reads the integer revision attribute', () => {
  expect(parseCatalogueXML(catWithRevision).revision).toBe(14);
});

test('a missing revision attribute parses as null (treated as outdated downstream)', () => {
  expect(parseGameSystemXML(gstWithoutRevision).revision).toBeNull();
});

test('processImportedData carries the game system revision on the stored system', () => {
  const { system } = processImportedData(
    [{ name: 'sys.gst', content: gstWithRevision }],
    [{ name: 'faction.cat', content: catWithRevision }]
  );

  expect(system.revision).toBe(9);
  expect(system.catalogues[0].revision).toBe(14);
});
