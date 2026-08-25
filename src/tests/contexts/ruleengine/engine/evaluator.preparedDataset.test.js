/**
 * Tests der **zweistufigen Fassade** (Main-Issue 75, Baustein 8): der Datensatz
 * wird einmal aufbereitet, und dasselbe Ergebnis traegt beliebig viele
 * Auswertungen sowie die Beschreibung ohne Roster.
 *
 * Zwei Eigenschaften machen diese Form ueberhaupt erst zulaessig, und beide sind
 * hier festgenagelt:
 *
 * 1. **Die Wiederverwendung ist verhaltensneutral.** Ein Roster gegen einen
 *    geteilten, schon mehrfach benutzten aufbereiteten Datensatz liefert exakt
 *    denselben Bericht wie gegen einen frisch aufbereiteten. Waere das nicht so,
 *    haette die Auswertung eine Spur im Datensatz hinterlassen — sie waere keine
 *    reine Funktion mehr (`docs/evaluator-architecture.md` §2, Leitprinzip 1), und
 *    ein Bericht haetten davon abgehangen, was vorher ausgewertet wurde.
 * 2. **Der Griff ist undurchsichtig.** Der Aufrufer haelt den aufbereiteten
 *    Datensatz, erfaehrt aber nichts ueber den inneren Aufbau der Engine
 *    (ADR-0034). Was in ihm steckt, beantworten allein `evaluate` und
 *    `describeDataset`.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, describeDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-0000-0000-0000';
const POINTS_COST_TYPE_ID = 'cost-points';
const FORCE_ID = 'force-army';
const WARRIOR_ID = 'entry-warrior';
const BANNER_ID = 'entry-banner';
const MAX_WARRIORS_LIMIT_ID = 'limit-max-warriors';
const MAX_WARRIORS = 2;

const GAME_SYSTEM_XML = `<?xml version="1.0"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${POINTS_COST_TYPE_ID}" name="pts" defaultCostLimit="2000"/></costTypes>
    <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0"?>
  <catalogue id="cat-army" name="Army" gameSystemId="${GAME_SYSTEM_ID}" library="false">
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <constraints>
          <constraint id="${MAX_WARRIORS_LIMIT_ID}" type="max" value="${MAX_WARRIORS}" field="selections" scope="roster"/>
        </constraints>
      </selectionEntry>
      <selectionEntry id="${BANNER_ID}" name="Banner" type="upgrade"/>
    </selectionEntries>
  </catalogue>`;

const DATASET = { gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] };

/** Ein Kontingent mit `count` Kriegern. */
function armyOfWarriors(count) {
  return {
    forces: [{ defId: FORCE_ID, count: 1, children: [{ defId: WARRIOR_ID, count, children: [] }] }],
  };
}

/**
 * Ein vergleichbarer Fingerabdruck eines Berichts: die Verletzungen mit Ist und
 * Grenze und die Faehigkeitsdatensaetze je Slot-Pfad. Verglichen wird das
 * *Ergebnis*, nicht die Objektidentitaet — zwei Auswertungen liefern immer
 * verschiedene Objekte.
 */
function reportFingerprint(report) {
  return JSON.stringify({
    violations: report.violations
      .map(violation => `${violation.limitId}@${violation.anchor?.defId}=${violation.actual}/${violation.bound}`)
      .sort(),
    capabilities: [...report.capabilities]
      .map(([path, capability]) => `${path}:${capability.defId}:${capability.current}/${capability.effectiveMax}`)
      .sort(),
    diagnostics: report.diagnostics.map(diagnostic => diagnostic.kind).sort(),
  });
}

describe('zweistufige Fassade: dasselbe aufbereitete Ergebnis traegt viele Auswertungen', () => {
  it('liefert fuer dasselbe Roster denselben Bericht wie eine eigene Aufbereitung', () => {
    const shared = prepareDataset(DATASET);
    const roster = armyOfWarriors(MAX_WARRIORS + 1);

    const againstShared = evaluate(shared, roster);
    const againstOwn = evaluate(prepareDataset(DATASET), roster);

    expect(reportFingerprint(againstShared)).toEqual(reportFingerprint(againstOwn));
    expect(againstShared.violations.map(violation => violation.limitId)).toContain(MAX_WARRIORS_LIMIT_ID);
  });

  it('haelt das Ergebnis eines Rosters stabil, egal was vorher gegen denselben Datensatz lief', () => {
    const shared = prepareDataset(DATASET);
    const overLimit = armyOfWarriors(MAX_WARRIORS + 1);

    const first = reportFingerprint(evaluate(shared, overLimit));
    evaluate(shared, armyOfWarriors(0));
    evaluate(shared, armyOfWarriors(MAX_WARRIORS));
    const afterOthers = reportFingerprint(evaluate(shared, overLimit));

    // Die scharfe Aussage der Wiederverwendung: keine Auswertung hinterlaesst eine
    // Spur im aufbereiteten Datensatz. Bricht das, waeren Berichte von der
    // Reihenfolge frueherer Auswertungen abhaengig — ein praktisch unauffindbares
    // Fehlerbild.
    expect(afterOthers).toEqual(first);
  });

  it('beantwortet Auswertung und Beschreibung aus demselben einen Vorlauf', () => {
    const shared = prepareDataset(DATASET);

    const description = describeDataset(shared);
    const report = evaluate(shared, armyOfWarriors(1));

    expect(description.costTypes.map(costType => costType.id)).toEqual([POINTS_COST_TYPE_ID]);
    expect(description.creatableForces.map(force => force.id)).toEqual([FORCE_ID]);
    // Nach der Auswertung ist die Beschreibung unveraendert: auch sie liest den
    // aufbereiteten Datensatz nur.
    expect(describeDataset(shared)).toEqual(description);
    expect(report.capabilities.size).toBeGreaterThan(0);
  });
});

describe('zweistufige Fassade: der aufbereitete Datensatz ist ein undurchsichtiger Griff', () => {
  it('gibt dem Aufrufer keine Kenntnis vom inneren Aufbau der Engine', () => {
    const prepared = prepareDataset(DATASET);

    expect(Object.keys(prepared)).toEqual([]);
    expect(prepared.resolved).toBeUndefined();
  });

  it('weist einen rohen Datensatz statt eines aufbereiteten mit klarer Meldung zurueck', () => {
    expect(() => evaluate(DATASET, armyOfWarriors(1))).toThrow(/prepareDataset/);
    expect(() => describeDataset(DATASET)).toThrow(/prepareDataset/);
  });
});
