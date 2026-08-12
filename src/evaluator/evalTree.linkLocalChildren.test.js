/**
 * `ownerDefinitionOf` (`evalTree.js`) — die tragende Definition eines belegten
 * Knotens, der ueber einen `entryLink` gesetzt wurde.
 *
 * Ein `entryLink` darf **selbst** Kinder deklarieren (`Catalogue.xsd`:
 * `EntryLink` erweitert `SelectionEntryBase`;
 * `docs/battlescribe-data-format.md` §4.4). Sie stehen an dieser
 * Verwendungsstelle neben den Kindern des Ziels. `ownerDefinitionOf` lieferte
 * bislang **nur** das aufgeloeste Ziel — die am Verweis deklarierten Kinder
 * fielen damit aus jeder Traversierung heraus, die ueber diese eine Funktion
 * geht: Angebots-Anker (`offer.js`), Gruppen-Anker, Pflicht-Phantome und
 * Sichtbarkeits-Klammern (`evalTree.js`).
 *
 * Realer Fall: Empire-Captain → Gruppe „Mounts" → Verweis „Empire Warhorse"
 * (Ziel ist ein geteilter Eintrag **ohne** Kinder) → Option „Barding", am
 * Verweis deklariert. Wer das Ross waehlte, bekam im Bericht keinen Slot fuer
 * die Barding-Option — der Editor konnte sie deshalb nicht anbieten.
 *
 * Die Faelle unten pinnen dieselbe Regel an ihren drei Wirkstellen und halten
 * die Gegenprobe daneben: die Kinder eines **nicht** gewaehlten Verweises
 * gehoeren weiterhin nicht dem aeusseren Rahmen (`offer.test.js` haelt diese
 * Grenze von der anderen Seite fest).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { PreparedDataset, prepareDataset } from './datasetPreparation.js';
import { buildEvalTree, allNodes } from './evalTree.js';
import { attachOfferAnchors } from './offer.js';
import { AnchorKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const FORCE_ID = 'force-army';
const CAPTAIN_ID = 'entry-captain';
const MOUNTS_GROUP_ID = 'group-mounts';
const WARHORSE_LINK_ID = 'link-warhorse';
const SHARED_WARHORSE_ID = 'shared-warhorse';
const BARDING_ID = 'entry-barding';
const SADDLE_ID = 'entry-saddle';
const TARGET_OWN_CHILD_ID = 'entry-target-own-child';
const LOCAL_GROUP_ID = 'group-link-local';
const LOCAL_GROUP_MEMBER_ID = 'entry-local-group-member';

/**
 * Der Empire-Captain in seiner kleinsten Form: eine Gruppe „Mounts" mit einem
 * Verweis auf ein **geteiltes** Ross. `linkLocalXml` sind die am Verweis
 * deklarierten Kinder, `targetChildrenXml` die des geteilten Ziels — so laesst
 * sich je Fall trennen, welche Seite den Slot beisteuern muss.
 */
function catalogueXml({ linkLocalXml = '', targetChildrenXml = '' } = {}) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-link-local" name="Link Local Children Catalogue">
      <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
      <sharedSelectionEntries>
        <selectionEntry id="${SHARED_WARHORSE_ID}" name="Warhorse" type="upgrade">
          ${targetChildrenXml}
        </selectionEntry>
      </sharedSelectionEntries>
      <selectionEntries>
        <selectionEntry id="${CAPTAIN_ID}" name="Captain" type="unit">
          <selectionEntryGroups>
            <selectionEntryGroup id="${MOUNTS_GROUP_ID}" name="Mounts">
              <constraints>
                <constraint id="max-mounts" type="max" value="1" field="selections" scope="parent"/>
              </constraints>
              <entryLinks>
                <entryLink id="${WARHORSE_LINK_ID}" name="Warhorse" targetId="${SHARED_WARHORSE_ID}" type="selectionEntry">
                  ${linkLocalXml}
                </entryLink>
              </entryLinks>
            </selectionEntryGroup>
          </selectionEntryGroups>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Das Ross ist gewaehlt; seine eigenen Optionen sind noch offen. */
const CAPTAIN_ON_WARHORSE = {
  forces: [{
    defId: FORCE_ID,
    count: 1,
    children: [{ defId: CAPTAIN_ID, count: 1, children: [{ defId: WARHORSE_LINK_ID, count: 1, children: [] }] }],
  }],
};

/** Der Captain steht zu Fuss — der Verweis ist nicht belegt. */
const CAPTAIN_ON_FOOT = {
  forces: [{ defId: FORCE_ID, count: 1, children: [{ defId: CAPTAIN_ID, count: 1, children: [] }] }],
};

/** Baut Baumphase 1 und haengt anschliessend die Angebots-Anker an (Baumphase 2). */
function buildTreeWithOffer(catalogXml, roster) {
  const { resolved } = PreparedDataset.contentsOf(prepareDataset({ catalogues: [catalogXml] }));
  const { root } = buildEvalTree(resolved, roster);
  attachOfferAnchors(root, resolved);
  return root;
}

/** Der Rahmen mit dieser Definitions-Id. */
function frameOf(root, frameDefId) {
  return [...allNodes(root)].find(node => node.def?.id === frameDefId);
}

