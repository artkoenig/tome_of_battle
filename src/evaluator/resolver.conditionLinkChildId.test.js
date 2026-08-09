/**
 * Issue 0147 (Increment 1): `childId` einer BEDINGUNG, die einen `entryLink`
 * benennt — gleich welcher Tiefe, an der Katalogwurzel wie verschachtelt —,
 * wird auf die aufgeloeste Ziel-Id normalisiert (`targetChildId`), samt
 * `witnessDefinition` auf die Ziel-Definition. Bewusst ausgenommen bleibt
 * `<repeat>`: dessen `childId` bleibt unveraendert die Link-Id. Ohne diese
 * Normalisierung zaehlt eine `atLeast(scope=force)`-Bedingung, deren `childId`
 * einen Link benennt, keine Roster-Auswahl, die nur die Ziel-Id des Links
 * traegt (`entryLinkId` leer) — genau der Fall aus dem gepinnten Szenario
 * `at-least-force-toggle-gate`.
 *
 * Block 1 (statisch, `parseCatalogue` + `resolveCatalogue`, kein Roster) pinnt
 * die Umschreibung selbst und ihre bewusste Reichweite. Block 2 (Verhalten,
 * `evaluate(prepareDataset(...), roster)`) pinnt, wozu die Umschreibung dient:
 * eine Ziel-gebundene Auswahl hebt dieselbe max-0-Sperre wie eine Link-gebundene.
 * Beide Ebenen stehen bewusst in einer Datei — dieselbe Entscheidung, zweimal
 * beobachtet.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';
import { resolveCatalogue } from './resolver.js';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

// ─────────────────────────────────────────────────────────────────────────────
// Block 1: die statische Umschreibung.
// ─────────────────────────────────────────────────────────────────────────────

const FORCE_ID = 'force-main';
const ROOT_LINK_ID = 'link-root-target';
const TARGET_ID = 'shared-target';
const HOST_ID = 'entry-host';
const NESTED_LINK_ID = 'link-nested-target';
const NESTED_TARGET_ID = 'shared-nested-target';
const PLAIN_ID = 'entry-plain';
const CARRIER_ID = 'entry-carrier';

// Sieben Modifikatoren am Carrier, je einer pro Fall (R1-R5); Indizes sind die
// Modifikator-Reihenfolge im Dokument. `field="hidden"` ist als Modifikator-Feld
// beliebig — hier zaehlt allein die Bedingung/Wiederholung, nicht die Wirkung.
const STATIC_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-link-childid" name="Link ChildId Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Force"/>
    </forceEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${TARGET_ID}" name="Target" type="upgrade"/>
      <selectionEntry id="${NESTED_TARGET_ID}" name="Nested Target" type="upgrade"/>
    </sharedSelectionEntries>
    <entryLinks>
      <entryLink id="${ROOT_LINK_ID}" name="Root Link" targetId="${TARGET_ID}" type="selectionEntry"/>
    </entryLinks>
    <selectionEntries>
      <selectionEntry id="${PLAIN_ID}" name="Plain" type="unit"/>
      <selectionEntry id="${HOST_ID}" name="Host" type="unit">
        <entryLinks>
          <entryLink id="${NESTED_LINK_ID}" name="Nested Link" targetId="${NESTED_TARGET_ID}" type="selectionEntry"/>
        </entryLinks>
      </selectionEntry>
      <selectionEntry id="${CARRIER_ID}" name="Carrier" type="unit">
        <modifiers>
          <!-- R1: childId benennt den Wurzel-Link -> targetChildId wird die Ziel-Id. -->
          <modifier type="set" field="hidden" value="true">
            <conditions>
              <condition type="atLeast" field="selections" scope="roster" value="1" childId="${ROOT_LINK_ID}"/>
            </conditions>
          </modifier>
          <!-- R2: childId benennt einen gewoehnlichen Eintrag -> unveraendert. -->
          <modifier type="set" field="hidden" value="true">
            <conditions>
              <condition type="atLeast" field="selections" scope="roster" value="1" childId="${PLAIN_ID}"/>
            </conditions>
          </modifier>
          <!-- R3a: childId ist das Typ-Schluesselwort "model", keine Definition dahinter. -->
          <modifier type="set" field="hidden" value="true">
            <conditions>
              <condition type="atLeast" field="selections" scope="roster" value="1" childId="model"/>
            </conditions>
          </modifier>
          <!-- R3b: childId="any" liest der Leser bereits als null. -->
          <modifier type="set" field="hidden" value="true">
            <conditions>
              <condition type="atLeast" field="selections" scope="roster" value="1" childId="any"/>
            </conditions>
          </modifier>
          <!-- R3c: kein childId-Attribut ueberhaupt. -->
          <modifier type="set" field="hidden" value="true">
            <conditions>
              <condition type="atLeast" field="selections" scope="roster" value="1"/>
            </conditions>
          </modifier>
          <!-- R4: dieselbe Link-Id, aber an einer <repeat> statt einer <condition>. -->
          <modifier type="set" field="hidden" value="true">
            <repeats>
              <repeat field="selections" scope="roster" value="1" childId="${ROOT_LINK_ID}"/>
            </repeats>
          </modifier>
          <!-- R5: ein GESCHACHTELTER Link, nicht an der Katalogwurzel. -->
          <modifier type="set" field="hidden" value="true">
            <conditions>
              <condition type="atLeast" field="selections" scope="roster" value="1" childId="${NESTED_LINK_ID}"/>
            </conditions>
          </modifier>
        </modifiers>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

function resolveStaticFixture() {
  return resolveCatalogue(parseCatalogue(STATIC_CATALOGUE_XML));
}

describe('Resolver: childId eines Wurzel-entryLinks wird auf die Ziel-Id normalisiert (statisch)', () => {
  it('R1: childId=Wurzel-Link -> targetChildId ist die Ziel-Id, witnessDefinition ist die Ziel-Definition', () => {
    const resolved = resolveStaticFixture();
    const condition = resolved.lookup(CARRIER_ID).modifiers[0].conditions[0];

    expect(condition.targetChildId).toBe(TARGET_ID);
    expect(condition.witnessDefinition).not.toBeNull();
    expect(condition.witnessDefinition.id).toBe(TARGET_ID);
  });

  it('R2: childId=gewoehnlicher Eintrag -> targetChildId bleibt unveraendert (keine Uebernormalisierung)', () => {
    const resolved = resolveStaticFixture();
    const condition = resolved.lookup(CARRIER_ID).modifiers[1].conditions[0];

    expect(condition.targetChildId).toBe(PLAIN_ID);
  });

  it('R3a: childId="model" (Typ-Schluesselwort ohne Definition) bleibt "model"', () => {
    const resolved = resolveStaticFixture();
    const condition = resolved.lookup(CARRIER_ID).modifiers[2].conditions[0];

    expect(condition.targetChildId).toBe('model');
  });

  it('R3b: childId="any" bleibt null', () => {
    const resolved = resolveStaticFixture();
    const condition = resolved.lookup(CARRIER_ID).modifiers[3].conditions[0];

    expect(condition.targetChildId).toBeNull();
  });

  it('R3c: kein childId-Attribut -> bleibt null/undefined, keine Ausnahme', () => {
    const resolved = resolveStaticFixture();
    const condition = resolved.lookup(CARRIER_ID).modifiers[4].conditions[0];

    expect(condition.targetChildId == null).toBe(true); // eslint-disable-line eqeqeq -- null ODER undefined ist hier gleichermassen richtig.
  });

  it('R4 (bewusste Grenze): eine <repeat>, die denselben Wurzel-Link benennt, bleibt bei der Link-Id', () => {
    const resolved = resolveStaticFixture();
    const repeat = resolved.lookup(CARRIER_ID).modifiers[5].repeats[0];

    expect(repeat.targetChildId).toBe(ROOT_LINK_ID);
  });

  it('R5: die Normalisierung gilt auch fuer einen GESCHACHTELTEN entryLink, nicht nur fuer Wurzel-Links', () => {
    const resolved = resolveStaticFixture();
    const condition = resolved.lookup(CARRIER_ID).modifiers[6].conditions[0];

    expect(condition.targetChildId).toBe(NESTED_TARGET_ID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block 2: das Verhalten, das die Umschreibung kauft — Miniatur des gepinnten
// Szenarios `at-least-force-toggle-gate`.
// ─────────────────────────────────────────────────────────────────────────────

const TOGGLE_FORCE_ID = 'force-toggle';
const TOGGLE_LINK_ID = 'link-toggle';
const TOGGLE_TARGET_ID = 'shared-toggle-target';
const HERO_ID = 'entry-hero';
const MAX_ID = 'max-hero-force';

// Ein Wurzel-Link OHNE eigene Grenzen (kein Pflicht-Phantom als Nebengeraeusch)
// auf ein geteiltes Ziel ohne eigene Grenzen; ein Held, dessen max-0-Sperre ein
// per Link gezaehlter atLeast-Schalter auf 1 setzt.
const TOGGLE_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-toggle-gate" name="Toggle Gate Catalogue">
    <forceEntries>
      <forceEntry id="${TOGGLE_FORCE_ID}" name="Force"/>
    </forceEntries>
    <entryLinks>
      <entryLink id="${TOGGLE_LINK_ID}" name="Toggle" targetId="${TOGGLE_TARGET_ID}" type="selectionEntry"/>
    </entryLinks>
    <sharedSelectionEntries>
      <selectionEntry id="${TOGGLE_TARGET_ID}" name="Toggle Target" type="upgrade"/>
    </sharedSelectionEntries>
    <selectionEntries>
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
        <constraints>
          <constraint id="${MAX_ID}" type="max" value="0" field="selections" scope="force" shared="true" includeChildSelections="false"/>
        </constraints>
        <modifiers>
          <modifier type="set" field="${MAX_ID}" value="1">
            <conditions>
              <condition type="atLeast" field="selections" scope="force" value="1" childId="${TOGGLE_LINK_ID}" shared="true" includeChildSelections="true"/>
            </conditions>
          </modifier>
        </modifiers>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Ein Kontingent des Toggle-Katalogs mit den gegebenen Kind-Auswahlen. */
