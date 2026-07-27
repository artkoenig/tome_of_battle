/**
 * Die **Belegung** je Slot (`occupancy.js`): was an der Stelle eines Slots steht,
 * gezaehlt aus dem Zaehlindex und unabhaengig von jeder Grenze.
 *
 * Geprueft wird die Zaehlregel selbst — Rahmen, Ziel und Messgroesse je Ankerart —,
 * nicht ihre Verwendung im Bericht (die haelt `report.occupancy.test.js` fest).
 * Beides getrennt, weil die Regel eine Aussage ueber den Baum ist und nicht ueber
 * den Datensatz, der sie liest.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { PreparedDataset, prepareDataset } from './datasetPreparation.js';
import { buildEvalTree, allNodes } from './evalTree.js';
import { attachOfferAnchors } from './offer.js';
import { buildIndex } from './countIndex.js';
import { createBaseEffectiveState } from './effectiveState.js';
import { buildOccupancyIndex, occupancyOf } from './occupancy.js';
import { AnchorKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Eigene, minimale Fixtures (ADR-0030) ─────────────────────────────────────

const DETACHMENT_FORCE_ID = 'force-detachment';
const ELITE_CATEGORY_ID = 'cat-elite';
const WARRIOR_ID = 'entry-warrior';
const BANNER_ID = 'entry-banner';
const WARRIOR_COUNT = 2;
const DETACHMENT_COUNT = 1;

/**
 * Ein Kontingent, das die Kategorie „Elite" fuehrt (⇒ Kategorie-Anker), ein Krieger
 * in dieser Kategorie (real vorhanden) und ein Bannertraeger mit armeeweiter
 * Pflichtgrenze, den das Roster nicht fuehrt (⇒ Pflicht-Phantom).
 */
const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-occupancy-unit" name="Occupancy Unit Catalogue">
    <categoryEntries>
      <categoryEntry id="${ELITE_CATEGORY_ID}" name="Elite"/>
    </categoryEntries>
    <forceEntries>
      <forceEntry id="${DETACHMENT_FORCE_ID}" name="Detachment">
        <categoryLinks>
          <categoryLink id="link-elite" targetId="${ELITE_CATEGORY_ID}"/>
        </categoryLinks>
      </forceEntry>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <categoryLinks>
          <categoryLink id="link-warrior-elite" targetId="${ELITE_CATEGORY_ID}"/>
        </categoryLinks>
      </selectionEntry>
      <selectionEntry id="${BANNER_ID}" name="Banner" type="upgrade">
        <constraints>
          <constraint id="min-banner" type="min" value="1" field="selections" scope="roster"/>
        </constraints>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/**
 * Baut Baum, Index und Belegung — in derselben Reihenfolge wie die Fassade: die
 * Angebots-Anker haengen vor der Zaehlung, damit auch sie eine Belegung tragen.
 */
function buildOccupancy() {
  const { resolved, catalogueIds } = PreparedDataset.contentsOf(prepareDataset({ catalogues: [CATALOGUE_XML] }));
  const roster = {
    forces: [{
      defId: DETACHMENT_FORCE_ID,
      count: DETACHMENT_COUNT,
      children: [{ defId: WARRIOR_ID, count: WARRIOR_COUNT, children: [] }],
    }],
  };
  const { root } = buildEvalTree(resolved, roster, catalogueIds);
  const index = buildIndex(root, createBaseEffectiveState(root));
  attachOfferAnchors(root, resolved);
  return { root, occupancy: buildOccupancyIndex(root, index, resolved.categoryIds) };
}

/** Der einzige Knoten einer Definition mit gegebener Ankerart. */
function nodeOf(root, defId, anchorKind) {
  const found = [...allNodes(root)].filter(node => node.def.id === defId && node.anchorKind === anchorKind);
  expect(found).toHaveLength(1);
  return found[0];
}

describe('Belegung: was an der Stelle eines Slots steht', () => {
  it('zaehlt an einem belegten Slot die Auswahlen in seinem Rahmen', () => {
    const { root, occupancy } = buildOccupancy();

    expect(occupancyOf(occupancy, nodeOf(root, WARRIOR_ID, AnchorKind.OCCUPIED))).toBe(WARRIOR_COUNT);
  });

  it('zaehlt an einem Kontingent-Slot Kontingente, nicht Auswahlen', () => {
    const { root, occupancy } = buildOccupancy();

    // Die Messgroesse eines Kontingent-Slots ist `forceCount` — dieselbe Aussage
    // („wie viel steht hier"), nur in der Einheit dieses Slots.
    expect(occupancyOf(occupancy, nodeOf(root, DETACHMENT_FORCE_ID, AnchorKind.OCCUPIED))).toBe(DETACHMENT_COUNT);
  });

  it('zaehlt an einem Kategorie-Anker, was in seinem Kontingent unter der Kategorie steht', () => {
    const { root, occupancy } = buildOccupancy();

    // Der Anker traegt den Verweis, gezaehlt wird seine Kategorie (`countingTargetIdOf`).
    const categoryAnchor = [...allNodes(root)].find(node => node.anchorKind === AnchorKind.CATEGORY_ANCHOR);
    expect(occupancyOf(occupancy, categoryAnchor)).toBe(WARRIOR_COUNT);
  });

  it('zaehlt an einem Pflicht-Anker 0 — dort steht ja gerade nichts', () => {
    const { root, occupancy } = buildOccupancy();

    expect(occupancyOf(occupancy, nodeOf(root, BANNER_ID, AnchorKind.MANDATORY_PHANTOM))).toBe(0);
  });

  it('traegt jeden Slot des Baums — auch die zuletzt angehaengten Angebots-Anker', () => {
    const { root, occupancy } = buildOccupancy();

    const slots = [...allNodes(root)];
    expect(slots.every(node => occupancy.has(node))).toBe(true);
    expect(slots.some(node => node.anchorKind === AnchorKind.OFFER_ANCHOR)).toBe(true);
  });

  it('meldet einen ungezaehlten Slot laut, statt ihn als 0 auszugeben', () => {
    const { occupancy } = buildOccupancy();

    // Genau der Ersatzwert, den dieses Modul abschafft: er darf nicht durch die
    // Hintertuer eines fehlenden Eintrags zurueckkehren.
    expect(() => occupancyOf(occupancy, { def: { id: 'node-outside-the-tree' } })).toThrow('node-outside-the-tree');
  });
});
