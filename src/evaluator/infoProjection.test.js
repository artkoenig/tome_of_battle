/**
 * Tests der **Info-Projektion** je Slot (`infoProjection.js`, Issue 75/06;
 * `design.md`, Kontrakt „Profile und Regeltexte je Slot").
 *
 * Geprueft wird die eine Frage des Moduls — *welche Profile und Regeltexte gelten
 * fuer diesen Slot?* — an minimalen, synthetischen Katalogen ueber die
 * oeffentliche Fassade: Eigenes und aus belegten Unter-Auswahlen Geerbtes,
 * Verstecktes (Basis-`hidden` wie Modifikator), Info-Verweise samt Verweis auf
 * eine Info-Gruppe, und die **effektiven** Merkmalswerte und Namen.
 *
 * Die realen WHFB6-Katalogdaten decken dieselben Regeln in den E2E-Szenarien ab
 * (ADR-0033); hier stehen bewusst nur die kleinen, isolierten Faelle.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind, InfoElementKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const UNIT_ID = 'entry-unit';
const OPTION_ID = 'entry-option';
const PROFILE_TYPE_ID = 'profile-type-unit';
const PROFILE_TYPE_NAME = 'Einheit';
const MOVE_TYPE_ID = 'char-type-move';
const MOVE_TYPE_NAME = 'Bewegung';
const WOUNDS_TYPE_ID = 'char-type-wounds';
const WOUNDS_TYPE_NAME = 'Lebenspunkte';

/**
 * Das Spielsystem stellt die Profiltyp-Deklarationen — die einzige Quelle der
 * Klartext-Namen von Profiltyp und Charakteristik-Typ (XSD: beide Pflichtattribute
 * der Deklaration, die Kopie am Profil dagegen optional).
 */
