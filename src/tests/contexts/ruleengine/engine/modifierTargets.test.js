import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';
import { DiagnosticKind, MessageSeverity } from '../../../../contexts/ruleengine/engine/model.js';

/**
 * Die drei Modifikator-Ziele, die die Engine bis Issue 75/04 nicht kannte:
 * **Merkmalswert**, **Anzeigename** und **Autor-Meldung**. Geprueft wird am
 * Bericht der Fassade — der einzigen Aussenschnittstelle —, weil genau dort die
 * Wirkung ankommen muss (ADR-0034).
 *
 * Die Katalog-Ausschnitte sind synthetisch, aber der Form der echten Daten
 * nachgebildet: ein Merkmals-Modifikator haengt dort **immer** an einem Profil
 * oder an einem Info-Verweis, nie an der Auswahl-Definition selbst.
 */

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gst-targets';
const PROFILE_TYPE_ID = 'profiletype-troop';
const STRENGTH_TYPE_ID = 'chartype-strength';
const TOUGHNESS_TYPE_ID = 'chartype-toughness';

const WARRIOR_ID = 'entry-warrior';
const WARRIOR_NAME = 'Warrior';
const BANNER_ID = 'entry-banner';
const BANNER_NAME = 'Banner';
const WARRIOR_PROFILE_ID = 'profile-warrior';
const SHARED_PROFILE_ID = 'profile-shared-steed';
const STEED_LINK_ID = 'infolink-steed';

