/**
 * Tests der **durchgesetzten Unveraenderlichkeit** der aufgeloesten Sicht.
 *
 * `resolveCatalogue` verspricht eine unveraenderliche Sicht; die Anreicherung
 * (`modifier.target`, `condition.witnessDefinition`, `info.resolved`,
 * `link.resolved`) schreibt dafuer **einmal, waehrend der Aufbereitung** auf die
 * frisch geparsten Objekte. Seit die Fassade zweistufig ist (ein aufbereiteter
 * Datensatz traegt beliebig viele Auswertungen), darf diese Garantie nicht nur
 * auf Disziplin beruhen: nach der Aufloesung ist der ganze Graph tief
 * eingefroren, und jeder spaetere Schreibversuch wirft im Strict Mode einen
 * `TypeError` — an der schreibenden Stelle, nicht als ferne Korruption.
 *
 * Drei Dinge stehen hier: dass der Graph eingefroren **ist** (der Mechanismus),
 * dass die daraus folgende Einmal-Vorbedingung von `resolveCatalogue`
 * durchgesetzt wird, und dass mehrere Auswertungen desselben aufbereiteten
 * Datensatzes einander **nicht beeinflussen** — letzteres an einem Roster, das
 * eine Verletzung und einen bedingten Modifikator ausloest, damit der Vergleich
 * etwas vergleicht.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';
import { resolveCatalogue } from './resolver.js';
import { evaluate, prepareDataset } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const ENTRY_ID = 'entry-warrior';
const ARCHER_ID = 'entry-archer';
const SHARED_ENTRY_ID = 'shared-champion';
const ENTRY_LINK_ID = 'link-champion';
const INFO_LINK_ID = 'link-info';
const RULE_ID = 'shared-rule';
const GROUP_ID = 'group-elite';
const CATEGORY_ID = 'cat-core';
const POINTS_ID = 'cost-points';
const MAX_WARRIORS_LIMIT_ID = 'limit-max-warriors';

/**
 * Katalog, der alle vier Anreicherungs-Stellen des Resolvers trifft: ein
 * Modifikator mit Bedingung (`target` + `witnessDefinition`), ein `infoLink`
 * (`info.resolved`), ein `entryLink` (`link.resolved`) sowie eine Kategorie und
 * eine Gruppe mit Grenze (`categoryIds`, `groupMemberIds`).
 */
