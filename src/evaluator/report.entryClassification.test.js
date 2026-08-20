/**
 * Issue 0156 — die **statischen Eintragsmerkmale** stehen im Bericht:
 * `isListRule`, `isMandatoryListRule`, `isIndependentSubUnit` und die
 * Herkunfts-Entscheidung `isForeignCatalogue`. Vorher beantwortete jede
 * Oberfläche sie selbst am Katalog (`listRules.js`, `subUnit.js`,
 * `foreignCatalogueIdsOf`); jetzt liest sie sie ab (ADR-0034).
 *
 * Aufbau wie `report.groupBehavior.test.js`: minimale synthetische Fixture, die
 * zweistufige Fassade (`prepareDataset` + `evaluate`), dieselbe
 * Slot-Lookup-Konvention.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { prepareDataset, evaluate } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-classification';
const COST_TYPE_ID = 'cost-pts';
const FORCE_DEF_ID = 'force-classification';

const OWN_CATALOGUE_ID = 'cat-own';
const ALLIED_CATALOGUE_ID = 'cat-ally';
const LIBRARY_CATALOGUE_ID = 'cat-lib';

const CHARIOT_ID = 'entry-chariot';
const CREW_ID = 'entry-crew';
const CREW_OPTION_ID = 'entry-crew-option';
const COLLECTIVE_CREW_ID = 'entry-crew-collective';
const WHEELS_ID = 'entry-wheels';
const EXPERIMENTAL_RULES_ID = 'entry-experimental';
const OATH_ID = 'entry-oath';
const CAMPAIGN_ID = 'entry-campaign';
const ALLIED_UNIT_ID = 'entry-allied-unit';
const LIBRARY_UNIT_ID = 'entry-library-unit';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Classification System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
    <forceEntries><forceEntry id="${FORCE_DEF_ID}" name="Main Force"/></forceEntries>
  </gameSystem>`;

const OWN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${OWN_CATALOGUE_ID}" name="Own Book" gameSystemId="${GAME_SYSTEM_ID}" library="false">
    <!-- Since issue 0159 a library is only reached through an explicit
         catalogueLink, and its ROOT entry is only offered with
         importRootEntries="true". Without the link the library unit below
         never becomes a slot, so the origin decision could not be observed. -->
    <catalogueLinks>
      <catalogueLink id="cl-own-to-library" name="Mercenaries" type="catalogue"
                     targetId="${LIBRARY_CATALOGUE_ID}" importRootEntries="true"/>
    </catalogueLinks>
    <selectionEntries>
      <selectionEntry id="${CHARIOT_ID}" name="Chariot" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="50"/></costs>
        <selectionEntries>
          <!-- Eigenstaendige Untereinheit: type=model, nicht kollektiv, mit
               eigenen Auswahlmoeglichkeiten. -->
          <selectionEntry id="${CREW_ID}" name="Crew" type="model">
            <selectionEntries>
              <selectionEntry id="${CREW_OPTION_ID}" name="Spear" type="upgrade"/>
            </selectionEntries>
          </selectionEntry>
          <!-- Kollektiv gefuehrt: dieselbe Gestalt, aber keine eigene Karte. -->
          <selectionEntry id="${COLLECTIVE_CREW_ID}" name="Beast Handlers" type="model" collective="true">
            <selectionEntries>
              <selectionEntry id="entry-handler-option" name="Whip" type="upgrade"/>
            </selectionEntries>
          </selectionEntry>
          <!-- Ohne eigene Auswahlmoeglichkeiten: eine blosse Option. -->
          <selectionEntry id="${WHEELS_ID}" name="Scythed Wheels" type="upgrade"/>
        </selectionEntries>
      </selectionEntry>

      <!-- Listenregeln auf Wurzelebene: reine Einstellungen, kein Kampffeld. -->
      <selectionEntry id="${EXPERIMENTAL_RULES_ID}" name="Allow experimental rules?" type="upgrade"/>
      <!-- Eindeutige Pflicht-Listenregel (§9.9): eigener min-Constraint mit
           ausgeschriebenem Bezugsrahmen, ohne eigene Unterauswahlen. -->
      <selectionEntry id="${OATH_ID}" name="Oath of Fealty" type="upgrade">
        <constraints>
          <constraint id="con-oath-min" type="min" field="selections" scope="force" value="1"/>
        </constraints>
      </selectionEntry>
      <!-- Gleiche Bauart, aber der min-Constraint meint die eigene
           Instanzgrenze (scope="parent") — keine armeeweite Pflicht. -->
      <selectionEntry id="${CAMPAIGN_ID}" name="Campaign rules" type="upgrade">
        <constraints>
          <constraint id="con-campaign-min" type="min" field="selections" scope="parent" value="1"/>
        </constraints>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const ALLIED_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${ALLIED_CATALOGUE_ID}" name="Allied Book" gameSystemId="${GAME_SYSTEM_ID}" library="false">
    <selectionEntries>
      <selectionEntry id="${ALLIED_UNIT_ID}" name="Gorger" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="60"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const LIBRARY_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${LIBRARY_CATALOGUE_ID}" name="Mercenaries" gameSystemId="${GAME_SYSTEM_ID}" library="true">
    <selectionEntries>
      <selectionEntry id="${LIBRARY_UNIT_ID}" name="Mercenary Captain" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="40"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Der Bericht eines Rosters, dessen eines Kontingent dem eigenen Buch gehoert. */
