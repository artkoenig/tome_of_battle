/**
 * Issue 0102, Punkt 1: `publications` / `publicationId` / `page` werden gelesen
 * und getragen — bis in die Info-Projektion des Berichts.
 *
 * Vertrag (Issue-Plan, 2026-07-29):
 * - `parseCatalogue(xml)` liefert ein Feld `publications: Array<{ id, name }>`
 *   (leer, wenn keine deklariert).
 * - Jede ueber die gemeinsame EntryBase-Lesung gelesene Entitaet (selectionEntry,
 *   profile, rule, …) traegt `publicationId` und `page` (`null`, wenn nicht
 *   gesetzt). `page` ist laut vendored XSD `xs:string` (Catalogue.xsd:45) — der
 *   rohe Attributtext.
 * - `mergeCatalogues` konkateniert `publications` ueber alle Dokumente.
 * - Bericht: Profil-/Regel-Eintraege der Info-Projektion tragen
 *   `publication: { id, name, page } | null` — `name` aus der Deklaration
 *   aufgeloest (`null`, wenn die Id dort nicht deklariert ist), `page` vom
 *   Element; `null`, wenn das Element keine `publicationId` traegt.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';
import { mergeCatalogues } from './catalogSet.js';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind, InfoElementKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const PUB_ID = 'pub-brb-0001';
const PUB_NAME = 'BRB';
const SECOND_PUB_ID = 'pub-rh-0002';
const SECOND_PUB_NAME = 'Ravening Hordes';
const UNDECLARED_PUB_ID = 'pub-nirgends-deklariert';
const ENTRY_ID = 'entry-warrior';
const PROFILE_ID = 'profile-warrior';
const RULE_ID = 'rule-fear';
const PAGE = '42';

/** Ein Katalog mit den gegebenen Wurzel-Kindern. */
function catalogueXml(rootChildren) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-pub" name="Publications Catalogue">
      ${rootChildren}
    </catalogue>`;
}

/** Roster: eine einzelne Einheit der gegebenen Definitions-ID. */
function rosterOf(defId) {
  return { forces: [{ defId, count: 1, children: [] }] };
}

/** Der Faehigkeitsdatensatz des belegten Slots mit dieser Definitions-ID. */
function occupiedSlot(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId && capability.anchorKind === AnchorKind.OCCUPIED) return capability;
  }
  return null;
}

// ── Deklarationsliste der Wurzel ─────────────────────────────────────────────

describe('parseCatalogue: <publications> der Wurzel', () => {
  it('liest jede Deklaration als { id, name } in ein Feld publications', () => {
    const xml = catalogueXml(`
      <publications>
        <publication id="${PUB_ID}" name="${PUB_NAME}"/>
        <publication id="${SECOND_PUB_ID}" name="${SECOND_PUB_NAME}"/>
      </publications>`);

    expect(parseCatalogue(xml).publications).toEqual([
      { id: PUB_ID, name: PUB_NAME },
      { id: SECOND_PUB_ID, name: SECOND_PUB_NAME },
    ]);
  });

  it('liefert ohne <publications> eine leere Liste', () => {
    expect(parseCatalogue(catalogueXml('')).publications).toEqual([]);
  });
});

// ── publicationId/page an den gelesenen Entitaeten (EntryBase) ───────────────

describe('parseCatalogue: publicationId und page an gelesenen Entitaeten', () => {
  const XML = catalogueXml(`
    <selectionEntries>
      <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit"
                      publicationId="${PUB_ID}" page="${PAGE}">
        <profiles>
          <profile id="${PROFILE_ID}" name="Warrior" typeId="pt-unit"
                   publicationId="${PUB_ID}" page="${PAGE}"/>
        </profiles>
        <rules>
          <rule id="${RULE_ID}" name="Fear" publicationId="${SECOND_PUB_ID}"/>
        </rules>
      </selectionEntry>
    </selectionEntries>`);

  it('traegt beide Angaben an einem selectionEntry', () => {
    const entry = parseCatalogue(XML).entries.find(def => def.id === ENTRY_ID);

    expect(entry.publicationId).toBe(PUB_ID);
    expect(entry.page).toBe(PAGE);
  });

  it('traegt beide Angaben an einem profile', () => {
    const entry = parseCatalogue(XML).entries.find(def => def.id === ENTRY_ID);
    const profile = entry.infos.find(info => info.id === PROFILE_ID);

    expect(profile.publicationId).toBe(PUB_ID);
    expect(profile.page).toBe(PAGE);
  });

  it('traegt publicationId an einer rule; die nicht gesetzte page ist null', () => {
    const entry = parseCatalogue(XML).entries.find(def => def.id === ENTRY_ID);
    const rule = entry.infos.find(info => info.id === RULE_ID);

    expect(rule.publicationId).toBe(SECOND_PUB_ID);
    expect(rule.page).toBeNull();
  });

  it('liest nicht gesetzte Attribute als null (nie undefined)', () => {
    const xml = catalogueXml(`
      <selectionEntries>
        <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit"/>
      </selectionEntries>`);
    const entry = parseCatalogue(xml).entries.find(def => def.id === ENTRY_ID);

    expect(entry.publicationId).toBeNull();
    expect(entry.page).toBeNull();
  });
});

// ── Merge ────────────────────────────────────────────────────────────────────

describe('mergeCatalogues: publications werden dokumentweise konkateniert', () => {
  it('konkateniert die Deklarationen in der uebergebenen Reihenfolge', () => {
    const merged = mergeCatalogues([
      { publications: [{ id: PUB_ID, name: PUB_NAME }] },
      { publications: [{ id: SECOND_PUB_ID, name: SECOND_PUB_NAME }] },
    ]);

    expect(merged.publications).toEqual([
      { id: PUB_ID, name: PUB_NAME },
      { id: SECOND_PUB_ID, name: SECOND_PUB_NAME },
    ]);
  });

  it('fuellt ein Dokument ohne publications mit einer leeren Liste', () => {
    expect(mergeCatalogues([{}]).publications).toEqual([]);
  });
});

// ── Bericht: Buchquelle an den Info-Eintraegen der Projektion ────────────────

describe('Bericht: publication an den Profil-/Regel-Eintraegen der Info-Projektion', () => {
  /** Katalog: die Publikation ist im selben Dokument deklariert. */
  function catalogueWithInfoSources({ profileAttrs = '', ruleAttrs = '' }) {
    return catalogueXml(`
      <publications>
        <publication id="${PUB_ID}" name="${PUB_NAME}"/>
      </publications>
      <selectionEntries>
        <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
          <profiles>
            <profile id="${PROFILE_ID}" name="Warrior" typeId="pt-unit" ${profileAttrs}/>
          </profiles>
          <rules>
            <rule id="${RULE_ID}" name="Fear" ${ruleAttrs}><description>Text.</description></rule>
          </rules>
        </selectionEntry>
      </selectionEntries>`);
  }

  /** Das Info-Element gegebener Vorkommens-ID am Slot der Einheit. */
  function infoElementOf(catalogXml, infoId) {
    const report = evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), rosterOf(ENTRY_ID));
    return occupiedSlot(report, ENTRY_ID).infoElements.find(info => info.id === infoId);
  }

  it('loest die Buchquelle eines Profils auf: id und name aus der Deklaration, page vom Element', () => {
    const xml = catalogueWithInfoSources({ profileAttrs: `publicationId="${PUB_ID}" page="${PAGE}"` });

    expect(infoElementOf(xml, PROFILE_ID).publication).toEqual({
      id: PUB_ID,
      name: PUB_NAME,
      page: PAGE,
    });
  });

  it('loest die Buchquelle einer Regel auf; ohne page-Attribut ist page null', () => {
    const xml = catalogueWithInfoSources({ ruleAttrs: `publicationId="${PUB_ID}"` });

    expect(infoElementOf(xml, RULE_ID).publication).toEqual({
      id: PUB_ID,
      name: PUB_NAME,
      page: null,
    });
  });

  it('traegt publication: null an einem Element ohne publicationId', () => {
    const xml = catalogueWithInfoSources({});
    const profile = infoElementOf(xml, PROFILE_ID);

    expect(profile.kind).toBe(InfoElementKind.PROFILE);
    expect(profile.publication).toBeNull();
  });

  it('nennt eine nirgends deklarierte publicationId ehrlich mit name: null', () => {
    const xml = catalogueWithInfoSources({
      profileAttrs: `publicationId="${UNDECLARED_PUB_ID}" page="${PAGE}"`,
    });

    expect(infoElementOf(xml, PROFILE_ID).publication).toEqual({
      id: UNDECLARED_PUB_ID,
      name: null,
      page: PAGE,
    });
  });

  it('loest eine im Spielsystem deklarierte Publikation fuer ein Katalog-Element auf (Merge)', () => {
    const gameSystem = `<?xml version="1.0" encoding="utf-8"?>
      <gameSystem id="gs-pub" name="Pub Game System">
        <publications>
          <publication id="${PUB_ID}" name="${PUB_NAME}"/>
        </publications>
      </gameSystem>`;
    const catalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-pub" name="Publications Catalogue" gameSystemId="gs-pub">
        <selectionEntries>
          <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
            <rules>
              <rule id="${RULE_ID}" name="Fear" publicationId="${PUB_ID}" page="${PAGE}"><description>Text.</description></rule>
            </rules>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
    const report = evaluateDataset(
      prepareDataset({ gameSystem, catalogues: [catalogue] }),
      rosterOf(ENTRY_ID),
    );
    const rule = occupiedSlot(report, ENTRY_ID).infoElements.find(info => info.id === RULE_ID);

    expect(rule.publication).toEqual({ id: PUB_ID, name: PUB_NAME, page: PAGE });
  });
});
