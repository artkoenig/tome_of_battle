/**
 * Issue 0156 — das **Wahlverhalten** einer Options-Gruppe steht im Bericht:
 * `isSingleChoice`/`isMaxRaisable` am Gruppen-Anker, `isRepeatableWithinGroup`
 * am Options-Slot. Vorher rechnete die Oberfläche diese drei Antworten selbst
 * an den Katalogdaten nach (`OptionGroup.jsx` über die Helfer des
 * Schreibmodells); jetzt liest sie sie ab (ADR-0034).
 *
 * Aufbau wie `report.sortIndex.test.js`: eine minimale synthetische Fixture,
 * die zweistufige Fassade (`prepareDataset` + `evaluate`) und dieselbe
 * Slot-Lookup-Konvention (`slotOf`).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { prepareDataset, evaluate } from '../../../domain/evaluator/evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-behaviour';
const COST_TYPE_ID = 'cost-pts';
const FORCE_DEF_ID = 'force-behaviour';
const HERO_ID = 'entry-hero';

const ARMOUR_GROUP_ID = 'grp-armour';
const SHIELD_ID = 'opt-shield';
const PLATE_ID = 'opt-plate';
const WEAPON_GROUP_ID = 'grp-weapons';
const SWORD_ID = 'opt-sword';
const ARCANE_GROUP_ID = 'grp-arcane';
const SCROLL_ID = 'opt-scroll';
const WAND_ID = 'opt-wand';
const OPEN_GROUP_ID = 'grp-open';
const BANNER_ID = 'opt-banner';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Behaviour System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
  </gameSystem>`;

const upgrade = (id, name) =>
  `<selectionEntry id="${id}" name="${name}" type="upgrade">
     <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
   </selectionEntry>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-behaviour" name="Behaviour Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries><forceEntry id="${FORCE_DEF_ID}" name="Main Force"/></forceEntries>
    <selectionEntries>
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="50"/></costs>
        <selectionEntryGroups>
          <!-- Rüstung+Schild (ADR-0029): max=1, aber ein an das Schild
               gekoppelter increment kann dieses Max über 1 heben. -->
          <selectionEntryGroup id="${ARMOUR_GROUP_ID}" name="Armour">
            <constraints>
              <constraint id="con-armour-max" type="max" field="selections" scope="parent" value="1"/>
            </constraints>
            <modifiers>
              <modifier type="increment" field="con-armour-max" value="1">
                <conditions>
                  <condition type="greaterThan" field="selections" scope="parent" childId="${SHIELD_ID}" value="0" shared="true"/>
                </conditions>
              </modifier>
            </modifiers>
            <selectionEntries>${upgrade(PLATE_ID, 'Plate')}${upgrade(SHIELD_ID, 'Shield')}</selectionEntries>
          </selectionEntryGroup>

          <!-- Echte Einzelwahl: max=1 ohne hebenden Modifikator. -->
          <selectionEntryGroup id="${WEAPON_GROUP_ID}" name="Weapons">
            <constraints>
              <constraint id="con-weapons-max" type="max" field="selections" scope="parent" value="1"/>
            </constraints>
            <selectionEntries>${upgrade(SWORD_ID, 'Sword')}</selectionEntries>
          </selectionEntryGroup>

          <!-- §9.7: increment MIT <repeat> auf genau eine Option hebt die Kappe
               je gewähltem Exemplar — diese Option ist wiederholbar, die Gruppe
               bleibt Einzelwahl. -->
          <selectionEntryGroup id="${ARCANE_GROUP_ID}" name="Arcane Items">
            <constraints>
              <constraint id="con-arcane-max" type="max" field="selections" scope="parent" value="1"/>
            </constraints>
            <modifiers>
              <modifier type="increment" field="con-arcane-max" value="1">
                <repeats>
                  <repeat field="selections" scope="parent" childId="${SCROLL_ID}" value="1" repeats="1" shared="true"/>
                </repeats>
              </modifier>
            </modifiers>
            <selectionEntries>${upgrade(SCROLL_ID, 'Scroll')}${upgrade(WAND_ID, 'Wand')}</selectionEntries>
          </selectionEntryGroup>

          <!-- Ohne Max-Grenze ist die Gruppe Mehrfachauswahl; der Anker
               entsteht hier über den deskriptiven sortIndex (Issue 0133). -->
          <selectionEntryGroup id="${OPEN_GROUP_ID}" name="Open" sortIndex="1">
            <selectionEntries>${upgrade(BANNER_ID, 'Banner')}</selectionEntries>
          </selectionEntryGroup>
        </selectionEntryGroups>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Der Bericht eines leeren Hero-Rosters — alles Übrige hängt als Angebots-Anker darunter. */
function report() {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  return evaluate(prepared, {
    forces: [{ defId: FORCE_DEF_ID, count: 1, children: [
      { defId: HERO_ID, count: 1, children: [] },
    ] }],
  });
}

/** Der Fähigkeitsdatensatz eines Slots per Definitions-Id (der erste Treffer im Bericht). */
function slotOf(built, defId) {
  for (const capability of built.capabilities.values()) {
    if (capability.defId === defId) return capability;
  }
  return undefined;
}

describe('SlotCapability: Wahlverhalten der Options-Gruppe (Issue 0156)', () => {
  it('eine auf max=1 gedeckelte Gruppe ohne hebenden Modifikator ist echte Einzelwahl', () => {
    const built = report();

    expect(slotOf(built, WEAPON_GROUP_ID)).toMatchObject({
      anchorKind: 'groupAnchor', effectiveMax: 1, isSingleChoice: true, isMaxRaisable: false,
    });
  });

  it('eine max-hebbare Gruppe ist trotz effektivem Max 1 keine Einzelwahl (Rüstung+Schild, ADR-0029)', () => {
    const built = report();

    // Kein Schild gewählt: das effektive Max steht auf 1 — genau der Teufelskreis,
    // den die statische Hebbarkeit auflöst.
    expect(slotOf(built, ARMOUR_GROUP_ID)).toMatchObject({
      anchorKind: 'groupAnchor', effectiveMax: 1, isMaxRaisable: true, isSingleChoice: false,
    });
  });

  it('eine Gruppe ohne Max-Grenze ist Mehrfachauswahl', () => {
    const built = report();

    expect(slotOf(built, OPEN_GROUP_ID)).toMatchObject({
      anchorKind: 'groupAnchor', effectiveMax: null, isSingleChoice: false, isMaxRaisable: false,
    });
  });

  it('increment+<repeat> kennzeichnet die benannte Option als wiederholbar, ihre Geschwister nicht', () => {
    const built = report();

    expect(slotOf(built, SCROLL_ID)).toMatchObject({ isRepeatableWithinGroup: true });
    expect(slotOf(built, WAND_ID)).toMatchObject({ isRepeatableWithinGroup: false });
    // Und die Gruppe selbst bleibt Einzelwahl: das Muster hebt die Kappe je
    // Kopie desselben Gegenstands, es öffnet die Gruppe nicht.
    expect(slotOf(built, ARCANE_GROUP_ID)).toMatchObject({ isSingleChoice: true, isMaxRaisable: false });
  });

  it('ein Options-Slot ohne wiederholende Gruppe meldet false, kein undefined', () => {
    const built = report();

    expect(slotOf(built, SWORD_ID).isRepeatableWithinGroup).toBe(false);
    expect(slotOf(built, PLATE_ID).isRepeatableWithinGroup).toBe(false);
  });
});