function report() {
  const prepared = prepareDataset({
    gameSystem: GAME_SYSTEM_XML,
    catalogues: [OWN_CATALOGUE_XML, ALLIED_CATALOGUE_XML, LIBRARY_CATALOGUE_XML],
  });
  return evaluate(prepared, {
    forces: [{
      defId: FORCE_DEF_ID,
      count: 1,
      catalogueId: OWN_CATALOGUE_ID,
      children: [{
        defId: CHARIOT_ID,
        count: 1,
        children: [
          { defId: CREW_ID, count: 1, children: [] },
          { defId: COLLECTIVE_CREW_ID, count: 1, children: [] },
          { defId: WHEELS_ID, count: 1, children: [] },
        ],
      }],
    }],
  });
}

/** Der Faehigkeitsdatensatz eines Slots per Definitions-Id (erster Treffer). */
function slotOf(built, defId) {
  for (const capability of built.capabilities.values()) {
    if (capability.defId === defId) return capability;
  }
  return undefined;
}

describe('SlotCapability: Listenregel-Merkmale (Issue 0156)', () => {
  it('ein upgrade-Eintrag ist eine Listenregel, eine Einheit nicht', () => {
    const built = report();

    expect(slotOf(built, EXPERIMENTAL_RULES_ID)).toMatchObject({ isListRule: true });
    expect(slotOf(built, CHARIOT_ID)).toMatchObject({ isListRule: false });
    expect(slotOf(built, CREW_ID)).toMatchObject({ isListRule: false });
  });

  it('ein eigener min-Constraint mit Bezugsrahmen force macht die Regel zur eindeutigen Pflicht', () => {
    const built = report();

    expect(slotOf(built, OATH_ID)).toMatchObject({ isListRule: true, isMandatoryListRule: true });
  });

  it('ein min-Constraint auf die eigene Instanzgrenze ist keine armeeweite Pflicht', () => {
    const built = report();

    expect(slotOf(built, CAMPAIGN_ID)).toMatchObject({ isListRule: true, isMandatoryListRule: false });
  });

  it('eine Regel ohne min-Constraint ist keine Pflicht', () => {
    const built = report();

    expect(slotOf(built, EXPERIMENTAL_RULES_ID).isMandatoryListRule).toBe(false);
  });
});

describe('SlotCapability: eigenstaendige Untereinheit (Issue 0156)', () => {
  it('ein nicht kollektives model mit eigenen Auswahlmoeglichkeiten ist eine eigenstaendige Untereinheit', () => {
    const built = report();

    expect(slotOf(built, CREW_ID)).toMatchObject({ isIndependentSubUnit: true });
  });

  it('ein kollektiv gefuehrter Eintrag ist keine — und eine Option ohne Kinder ebenfalls nicht', () => {
    const built = report();

    expect(slotOf(built, COLLECTIVE_CREW_ID)).toMatchObject({ isIndependentSubUnit: false });
    expect(slotOf(built, WHEELS_ID)).toMatchObject({ isIndependentSubUnit: false });
  });

  it('die Einheit selbst meldet das Merkmal, ohne dass es sie zur Untereinheit machte', () => {
    const built = report();

    // Der Traeger erfuellt dieselben Merkmale — die Frage stellt sich nur an
    // seinen Kindern, und genau deshalb steht die Antwort an jedem Slot.
    expect(typeof slotOf(built, CHARIOT_ID).isIndependentSubUnit).toBe('boolean');
  });
});

describe('SlotCapability: fremdes Armeebuch (Issue 0156)', () => {
  it('das Buch eines anderen Kontingents faellt hier gar nicht erst als Slot an', () => {
    const built = report();

    // Der Katalog-Bezugsrahmen (Issue 0140) haelt das fremde Buch schon aus dem
    // Baum heraus; die Herkunfts-Entscheidung im Bericht ist die zweite Linie
    // fuer die Faelle, in denen ein Wurzel-Angebot doch aus einem anderen Buch
    // gewinnt (ADR-0032, geteiltes Ziel). Sie ist deshalb hier `false`, wo sie
    // ueberhaupt eine Antwort gibt — und der Slot fehlt, wo er nicht angeboten
    // wird.
    expect(slotOf(built, ALLIED_UNIT_ID)).toBeUndefined();
  });

  it('das eigene Buch und eine Bibliothek sind nie fremd', () => {
    const built = report();

    expect(slotOf(built, CHARIOT_ID)).toMatchObject({
      sourceId: OWN_CATALOGUE_ID, isForeignCatalogue: false,
    });
    expect(slotOf(built, LIBRARY_UNIT_ID)).toMatchObject({
      sourceId: LIBRARY_CATALOGUE_ID, isForeignCatalogue: false,
    });
  });
});