const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="gs-info" name="Info Game System">
    <profileTypes>
      <profileType id="${PROFILE_TYPE_ID}" name="${PROFILE_TYPE_NAME}">
        <characteristicTypes>
          <characteristicType id="${MOVE_TYPE_ID}" name="${MOVE_TYPE_NAME}"/>
          <characteristicType id="${WOUNDS_TYPE_ID}" name="${WOUNDS_TYPE_NAME}"/>
        </characteristicTypes>
      </profileType>
    </profileTypes>
  </gameSystem>`;

function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogueXml] }), roster);
}

/** Der Faehigkeitsdatensatz des belegten Slots mit dieser Definitions-ID. */
function occupiedSlot(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId && capability.anchorKind === AnchorKind.OCCUPIED) return capability;
  }
  return null;
}

/** Die Info-Projektion des belegten Slots mit dieser Definitions-ID. */
function infoElementsOfSlot(report, defId) {
  return occupiedSlot(report, defId).infoElements;
}

/** Die Vorkommens-IDs der Info-Projektion eines Slots, in ihrer Reihenfolge. */
function infoElementIdsOfSlot(report, defId) {
  return infoElementsOfSlot(report, defId).map(entry => entry.id);
}

/** Ein Roster mit einer Einheit, die optional eine Unter-Auswahl traegt. */
function rosterWithOption({ withOption }) {
  const children = withOption ? [{ defId: OPTION_ID, count: 1, children: [] }] : [];
  return { forces: [{ defId: UNIT_ID, count: 1, children }] };
}

describe('Info-Projektion: die eigenen Profile und Regeln eines Slots', () => {
  const PROFILE_ID = 'profile-unit';
  const RULE_ID = 'rule-fear';
  const RULE_TEXT = 'Gegner muessen einen Test ablegen.';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-info-own" name="Info Own Catalogue" gameSystemId="gs-info">
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit">
          <profiles>
            <profile id="${PROFILE_ID}" name="Krieger" typeId="${PROFILE_TYPE_ID}">
              <characteristics>
                <characteristic name="M" typeId="${MOVE_TYPE_ID}">4</characteristic>
                <characteristic name="W" typeId="${WOUNDS_TYPE_ID}">1</characteristic>
              </characteristics>
            </profile>
          </profiles>
          <rules>
            <rule id="${RULE_ID}" name="Furcht">
              <description>${RULE_TEXT}</description>
            </rule>
          </rules>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('liefert das Profil mit Profiltyp und Merkmalen, je mit Klartext-Namen aus der Deklaration', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: false }));

    expect(infoElementsOfSlot(report, UNIT_ID)).toContainEqual({
      kind: InfoElementKind.PROFILE,
      id: PROFILE_ID,
      name: 'Krieger',
      profileTypeId: PROFILE_TYPE_ID,
      profileTypeName: PROFILE_TYPE_NAME,
      characteristics: [
        { typeId: MOVE_TYPE_ID, name: MOVE_TYPE_NAME, value: '4' },
        { typeId: WOUNDS_TYPE_ID, name: WOUNDS_TYPE_NAME, value: '1' },
      ],
    });
  });

  it('liefert die Regel mit ihrem unveraenderten Regeltext', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: false }));

    expect(infoElementsOfSlot(report, UNIT_ID)).toContainEqual({
      kind: InfoElementKind.RULE,
      id: RULE_ID,
      name: 'Furcht',
      text: RULE_TEXT,
    });
  });

  it('haelt die Dokumentreihenfolge ein: erst das Profil, dann die Regel', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: false }));

    expect(infoElementIdsOfSlot(report, UNIT_ID)).toEqual([PROFILE_ID, RULE_ID]);
  });
});

describe('Info-Projektion: Vererbung aus den belegten Unter-Auswahlen', () => {
  const UNIT_RULE_ID = 'rule-unit';
  const OPTION_PROFILE_ID = 'profile-option';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-info-inherit" name="Info Inherit Catalogue" gameSystemId="gs-info">
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit">
          <rules>
            <rule id="${UNIT_RULE_ID}" name="Einheitenregel"><description>Regel der Einheit.</description></rule>
          </rules>
          <selectionEntries>
            <selectionEntry id="${OPTION_ID}" name="Speer" type="upgrade">
              <profiles>
                <profile id="${OPTION_PROFILE_ID}" name="Speer" typeId="${PROFILE_TYPE_ID}">
                  <characteristics>
                    <characteristic name="M" typeId="${MOVE_TYPE_ID}">0</characteristic>
                  </characteristics>
                </profile>
              </profiles>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('erbt das Profil der gewaehlten Unter-Auswahl an den Slot der Einheit — hinter deren eigenen', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: true }));

    expect(infoElementIdsOfSlot(report, UNIT_ID)).toEqual([UNIT_RULE_ID, OPTION_PROFILE_ID]);
  });

  it('erbt nichts, solange die Unter-Auswahl nicht gewaehlt ist (nur belegte vererben)', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: false }));

    expect(infoElementIdsOfSlot(report, UNIT_ID)).toEqual([UNIT_RULE_ID]);
  });

  it('laesst die Unter-Auswahl ihre eigene Projektion behalten (ohne die der Einheit)', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: true }));

    expect(infoElementIdsOfSlot(report, OPTION_ID)).toEqual([OPTION_PROFILE_ID]);
  });
});

describe('Info-Projektion: Verstecktes bleibt aussen vor', () => {
  const VISIBLE_RULE_ID = 'rule-visible';
  const BASE_HIDDEN_RULE_ID = 'rule-base-hidden';
  const MODIFIER_HIDDEN_RULE_ID = 'rule-modifier-hidden';
  const REVEALED_RULE_ID = 'rule-revealed';
  const OPTION_RULE_ID = 'rule-of-hidden-option';
  // Dasselbe Muster wie im echten Katalog (Vampire Counts, Info-Verweis
  // „Flammable"): ein basis-verstecktes Element, das ein bedingter Modifikator
  // einblendet, sobald eine bestimmte Auswahl im Kontingent steht.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-info-hidden" name="Info Hidden Catalogue" gameSystemId="gs-info">
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit">
          <rules>
            <rule id="${VISIBLE_RULE_ID}" name="Sichtbar"><description>Sichtbar.</description></rule>
            <rule id="${BASE_HIDDEN_RULE_ID}" name="Basis-versteckt" hidden="true"><description>Versteckt.</description></rule>
            <rule id="${MODIFIER_HIDDEN_RULE_ID}" name="Modifikator-versteckt">
              <description>Wird ausgeblendet.</description>
              <modifiers>
                <modifier type="set" field="hidden" value="true"/>
              </modifiers>
            </rule>
            <rule id="${REVEALED_RULE_ID}" name="Bedingt eingeblendet" hidden="true">
              <description>Wird bedingt eingeblendet.</description>
              <modifiers>
                <modifier type="set" field="hidden" value="false">
                  <conditions>
                    <condition type="atLeast" field="selections" scope="self" childId="${OPTION_ID}" value="1"/>
                  </conditions>
                </modifier>
              </modifiers>
            </rule>
          </rules>
          <selectionEntries>
            <selectionEntry id="${OPTION_ID}" name="Verborgene Option" type="upgrade">
              <rules>
                <rule id="${OPTION_RULE_ID}" name="Regel der verborgenen Option"><description>Haengt am versteckten Knoten.</description></rule>
              </rules>
              <modifiers>
                <modifier type="set" field="hidden" value="true"/>
              </modifiers>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('laesst ein per Basis-`hidden` verstecktes Element und ein per Modifikator verstecktes aus', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: false }));

    expect(infoElementIdsOfSlot(report, UNIT_ID)).not.toContain(BASE_HIDDEN_RULE_ID);
    expect(infoElementIdsOfSlot(report, UNIT_ID)).not.toContain(MODIFIER_HIDDEN_RULE_ID);
    expect(infoElementIdsOfSlot(report, UNIT_ID)).toContain(VISIBLE_RULE_ID);
  });

  it('nimmt ein basis-verstecktes Element auf, sobald ein Modifikator es einblendet', () => {
    const hiddenReport = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: false }));
    const revealedReport = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: true }));

    expect(infoElementIdsOfSlot(hiddenReport, UNIT_ID)).not.toContain(REVEALED_RULE_ID);
    expect(infoElementIdsOfSlot(revealedReport, UNIT_ID)).toContain(REVEALED_RULE_ID);
  });

  it('erbt nichts von einem versteckten Knoten — auch nicht dessen sichtbare Elemente', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: true }));

    expect(occupiedSlot(report, OPTION_ID).isHidden).toBe(true);
    expect(infoElementIdsOfSlot(report, UNIT_ID)).not.toContain(OPTION_RULE_ID);
  });

  it('laesst die eigene Projektion eines versteckten Knotens leer (sie haengt an ihm selbst)', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: true }));

    expect(infoElementsOfSlot(report, OPTION_ID)).toEqual([]);
  });
});

describe('Info-Projektion: ein Info-Verweis erscheint an der Stelle des Verweises', () => {
  const SHARED_PROFILE_ID = 'shared-profile';
  const SHARED_RULE_ID = 'shared-rule';
  const SHARED_GROUP_ID = 'shared-group';
  const GROUPED_RULE_ID = 'grouped-rule';
  const PROFILE_LINK_ID = 'link-to-profile';
  const RULE_LINK_ID = 'link-to-rule';
  const GROUP_LINK_ID = 'link-to-group';
  const LINK_NAME = 'Verweis-Anzeigename';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-info-link" name="Info Link Catalogue" gameSystemId="gs-info">
      <sharedProfiles>
        <profile id="${SHARED_PROFILE_ID}" name="Geteiltes Profil" typeId="${PROFILE_TYPE_ID}">
          <characteristics>
            <characteristic name="M" typeId="${MOVE_TYPE_ID}">6</characteristic>
          </characteristics>
        </profile>
      </sharedProfiles>
      <sharedRules>
        <rule id="${SHARED_RULE_ID}" name="Geteilte Regel"><description>Geteilter Text.</description></rule>
      </sharedRules>
      <sharedInfoGroups>
        <infoGroup id="${SHARED_GROUP_ID}" name="Geteilte Gruppe">
          <rules>
            <rule id="${GROUPED_RULE_ID}" name="Regel in der Gruppe"><description>Text in der Gruppe.</description></rule>
          </rules>
        </infoGroup>
      </sharedInfoGroups>
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit">
          <infoLinks>
            <infoLink id="${PROFILE_LINK_ID}" name="${LINK_NAME}" type="profile" targetId="${SHARED_PROFILE_ID}"/>
            <infoLink id="${RULE_LINK_ID}" name="Verwiesene Regel" type="rule" targetId="${SHARED_RULE_ID}"/>
            <infoLink id="${GROUP_LINK_ID}" name="Verwiesene Gruppe" type="infoGroup" targetId="${SHARED_GROUP_ID}"/>
          </infoLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('traegt die ID und den Namen des Verweises, die Merkmale aber vom Ziel', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: false }));

    expect(infoElementsOfSlot(report, UNIT_ID)).toContainEqual({
      kind: InfoElementKind.PROFILE,
      id: PROFILE_LINK_ID,
      name: LINK_NAME,
      profileTypeId: PROFILE_TYPE_ID,
      profileTypeName: PROFILE_TYPE_NAME,
      characteristics: [{ typeId: MOVE_TYPE_ID, name: MOVE_TYPE_NAME, value: '6' }],
    });
  });

  it('liefert das geteilte Element genau einmal — als Vorkommen des Verweises, nicht zusaetzlich als Definition', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: false }));

    expect(infoElementIdsOfSlot(report, UNIT_ID)).not.toContain(SHARED_PROFILE_ID);
    expect(infoElementIdsOfSlot(report, UNIT_ID)).not.toContain(SHARED_RULE_ID);
  });

  it('nimmt den Regeltext des Ziels an die Stelle des Verweises', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: false }));

    expect(infoElementsOfSlot(report, UNIT_ID)).toContainEqual({
      kind: InfoElementKind.RULE,
      id: RULE_LINK_ID,
      name: 'Verwiesene Regel',
      text: 'Geteilter Text.',
    });
  });

  it('loest einen Verweis auf eine Info-Gruppe in deren Mitglieder auf (die Gruppe selbst traegt nichts)', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithOption({ withOption: false }));

    const ids = infoElementIdsOfSlot(report, UNIT_ID);
    expect(ids).toContain(GROUPED_RULE_ID);
    expect(ids).not.toContain(GROUP_LINK_ID);
    expect(ids).not.toContain(SHARED_GROUP_ID);
  });
});

describe('Info-Projektion: die Wirkung greifender Modifikatoren ist sichtbar', () => {
  const PROFILE_ID = 'profile-unit';
  const BASE_MOVE = '4';
  const BOOSTED_MOVE = '6';
  const BASE_NAME = 'Krieger';
  const BOOSTED_NAME = 'Elite-Krieger';
  const BOOST_THRESHOLD = 2;
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-info-effective" name="Info Effective Catalogue" gameSystemId="gs-info">
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="${BASE_NAME}" type="unit">
          <profiles>
            <profile id="${PROFILE_ID}" name="${BASE_NAME}" typeId="${PROFILE_TYPE_ID}">
              <characteristics>
                <characteristic name="M" typeId="${MOVE_TYPE_ID}">${BASE_MOVE}</characteristic>
              </characteristics>
              <modifiers>
                <modifier type="set" field="${MOVE_TYPE_ID}" value="${BOOSTED_MOVE}">
                  <conditions>
                    <condition type="atLeast" field="selections" scope="self" value="${BOOST_THRESHOLD}"/>
                  </conditions>
                </modifier>
                <modifier type="set" field="name" value="${BOOSTED_NAME}">
                  <conditions>
                    <condition type="atLeast" field="selections" scope="self" value="${BOOST_THRESHOLD}"/>
                  </conditions>
                </modifier>
              </modifiers>
            </profile>
          </profiles>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  /** Ein Roster mit gegebener Anzahl der Einheit (die Bedingung liest `scope="self"`). */
  function rosterOfUnits(count) {
    return { forces: [{ defId: UNIT_ID, count, children: [] }] };
  }

  it('zeigt den Basiswert und den Basisnamen, solange die Bedingung nicht haelt', () => {
    const report = evaluate(CATALOGUE_XML, rosterOfUnits(BOOST_THRESHOLD - 1));

    const [profile] = infoElementsOfSlot(report, UNIT_ID);
    expect(profile.name).toBe(BASE_NAME);
    expect(profile.characteristics).toEqual([{ typeId: MOVE_TYPE_ID, name: MOVE_TYPE_NAME, value: BASE_MOVE }]);
  });

  it('zeigt den effektiven Merkmalswert und den effektiven Namen, sobald sie haelt', () => {
    const report = evaluate(CATALOGUE_XML, rosterOfUnits(BOOST_THRESHOLD));

    const [profile] = infoElementsOfSlot(report, UNIT_ID);
    expect(profile.name).toBe(BOOSTED_NAME);
    expect(profile.characteristics).toEqual([{ typeId: MOVE_TYPE_ID, name: MOVE_TYPE_NAME, value: BOOSTED_MOVE }]);
  });
});

describe('Info-Projektion: ohne Profiltyp-Deklaration bleiben die Klartext-Namen leer', () => {
  const PROFILE_ID = 'profile-unit';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-info-no-types" name="Info No Types Catalogue">
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit">
          <profiles>
            <profile id="${PROFILE_ID}" name="Krieger" typeId="${PROFILE_TYPE_ID}">
              <characteristics>
                <characteristic name="M" typeId="${MOVE_TYPE_ID}">4</characteristic>
              </characteristics>
            </profile>
          </profiles>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('nennt IDs und Werte weiterhin vollstaendig, den unbekannten Namen aber ehrlich als null', () => {
    const report = evaluateDataset(prepareDataset({ catalogues: [CATALOGUE_XML] }), rosterWithOption({ withOption: false }));

    expect(infoElementsOfSlot(report, UNIT_ID)).toEqual([{
      kind: InfoElementKind.PROFILE,
      id: PROFILE_ID,
      name: 'Krieger',
      profileTypeId: PROFILE_TYPE_ID,
      profileTypeName: null,
      characteristics: [{ typeId: MOVE_TYPE_ID, name: null, value: '4' }],
    }]);
  });
});