/** Die Definitions-Ids der Kind-Anker einer Art unter diesem Rahmen. */
function anchoredIdsUnder(root, frameDefId, anchorKind) {
  return frameOf(root, frameDefId).children
    .filter(child => child.anchorKind === anchorKind)
    .map(child => child.def.id);
}

describe('Tragende Definition eines Verweis-Knotens: Ziel-Kinder UND am Verweis deklarierte Kinder', () => {
  it('bietet die am Verweis deklarierte Option unter der belegten Auswahl an (Captain → Ross → Barding)', () => {
    const root = buildTreeWithOffer(
      catalogueXml({ linkLocalXml: `<selectionEntries><selectionEntry id="${BARDING_ID}" name="Barding" type="upgrade"/></selectionEntries>` }),
      CAPTAIN_ON_WARHORSE
    );

    expect(anchoredIdsUnder(root, WARHORSE_LINK_ID, AnchorKind.OFFER_ANCHOR)).toContain(BARDING_ID);
  });

  it('bietet neben der am Verweis deklarierten Option auch die des Ziels an — beide Seiten, nicht die eine statt der anderen', () => {
    const root = buildTreeWithOffer(
      catalogueXml({
        linkLocalXml: `<selectionEntries><selectionEntry id="${BARDING_ID}" name="Barding" type="upgrade"/></selectionEntries>`,
        targetChildrenXml: `<selectionEntries><selectionEntry id="${TARGET_OWN_CHILD_ID}" name="Target Own Child" type="upgrade"/></selectionEntries>`,
      }),
      CAPTAIN_ON_WARHORSE
    );

    const offered = anchoredIdsUnder(root, WARHORSE_LINK_ID, AnchorKind.OFFER_ANCHOR);
    expect(offered).toContain(BARDING_ID);
    expect(offered).toContain(TARGET_OWN_CHILD_ID);
  });

  it('setzt einen Gruppen-Anker fuer eine am Verweis deklarierte Gruppe mit Grenze', () => {
    const root = buildTreeWithOffer(
      catalogueXml({
        linkLocalXml: `
          <selectionEntryGroups>
            <selectionEntryGroup id="${LOCAL_GROUP_ID}" name="Link Local Group">
              <constraints>
                <constraint id="max-local-group" type="max" value="1" field="selections" scope="parent"/>
              </constraints>
              <selectionEntries>
                <selectionEntry id="${LOCAL_GROUP_MEMBER_ID}" name="Local Group Member" type="upgrade"/>
              </selectionEntries>
            </selectionEntryGroup>
          </selectionEntryGroups>`,
      }),
      CAPTAIN_ON_WARHORSE
    );

    expect(anchoredIdsUnder(root, WARHORSE_LINK_ID, AnchorKind.GROUP_ANCHOR)).toContain(LOCAL_GROUP_ID);
    expect(anchoredIdsUnder(root, WARHORSE_LINK_ID, AnchorKind.OFFER_ANCHOR)).toContain(LOCAL_GROUP_MEMBER_ID);
  });

  it('setzt ein Pflicht-Phantom fuer eine am Verweis deklarierte Pflicht-Option (min 1, scope="parent")', () => {
    const root = buildTreeWithOffer(
      catalogueXml({
        linkLocalXml: `
          <selectionEntries>
            <selectionEntry id="${SADDLE_ID}" name="Saddle" type="upgrade">
              <constraints>
                <constraint id="min-saddle" type="min" value="1" field="selections" scope="parent"/>
              </constraints>
            </selectionEntry>
          </selectionEntries>`,
      }),
      CAPTAIN_ON_WARHORSE
    );

    expect(anchoredIdsUnder(root, WARHORSE_LINK_ID, AnchorKind.MANDATORY_PHANTOM)).toContain(SADDLE_ID);
  });

  it('KONTROLLE: haelt die am Verweis deklarierte Option aus dem aeusseren Rahmen heraus, solange der Verweis nicht belegt ist', () => {
    const root = buildTreeWithOffer(
      catalogueXml({ linkLocalXml: `<selectionEntries><selectionEntry id="${BARDING_ID}" name="Barding" type="upgrade"/></selectionEntries>` }),
      CAPTAIN_ON_FOOT
    );

    const offered = anchoredIdsUnder(root, CAPTAIN_ID, AnchorKind.OFFER_ANCHOR);
    expect(offered).toContain(WARHORSE_LINK_ID);
    expect(offered).not.toContain(BARDING_ID);
  });

  it('KONTROLLE: laesst einen Verweis ohne eigene Kinder unveraendert beim Angebot seines Ziels', () => {
    const root = buildTreeWithOffer(
      catalogueXml({ targetChildrenXml: `<selectionEntries><selectionEntry id="${TARGET_OWN_CHILD_ID}" name="Target Own Child" type="upgrade"/></selectionEntries>` }),
      CAPTAIN_ON_WARHORSE
    );

    expect(anchoredIdsUnder(root, WARHORSE_LINK_ID, AnchorKind.OFFER_ANCHOR)).toEqual([TARGET_OWN_CHILD_ID]);
  });
});
