import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { PreparedDataset, prepareDataset } from './datasetPreparation.js';
import { buildEvalTree, syntheticNodes, realNodes, frameKeyOf } from './evalTree.js';
import { attachOfferAnchors } from './offer.js';
import { buildIndex } from './countIndex.js';
import { createBaseEffectiveState } from './effectiveState.js';
import { AnchorKind, scopeKey, ScopeKeyword } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * **Die tragende Invariante des Nach-Durchlaufs** (`design.md`, Issue 75/03):
 * *ein synthetischer Anker geht nie in den Zaehlindex ein.*
 *
 * Nur sie macht es exakt, die Fixpunktschleife auf die realen Knoten einzuengen und
 * die Anker **einmal danach** auszuwerten: was nicht gezaehlt wird, kann auf den
 * gezaehlten Bestand nicht zurueckwirken. Braeche sie, wuerde aus dem exakten
 * Nach-Durchlauf still eine Naeherung — ein Fehlerbild, das sich als leicht falsche
 * Zahlen aeussert und praktisch nicht zu finden ist. Sie gehoert deshalb als
 * Modultest an die Index-Schicht und nicht bloss in einen Kommentar.
 */

const WARRIOR_ID = 'entry-warrior';
const BANNER_ID = 'entry-banner';
const ELITE_CAT_ID = 'cat-elite';
const POINTS_ID = 'cost-points';
const WARRIOR_POINTS = 10;
const WARRIOR_COUNT = 2;

/**
 * Ein Krieger mit Kosten und Kategorie (real vorhanden) und ein Bannertraeger mit
 * armeeweiter Pflichtgrenze (nicht vorhanden ⇒ Pflicht-Phantom an der Wurzel).
 */
const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-synthetic-anchors" name="Synthetic Anchors Catalogue">
    <categoryEntries>
      <categoryEntry id="${ELITE_CAT_ID}" name="Elite"/>
    </categoryEntries>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <costs>
          <cost name="Points" typeId="${POINTS_ID}" value="${WARRIOR_POINTS}"/>
        </costs>
        <categoryLinks>
          <categoryLink targetId="${ELITE_CAT_ID}"/>
        </categoryLinks>
      </selectionEntry>
      <selectionEntry id="${BANNER_ID}" name="Banner" type="upgrade">
        <constraints>
          <constraint id="min-banner" type="min" value="1" field="selections" scope="roster"/>
        </constraints>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Baut Baum und Index aus dem Katalog und einem Roster aus einer Krieger-Auswahl. */
function buildTreeAndIndex() {
  const { resolved } = PreparedDataset.contentsOf(prepareDataset({ catalogues: [CATALOGUE_XML] }));
  const roster = { forces: [{ defId: WARRIOR_ID, count: WARRIOR_COUNT, children: [] }] };
  const { root } = buildEvalTree(resolved, roster);
  return { root, index: buildIndex(root, createBaseEffectiveState(root)) };
}

/** Die armeeweiten Schluessel, unter denen ueberhaupt etwas gezaehlt werden kann. */
const ROSTER_KEYS = Object.freeze([
  scopeKey(ScopeKeyword.ROSTER, null),
  scopeKey(ScopeKeyword.ROSTER, WARRIOR_ID),
  scopeKey(ScopeKeyword.ROSTER, BANNER_ID),
  scopeKey(ScopeKeyword.ROSTER, ELITE_CAT_ID),
]);

/**
 * Alle Antworten des Index auf eine Schluesselmenge als vergleichbarer Text — mit
 * beiden `includeChild…`-Flags, damit kein Beitrags-Eimer aus dem Vergleich faellt.
 */
function answersOf(index, keys) {
  return keys.map(key => {
    const tally = index.get(key, true, true);
    const costs = [...tally.costSums].map(([costTypeId, value]) => `${costTypeId}=${value}`).sort();
    return `${key} → ${tally.selectionCount}/${tally.forceCount}/${costs.join(',')}`;
  });
}

/**
 * Haengt einen zusaetzlichen synthetischen Anker fuer eine **gezaehlte** Definition
 * an die Wurzel: derselbe Definitionsknoten, den der reale Krieger traegt, also
 * dieselben Kosten, dieselbe Kategorie, dieselben Zaehlschluessel. Genau so saehe
 * ein Angebots-Anker aus, der versehentlich mitgezaehlt wuerde.
 */
function attachExtraAnchorFor(root, node) {
  const anchor = {
    def: node.def,
    instance: null,
    parent: root,
    children: [],
    isPhantom: true,
    isRoot: false,
    isForce: false,
    anchorKind: AnchorKind.OFFER_ANCHOR,
    frameId: Number.MAX_SAFE_INTEGER,
    forceRoot: null,
  };
  root.children.push(anchor);
  return anchor;
}

