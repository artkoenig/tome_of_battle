/**
 * Die **Buchquelle** in der Info-Projektion (`infoProjection.js`, Issue 0102,
 * Punkt 1): jedes Profil und jede Regel im Bericht nennt das Buch und die Seite,
 * auf die der Katalogautor sie zurueckfuehrt
 * (`docs/battlescribe-data-format.md` §5.2, §13.3).
 *
 * Der Klartext-Name des Buchs stammt aus den `<publication>`-Deklarationen des
 * Datensatzes und nur von dort — dieselbe Regel wie bei den Profiltypen. Die
 * Deklarationen stehen dabei ueblicherweise in der **Spielsystemdatei**, die
 * `publicationId` aber im Katalog: der Weg fuehrt also ueber die
 * Zusammenfuehrung der Quellen (ADR-0032).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind, InfoElementKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const UNIT_ID = 'entry-unit';
const RULE_ID = 'rule-fear';
const SHARED_RULE_ID = 'shared-rule';
const RULE_LINK_ID = 'link-to-rule';
const PROFILE_ID = 'profile-unit';
const PROFILE_TYPE_ID = 'profile-type-unit';
const BOOK_ID = 'book-brb';
const BOOK_NAME = 'Warhammer Rulebook';
const OTHER_BOOK_ID = 'book-armies';
const UNKNOWN_BOOK_ID = 'book-nirgends-deklariert';
const PLAIN_UNIT_ID = 'entry-ohne-buch';

/** Das Spielsystem deklariert die Buecher — und die Profiltypen. */
const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="gs-pub" name="Publication Game System">
    <publications>
      <publication id="${BOOK_ID}" name="${BOOK_NAME}" shortName="BRB"/>
      <publication id="${OTHER_BOOK_ID}" name="Armies of the World"/>
    </publications>
    <profileTypes>
      <profileType id="${PROFILE_TYPE_ID}" name="Einheit"/>
    </profileTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-pub" name="Publication Catalogue" gameSystemId="gs-pub">
    <sharedRules>
      <rule id="${SHARED_RULE_ID}" name="Geteilte Regel" publicationId="${OTHER_BOOK_ID}" page="99">
        <description>Geteilter Text.</description>
      </rule>
    </sharedRules>
    <selectionEntries>
      <selectionEntry id="${UNIT_ID}" name="Krieger" type="unit"
                      publicationId="${BOOK_ID}" page="7">
        <profiles>
          <profile id="${PROFILE_ID}" name="Krieger" typeId="${PROFILE_TYPE_ID}"
                   publicationId="${UNKNOWN_BOOK_ID}" page="3"/>
        </profiles>
        <rules>
          <rule id="${RULE_ID}" name="Furcht" publicationId="${BOOK_ID}" page="42">
            <description>Gegner muessen einen Test ablegen.</description>
          </rule>
          <rule id="rule-ohne-quelle" name="Ohne Quelle">
            <description>Kein Buch, keine Seite.</description>
          </rule>
        </rules>
        <infoLinks>
          <infoLink id="${RULE_LINK_ID}" name="Verweis" type="rule" targetId="${SHARED_RULE_ID}"/>
        </infoLinks>
        <selectionEntries>
          <selectionEntry id="${PLAIN_UNIT_ID}" name="Ohne Buch" type="upgrade"/>
        </selectionEntries>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const ROSTER = { forces: [{ defId: UNIT_ID, count: 1, children: [] }] };

/** Der Bericht ueber das Kontingent mit der einen Einheit. */
function report() {
  return evaluateDataset(
    prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] }),
    ROSTER,
  );
}

/** Der erste Slot einer Definition, gleich welcher Ankerart. */
function slotOf(defId) {
  for (const capability of report().capabilities.values()) {
    if (capability.defId === defId) return capability;
  }
  return null;
}

/** Die Info-Projektion des belegten Slots der Einheit. */
function infoElements() {
  const report = evaluateDataset(
    prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] }),
    ROSTER,
  );
  for (const capability of report.capabilities.values()) {
    if (capability.defId === UNIT_ID && capability.anchorKind === AnchorKind.OCCUPIED) {
      return capability.infoElements;
    }
  }
  return [];
}

/** Der Eintrag der Projektion mit dieser Vorkommens-ID. */
function entryWithId(id) {
  return infoElements().find(entry => entry.id === id);
}

describe('Info-Projektion: die Buchquelle eines Info-Eintrags', () => {
  it('nennt Buch-ID, Klartext-Namen und Seite einer Regel', () => {
    expect(entryWithId(RULE_ID).source).toEqual({
      publicationId: BOOK_ID,
      publicationName: BOOK_NAME,
      page: '42',
    });
  });

  it('nennt sie ebenso an einem Profil', () => {
    expect(entryWithId(PROFILE_ID).source).toMatchObject({ page: '3' });
  });

  it('haelt den Namen eines nirgends deklarierten Buchs ehrlich auf null, ohne ID und Seite zu verlieren', () => {
    expect(entryWithId(PROFILE_ID).source).toEqual({
      publicationId: UNKNOWN_BOOK_ID,
      publicationName: null,
      page: '3',
    });
  });

  it('traegt ohne jede Angabe keine Quelle statt einer leeren', () => {
    expect(entryWithId('rule-ohne-quelle').source).toBeNull();
  });

  it('nimmt die Quelle des Verweisziels an die Stelle des Verweises, wenn der Verweis keine eigene nennt', () => {
    expect(entryWithId(RULE_LINK_ID)).toMatchObject({
      kind: InfoElementKind.RULE,
      source: { publicationId: OTHER_BOOK_ID, publicationName: 'Armies of the World', page: '99' },
    });
  });
});

describe('Bericht: die eigene Buchquelle eines Slots', () => {
  it('nennt Buch, Klartext-Namen und Seite der Definition des Slots', () => {
    expect(slotOf(UNIT_ID).source).toEqual({
      publicationId: BOOK_ID,
      publicationName: BOOK_NAME,
      page: '7',
    });
  });

  it('bleibt `null`, wo die Definition weder Buch noch Seite nennt', () => {
    const plain = slotOf(PLAIN_UNIT_ID);
    expect(plain, `kein Slot fuer ${PLAIN_UNIT_ID} im Bericht`).not.toBeNull();
    expect(plain.source).toBeNull();
  });
});
