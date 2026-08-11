import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { PreparedDataset, prepareDataset as prepareRawDataset } from './datasetPreparation.js';
import { buildEvalTree } from './evalTree.js';
import { buildIndex } from './countIndex.js';
import { createBaseEffectiveState } from './effectiveState.js';
import { scopeKey, ScopeKeyword } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * **Eine Kostenart-Grenze summiert die Kosten unterhalb ihres Traegers**
 * (`docs/battlescribe-data-format.md` §7.6/§9.4, Issue 091).
 *
 * Der `scope` sagt nur, *welche* Entitaet summiert; summiert werden die Kosten der
 * Auswahlen **unterhalb des Trägers** der Grenze, und `includeChildSelections`
 * entscheidet, ob dabei auch **verschachtelte** Auswahlen hereinkommen.
 *
 * Geprueft wird an beiden Nahtstellen:
 * - **aussen**, an der Fassade: das Repro der Grenze meldet Ist 110 gegen 100 —
 *   das ist die Aussage, um die es fachlich geht;
 * - **innen**, an der Zaehlschicht: nur die **Kosten** steigen unter die Ziel-Id
 *   eines Vorfahren auf, die **Selektionsanzahl** nicht. Diese Trennung ist der
 *   eigentliche Vertrag der Aenderung (die Zaehlung der Auswahlen unterhalb des
 *   Traegers ist Issue 083) und liesse sich an der Fassade nur mittelbar sehen.
 */

const FORCE_ID = 'force-army';
const HERO_ID = 'entry-hero';
const ITEM_ID = 'entry-item';
const POINTS_ID = 'cost-points';
const HERO_LIMIT_ID = 'limit-hero-points';

const HERO_POINTS = 50;
const ITEM_POINTS = 60;
const HERO_BOUND = 100;

/**
 * Held mit Kosten und einer Kostenart-Grenze; darunter ein waehlbarer Gegenstand
 * mit eigenen Kosten. `includeChildSelections` der Grenze ist der Parameter — die
 * beiden Flagstellungen sind der eigentliche Testfall (Kriterium 3).
 */
function heroCatalogue(includeChildSelections) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cost-carrier" name="Cost Carrier Catalogue">
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
                        field="${POINTS_ID}" scope="roster" shared="true"
                        percentValue="false"
                        includeChildSelections="${includeChildSelections}"
                        includeChildForces="false"/>
          </constraints>
          <selectionEntries>
            <selectionEntry id="${ITEM_ID}" name="Item" type="upgrade">
              <costs>
                <cost name="Points" typeId="${POINTS_ID}" value="${ITEM_POINTS}"/>
              </costs>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Ein Kontingent mit einem Helden, der `itemCount` Gegenstaende traegt. */
