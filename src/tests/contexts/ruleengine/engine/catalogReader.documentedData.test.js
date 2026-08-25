/**
 * Der Grundsatz „nichts wird still verschluckt" am Katalog-Leser
 * (`docs/evaluator-architecture.md` §4, Issue 0102): jedes Attribut und jedes
 * Element, das die BSData-Dokumentation benennt, wird **gelesen** oder als
 * **Diagnose** gemeldet — nie kommentarlos fallengelassen.
 *
 * Gepinnt sind die sechs Punkte, die dieses Issue bearbeitet:
 *
 * 1. `publications` an der Wurzel, `publicationId`/`page` an jeder `EntryBase`
 *    (`docs/battlescribe-data-format.md` §5.2, §13.3);
 * 2. `defaultSelectionEntryId` an einer Gruppe (§7.1);
 * 4. `collective` an Eintrag, Gruppe und Verweis (§10) — gelesen, aber
 *    bewusst nicht ausgewertet (Synchron-Regel: Issue 0104);
 * 6. `xs:boolean` in der Kurzform `1`/`0`;
 * 7. eine `<cost>` ohne lesbaren Wert;
 * 9. `scope` an einem `<modifier>`.
 *
 * Die Punkte 3 (`import`), 5 (Info-Kinder an einem `categoryLink`) und 8
 * (deklarierte, nirgends bepreiste Kostenart) sind im Issue als begruendeter
 * Verzicht festgehalten: kein Vorkommen in 36 realen Katalogdokumenten.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from '../../../../contexts/ruleengine/engine/catalogReader.js';
import { DiagnosticKind, DefinitionKind, InfoElementKind } from '../../../../contexts/ruleengine/engine/model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const BOOK_ID = '315e-e3c4-08af-fd51';
const POINTS_COST_TYPE_ID = 'ecfa-8486-4f6c-c249';
const UNIT_ID = 'unit-1';
const GROUP_ID = 'group-1';
const OPTION_ID = 'option-1';
const LINK_ID = 'link-1';

/** Ein Katalog mit den gegebenen Wurzel-Kindern. */
function catalogueXml(rootChildren) {
  return `<?xml version="1.0"?>
    <catalogue id="cat" name="Cat" gameSystemId="gs">
      ${rootChildren}
    </catalogue>`;
}

/** Die Diagnosen einer Art aus einem gelesenen Katalog. */
function diagnosticsOfKind(catalogue, kind) {
  return catalogue.diagnostics.filter(diagnostic => diagnostic.kind === kind);
}

describe('parseCatalogue: Quellenangaben (Punkt 1)', () => {
  it('liest die <publication>-Deklarationen der Wurzel mit allen ihren Angaben', () => {
    const xml = catalogueXml(`
      <publications>
        <publication id="${BOOK_ID}" name="BRB" shortName="Rulebook" publisher="GW"
                     publicationDate="2000" publisherUrl="https://example.invalid"/>
      </publications>`);

    expect(parseCatalogue(xml).publications).toEqual([{
      id: BOOK_ID,
      name: 'BRB',
      shortName: 'Rulebook',
      publisher: 'GW',
      publicationDate: '2000',
      publisherUrl: 'https://example.invalid',
    }]);
  });

  it('laesst nicht deklarierte Angaben einer Publikation ehrlich leer, statt sie zu erfinden', () => {
    const xml = catalogueXml(`
      <publications><publication id="${BOOK_ID}" name="BRB"/></publications>`);

    expect(parseCatalogue(xml).publications[0]).toEqual({
      id: BOOK_ID,
      name: 'BRB',
      shortName: null,
      publisher: null,
      publicationDate: null,
      publisherUrl: null,
    });
  });

  it('liest publicationId und page an einer Auswahl-Definition', () => {
    const xml = catalogueXml(`
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit"
                        publicationId="${BOOK_ID}" page="42"/>
      </selectionEntries>`);
    const entry = parseCatalogue(xml).entries[0];

    expect(entry.publicationId).toBe(BOOK_ID);
    expect(entry.page).toBe('42');
  });

  it('liest publicationId und page auch an einem Info-Element — sie haengen an derselben EntryBase', () => {
    const xml = catalogueXml(`
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit">
          <rules>
            <rule id="rule-1" name="Furcht" publicationId="${BOOK_ID}" page="7">
              <description>Text.</description>
            </rule>
          </rules>
        </selectionEntry>
      </selectionEntries>`);
    const rule = parseCatalogue(xml).entries[0].infos
      .find(info => info.kind === InfoElementKind.RULE);

    expect(rule.publicationId).toBe(BOOK_ID);
    expect(rule.page).toBe('7');
  });

  it('traegt ohne Quellenangabe null statt eines leeren Strings', () => {
    const xml = catalogueXml(`
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit" publicationId="" page=""/>
      </selectionEntries>`);
    const entry = parseCatalogue(xml).entries[0];

    expect(entry.publicationId).toBeNull();
    expect(entry.page).toBeNull();
  });
});