function toggleForce(children) {
  return { forces: [{ defId: TOGGLE_FORCE_ID, count: 1, children }] };
}

/** Der Faehigkeitsdatensatz des Helden-Slots (belegt oder Phantom, es gibt nur einen). */
function heroSlot(report) {
  return [...report.capabilities.values()].find(capability => capability.defId === HERO_ID);
}

/** Die Verletzungen mit der Limit-Id der Helden-Sperre. */
function maxViolations(report) {
  return report.violations.filter(violation => violation.limitId === MAX_ID);
}

describe('Engine: eine Ziel-gebundene Auswahl unter dem Link zaehlt fuer die force-Bedingung (Verhalten)', () => {
  it('B1: Ziel-Id im Roster (kein Link) erfuellt die Bedingung — die Sperre hebt sich auf effectiveMax 1', () => {
    const report = evaluate(
      TOGGLE_CATALOGUE_XML,
      toggleForce([
        { defId: TOGGLE_TARGET_ID, count: 1, children: [] },
        { defId: HERO_ID, count: 1, children: [] },
      ]),
    );

    expect(maxViolations(report)).toEqual([]);
    expect(heroSlot(report)).toMatchObject({ effectiveMax: 1, current: 1 });
  });

  it('B2 (Gegenprobe): ohne die Toggle-Auswahl bleibt die Sperre scharf — Verletzung bei effectiveMax 0', () => {
    const report = evaluate(TOGGLE_CATALOGUE_XML, toggleForce([{ defId: HERO_ID, count: 1, children: [] }]));

    expect(maxViolations(report)).toHaveLength(1);
    expect(maxViolations(report)[0]).toMatchObject({ limitId: MAX_ID, actual: 1, bound: 0 });
    expect(heroSlot(report)).toMatchObject({ effectiveMax: 0 });
  });

  it('B3 (Rueckfallsicherung): die Link-gebundene Auswahl hebt die Sperre weiterhin — wie B1', () => {
    const report = evaluate(
      TOGGLE_CATALOGUE_XML,
      toggleForce([
        { defId: TOGGLE_LINK_ID, count: 1, children: [] },
        { defId: HERO_ID, count: 1, children: [] },
      ]),
    );

    expect(maxViolations(report)).toEqual([]);
    expect(heroSlot(report)).toMatchObject({ effectiveMax: 1, current: 1 });
  });
});