function rosterWithItems(itemCount) {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: [{
        defId: HERO_ID,
        count: 1,
        children: itemCount === 0 ? [] : [{ defId: ITEM_ID, count: itemCount, children: [] }],
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

/** Der Faehigkeitsdatensatz des Helden. */
function heroCapability(report) {
  return [...report.capabilities.values()].find(capability => capability.defId === HERO_ID);
}

/**
 * Die Punktsumme, die die Kostenart-Grenze des Helden misst — abgelesen an seinen
 * `costLimits`, wo jede kostenbezogene Grenze ihren eigenen Datensatz hat. Sie
 * steht dort auch ohne Verstoss; die Stueckzahl-Felder des Slots (`current` &c.)
 * tragen dagegen nie eine Punktsumme (`report.js`).
 */
function heroCostSum(report) {
  return heroCapability(report)?.costLimits.find(limit => limit.limitId === HERO_LIMIT_ID)?.current;
}

describe('Kostenart-Grenze am Eintrag: includeChildSelections="true" summiert die Nachfahren mit', () => {
  it('meldet das Repro aus Issue 091 mit Ist 110 gegen Grenze 100', () => {
    const report = evaluate(heroCatalogue(true), rosterWithItems(1));

    expect(heroViolation(report)).toMatchObject({
      limitId: HERO_LIMIT_ID,
      actual: HERO_POINTS + ITEM_POINTS,
      bound: HERO_BOUND,
    });
  });

  it('summiert die Kosten eines Nachfahren mal seiner Stueckzahl', () => {
    const itemCount = 2;

    const report = evaluate(heroCatalogue(true), rosterWithItems(itemCount));

    expect(heroViolation(report)?.actual).toBe(HERO_POINTS + itemCount * ITEM_POINTS);
  });

  it('bleibt unter der Grenze, solange die Summe sie nicht reisst', () => {
    // Nur der Traeger: 50 <= 100 — die Grenze feuert nicht, obwohl sie jetzt tiefer zaehlt.
    const report = evaluate(heroCatalogue(true), rosterWithItems(0));

    expect(heroViolation(report)).toBeUndefined();
    expect(heroCostSum(report)).toBe(HERO_POINTS);
  });
});

describe('Kostenart-Grenze am Eintrag: includeChildSelections="false" bleibt bei der engeren Lesart', () => {
  it('liest nur die Kosten des Traegers und feuert deshalb nicht', () => {
    const report = evaluate(heroCatalogue(false), rosterWithItems(1));

    // „just `scope`'s `field`" (§7.6): die verschachtelte Auswahl bleibt aussen vor.
    expect(heroViolation(report)).toBeUndefined();
    expect(heroCostSum(report)).toBe(HERO_POINTS);
  });
});

describe('Zaehlschicht: unter der Ziel-Id eines Vorfahren steigen nur die Kosten auf', () => {
  /** Baum und Index zum Helden-Katalog (die Grenze spielt hier keine Rolle). */
  function buildIndexForRoster(roster) {
    const { resolved } = PreparedDataset.contentsOf(prepareRawDataset({ catalogues: [heroCatalogue(true)] }));
    const { root } = buildEvalTree(resolved, roster);
    return buildIndex(root, createBaseEffectiveState(root));
  }

  const HERO_KEY = scopeKey(ScopeKeyword.ROSTER, HERO_ID);

  it('summiert Traeger und Nachfahren unter der Traeger-Id, wenn Kindauswahlen zaehlen', () => {
    const index = buildIndexForRoster(rosterWithItems(1));

    expect(index.get(HERO_KEY, true, false).costSums.get(POINTS_ID)).toBe(HERO_POINTS + ITEM_POINTS);
  });

  it('laesst den Nachfahren aussen vor, wenn Kindauswahlen nicht zaehlen', () => {
    const index = buildIndexForRoster(rosterWithItems(1));

    expect(index.get(HERO_KEY, false, false).costSums.get(POINTS_ID)).toBe(HERO_POINTS);
  });

  it('zaehlt den Nachfahren NICHT als Auswahl unter der Traeger-Id', () => {
    const index = buildIndexForRoster(rosterWithItems(1));

    // Aufsteigen duerfen nur die Kosten: unter der Helden-Id steht genau **ein**
    // Held, kein Held plus Gegenstand. Die Auswahl-Zaehlung unterhalb des Traegers
    // ist eine eigene Frage (Issue 083) und darf hier nicht mitkippen.
    expect(index.get(HERO_KEY, true, true).selectionCount).toBe(1);
  });
});

// ── Verschachtelter Traeger (Issue 0113): Eigen-Kosten zaehlen, Nachfahren nicht ──

const CAPTAIN_ID = 'entry-captain';

/**
 * Wie {@link heroCatalogue}, aber der Held (samt Grenze und Gegenstand) steckt
 * selbst unter einem Captain. Die Kollisions-Aufloesung aus Issue 0113 muss
 * beide Richtungen halten: das Vorkommen des Traegers zaehlt trotz eigener
 * Verschachtelung (§9.4, „Ein Traeger mit eigenen Kosten bringt diese in seine
 * Summe ein"), die Kosten seines Nachfahren bleiben mit
 * `includeChildSelections="false"` draussen (§7.6 „just scope's field").
 */
function nestedHeroCatalogue() {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cost-nested-carrier" name="Nested Cost Carrier Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${CAPTAIN_ID}" name="Captain" type="unit">
          <selectionEntries>
            <selectionEntry id="${HERO_ID}" name="Hero" type="model">
              <costs>
                <cost name="Points" typeId="${POINTS_ID}" value="${HERO_POINTS}"/>
              </costs>
              <constraints>
                <constraint id="${HERO_LIMIT_ID}" type="max" value="${HERO_BOUND}"
                            field="${POINTS_ID}" scope="roster" shared="true"
                            percentValue="false"
                            includeChildSelections="false"
                            includeChildForces="false"/>
              </constraints>
              <selectionEntries>
                <selectionEntry id="${ITEM_ID}" name="Item" type="upgrade">
                  <costs>
                    <cost name="Points" typeId="${POINTS_ID}" value="${ITEM_POINTS}"/>
                  </costs>
                </selectionEntry>
              </selectionEntries>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Ein Kontingent mit einem Captain, dessen Held einen Gegenstand traegt. */
function nestedRosterWithItem() {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: [{
        defId: CAPTAIN_ID,
        count: 1,
        children: [{
          defId: HERO_ID,
          count: 1,
          children: [{ defId: ITEM_ID, count: 1, children: [] }],
        }],
      }],
    }],
  };
}

describe('Verschachtelter Traeger (Issue 0113): die roster-Grenze liest seine Eigen-Kosten, nicht die des Nachfahren', () => {
  it('liest die Eigen-Kosten des verschachtelten Traegers (weder 0 noch die Nachfahren-Summe)', () => {
    const report = evaluate(nestedHeroCatalogue(), nestedRosterWithItem());

    // 0 hiesse: das verschachtelte Vorkommen zaehlt gar nicht (Verstoss gegen
    // §9.4/Issue 083); 110 hiesse: der Nachfahre zaehlt mit (Verstoss gegen
    // §7.6/Issue 091). Richtig ist genau der Traeger selbst: 50.
    expect(heroViolation(report)).toBeUndefined();
    expect(heroCostSum(report)).toBe(HERO_POINTS);
  });
});

// ── Das Gruppen-Muster aus §9.4: „Magische Gegenstaende zusammen hoechstens N" ──

const CHAMPION_ID = 'entry-champion';
const MAGIC_ITEMS_GROUP_ID = 'group-magic-items';
const BLADE_ID = 'entry-blade';
const RUNE_ID = 'entry-rune';
const GROUP_LIMIT_ID = 'limit-magic-items-points';

const BLADE_POINTS = 60;
const RUNE_POINTS = 60;
const GROUP_BOUND = 100;

/**
 * Ein Champion mit der Gruppe „Magic Items", deren Grenze eine **Kostensumme**
 * misst (§9.4). Das Gruppenmitglied — die Klinge — traegt selbst eine
 * verschachtelte, kostenpflichtige Auswahl (die Rune).
 */
function magicItemsCatalogue(includeChildSelections) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-magic-items" name="Magic Items Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${CHAMPION_ID}" name="Champion" type="model">
          <selectionEntryGroups>
            <selectionEntryGroup id="${MAGIC_ITEMS_GROUP_ID}" name="Magic Items">
              <constraints>
                <constraint id="${GROUP_LIMIT_ID}" type="max" value="${GROUP_BOUND}"
                            field="${POINTS_ID}" scope="parent" shared="true"
                            percentValue="false"
                            includeChildSelections="${includeChildSelections}"
                            includeChildForces="false"/>
              </constraints>
              <selectionEntries>
                <selectionEntry id="${BLADE_ID}" name="Blade" type="upgrade">
                  <costs>
                    <cost name="Points" typeId="${POINTS_ID}" value="${BLADE_POINTS}"/>
                  </costs>
                  <selectionEntries>
                    <selectionEntry id="${RUNE_ID}" name="Rune" type="upgrade">
                      <costs>
                        <cost name="Points" typeId="${POINTS_ID}" value="${RUNE_POINTS}"/>
                      </costs>
                    </selectionEntry>
                  </selectionEntries>
                </selectionEntry>
              </selectionEntries>
            </selectionEntryGroup>
          </selectionEntryGroups>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Champion mit Klinge; die Klinge traegt `runeCount` Runen. */
function magicItemsRoster(runeCount) {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: [{
        defId: CHAMPION_ID,
        count: 1,
        children: [{
          defId: BLADE_ID,
          count: 1,
          children: runeCount === 0 ? [] : [{ defId: RUNE_ID, count: runeCount, children: [] }],
        }],
      }],
    }],
  };
}