const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-frozen" name="Frozen Catalogue">
    <categoryEntries>
      <categoryEntry id="${CATEGORY_ID}" name="Core"/>
    </categoryEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${SHARED_ENTRY_ID}" name="Champion" type="unit"/>
    </sharedSelectionEntries>
    <sharedRules>
      <rule id="${RULE_ID}" name="Fear"/>
    </sharedRules>
    <selectionEntries>
      <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
        <costs>
          <cost name="Points" typeId="${POINTS_ID}" value="10"/>
        </costs>
        <constraints>
          <constraint id="${MAX_WARRIORS_LIMIT_ID}" type="max" value="2" field="selections" scope="roster"/>
        </constraints>
        <modifiers>
          <modifier type="increment" field="${POINTS_ID}" value="5">
            <conditions>
              <condition type="atLeast" field="selections" scope="roster" childId="${ARCHER_ID}" value="1"/>
            </conditions>
          </modifier>
        </modifiers>
        <infoLinks>
          <infoLink id="${INFO_LINK_ID}" name="Fear" type="rule" targetId="${RULE_ID}"/>
        </infoLinks>
      </selectionEntry>
      <selectionEntry id="${ARCHER_ID}" name="Archer" type="unit"/>
    </selectionEntries>
    <selectionEntryGroups>
      <selectionEntryGroup id="${GROUP_ID}" name="Elite">
        <constraints>
          <constraint id="limit-group" type="max" value="1" field="selections" scope="parent"/>
        </constraints>
        <selectionEntries>
          <selectionEntry id="entry-elite" name="Elite Guard" type="unit"/>
        </selectionEntries>
      </selectionEntryGroup>
    </selectionEntryGroups>
    <entryLinks>
      <entryLink id="${ENTRY_LINK_ID}" name="Champion" targetId="${SHARED_ENTRY_ID}" type="selectionEntry"/>
    </entryLinks>
  </catalogue>`;

function resolveFixture() {
  return resolveCatalogue(parseCatalogue(CATALOGUE_XML));
}

describe('Resolver: die aufgeloeste Sicht ist tief eingefroren', () => {
  it('friert jede Definition ein — ein Schreibversuch wirft im Strict Mode', () => {
    const resolved = resolveFixture();
    const warrior = resolved.lookup(ENTRY_ID);

    expect(Object.isFrozen(warrior)).toBe(true);
    expect(() => { warrior.name = 'Mutiert'; }).toThrow(TypeError);
    expect(() => { warrior.children.push({}); }).toThrow(TypeError);
  });

  it('friert auch die nur per Verweis erreichbaren (geteilten) Definitionen ein', () => {
    const resolved = resolveFixture();
    const shared = resolved.lookup(SHARED_ENTRY_ID);

    expect(Object.isFrozen(shared)).toBe(true);
    expect(() => { shared.isHidden = true; }).toThrow(TypeError);
  });

  it('friert die einmal aufgeloeste Anreicherung ein: modifier.target und witnessDefinition', () => {
    const resolved = resolveFixture();
    const modifier = resolved.lookup(ENTRY_ID).modifiers[0];

    expect(modifier.target).not.toBeNull();
    expect(() => { modifier.target = null; }).toThrow(TypeError);

    const condition = modifier.conditions[0];
    expect(condition.witnessDefinition).toBe(resolved.lookup(ARCHER_ID));
    expect(() => { condition.witnessDefinition = null; }).toThrow(TypeError);
  });

  it('friert die einmal aufgeloeste Anreicherung ein: link.resolved und info.resolved', () => {
    const resolved = resolveFixture();
    const entryLink = resolved.lookup(ENTRY_LINK_ID);
    const infoLink = resolved.lookup(ENTRY_ID).infos.find(info => info.id === INFO_LINK_ID);

    expect(entryLink.resolved).toBe(resolved.lookup(SHARED_ENTRY_ID));
    expect(() => { entryLink.resolved = null; }).toThrow(TypeError);

    expect(infoLink.resolved).toBe(resolved.lookup(RULE_ID));
    expect(() => { infoLink.resolved = null; }).toThrow(TypeError);
  });

  it('friert die Sicht selbst und ihre Listen ein', () => {
    const resolved = resolveFixture();

    expect(Object.isFrozen(resolved)).toBe(true);
    expect(() => { resolved.definitions.push({}); }).toThrow(TypeError);
    expect(() => { resolved.armyLevelCandidates.pop(); }).toThrow(TypeError);
    expect(() => { resolved.diagnostics.push({}); }).toThrow(TypeError);
    expect(() => { resolved.profileTypes.push({}); }).toThrow(TypeError);
  });

  it('haertet Mengen und Karten der Sicht: auch add/set/delete/clear werfen', () => {
    const resolved = resolveFixture();

    expect(() => resolved.categoryIds.add('cat-neu')).toThrow(TypeError);
    expect(() => resolved.categoryIds.clear()).toThrow(TypeError);
    expect(() => resolved.groupMemberIds.set('x', new Set())).toThrow(TypeError);
    expect(() => resolved.groupMemberIds.get(GROUP_ID).add('x')).toThrow(TypeError);

    // Lesend bleibt alles nutzbar.
    expect(resolved.categoryIds.has(CATEGORY_ID)).toBe(true);
    expect(resolved.groupMemberIds.get(GROUP_ID).has('entry-elite')).toBe(true);
  });
});

describe('Resolver: eine zweite Aufloesung derselben Knoten wird abgewiesen', () => {
  it('meldet die verletzte Vorbedingung mit klarer Meldung statt eines rohen Schreibfehlers', () => {
    const catalogue = parseCatalogue(CATALOGUE_XML);
    resolveCatalogue(catalogue);

    expect(() => resolveCatalogue(catalogue)).toThrow(/bereits aufgeloest/);
  });

  it('laesst die Aufloesung frisch geparster Knoten unberuehrt zu', () => {
    resolveCatalogue(parseCatalogue(CATALOGUE_XML));

    expect(resolveFixture().lookup(ENTRY_ID).id).toBe(ENTRY_ID);
  });
});

/**
 * Ein vergleichbarer Fingerabdruck eines Berichts: die Verletzungen mit Ist und
 * Grenze, die Faehigkeitsdatensaetze je Slot-Pfad und die Diagnosearten.
 * Verglichen wird das *Ergebnis*, nicht die Objektidentitaet — zwei Auswertungen
 * liefern immer verschiedene Objekte.
 */
function reportFingerprint(report) {
  return JSON.stringify({
    violations: report.violations
      .map(violation => `${violation.limitId}@${violation.anchor?.defId}=${violation.actual}/${violation.bound}`)
      .sort(),
    capabilities: [...report.capabilities]
      .map(([path, capability]) => `${path}:${capability.defId}:${capability.current}/${capability.effectiveMax}`)
      .sort(),
    diagnostics: report.diagnostics.map(entry => entry.kind).sort(),
  });
}

/** Ein Roster aus `warriors` Kriegern und `archers` Bogenschuetzen. */
function armyOf(warriors, archers) {
  return {
    forces: [
      { defId: ENTRY_ID, count: warriors, children: [] },
      { defId: ARCHER_ID, count: archers, children: [] },
    ],
  };
}

describe('Fassade: mehrere Auswertungen desselben Datensatzes beeinflussen einander nicht', () => {
  // Das Roster ist mit Absicht **aussagekraeftig**: drei Krieger reissen
  // `limit-max-warriors` (max 2), und der Bogenschuetze erfuellt die Bedingung des
  // Kosten-Modifikators. Jede Auswertung liest damit genau die angereicherten
  // Felder des eingefrorenen Graphen (`modifier.target`,
  // `condition.witnessDefinition`). Ein leeres Roster beruehrte nichts davon —
  // der Vergleich zweier leerer Berichte sagte ueber Wechselwirkungen nichts aus.
  const OVER_LIMIT = armyOf(3, 1);

  /** Haelt fest, dass der Bericht wirklich etwas enthaelt, das auseinanderlaufen koennte. */
  function expectSubstantive(report) {
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].limitId).toBe(MAX_WARRIORS_LIMIT_ID);
    expect(report.violations[0].actual).toBe(3);
    expect(report.violations[0].bound).toBe(2);
    expect(report.capabilities.size).toBe(2);
  }

  it('liefert dasselbe Ergebnis, egal welche Auswertungen vorher gegen denselben Datensatz liefen', () => {
    const shared = prepareDataset({ catalogues: [CATALOGUE_XML] });

    const first = evaluate(shared, OVER_LIMIT);
    expectSubstantive(first);

    // Andere Roster dazwischen — jedes durchlaeuft Baumaufbau, Fixpunktschleife
    // und Berichtsbau auf demselben Graphen.
    evaluate(shared, armyOf(0, 0));
    evaluate(shared, armyOf(2, 1));
    evaluate(shared, armyOf(5, 3));

    const afterOthers = evaluate(shared, OVER_LIMIT);
    expectSubstantive(afterOthers);
    expect(reportFingerprint(afterOthers)).toEqual(reportFingerprint(first));
  });

  it('liefert gegen den geteilten Datensatz dasselbe wie gegen einen frisch aufbereiteten', () => {
    const shared = prepareDataset({ catalogues: [CATALOGUE_XML] });
    evaluate(shared, armyOf(5, 3));

    const againstShared = evaluate(shared, OVER_LIMIT);
    const againstOwn = evaluate(prepareDataset({ catalogues: [CATALOGUE_XML] }), OVER_LIMIT);

    expect(reportFingerprint(againstShared)).toEqual(reportFingerprint(againstOwn));
  });

  it('weist den Schreibzugriff ab, der eine spaetere Auswertung veraendern wuerde', () => {
    // Die Kehrseite der beiden Tests darueber: dass die Berichte gleich bleiben,
    // liegt nicht daran, dass heute zufaellig niemand schreibt — der Weg dorthin
    // ist versperrt. Genau diese Werte gehen in `actual`/`bound` des oben
    // verglichenen Berichts ein; waeren sie schreibbar, liefe jede spaetere
    // Auswertung gegen andere Zahlen als die erste.
    const resolved = resolveFixture();
    const warrior = resolved.lookup(ENTRY_ID);
    const maxWarriors = warrior.limits.find(limit => limit.id === MAX_WARRIORS_LIMIT_ID);

    expect(maxWarriors.value).toBe(2);
    expect(() => { maxWarriors.value = 99; }).toThrow(TypeError);
    expect(() => { warrior.costs[POINTS_ID] = 999; }).toThrow(TypeError);
    expect(maxWarriors.value).toBe(2);
  });
});
