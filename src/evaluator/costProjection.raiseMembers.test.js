/**
 * Issue 0157 — die **Pflicht-Mitglieder** eines Slots (`raiseMembers`).
 *
 * Der Bericht sagt nicht nur, was das Ausheben eines Slots kostet
 * (`raiseCosts`), sondern auch, **was dabei entsteht**: je Pflicht-Kind seine
 * Id, seine effektive Anzahl und dessen eigene Pflicht-Kinder. Das
 * Schreibmodell (`src/roster/selectionFactory.js`) legt genau diesen Baum an,
 * statt die Verpflichtung ein zweites Mal aus den Katalog-Constraints zu lesen
 * (ADR-0034). Preis und Baum stammen aus einem Durchlauf — was hier steht,
 * steht deshalb auch im Preis.
 *
 * Geprüfte Intention (aus `docs/battlescribe-data-format.md` §7.4/§8/§9.7
 * abgeleitet, nicht aus dem Engine-Quelltext):
 *  1. Ein Mitglied mit eigenem `min > 0` (Bezugsrahmen `parent`) ist Pflicht —
 *     mit seinem eigenen `min` als Anzahl, gleich ob eine Gruppe es hält.
 *  2. Eine Pflichtgruppe ohne itemisierte Mitglieder („nimm eins aus dem Topf")
 *     steuert die Vorgabe `defaultSelectionEntryId` bei, ersatzweise ihr erstes
 *     Mitglied, mit dem `min` der GRUPPE als Anzahl.
 *  3. Eine Gruppe ohne eigenes `min` steuert selbst nichts bei — aber der
 *     Abstieg in sie hängt nie daran.
 *  4. Ein verstecktes Pflicht-Kind ist keine Pflicht: seine Min-Grenze wird
 *     nicht validiert, also entsteht es auch nicht.
 *  5. Die Anzahl ist der **effektive** Wert: ein Modifikator, der das `min`
 *     hebt oder auf 0 senkt, entscheidet mit.
 *  6. Pflicht-Kinder eines Pflicht-Kindes stehen darunter, rekursiv.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), roster);
}

/** Der Angebots-Anker eines noch nicht ausgehobenen Eintrags. */
function offerAnchorByDefId(report, defId) {
  return [...report.capabilities.values()].find(
    capability => capability.defId === defId && capability.anchorKind === AnchorKind.OFFER_ANCHOR,
  );
}

/** Die Mitglieder in der Form, in der die Fabrik sie liest: Id und Anzahl. */
const shapeOf = (members) => members.map(({ defId, count }) => ({ defId, count }));

const FORCE_ID = 'force-army';
const POINTS_ID = 'cost-points';
const HERO_ID = 'entry-hero';