describe('parseCatalogue: Vorbelegung einer Gruppe (Punkt 2)', () => {
  it('liest defaultSelectionEntryId an einer selectionEntryGroup', () => {
    const xml = catalogueXml(`
      <selectionEntryGroups>
        <selectionEntryGroup id="${GROUP_ID}" name="Waffen" defaultSelectionEntryId="${OPTION_ID}"/>
      </selectionEntryGroups>`);

    expect(parseCatalogue(xml).entries[0].defaultSelectionEntryId).toBe(OPTION_ID);
  });

  it('traegt ohne Attribut null — die Gruppe benennt dann keine Vorbelegung', () => {
    const xml = catalogueXml(`
      <selectionEntryGroups>
        <selectionEntryGroup id="${GROUP_ID}" name="Waffen"/>
      </selectionEntryGroups>`);

    expect(parseCatalogue(xml).entries[0].defaultSelectionEntryId).toBeNull();
  });
});

describe('parseCatalogue: collective (Punkt 4)', () => {
  it('liest collective an Eintrag, Gruppe und Verweis', () => {
    const xml = catalogueXml(`
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit" collective="true"/>
      </selectionEntries>
      <selectionEntryGroups>
        <selectionEntryGroup id="${GROUP_ID}" name="Waffen" collective="true"/>
      </selectionEntryGroups>
      <entryLinks>
        <entryLink id="${LINK_ID}" name="Verweis" type="selectionEntry"
                   targetId="${UNIT_ID}" collective="true"/>
      </entryLinks>`);
    const byKind = new Map(parseCatalogue(xml).entries.map(entry => [entry.kind, entry]));

    expect(byKind.get(DefinitionKind.ENTRY).isCollective).toBe(true);
    expect(byKind.get(DefinitionKind.GROUP).isCollective).toBe(true);
    expect(byKind.get(DefinitionKind.ENTRY_LINK).isCollective).toBe(true);
  });

  it('faellt ohne Attribut auf die XSD-Vorgabe false zurueck', () => {
    const xml = catalogueXml(`
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit"/>
      </selectionEntries>`);

    expect(parseCatalogue(xml).entries[0].isCollective).toBe(false);
  });
});

describe('parseCatalogue: xs:boolean in der Kurzform 1/0 (Punkt 6)', () => {
  it('liest hidden="1" wie hidden="true"', () => {
    const xml = catalogueXml(`
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit" hidden="1"/>
      </selectionEntries>`);

    expect(parseCatalogue(xml).entries[0].isHidden).toBe(true);
  });

  it('liest hidden="0" als ausdrueckliches false, nicht als "nicht gesetzt"', () => {
    const xml = catalogueXml(`
      <entryLinks>
        <entryLink id="${LINK_ID}" name="Verweis" type="selectionEntry"
                   targetId="${UNIT_ID}" hidden="0"/>
      </entryLinks>`);
    const link = parseCatalogue(xml).entries[0];

    // Der Rohzustand entscheidet, ob ein Verweis das Basis-`hidden` seines Ziels
    // erbt oder es ueberstimmt (`effectiveState.js`, Issue 0099).
    expect(link.isHidden).toBe(false);
    expect(link.hiddenAttribute).toBe(false);
  });

  it('liest die Kurzform auch an den Zaehl-Flags und an percentValue einer Grenze', () => {
    const xml = catalogueXml(`
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit">
          <constraints>
            <constraint id="c1" type="max" field="selections" scope="roster" value="50"
                        percentValue="1" shared="0" includeChildSelections="1"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>`);
    const limit = parseCatalogue(xml).entries[0].limits[0];

    expect(limit.isPercent).toBe(true);
    expect(limit.flags).toEqual({ shared: false, includeChildSelections: true, includeChildForces: false });
  });

  it('liest die Kurzform am primary-Kennzeichen eines categoryLink', () => {
    const xml = catalogueXml(`
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit">
          <categoryLinks>
            <categoryLink id="cl-1" name="Kern" targetId="cat-core" primary="1"/>
          </categoryLinks>
        </selectionEntry>
      </selectionEntries>`);

    expect(parseCatalogue(xml).entries[0].primaryCategoryId).toBe('cat-core');
  });
});

