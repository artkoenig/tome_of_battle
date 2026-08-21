/**
 * Issue 0121, Task 13a (Kriterium 5) — der Faehigkeitsdatensatz nennt die
 * **Herkunft** eines Slots.
 *
 * Der Aushebe-Dialog darf nur Einheiten des aktiven Katalogs anbieten. Woher ein
 * Angebot stammt, steht heute in keinem Feld des Berichts, weshalb die
 * Oberflaeche es nicht wissen kann (ADR-0034: sie liest den Bericht und nichts
 * dahinter). Neu deshalb: `SlotCapability.sourceId` — die `id` des Dokuments
 * (`.gst` oder `.cat`), das die **Definition dieses Slots** deklariert; `null`,
 * wenn unbekannt.
 *
 * Vorbild und Analogie: `creatableForces[].sourceId` der Datensatz-Beschreibung
 * (`datasetDescription.js`) und `buildPrimaryCatalogueIndex` (`catalogSet.js`) —
 * dieselbe Regel „erstes Vorkommen einer Id gewinnt", dieselbe deterministische
 * Dokumentreihenfolge (Spielsystem zuerst, dann die Kataloge in
 * Aufruf-Reihenfolge, ADR-0032).
 *
 * **Link-Id-Regel:** bei einem Verweis-Slot gilt das Dokument, das den
 * **Verweis** deklariert (die `defId`), nicht das seines Ziels. Ein `entryLink`
 * in `Vampire Counts.cat` ist ein Vampire-Counts-Angebot, auch wenn sein Ziel in
 * einem anderen Katalog steht.
 *
 * Aufbau: eigene minimale Fixtures und die zweistufige Fassade wie in
 * `report.test.js` / `evaluator.describeDataset.test.js`; ein Datensatz aus
 * `.gst` + drei `.cat` (eigener, fremder, Bibliothek).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { prepareDataset, evaluate } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-main';
const COST_TYPE_ID = 'cost-pts';
const CATEGORY_ID = 'cat-special';
const FORCE_DEF_ID = 'force-main';

const OWN_CATALOGUE_ID = 'cat-own';
const FOREIGN_CATALOGUE_ID = 'cat-foreign';
const LIBRARY_CATALOGUE_ID = 'cat-lib';

const GST_SHARED_ENTRY_ID = 'shared-gst-banner';
const OWN_ENTRY_ID = 'entry-own';
const FOREIGN_ENTRY_ID = 'entry-foreign';
const LIBRARY_ENTRY_ID = 'entry-lib';
const FOREIGN_SHARED_ENTRY_ID = 'shared-foreign-ogre';
const OWN_LINK_ID = 'link-own-to-foreign';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
    <categoryEntries><categoryEntry id="${CATEGORY_ID}" name="Special"/></categoryEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${GST_SHARED_ENTRY_ID}" name="Grand Banner" type="upgrade">
        <categoryLinks><categoryLink id="gl-b" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="7"/></costs>
      </selectionEntry>
    </sharedSelectionEntries>
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force">
        <categoryLinks><categoryLink id="cl-special" name="Special" targetId="${CATEGORY_ID}" primary="false"/></categoryLinks>
      </forceEntry>
    </forceEntries>
  </gameSystem>`;

/** Das eigene Armeebuch: ein Wurzel-Eintrag und ein Verweis in den fremden Katalog. */
const OWN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${OWN_CATALOGUE_ID}" name="Vampire Counts" gameSystemId="${GAME_SYSTEM_ID}">
    <selectionEntries>
      <selectionEntry id="${OWN_ENTRY_ID}" name="Vampire" type="unit">
        <categoryLinks><categoryLink id="ol-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="30"/></costs>
      </selectionEntry>
    </selectionEntries>
    <entryLinks>
      <entryLink id="${OWN_LINK_ID}" name="Hired Ogre" targetId="${FOREIGN_SHARED_ENTRY_ID}" type="selectionEntry">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="55"/></costs>
      </entryLink>
    </entryLinks>
  </catalogue>`;

/** Ein fremdes Armeebuch: eigener Wurzel-Eintrag plus das Ziel des fremden Verweises. */
const FOREIGN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${FOREIGN_CATALOGUE_ID}" name="Ogre Kingdoms" gameSystemId="${GAME_SYSTEM_ID}">
    <sharedSelectionEntries>
      <selectionEntry id="${FOREIGN_SHARED_ENTRY_ID}" name="Ogre Bull" type="unit">
        <categoryLinks><categoryLink id="fs-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="45"/></costs>
      </selectionEntry>
    </sharedSelectionEntries>
    <selectionEntries>
      <selectionEntry id="${FOREIGN_ENTRY_ID}" name="Gorger" type="unit">
        <categoryLinks><categoryLink id="fl-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="40"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const LIBRARY_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${LIBRARY_CATALOGUE_ID}" name="Mercenaries" gameSystemId="${GAME_SYSTEM_ID}" library="true">
    <selectionEntries>
      <selectionEntry id="${LIBRARY_ENTRY_ID}" name="Mercenary Captain" type="unit">
        <categoryLinks><categoryLink id="ll-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="20"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/**
 * Der Bericht des Datensatzes zu einem Roster, das das Kontingent anlegt und den
 * geteilten Eintrag der `.gst` sowie den eigenen Wurzel-Eintrag belegt. Alles
 * uebrige haengt als Angebots-Anker darunter.
 */
function report({
  catalogues = [OWN_CATALOGUE_XML, FOREIGN_CATALOGUE_XML, LIBRARY_CATALOGUE_XML],
  children = [
    { defId: GST_SHARED_ENTRY_ID, count: 1, children: [] },
    { defId: OWN_ENTRY_ID, count: 1, children: [] },
  ],
} = {}) {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues });
  return evaluate(prepared, {
    forces: [{ defId: FORCE_DEF_ID, count: 1, children }],
    costLimits: [{ costTypeId: COST_TYPE_ID, value: 2000 }],
  });
}

/** Der Faehigkeitsdatensatz des Slots dieser Definition (der erste im Bericht). */
function slotOf(built, defId) {
  for (const capability of built.capabilities.values()) {
    if (capability.defId === defId) return capability;
  }
  return undefined;
}

describe('SlotCapability.sourceId: die Herkunft eines Slots (Issue 0121, Task 13, Kriterium 5)', () => {
  it('ein belegter Slot nennt den Katalog, der seine Definition deklariert', () => {
    const built = report();

    expect(slotOf(built, OWN_ENTRY_ID)).toMatchObject({
      anchorKind: 'occupied',
      sourceId: OWN_CATALOGUE_ID,
    });
  });

  it('ein belegter Slot eines geteilten Eintrags der .gst nennt die Id des Spielsystems', () => {
    const built = report();

    expect(slotOf(built, GST_SHARED_ENTRY_ID)).toMatchObject({
      anchorKind: 'occupied',
      sourceId: GAME_SYSTEM_ID,
    });
  });

  it('ein Angebots-Anker nennt seine Herkunft genau wie ein belegter Slot', () => {
    const built = report();

    expect(slotOf(built, FOREIGN_ENTRY_ID)).toMatchObject({
      anchorKind: 'offerAnchor',
      sourceId: FOREIGN_CATALOGUE_ID,
    });
    expect(slotOf(built, LIBRARY_ENTRY_ID)).toMatchObject({
      anchorKind: 'offerAnchor',
      sourceId: LIBRARY_CATALOGUE_ID,
    });
  });

  it('je Herkunft ein eigener Slot: die drei Kataloge und das Spielsystem bleiben unterscheidbar', () => {
    const built = report();

    expect({
      gameSystemShared: slotOf(built, GST_SHARED_ENTRY_ID).sourceId,
      own: slotOf(built, OWN_ENTRY_ID).sourceId,
      foreign: slotOf(built, FOREIGN_ENTRY_ID).sourceId,
      library: slotOf(built, LIBRARY_ENTRY_ID).sourceId,
    }).toEqual({
      gameSystemShared: GAME_SYSTEM_ID,
      own: OWN_CATALOGUE_ID,
      foreign: FOREIGN_CATALOGUE_ID,
      library: LIBRARY_CATALOGUE_ID,
    });
  });

  it('Link-Id-Regel: ein Verweis-Slot nennt das Dokument des VERWEISES, nicht das seines Ziels', () => {
    const built = report();

    const linkSlot = slotOf(built, OWN_LINK_ID);
    // Der Verweis steht im eigenen Katalog, sein Ziel im fremden.
    expect(linkSlot.targetDefId).toBe(FOREIGN_SHARED_ENTRY_ID);
    expect(linkSlot.sourceId).toBe(OWN_CATALOGUE_ID);
  });

  it('ein Kontingent-Slot der .gst nennt die Id des Spielsystems', () => {
    const built = report();

    expect(slotOf(built, FORCE_DEF_ID)).toMatchObject({ sourceId: GAME_SYSTEM_ID });
  });

  it('erstes Vorkommen einer Id gewinnt: dieselbe Definitions-Id in zwei Katalogen nennt den ersten', () => {
    const DUPLICATE_ID = 'entry-duplicate';
    const duplicateIn = (catalogueId, name) => `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="${catalogueId}" name="${catalogueId}" gameSystemId="${GAME_SYSTEM_ID}">
        <selectionEntries>
          <selectionEntry id="${DUPLICATE_ID}" name="${name}" type="unit">
            <categoryLinks><categoryLink id="dl-${catalogueId}" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
    const built = report({
      catalogues: [duplicateIn('cat-first', 'Erster'), duplicateIn('cat-second', 'Zweiter')],
      children: [],
    });
    // Vorbedingung: die Kollision ist als Diagnose sichtbar (ADR-0032).
    expect(built.diagnostics.some((entry) => entry.kind === 'duplicateDefinition')).toBe(true);

    expect(slotOf(built, DUPLICATE_ID)).toMatchObject({ sourceId: 'cat-first' });
  });

  it('ein Dokument ohne eigene Id laesst die Herkunft unbekannt: sourceId ist null', () => {
    const ANONYMOUS_ENTRY_ID = 'entry-anonymous';
    const CATALOGUE_WITHOUT_ID = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue name="Namenlos" gameSystemId="${GAME_SYSTEM_ID}">
        <selectionEntries>
          <selectionEntry id="${ANONYMOUS_ENTRY_ID}" name="Wandering Minstrel" type="unit">
            <categoryLinks><categoryLink id="an-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
    const built = report({ catalogues: [CATALOGUE_WITHOUT_ID], children: [] });

    expect(slotOf(built, ANONYMOUS_ENTRY_ID)).toMatchObject({ sourceId: null });
  });
});