/** Das Spielsystem, das die Charakteristik-Typen deklariert (die Ziel-IDs). */
const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Targets System">
    <profileTypes>
      <profileType id="${PROFILE_TYPE_ID}" name="Troop">
        <characteristicTypes>
          <characteristicType id="${STRENGTH_TYPE_ID}" name="S"/>
          <characteristicType id="${TOUGHNESS_TYPE_ID}" name="T"/>
        </characteristicTypes>
      </profileType>
    </profileTypes>
  </gameSystem>`;

/** Eine Bedingung „mindestens `value` Bannertraeger im Roster". */
function bannerCondition(value) {
  return `<conditions>
            <condition type="atLeast" field="selections" scope="roster" childId="${BANNER_ID}" value="${value}"/>
          </conditions>`;
}

function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogueXml] }), roster);
}

/** Sucht den Faehigkeitsdatensatz eines Slots ueber die Definitions-ID. */
function slotByDefId(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId) return capability;
  }
  return null;
}

/**
 * Der effektive Merkmalswert eines Slots an einem bestimmten Traeger — gelesen aus
 * der **Info-Projektion** des Faehigkeitsdatensatzes (Issue 75/06): die flache
 * `characteristics`-Liste ist darin aufgegangen, ein Merkmal steht seitdem an
 * seinem Profil-Eintrag statt neben ihm.
 */
function characteristicOf(report, defId, carrierId, typeId) {
  const profile = slotByDefId(report, defId)?.infoElements
    .find(entry => entry.id === carrierId);
  return profile?.characteristics.find(entry => entry.typeId === typeId)?.value ?? null;
}

/** Ein Roster mit einer Kriegereinheit und optional einem Bannertraeger. */
function rosterWith({ banners = 0 } = {}) {
  const forces = [{ defId: WARRIOR_ID, count: 1, children: [] }];
  if (banners > 0) forces.push({ defId: BANNER_ID, count: banners, children: [] });
  return { forces };
}

describe('Modifikator-Ziel: Merkmalswert', () => {
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-characteristic" name="Characteristic Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="${WARRIOR_NAME}" type="unit">
          <profiles>
            <profile id="${WARRIOR_PROFILE_ID}" name="Warrior" typeId="${PROFILE_TYPE_ID}">
              <characteristics>
                <characteristic name="S" typeId="${STRENGTH_TYPE_ID}">3</characteristic>
                <characteristic name="T" typeId="${TOUGHNESS_TYPE_ID}">4</characteristic>
              </characteristics>
              <modifiers>
                <modifier type="increment" field="${STRENGTH_TYPE_ID}" value="2">
                  ${bannerCondition(1)}
                </modifier>
                <modifier type="set" field="${TOUGHNESS_TYPE_ID}" value="5+">
                  ${bannerCondition(1)}
                </modifier>
              </modifiers>
            </profile>
          </profiles>
        </selectionEntry>
        <selectionEntry id="${BANNER_ID}" name="${BANNER_NAME}" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;

  it('laesst den Basiswert stehen, solange die Bedingung nicht haelt', () => {
    const report = evaluate(CATALOGUE_XML, rosterWith());

    expect(characteristicOf(report, WARRIOR_ID, WARRIOR_PROFILE_ID, STRENGTH_TYPE_ID)).toBe('3');
    expect(characteristicOf(report, WARRIOR_ID, WARRIOR_PROFILE_ID, TOUGHNESS_TYPE_ID)).toBe('4');
  });

  it('rechnet den Merkmalswert fort, sobald die Bedingung haelt', () => {
    const report = evaluate(CATALOGUE_XML, rosterWith({ banners: 1 }));

    expect(characteristicOf(report, WARRIOR_ID, WARRIOR_PROFILE_ID, STRENGTH_TYPE_ID)).toBe('5');
  });

  it('setzt einen nicht-numerischen Merkmalswert unveraendert als Text (kein Zahl-Parsen)', () => {
    const report = evaluate(CATALOGUE_XML, rosterWith({ banners: 1 }));

    expect(characteristicOf(report, WARRIOR_ID, WARRIOR_PROFILE_ID, TOUGHNESS_TYPE_ID)).toBe('5+');
  });

  it('meldet ein nicht deutbares Ziel, statt es still als Hinweistext aufzufangen', () => {
    const withUnknownField = CATALOGUE_XML.replace(
      `field="${STRENGTH_TYPE_ID}"`,
      'field="staerke"',
    );

    const report = evaluate(withUnknownField, rosterWith({ banners: 1 }));

    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.UNSUPPORTED_MODIFIER_TARGET, field: 'staerke' }),
    );
  });
});

describe('Modifikator-Ziel: Merkmalswert am Info-Verweis', () => {
  // Zwei Einheiten verweisen auf **dasselbe** geteilte Profil; nur die eine traegt
  // am Verweis einen Modifikator. Das ist der Fall, an dem sich entscheidet, ob ein
  // Merkmal am Vorkommen oder an der geteilten Definition haengt.
  const RIDER_ID = 'entry-rider';
  const SCOUT_ID = 'entry-scout';
  const SCOUT_LINK_ID = 'infolink-steed-scout';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-shared-profile" name="Shared Profile Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
      <sharedProfiles>
        <profile id="${SHARED_PROFILE_ID}" name="Steed" typeId="${PROFILE_TYPE_ID}">
          <characteristics>
            <characteristic name="S" typeId="${STRENGTH_TYPE_ID}">3</characteristic>
          </characteristics>
        </profile>
      </sharedProfiles>
      <selectionEntries>
        <selectionEntry id="${RIDER_ID}" name="Rider" type="unit">
          <infoLinks>
            <infoLink id="${STEED_LINK_ID}" name="Steed" type="profile" targetId="${SHARED_PROFILE_ID}">
              <modifiers>
                <modifier type="increment" field="${STRENGTH_TYPE_ID}" value="1"/>
              </modifiers>
            </infoLink>
          </infoLinks>
        </selectionEntry>
        <selectionEntry id="${SCOUT_ID}" name="Scout" type="unit">
          <infoLinks>
            <infoLink id="${SCOUT_LINK_ID}" name="Steed" type="profile" targetId="${SHARED_PROFILE_ID}"/>
          </infoLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  const ROSTER = {
    forces: [
      { defId: RIDER_ID, count: 1, children: [] },
      { defId: SCOUT_ID, count: 1, children: [] },
    ],
  };

  it('wirkt am Vorkommen des verlinkten Profils', () => {
    const report = evaluate(CATALOGUE_XML, ROSTER);

    expect(characteristicOf(report, RIDER_ID, STEED_LINK_ID, STRENGTH_TYPE_ID)).toBe('4');
  });

  it('laesst dasselbe geteilte Profil an einem anderen Slot unberuehrt', () => {
    const report = evaluate(CATALOGUE_XML, ROSTER);

    expect(characteristicOf(report, SCOUT_ID, SCOUT_LINK_ID, STRENGTH_TYPE_ID)).toBe('3');
  });
});

describe('Modifikator-Ziel: Anzeigename', () => {
  const SUFFIX = 'Elite';
  const JOIN = ' — ';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-name" name="Name Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="${WARRIOR_NAME}" type="unit">
          <profiles>
            <profile id="${WARRIOR_PROFILE_ID}" name="Warrior" typeId="${PROFILE_TYPE_ID}">
              <modifiers>
                <modifier type="set" field="name" value="Veteran"/>
              </modifiers>
            </profile>
          </profiles>
          <modifiers>
            <modifier type="append" field="name" value="${SUFFIX}" join="${JOIN}">
              ${bannerCondition(1)}
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${BANNER_ID}" name="${BANNER_NAME}" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;

  it('haelt den Katalognamen, solange die Bedingung nicht haelt', () => {
    const report = evaluate(CATALOGUE_XML, rosterWith());

    expect(slotByDefId(report, WARRIOR_ID).name).toBe(WARRIOR_NAME);
  });

  it('ergaenzt den Namen mit dem `join`-Trennzeichen, sobald die Bedingung haelt', () => {
    const report = evaluate(CATALOGUE_XML, rosterWith({ banners: 1 }));

    expect(slotByDefId(report, WARRIOR_ID).name).toBe(`${WARRIOR_NAME}${JOIN}${SUFFIX}`);
  });

  it('laesst einen Namens-Modifikator am Profil den Namen der Einheit nicht veraendern', () => {
    const report = evaluate(CATALOGUE_XML, rosterWith());

    expect(slotByDefId(report, WARRIOR_ID).name).toBe(WARRIOR_NAME);
  });
});

describe('Modifikator-Ziel: Autor-Meldung', () => {
  const ERROR_TEXT = 'Ein Bannertraeger braucht eine Einheit.';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-message" name="Message Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="${WARRIOR_NAME}" type="unit">
          <modifiers>
            <modifier type="add" field="error" value="${ERROR_TEXT}">
              ${bannerCondition(2)}
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${BANNER_ID}" name="${BANNER_NAME}" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;

  it('fuehrt die Meldung mit ihrem Schweregrad und im Wortlaut des Katalogs', () => {
    const report = evaluate(CATALOGUE_XML, rosterWith({ banners: 2 }));

    expect(slotByDefId(report, WARRIOR_ID).authorMessages).toEqual([
      { severity: MessageSeverity.ERROR, text: ERROR_TEXT },
    ]);
  });

  it('meldet sie nicht mehr als nicht unterstuetzten Modifikator', () => {
    const report = evaluate(CATALOGUE_XML, rosterWith({ banners: 2 }));

    expect(report.diagnostics).not.toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.UNSUPPORTED_MODIFIER }),
    );
  });

  it('bleibt aus, solange ihre Bedingung nicht haelt', () => {
    const report = evaluate(CATALOGUE_XML, rosterWith({ banners: 1 }));

    expect(slotByDefId(report, WARRIOR_ID).authorMessages).toEqual([]);
  });
});

describe('Basis-Sichtbarkeit aus dem Katalog', () => {
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-hidden-base" name="Hidden Base Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="${WARRIOR_NAME}" type="unit" hidden="true">
          <modifiers>
            <modifier type="set" field="hidden" value="false">
              ${bannerCondition(1)}
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${BANNER_ID}" name="${BANNER_NAME}" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;

  it('uebernimmt ein im Katalog gesetztes `hidden` als Basis-Sichtbarkeit', () => {
    const report = evaluate(CATALOGUE_XML, rosterWith());

    expect(slotByDefId(report, WARRIOR_ID).isHidden).toBe(true);
  });

  it('laesst einen bedingten Modifikator die Basis-Sichtbarkeit wieder aufheben', () => {
    const report = evaluate(CATALOGUE_XML, rosterWith({ banners: 1 }));

    expect(slotByDefId(report, WARRIOR_ID).isHidden).toBe(false);
  });
});