/** Ein Katalog mit genau einem Helden, dessen Innenleben der Aufrufer bestimmt. */
const catalogueWith = (heroBody) => `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-raise-members" name="Raise Members Catalogue">
    <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
    <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
    <selectionEntries>
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
        <costs><cost name="pts" typeId="${POINTS_ID}" value="10"/></costs>
        ${heroBody}
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const EMPTY_ROSTER = { forces: [{ defId: FORCE_ID, count: 1, children: [] }] };

const minLimit = (id, value) =>
  `<constraint id="${id}" type="min" value="${value}" field="selections" scope="parent"/>`;

describe('raiseMembers — itemisierte Pflicht (Kriterium 1)', () => {
  it('nennt jedes Mitglied mit eigenem min, mit dessen eigenem min als Anzahl', () => {
    const report = evaluate(catalogueWith(`
      <selectionEntries>
        <selectionEntry id="entry-crew" name="Crew" type="model">
          <constraints>${minLimit('lim-crew', 3)}</constraints>
        </selectionEntry>
        <selectionEntry id="entry-optional" name="Optional" type="upgrade"/>
      </selectionEntries>`), EMPTY_ROSTER);

    expect(shapeOf(offerAnchorByDefId(report, HERO_ID).raiseMembers))
      .toEqual([{ defId: 'entry-crew', count: 3 }]);
  });

  it('gilt auch innerhalb einer Gruppe ohne eigenes min — die Gruppe klammert nur', () => {
    const report = evaluate(catalogueWith(`
      <selectionEntryGroups>
        <selectionEntryGroup id="grp-equipment" name="Equipment">
          <selectionEntries>
            <selectionEntry id="entry-sword" name="Sword" type="upgrade">
              <constraints>${minLimit('lim-sword', 1)}</constraints>
            </selectionEntry>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>`), EMPTY_ROSTER);

    expect(shapeOf(offerAnchorByDefId(report, HERO_ID).raiseMembers))
      .toEqual([{ defId: 'entry-sword', count: 1 }]);
  });
});

describe('raiseMembers — wähle-eine-Pflichtgruppe (Kriterium 2)', () => {
  const groupWith = (attributes) => catalogueWith(`
    <selectionEntryGroups>
      <selectionEntryGroup id="grp-mounts" name="Mounts" ${attributes}>
        <constraints>${minLimit('lim-mounts', 1)}</constraints>
        <selectionEntries>
          <selectionEntry id="entry-foot" name="On Foot" type="upgrade"/>
          <selectionEntry id="entry-horse" name="Warhorse" type="upgrade"/>
        </selectionEntries>
      </selectionEntryGroup>
    </selectionEntryGroups>`);

  it('nennt die vom Katalog vorgegebene Option, auch wenn sie nicht die erste ist', () => {
    const report = evaluate(groupWith('defaultSelectionEntryId="entry-horse"'), EMPTY_ROSTER);

    expect(shapeOf(offerAnchorByDefId(report, HERO_ID).raiseMembers))
      .toEqual([{ defId: 'entry-horse', count: 1 }]);
  });

  it('fällt ohne Vorgabe — und bei einer ins Leere zeigenden Vorgabe — auf das erste Mitglied zurück', () => {
    expect(shapeOf(offerAnchorByDefId(evaluate(groupWith(''), EMPTY_ROSTER), HERO_ID).raiseMembers))
      .toEqual([{ defId: 'entry-foot', count: 1 }]);
    expect(shapeOf(offerAnchorByDefId(
      evaluate(groupWith('defaultSelectionEntryId="gibt-es-nicht"'), EMPTY_ROSTER), HERO_ID,
    ).raiseMembers)).toEqual([{ defId: 'entry-foot', count: 1 }]);
  });

  it('nimmt das min der GRUPPE als Anzahl', () => {
    const report = evaluate(catalogueWith(`
      <selectionEntryGroups>
        <selectionEntryGroup id="grp-shots" name="Shots">
          <constraints>${minLimit('lim-shots', 2)}</constraints>
          <selectionEntries><selectionEntry id="entry-bolt" name="Bolt" type="upgrade"/></selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>`), EMPTY_ROSTER);

    expect(shapeOf(offerAnchorByDefId(report, HERO_ID).raiseMembers))
      .toEqual([{ defId: 'entry-bolt', count: 2 }]);
  });

  it('tritt hinter die itemisierte Lesart zurück: trägt ein Mitglied ein eigenes min, entscheidet dieses', () => {
    const report = evaluate(catalogueWith(`
      <selectionEntryGroups>
        <selectionEntryGroup id="grp-mixed" name="Mixed" defaultSelectionEntryId="entry-first">
          <constraints>${minLimit('lim-mixed', 1)}</constraints>
          <selectionEntries>
            <selectionEntry id="entry-first" name="First" type="upgrade"/>
            <selectionEntry id="entry-forced" name="Forced" type="upgrade">
              <constraints>${minLimit('lim-forced', 1)}</constraints>
            </selectionEntry>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>`), EMPTY_ROSTER);

    expect(shapeOf(offerAnchorByDefId(report, HERO_ID).raiseMembers))
      .toEqual([{ defId: 'entry-forced', count: 1 }]);
  });
});

describe('raiseMembers — was keine Pflicht ist (Kriterien 3 und 4)', () => {
  it('eine Gruppe ohne eigenes min steuert nichts bei, hält den Abstieg aber offen', () => {
    const report = evaluate(catalogueWith(`
      <selectionEntryGroups>
        <selectionEntryGroup id="grp-outer" name="Outer">
          <selectionEntries><selectionEntry id="entry-loose" name="Loose" type="upgrade"/></selectionEntries>
          <selectionEntryGroups>
            <selectionEntryGroup id="grp-inner" name="Inner">
              <constraints>${minLimit('lim-inner', 1)}</constraints>
              <selectionEntries><selectionEntry id="entry-torch" name="Torch" type="upgrade"/></selectionEntries>
            </selectionEntryGroup>
          </selectionEntryGroups>
        </selectionEntryGroup>
      </selectionEntryGroups>`), EMPTY_ROSTER);

    expect(shapeOf(offerAnchorByDefId(report, HERO_ID).raiseMembers))
      .toEqual([{ defId: 'entry-torch', count: 1 }]);
  });

  it('ein verstecktes Pflicht-Kind entsteht nicht — seine Min-Grenze wird nicht validiert', () => {
    const report = evaluate(catalogueWith(`
      <selectionEntries>
        <selectionEntry id="entry-secret" name="Secret" type="upgrade" hidden="true">
          <constraints>${minLimit('lim-secret', 1)}</constraints>
        </selectionEntry>
        <selectionEntry id="entry-open" name="Open" type="upgrade">
          <constraints>${minLimit('lim-open', 1)}</constraints>
        </selectionEntry>
      </selectionEntries>`), EMPTY_ROSTER);

    expect(shapeOf(offerAnchorByDefId(report, HERO_ID).raiseMembers))
      .toEqual([{ defId: 'entry-open', count: 1 }]);
  });
});

describe('raiseMembers — effektive Anzahl und Rekursion (Kriterien 5 und 6)', () => {
  it('liest die Anzahl nach den Modifikatoren: ein auf 0 gesenktes min ist keine Pflicht mehr', () => {
    const report = evaluate(catalogueWith(`
      <selectionEntries>
        <selectionEntry id="entry-guard" name="Guard" type="model">
          <constraints>${minLimit('lim-guard', 2)}</constraints>
          <modifiers>
            <modifier type="set" field="lim-guard" value="0"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>`), EMPTY_ROSTER);

    expect(offerAnchorByDefId(report, HERO_ID).raiseMembers).toEqual([]);
  });

  it('liest ein angehobenes min als Anzahl', () => {
    const report = evaluate(catalogueWith(`
      <selectionEntries>
        <selectionEntry id="entry-guard" name="Guard" type="model">
          <constraints>${minLimit('lim-guard', 1)}</constraints>
          <modifiers>
            <modifier type="set" field="lim-guard" value="4"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>`), EMPTY_ROSTER);

    expect(shapeOf(offerAnchorByDefId(report, HERO_ID).raiseMembers))
      .toEqual([{ defId: 'entry-guard', count: 4 }]);
  });

  it('führt die Pflicht-Kinder eines Pflicht-Kindes darunter', () => {
    const report = evaluate(catalogueWith(`
      <selectionEntries>
        <selectionEntry id="entry-mount" name="Mount" type="model">
          <constraints>${minLimit('lim-mount', 1)}</constraints>
          <selectionEntries>
            <selectionEntry id="entry-barding" name="Barding" type="upgrade">
              <constraints>${minLimit('lim-barding', 1)}</constraints>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>`), EMPTY_ROSTER);

    const members = offerAnchorByDefId(report, HERO_ID).raiseMembers;
    expect(shapeOf(members)).toEqual([{ defId: 'entry-mount', count: 1 }]);
    expect(shapeOf(members[0].members)).toEqual([{ defId: 'entry-barding', count: 1 }]);
  });

  it('KONTROLLE: ein Slot ohne Pflicht-Kinder meldet keine Mitglieder', () => {
    const report = evaluate(catalogueWith(''), EMPTY_ROSTER);

    expect(offerAnchorByDefId(report, HERO_ID).raiseMembers).toEqual([]);
  });
});
