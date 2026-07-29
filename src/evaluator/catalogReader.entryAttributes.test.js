/**
 * Issue 0102, Punkte 2-4: dokumentierte Attribute der Auswahl-Definitionen,
 * die der Leser bislang verwarf.
 *
 * Vertrag (Issue-Plan, 2026-07-29):
 * - Punkt 2: eine gelesene `selectionEntryGroup`-Definition traegt
 *   `defaultSelectionEntryId` (`null`, wenn nicht gesetzt) — §7.1 der
 *   bsdata-Doku (Vorbelegungs-Regeln).
 * - Punkte 3/4: gelesene `selectionEntry`-, `selectionEntryGroup`- und
 *   `entryLink`-Definitionen tragen `isImport` und `isCollective` (XSD-Default
 *   je `false`, Catalogue.xsd:283-284; `import="true"`/`collective="true"` ⇒
 *   `true`; die xs:boolean-Kurzformen `"1"`/`"0"` gelten ebenso).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const ENTRY_ID = 'entry-warrior';
const GROUP_ID = 'group-weapons';
const LINK_ID = 'link-import';
const DEFAULT_OPTION_ID = 'entry-default-option';

/**
 * Ein Katalog, dessen Wurzel je eine Auswahl-Definition der drei Arten traegt;
 * `attrs` haengt an allen dreien.
 */
function catalogueWith(attrs) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-attrs" name="Attribute Catalogue">
      <selectionEntries>
        <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit" ${attrs}/>
      </selectionEntries>
      <selectionEntryGroups>
        <selectionEntryGroup id="${GROUP_ID}" name="Weapons" ${attrs}/>
      </selectionEntryGroups>
      <entryLinks>
        <entryLink id="${LINK_ID}" name="Import" targetId="${ENTRY_ID}" type="selectionEntry" ${attrs}/>
      </entryLinks>
    </catalogue>`;
}

/** Die gelesene Definition der gegebenen ID (Eintrag, Gruppe oder Verweis). */
function definitionOf(xml, id) {
  return parseCatalogue(xml).entries.find(def => def.id === id);
}

const ALL_KINDS = [
  ['selectionEntry', ENTRY_ID],
  ['selectionEntryGroup', GROUP_ID],
  ['entryLink', LINK_ID],
];

// ── Punkt 2: defaultSelectionEntryId ─────────────────────────────────────────

describe('parseCatalogue: defaultSelectionEntryId einer selectionEntryGroup', () => {
  it('liest das gesetzte Attribut als ID der Standardauswahl', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-default" name="Default Catalogue">
        <selectionEntryGroups>
          <selectionEntryGroup id="${GROUP_ID}" name="Weapons"
                               defaultSelectionEntryId="${DEFAULT_OPTION_ID}">
            <selectionEntries>
              <selectionEntry id="${DEFAULT_OPTION_ID}" name="Hand Weapon" type="upgrade"/>
            </selectionEntries>
          </selectionEntryGroup>
        </selectionEntryGroups>
      </catalogue>`;

    expect(definitionOf(xml, GROUP_ID).defaultSelectionEntryId).toBe(DEFAULT_OPTION_ID);
  });

  it('liest ein fehlendes Attribut als null (nie undefined)', () => {
    expect(definitionOf(catalogueWith(''), GROUP_ID).defaultSelectionEntryId).toBeNull();
  });
});

// ── Punkte 3/4: isImport und isCollective ────────────────────────────────────

describe.each(ALL_KINDS)('parseCatalogue: import/collective an %s', (_kindName, defId) => {
  it('faellt ohne Attribute auf die XSD-Vorgabe false/false zurueck', () => {
    const definition = definitionOf(catalogueWith(''), defId);

    expect(definition.isImport).toBe(false);
    expect(definition.isCollective).toBe(false);
  });

  it('liest import="true" und collective="true"', () => {
    const definition = definitionOf(catalogueWith('import="true" collective="true"'), defId);

    expect(definition.isImport).toBe(true);
    expect(definition.isCollective).toBe(true);
  });

  it('liest import="false" und collective="false"', () => {
    const definition = definitionOf(catalogueWith('import="false" collective="false"'), defId);

    expect(definition.isImport).toBe(false);
    expect(definition.isCollective).toBe(false);
  });

  it('deutet die xs:boolean-Kurzform "1" als true', () => {
    const definition = definitionOf(catalogueWith('import="1" collective="1"'), defId);

    expect(definition.isImport).toBe(true);
    expect(definition.isCollective).toBe(true);
  });

  it('deutet die xs:boolean-Kurzform "0" als false', () => {
    const definition = definitionOf(catalogueWith('import="0" collective="0"'), defId);

    expect(definition.isImport).toBe(false);
    expect(definition.isCollective).toBe(false);
  });
});