describe('parseCatalogue: Kosten ohne lesbaren Wert (Punkt 7)', () => {
  it('meldet eine Diagnose mit Rohwert und Traeger, statt die Kostenangabe still zu verlieren', () => {
    const xml = catalogueXml(`
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit">
          <costs><cost name="pts" typeId="${POINTS_COST_TYPE_ID}" value="abc"/></costs>
        </selectionEntry>
      </selectionEntries>`);
    const catalogue = parseCatalogue(xml);

    expect(catalogue.entries[0].costs).toEqual({});
    expect(diagnosticsOfKind(catalogue, DiagnosticKind.UNREADABLE_COST)).toEqual([
      expect.objectContaining({
        typeId: POINTS_COST_TYPE_ID,
        value: 'abc',
        carrierId: UNIT_ID,
        carrierName: 'Krieger',
      }),
    ]);
  });

  it('meldet ebenso eine Kostenangabe ohne Kostenart', () => {
    const xml = catalogueXml(`
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit">
          <costs><cost name="pts" value="5"/></costs>
        </selectionEntry>
      </selectionEntries>`);
    const catalogue = parseCatalogue(xml);

    expect(catalogue.entries[0].costs).toEqual({});
    expect(diagnosticsOfKind(catalogue, DiagnosticKind.UNREADABLE_COST)).toHaveLength(1);
  });

  it('KONTROLLE: eine lesbare Kostenangabe erzeugt keine Diagnose', () => {
    const xml = catalogueXml(`
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit">
          <costs><cost name="pts" typeId="${POINTS_COST_TYPE_ID}" value="5"/></costs>
        </selectionEntry>
      </selectionEntries>`);
    const catalogue = parseCatalogue(xml);

    expect(catalogue.entries[0].costs).toEqual({ [POINTS_COST_TYPE_ID]: 5 });
    expect(diagnosticsOfKind(catalogue, DiagnosticKind.UNREADABLE_COST)).toEqual([]);
  });
});

describe('parseCatalogue: scope an einem Modifikator (Punkt 9)', () => {
  const modifierXml = scopeAttribute => catalogueXml(`
    <selectionEntries>
      <selectionEntry id="${UNIT_ID}" name="Mark of Slaanesh" type="upgrade">
        <modifiers>
          <modifier type="add" field="category" value="cat-extra" ${scopeAttribute}/>
        </modifiers>
      </selectionEntry>
    </selectionEntries>`);

  it('meldet einen abweichenden Scope, statt den Modifikator still am Traeger wirken zu lassen', () => {
    const catalogue = parseCatalogue(modifierXml('scope="unit"'));

    expect(diagnosticsOfKind(catalogue, DiagnosticKind.UNSUPPORTED_MODIFIER_SCOPE)).toEqual([
      expect.objectContaining({
        type: 'add',
        field: 'category',
        value: 'cat-extra',
        scope: 'unit',
        carrierId: UNIT_ID,
        carrierName: 'Mark of Slaanesh',
      }),
    ]);
  });

  it('traegt den rohen Scope in den aufbereiteten Datensatz, statt ihn zu verwerfen', () => {
    const catalogue = parseCatalogue(modifierXml('scope="unit"'));

    expect(catalogue.entries[0].modifiers[0].scope).toBe('unit');
  });

  it('KONTROLLE: ohne scope-Attribut wirkt der Modifikator wie bisher am Traeger, ohne Diagnose', () => {
    const catalogue = parseCatalogue(modifierXml(''));

    expect(catalogue.entries[0].modifiers[0].scope).toBeNull();
    expect(diagnosticsOfKind(catalogue, DiagnosticKind.UNSUPPORTED_MODIFIER_SCOPE)).toEqual([]);
  });
});
