import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { prepareDataset } from './datasetPreparation.js';
import { buildEvalTree, allNodes, realNodes, pathOf, frameKeyOf } from './evalTree.js';
import { attachOfferAnchors } from './offer.js';
import { evaluate as evaluateDataset } from './evaluator.js';
import { AnchorKind } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Angebots-Schicht (`offer.js`, ADR-0035): *wer ist in welchem Rahmen waehlbar?*
 *
 * Geprueft wird die Bestimmung selbst — an eigenen, minimalen Katalogen, die genau
 * eine Regel je Fall isolieren. Die Fixture-Kataloge der 6. Edition sind fuer diese
 * Frage ungeeignet: dort haengt an jeder Wurzeldefinition ein Dutzend Kategorien,
 * und ein Fehlschlag waere nicht zuzuordnen.
 */

const FORCE_ID = 'force-army';
const CORE_CATEGORY_ID = 'cat-core';
const RARE_CATEGORY_ID = 'cat-rare';

const SPEARMEN_ID = 'entry-spearmen';
const DRAGON_ID = 'entry-dragon';
const STANDARD_ID = 'entry-standard';
const SHIELD_ID = 'entry-shield';
const SHIELD_RUNE_ID = 'entry-shield-rune';
const SWORD_LINK_ID = 'link-sword';
const SHARED_SWORD_ID = 'shared-sword';

/**
 * Ein Kontingent, das **nur** die Kategorie „Core" fuehrt, und drei
 * Wurzeldefinitionen: eine mit Core (angeboten), eine mit Rare (nicht gefuehrt,
 * also nicht angeboten) und eine ganz ohne Kategorie (nie ausschliessbar).
 *
 * Die Speertraeger tragen ihre Optionen in einer Gruppe: einen Schild mit einer
 * **eigenen** Unteroption (die dem Schild gehoert, nicht den Speertraegern) und
 * einen Verweis auf ein geteiltes Schwert.
 */
