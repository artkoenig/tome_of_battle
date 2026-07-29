import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * **Nachfahren-Kosten gehorchen dem Flag in JEDEM Rahmen** (Issue 091,
 * Review-Runde 1; BSData-Wiki, `docs/battlescribe-data-format.md` §9.4).
 *
 * Der Traeger der Grenze bestimmt, was summiert wird:
 * - `includeChildSelections="false"`: keine Nachfahren-Kosten — hier, wo der
 *   Traeger direkt im Rahmen liegt, also NUR seine eigenen effektiven Kosten
 *   („just scope's field" — die enge, dokumentierte Lesart);
 * - `includeChildSelections="true"`: die Kosten des Traegers plus die Kosten
 *   ALLER Nachfahren-Auswahlen (mal Stueckzahl).
 *
 * Das muss fuer jeden Rahmen gelten, den die Grenze benutzen kann — auch fuer
 * die beiden, die Runde 1 als gebrochen belegt hat: `scope="self"` und
 * `shared="false"` (wertet im eigenen Rahmen des Traegers aus). Ab
 * Verschachtelungstiefe 2 schaltet das Flag den GANZEN Teilbaum einheitlich —
 * kein Hybrid, bei dem das direkte Kind zaehlt, das Enkelkind aber nicht.
 */

const FORCE_ID = 'force-army';
const HERO_ID = 'entry-hero';
const ITEM_ID = 'entry-item';
const GEM_ID = 'entry-gem';
const POINTS_ID = 'cost-points';
const HERO_LIMIT_ID = 'limit-hero-points';

const HERO_POINTS = 50;
const ITEM_POINTS = 60;
const GEM_POINTS = 40;
const HERO_BOUND = 100;

/**
 * Held (50 Pkt) mit Kostenart-Grenze (max 100) und einem waehlbaren Gegenstand
 * (60 Pkt); optional traegt der Gegenstand seinerseits einen Edelstein (40 Pkt).
 * `scope`, `shared` und `includeChildSelections` der Grenze sind die Parameter.
 */
function heroCatalogue({ scope, shared, includeChildSelections, withGrandchild = false }) {
  const gem = withGrandchild
    ? `<selectionEntries>
         <selectionEntry id="${GEM_ID}" name="Gem" type="upgrade">
           <costs>
             <cost name="Points" typeId="${POINTS_ID}" value="${GEM_POINTS}"/>
           </costs>
         </selectionEntry>
       </selectionEntries>`
    : '';
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cost-frame" name="Cost Frame Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${HERO_ID}" name="Hero" type="model">
          <costs>
            <cost name="Points" typeId="${POINTS_ID}" value="${HERO_POINTS}"/>
          </costs>
          <constraints>
            <constraint id="${HERO_LIMIT_ID}" type="max" value="${HERO_BOUND}"
                        field="${POINTS_ID}" scope="${scope}" shared="${shared}"
                        percentValue="false"
                        includeChildSelections="${includeChildSelections}"
                        includeChildForces="false"/>
          </constraints>
          <selectionEntries>
            <selectionEntry id="${ITEM_ID}" name="Item" type="upgrade">
              <costs>
                <cost name="Points" typeId="${POINTS_ID}" value="${ITEM_POINTS}"/>
              </costs>
              ${gem}
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Ein Kontingent: Held mit Gegenstand, optional darunter der Edelstein. */
function rosterWithItem({ withGrandchild = false } = {}) {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: [{
        defId: HERO_ID,
        count: 1,
        children: [{
          defId: ITEM_ID,
          count: 1,
          children: withGrandchild ? [{ defId: GEM_ID, count: 1, children: [] }] : [],
        }],
      }],
    }],
  };
}

/** Wertet einen Einzelkatalog ueber die echte Fassade aus (ADR-0032: `{ catalogues }`). */
function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), roster);
}

/** Die Meldung der Helden-Grenze, oder `undefined`, wenn sie nicht feuert. */
function heroViolation(report) {
  return report.violations.find(violation => violation.limitId === HERO_LIMIT_ID);
}

/** Der Faehigkeitsdatensatz des Helden — er traegt den Ist-Wert auch ohne Verstoss. */
function heroCapability(report) {
  return [...report.capabilities.values()].find(capability => capability.defId === HERO_ID);
}

describe('Kostenart-Grenze im scope="self"-Rahmen', () => {
  it('liest mit includeChildSelections="false" nur die eigenen Kosten des Traegers (50, kein Verstoss)', () => {
    const report = evaluate(
      heroCatalogue({ scope: 'self', shared: 'true', includeChildSelections: 'false' }),
      rosterWithItem(),
    );

    // „just scope's field": der Gegenstand (60) bleibt aussen vor — 50 <= 100.
    expect(heroViolation(report)).toBeUndefined();
    expect(heroCapability(report)?.current).toBe(HERO_POINTS);
  });

  it('summiert mit includeChildSelections="true" den Nachfahren mit (110 gegen 100)', () => {
    const report = evaluate(
      heroCatalogue({ scope: 'self', shared: 'true', includeChildSelections: 'true' }),
      rosterWithItem(),
    );

    expect(heroViolation(report)).toMatchObject({
      limitId: HERO_LIMIT_ID,
      actual: HERO_POINTS + ITEM_POINTS,
      bound: HERO_BOUND,
    });
  });
});

describe('Kostenart-Grenze mit shared="false" (wertet im eigenen Rahmen des Traegers)', () => {
  it('liest mit includeChildSelections="false" nur die eigenen Kosten des Traegers (50, kein Verstoss)', () => {
    const report = evaluate(
      heroCatalogue({ scope: 'roster', shared: 'false', includeChildSelections: 'false' }),
      rosterWithItem(),
    );

    expect(heroViolation(report)).toBeUndefined();
    expect(heroCapability(report)?.current).toBe(HERO_POINTS);
  });

  it('summiert mit includeChildSelections="true" den Nachfahren mit (110 gegen 100)', () => {
    const report = evaluate(
      heroCatalogue({ scope: 'roster', shared: 'false', includeChildSelections: 'true' }),
      rosterWithItem(),
    );

    expect(heroViolation(report)).toMatchObject({
      limitId: HERO_LIMIT_ID,
      actual: HERO_POINTS + ITEM_POINTS,
      bound: HERO_BOUND,
    });
  });
});

describe('Verschachtelungstiefe 2: das Flag schaltet den ganzen Teilbaum einheitlich', () => {
  it('liest mit includeChildSelections="false" weiterhin NUR den Traeger (50, kein Verstoss)', () => {
    const report = evaluate(
      heroCatalogue({ scope: 'self', shared: 'true', includeChildSelections: 'false', withGrandchild: true }),
      rosterWithItem({ withGrandchild: true }),
    );

    // Kein Hybrid: weder Kind (60) noch Enkelkind (40) duerfen hereinzaehlen.
    expect(heroViolation(report)).toBeUndefined();
    expect(heroCapability(report)?.current).toBe(HERO_POINTS);
  });

  it('summiert mit includeChildSelections="true" ALLE Nachfahren (150 gegen 100)', () => {
    const report = evaluate(
      heroCatalogue({ scope: 'self', shared: 'true', includeChildSelections: 'true', withGrandchild: true }),
      rosterWithItem({ withGrandchild: true }),
    );

    // Kein Hybrid: das direkte Kind (60) UND das Enkelkind (40) zaehlen — 150.
    expect(heroViolation(report)).toMatchObject({
      limitId: HERO_LIMIT_ID,
      actual: HERO_POINTS + ITEM_POINTS + GEM_POINTS,
      bound: HERO_BOUND,
    });
  });
});