describe('Index-Schicht: ein synthetischer Anker geht nie in die Zaehlung ein', () => {
  it('zaehlt den Pflicht-Anker einer fehlenden Definition nicht als vorhandene Auswahl', () => {
    const { index } = buildTreeAndIndex();

    // Der Bannertraeger hat einen Anker, aber keine Instanz: er zaehlt 0. Zaehlte er
    // mit, waere seine eigene Pflichtgrenze scheinbar erfuellt.
    expect(index.get(scopeKey(ScopeKeyword.ROSTER, BANNER_ID), true, true).selectionCount).toBe(0);
  });

  it('zaehlt armeeweit genau die realen Auswahlen — Anker tragen weder Anzahl noch Kosten bei', () => {
    const { root, index } = buildTreeAndIndex();

    expect([...syntheticNodes(root)].length).toBeGreaterThan(0); // der Fall ist nicht leer
    const rosterTally = index.get(scopeKey(ScopeKeyword.ROSTER, null), true, true);
    expect(rosterTally.selectionCount).toBe(WARRIOR_COUNT);
    expect(rosterTally.costSums.get(POINTS_ID)).toBe(WARRIOR_POINTS * WARRIOR_COUNT);
  });

  it('laesst jede Index-Antwort unveraendert, wenn ein Anker fuer eine gezaehlte Definition hinzukommt', () => {
    const { root, index } = buildTreeAndIndex();
    const before = answersOf(index, ROSTER_KEYS);

    const warrior = [...realNodes(root)].find(node => node.def.id === WARRIOR_ID);
    attachExtraAnchorFor(root, warrior);
    // Frischer Basiszustand: der neue Anker traegt dieselben Basiskosten und
    // -kategorien wie der reale Krieger — er ist also voll „zaehlbar" bevoelkert.
    const withAnchor = buildIndex(root, createBaseEffectiveState(root));

    expect(answersOf(withAnchor, ROSTER_KEYS)).toEqual(before);
  });

  it('traegt keinen synthetischen Knoten in der Traversierung der gezaehlten Knoten', () => {
    const { root } = buildTreeAndIndex();

    // Die Zaehlung stuetzt sich allein auf {@link realNodes}; kein Anker ist darin,
    // und kein Anker traegt eine Instanz, aus der eine Anzahl kaeme.
    expect([...realNodes(root)].some(node => node.isPhantom)).toBe(false);
    expect([...syntheticNodes(root)].every(node => node.instance === null)).toBe(true);
  });

  it('gibt jedem Anker eine eigene Rahmen-Identitaet, die keinen realen Rahmen ueberschreibt', () => {
    const { root } = buildTreeAndIndex();

    const frameKeys = [...realNodes(root), ...syntheticNodes(root)].map(frameKeyOf);
    expect(new Set(frameKeys).size).toBe(frameKeys.length);
  });
});

// ── Dieselbe Invariante am **echten** Zuwachs: den Angebots-Ankern ────────────
// Der Fall oben baut einen Anker von Hand nach; dieser laesst Baumphase 2 selbst
// laufen. Beides gehoert hierher: der handgebaute Fall zeigt, dass die Zaehlung
// einen mitzaehlenden Anker gar nicht erst zulaesst, dieser hier, dass die
// tatsaechlich gebaute Angebotsmenge ihn nicht erzeugt.

const ARMY_FORCE_ID = 'force-army';

/**
 * Ein Kontingent ohne Kategorienliste und zwei Wurzeldefinitionen ohne
 * Basis-Kategorie — beide sind damit im Kontingent waehlbar und bekommen ihren
 * Angebots-Anker, sobald sie nicht gewaehlt sind.
 */
