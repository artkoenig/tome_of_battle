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

describe('Fassade: die Auswertung arbeitet auf dem eingefrorenen Graphen', () => {
  it('wertet gegen den eingefrorenen aufbereiteten Datensatz aus — wiederholt und wirkungsfrei', () => {
    const prepared = prepareDataset({ catalogues: [CATALOGUE_XML] });
    const roster = {
      forces: [],
    };

    // Zwei Auswertungen desselben aufbereiteten Datensatzes: die zweite sieht
    // exakt denselben Graphen — haette eine Auswertung geschrieben, waere sie
    // bereits an der eingefrorenen Definition gescheitert.
    const first = evaluate(prepared, roster);
    const second = evaluate(prepared, roster);

    expect(second.violations).toEqual(first.violations);
    expect(second.diagnostics.map(d => d.kind)).toEqual(first.diagnostics.map(d => d.kind));
  });
});