const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-offer" name="Offer Catalogue">
    <categoryEntries>
      <categoryEntry id="${CORE_CATEGORY_ID}" name="Core"/>
      <categoryEntry id="${RARE_CATEGORY_ID}" name="Rare"/>
    </categoryEntries>
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Army">
        <categoryLinks>
          <categoryLink id="link-core" name="Core" targetId="${CORE_CATEGORY_ID}">
            <constraints>
              <constraint id="max-core" type="max" value="2" field="selections" scope="force"/>
            </constraints>
          </categoryLink>
        </categoryLinks>
      </forceEntry>
    </forceEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${SHARED_SWORD_ID}" name="Sword" type="upgrade"/>
    </sharedSelectionEntries>
    <selectionEntries>
      <selectionEntry id="${SPEARMEN_ID}" name="Spearmen" type="unit">
        <categoryLinks>
          <categoryLink targetId="${CORE_CATEGORY_ID}"/>
        </categoryLinks>
        <selectionEntryGroups>
          <selectionEntryGroup id="group-weapons" name="Weapons">
            <selectionEntries>
              <selectionEntry id="${SHIELD_ID}" name="Shield" type="upgrade">
                <selectionEntries>
                  <selectionEntry id="${SHIELD_RUNE_ID}" name="Shield Rune" type="upgrade"/>
                </selectionEntries>
              </selectionEntry>
            </selectionEntries>
            <entryLinks>
              <entryLink id="${SWORD_LINK_ID}" name="Sword" targetId="${SHARED_SWORD_ID}" type="selectionEntry"/>
            </entryLinks>
          </selectionEntryGroup>
        </selectionEntryGroups>
      </selectionEntry>
      <selectionEntry id="${DRAGON_ID}" name="Dragon" type="unit">
        <categoryLinks>
          <categoryLink targetId="${RARE_CATEGORY_ID}"/>
        </categoryLinks>
      </selectionEntry>
      <selectionEntry id="${STANDARD_ID}" name="Standard" type="unit"/>
    </selectionEntries>
  </catalogue>`;

/** Ein Kontingent mit den uebergebenen Auswahl-Instanzen. */
function armyWith(selections) {
  return { forces: [{ defId: FORCE_ID, count: 1, children: selections }] };
}

/** Eine Auswahl-Instanz mit Anzahl 1 und den uebergebenen Kindern. */
function selection(defId, children = []) {
  return { defId, count: 1, children };
}

/** Baut Baumphase 1 und haengt anschliessend die Angebots-Anker an (Baumphase 2). */
function buildTreeWithOffer(roster, catalogXml = CATALOGUE_XML) {
  const { resolved } = prepareDataset({ catalogues: [catalogXml] });
  const { root } = buildEvalTree(resolved, roster);
  const anchors = attachOfferAnchors(root, resolved);
  return { root, anchors };
}

/** Die Definitions-IDs der Angebots-Anker unter dem Rahmen mit dieser Definitions-ID. */
function offeredIdsUnder(root, frameDefId) {
  const frame = [...allNodes(root)].find(node => node.def?.id === frameDefId);
  return frame.children
    .filter(child => child.anchorKind === AnchorKind.OFFER_ANCHOR)
    .map(child => child.def.id);
}

describe('Angebot je Kontingent: die Kategorienliste entscheidet', () => {
  it('bietet eine Wurzeldefinition an, deren Basis-Kategorie das Kontingent fuehrt', () => {
    const { root } = buildTreeWithOffer(armyWith([]));

    expect(offeredIdsUnder(root, FORCE_ID)).toContain(SPEARMEN_ID);
  });

  it('bietet eine Wurzeldefinition ohne jede Basis-Kategorie an — keine kann sie ausschliessen', () => {
    const { root } = buildTreeWithOffer(armyWith([]));

    expect(offeredIdsUnder(root, FORCE_ID)).toContain(STANDARD_ID);
  });

  it('bietet eine Wurzeldefinition NICHT an, deren einzige Kategorie das Kontingent nicht fuehrt', () => {
    const { root } = buildTreeWithOffer(armyWith([]));

    expect(offeredIdsUnder(root, FORCE_ID)).not.toContain(DRAGON_ID);
  });

  it('bietet eine geteilte Definition nicht als eigenstaendigen Eintrag an — sie ist nur ueber ihren Verweis erreichbar', () => {
    const { root } = buildTreeWithOffer(armyWith([]));

    expect(offeredIdsUnder(root, FORCE_ID)).not.toContain(SHARED_SWORD_ID);
  });
});

describe('Angebot unter einer belegten Auswahl: die direkten Optionen, nicht mehr', () => {
  it('bietet die Option einer Gruppe unter der belegten Auswahl an', () => {
    const { root } = buildTreeWithOffer(armyWith([selection(SPEARMEN_ID)]));

    expect(offeredIdsUnder(root, SPEARMEN_ID)).toContain(SHIELD_ID);
  });

  it('steigt durch einen `entryLink` auf ein Ziel ab und bietet den **Verweis** an, nicht das Ziel', () => {
    const { root } = buildTreeWithOffer(armyWith([selection(SPEARMEN_ID)]));

    const offered = offeredIdsUnder(root, SPEARMEN_ID);
    expect(offered).toContain(SWORD_LINK_ID);
    expect(offered).not.toContain(SHARED_SWORD_ID);
  });

  it('bietet die Option einer Option NICHT im aeusseren Rahmen an — sie gehoert der inneren Auswahl', () => {
    const { root } = buildTreeWithOffer(armyWith([selection(SPEARMEN_ID)]));

    expect(offeredIdsUnder(root, SPEARMEN_ID)).not.toContain(SHIELD_RUNE_ID);
  });

  it('bietet die Optionen einer nicht gewaehlten Einheit nicht an — ein Angebots-Anker ist ein Blatt', () => {
    const { anchors } = buildTreeWithOffer(armyWith([]));

    const spearmenAnchor = anchors.find(anchor => anchor.def.id === SPEARMEN_ID);
    expect(spearmenAnchor.children).toEqual([]);
  });

  it('bietet die Optionen erst an, wenn die Einheit da ist', () => {
    const withoutUnit = buildTreeWithOffer(armyWith([]));
    const withUnit = buildTreeWithOffer(armyWith([selection(SPEARMEN_ID)]));

    expect(withoutUnit.anchors.some(anchor => anchor.def.id === SHIELD_ID)).toBe(false);
    expect(withUnit.anchors.some(anchor => anchor.def.id === SHIELD_ID)).toBe(true);
  });
});

describe('Entdopplung: kein zweiter Anker fuer dieselbe Definition im selben Rahmen', () => {
  it('bietet eine bereits gewaehlte Einheit im selben Kontingent nicht noch einmal an', () => {
    const { root } = buildTreeWithOffer(armyWith([selection(SPEARMEN_ID)]));

    expect(offeredIdsUnder(root, FORCE_ID)).not.toContain(SPEARMEN_ID);
  });

  it('bietet eine bereits gewaehlte Option unter ihrer Auswahl nicht noch einmal an', () => {
    const { root } = buildTreeWithOffer(armyWith([selection(SPEARMEN_ID, [selection(SHIELD_ID)])]));

    expect(offeredIdsUnder(root, SPEARMEN_ID)).not.toContain(SHIELD_ID);
  });

  it('erkennt eine unter der Ziel-ID gefuehrte Instanz als Beleg des Verweises', () => {
    // Das Roster fuehrt das geteilte Schwert unter seiner **Ziel**-ID; der Verweis
    // darauf darf trotzdem keinen zweiten Anker bekommen.
    const { root } = buildTreeWithOffer(armyWith([selection(SPEARMEN_ID, [selection(SHARED_SWORD_ID)])]));

    expect(offeredIdsUnder(root, SPEARMEN_ID)).not.toContain(SWORD_LINK_ID);
  });

  it('bietet eine vom Kontingent gefuehrte Kategorie nicht zusaetzlich als Auswahl an', () => {
    const { root } = buildTreeWithOffer(armyWith([]));

    expect(offeredIdsUnder(root, FORCE_ID)).not.toContain(CORE_CATEGORY_ID);
  });

  it('bietet eine fehlende Pflicht-Option nicht neben ihrem Pflicht-Anker an', () => {
    // Die haeufigste echte Kollision: eine Option mit `min > 0` (scope=parent) fehlt,
    // bekommt also schon in Baumphase 1 ihren Pflicht-Phantom. Ein zusaetzlicher
    // Angebots-Anker traege dieselbe Grenze ein zweites Mal — und meldete sie doppelt.
    const MANDATORY_OPTION_ID = 'entry-mandatory-option';
    const HOST_ID = 'entry-host';
    const catalogueXml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-offer-mandatory" name="Offer Mandatory Catalogue">
        <forceEntries>
          <forceEntry id="${FORCE_ID}" name="Army"/>
        </forceEntries>
        <selectionEntries>
          <selectionEntry id="${HOST_ID}" name="Host" type="unit">
            <selectionEntries>
              <selectionEntry id="${MANDATORY_OPTION_ID}" name="Mandatory Option" type="upgrade">
                <constraints>
                  <constraint id="min-mandatory-option" type="min" value="1" field="selections" scope="parent"/>
                </constraints>
              </selectionEntry>
            </selectionEntries>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;

    const { root } = buildTreeWithOffer(armyWith([selection(HOST_ID)]), catalogueXml);

    const host = [...allNodes(root)].find(node => node.def?.id === HOST_ID);
    const anchorsForOption = host.children.filter(child => child.def.id === MANDATORY_OPTION_ID);
    expect(anchorsForOption).toHaveLength(1);
    expect(anchorsForOption[0].anchorKind).toBe(AnchorKind.MANDATORY_PHANTOM);
  });
});

describe('Baumphase 2 laesst den bestehenden Baum unberuehrt', () => {
  it('haelt die Pfade aller vor Phase 2 vorhandenen Slots stabil', () => {
    const { resolved } = prepareDataset({ catalogues: [CATALOGUE_XML] });
    const roster = armyWith([selection(SPEARMEN_ID, [selection(SHIELD_ID)])]);
    const { root } = buildEvalTree(resolved, roster);
    const pathsBefore = new Map([...allNodes(root)].map(node => [node, pathOf(node)]));

    attachOfferAnchors(root, resolved);

    for (const [node, pathBefore] of pathsBefore) {
      expect(pathOf(node)).toBe(pathBefore);
    }
  });

  it('gibt jedem Angebots-Anker eine eigene Rahmen-Identitaet, die keine bestehende wiederverwendet', () => {
    const { root } = buildTreeWithOffer(armyWith([selection(SPEARMEN_ID)]));

    const frameKeys = [...allNodes(root)].map(frameKeyOf);
    expect(new Set(frameKeys).size).toBe(frameKeys.length);
  });

  it('haengt keinen Anker unter einen Anker — nur reale Knoten sind Rahmen des Angebots', () => {
    const { root } = buildTreeWithOffer(armyWith([selection(SPEARMEN_ID)]));

    const anchorsUnderAnchors = [...allNodes(root)]
      .filter(node => node.isPhantom)
      .flatMap(node => node.children);
    expect(anchorsUnderAnchors).toEqual([]);
  });

  it('macht aus keinem Angebots-Anker einen realen Knoten', () => {
    const { anchors } = buildTreeWithOffer(armyWith([selection(SPEARMEN_ID)]));

    expect(anchors.every(anchor => anchor.isPhantom && anchor.instance === null)).toBe(true);
  });

  it('erweitert die Menge der realen Knoten nicht', () => {
    const { resolved } = prepareDataset({ catalogues: [CATALOGUE_XML] });
    const roster = armyWith([selection(SPEARMEN_ID)]);
    const { root } = buildEvalTree(resolved, roster);
    const realBefore = [...realNodes(root)];

    attachOfferAnchors(root, resolved);

    expect([...realNodes(root)]).toEqual(realBefore);
  });
});

describe('Bericht: das Angebot speist Faehigkeitsdatensaetze, aber nie die Verletzungsliste', () => {
  const OFFERED_MIN_ID = 'entry-offered-min';
  const MIN_LIMIT_ID = 'min-offered';
  // Eine waehlbare, nicht gewaehlte Definition mit einer armeeweiten Pflichtgrenze:
  // ihr Angebots-Anker liest Ist 0 gegen Grenze 1 — als Zustand, nicht als Meldung.
  // Ihre Pflicht haengt am **Kontingent**-Rahmen, damit sie kein Pflicht-Phantom an
  // der Wurzel erzeugt und der Fall wirklich den Angebots-Anker prueft.
  const MIN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-offer-min" name="Offer MIN Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${OFFERED_MIN_ID}" name="Offered" type="unit">
          <constraints>
            <constraint id="${MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="self"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('meldet keine Verletzung fuer eine angebotene, nicht gewaehlte Definition', () => {
    const report = evaluateDataset({ catalogues: [MIN_CATALOGUE_XML] }, armyWith([]));

    expect(report.violations.filter(violation => violation.limitId === MIN_LIMIT_ID)).toEqual([]);
  });

  it('fuehrt fuer sie trotzdem einen Faehigkeitsdatensatz mit ihrem unerfuellten Mindestmass', () => {
    const report = evaluateDataset({ catalogues: [MIN_CATALOGUE_XML] }, armyWith([]));

    const offered = [...report.capabilities.values()]
      .find(capability => capability.defId === OFFERED_MIN_ID);
    expect(offered).toMatchObject({
      anchorKind: AnchorKind.OFFER_ANCHOR,
      frame: { defId: FORCE_ID, path: '0' },
      effectiveMin: 1,
      current: 0,
      isMandatoryUnmet: true,
    });
  });
});