const OFFER_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-offer-index" name="Offer Index Catalogue">
    <forceEntries>
      <forceEntry id="${ARMY_FORCE_ID}" name="Army"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <costs>
          <cost name="Points" typeId="${POINTS_ID}" value="${WARRIOR_POINTS}"/>
        </costs>
        <categoryLinks>
          <categoryLink targetId="${ELITE_CAT_ID}"/>
        </categoryLinks>
      </selectionEntry>
      <selectionEntry id="${BANNER_ID}" name="Banner" type="upgrade"/>
    </selectionEntries>
    <categoryEntries>
      <categoryEntry id="${ELITE_CAT_ID}" name="Elite"/>
    </categoryEntries>
  </catalogue>`;

describe('Index-Schicht: auch die Angebots-Anker aus Baumphase 2 zaehlen nie mit', () => {
  /** Kontingent mit einem Krieger; der Bannertraeger bleibt ungewaehlt (Angebot). */
  function buildOfferTree() {
    const { resolved } = PreparedDataset.contentsOf(prepareDataset({ catalogues: [OFFER_CATALOGUE_XML] }));
    const roster = {
      forces: [{ defId: ARMY_FORCE_ID, count: 1, children: [{ defId: WARRIOR_ID, count: WARRIOR_COUNT, children: [] }] }],
    };
    const { root } = buildEvalTree(resolved, roster);
    return { root, resolved };
  }

  const OFFER_KEYS = Object.freeze([
    scopeKey(ScopeKeyword.ROSTER, null),
    scopeKey(ScopeKeyword.ROSTER, WARRIOR_ID),
    scopeKey(ScopeKeyword.ROSTER, BANNER_ID),
    scopeKey(ScopeKeyword.ROSTER, ELITE_CAT_ID),
  ]);

  it('laesst jede Index-Antwort unveraendert, obwohl Baumphase 2 Anker fuer gezaehlte Definitionen anhaengt', () => {
    const { root, resolved } = buildOfferTree();
    const before = answersOf(buildIndex(root, createBaseEffectiveState(root)), OFFER_KEYS);

    const anchors = attachOfferAnchors(root, resolved);

    // Der Fall ist nicht leer: der ungewaehlte Bannertraeger ist angeboten.
    expect(anchors.map(anchor => anchor.def.id)).toContain(BANNER_ID);
    expect(answersOf(buildIndex(root, createBaseEffectiveState(root)), OFFER_KEYS)).toEqual(before);
  });
});

// ── Die Identitaet einer Eintragsgruppe ist kein Zaehlziel ────────────────────
// Eine `selectionEntryGroup` buendelt nur; gezaehlt werden ihre Member. Das gilt
// unabhaengig vom Weg, auf dem sie an ihre Stelle kommt: ein `entryLink` auf eine
// Gruppe **ist** diese Gruppe dort, kein zaehlbares Vorkommen daneben. Truege er
// seine Ids bei, laege eine gruppen-skopierte Grenze um eins zu hoch.

const MAGIC_GROUP_ID = 'group-magic-items';
const GROUP_LINK_ID = 'link-magic-items';
const SWORD_ID = 'entry-sword';
const HERO_ID = 'entry-hero';

const GROUP_LINK_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-group-link" name="Group Link Catalogue">
    <sharedSelectionEntryGroups>
      <selectionEntryGroup id="${MAGIC_GROUP_ID}" name="Magic Items">
        <selectionEntries>
          <selectionEntry id="${SWORD_ID}" name="Sword" type="upgrade"/>
        </selectionEntries>
      </selectionEntryGroup>
    </sharedSelectionEntryGroups>
    <selectionEntries>
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
        <entryLinks>
          <entryLink id="${GROUP_LINK_ID}" name="Magic Items" targetId="${MAGIC_GROUP_ID}" type="selectionEntryGroup"/>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

describe('Index-Schicht: die Identitaet einer Eintragsgruppe ist kein Zaehlziel', () => {
  /** Der Held mit dem Gruppen-Verweis, der Gruppe selbst und einem echten Member darunter. */
  function buildGroupLinkIndex() {
    const { resolved } = PreparedDataset.contentsOf(prepareDataset({ catalogues: [GROUP_LINK_CATALOGUE_XML] }));
    const roster = {
      forces: [{
        defId: HERO_ID,
        count: 1,
        children: [
          { defId: GROUP_LINK_ID, count: 1, children: [] },
          { defId: MAGIC_GROUP_ID, count: 1, children: [] },
          { defId: SWORD_ID, count: 1, children: [] },
        ],
      }],
    };
    const { root } = buildEvalTree(resolved, roster);
    return buildIndex(root, createBaseEffectiveState(root));
  }

  /** Der armeeweite Bestand unter einer Ziel-Id, beide Beitrags-Eimer eingeschlossen. */
  function rosterCountOf(index, targetId) {
    return index.get(scopeKey(ScopeKeyword.ROSTER, targetId), true, true).selectionCount;
  }

  it('zaehlt unter der Gruppen-Id nichts — weder die Gruppe selbst noch den Verweis auf sie', () => {
    const index = buildGroupLinkIndex();

    expect(rosterCountOf(index, MAGIC_GROUP_ID)).toBe(0);
    expect(rosterCountOf(index, GROUP_LINK_ID)).toBe(0);
  });

  it('zaehlt das Member der Gruppe unveraendert unter seiner eigenen Id', () => {
    const index = buildGroupLinkIndex();

    expect(rosterCountOf(index, SWORD_ID)).toBe(1);
  });
});