/** Die Meldung der Gruppen-Grenze, oder `undefined`, wenn sie nicht feuert. */
function groupViolation(report) {
  return report.violations.find(violation => violation.limitId === GROUP_LIMIT_ID);
}

describe('Gruppen-verankertes Kosten-Budget (§9.4) erfasst die verschachtelten Kosten seiner Member', () => {
  it('summiert Member und dessen verschachtelte Auswahl, wenn Kindauswahlen zaehlen', () => {
    const report = evaluate(magicItemsCatalogue(true), magicItemsRoster(1));

    expect(groupViolation(report)).toMatchObject({
      limitId: GROUP_LIMIT_ID,
      actual: BLADE_POINTS + RUNE_POINTS,
      bound: GROUP_BOUND,
    });
  });

  it('zaehlt weiterhin die Kosten des Members selbst, ohne die verschachtelten', () => {
    // Dieselbe Gruppe ohne Rune: 60 <= 100, kein Verstoss — der Member zaehlt wie bisher.
    const report = evaluate(magicItemsCatalogue(true), magicItemsRoster(0));

    expect(groupViolation(report)).toBeUndefined();
  });

  it('bleibt mit includeChildSelections="false" bei der engeren Lesart', () => {
    const report = evaluate(magicItemsCatalogue(false), magicItemsRoster(1));

    expect(groupViolation(report)).toBeUndefined();
  });
});
