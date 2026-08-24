import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../domain/evaluator/evaluator.js';
import { AnchorKind } from '../../../domain/evaluator/model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Wertet einen einzelnen synthetischen Katalog ueber die zweistufige Fassade aus
 * (Konvention wie `constraints.carrierDescendants.test.js`): erst aufbereiten,
 * dann auswerten.
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

/** Alle Verletzungen des Berichts zu einer Grenz-Id. */
function violationsOf(report, limitId) {
  return report.violations.filter(violation => violation.limitId === limitId);
}

/**
 * Die Grenze muss feuern: mindestens eine Verletzung, und JEDE traegt das
 * erwartete Ist/Grenze-Paar (Konvention wie `constraints.carrierDescendants.test.js`).
 */
function expectFiring(report, limitId, { actual, bound }) {
  const violations = violationsOf(report, limitId);
  expect(violations.length, `Grenze ${limitId} muss feuern`).toBeGreaterThanOrEqual(1);
  for (const violation of violations) {
    expect(violation, `jede Verletzung von ${limitId} traegt Ist/Grenze`).toMatchObject({ actual, bound });
  }
}

/**
 * Der belegte Anker eines Slots, dessen Def-Id entweder die des Links oder die
 * des geteilten Zieleintrags sein kann — der Bericht projiziert das nicht
 * einheitlich, deshalb wird hier ueber beide Kandidaten gesucht.
 */
function occupiedCapabilityFor(report, candidateDefIds) {
  return [...report.capabilities.values()]
    .find(capability => capability.anchorKind === AnchorKind.OCCUPIED && candidateDefIds.includes(capability.defId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue 0147 (Uprising points limit): eine geteilte, am Eintrag verankerte
// Grenze mit scope="force" und includeChildSelections="false" zaehlt
// verschachtelte Vorkommen INNERHALB ihres Kontingents — neben ihrem
// roster-Zwilling aus Issue 083 (siehe constraints.carrierDescendants.test.js).
// ─────────────────────────────────────────────────────────────────────────────

const FORCE_ID = 'force-main';
const HERO_ID = 'entry-hero';
const RELIC_LINK_ID = 'link-relic';
const SHARED_RELIC_ID = 'shared-relic';
const RELIC_FORCE_MAX_ID = 'max-one-relic-je-kontingent';

// ── Fixture 1 (Faelle 1-3): geteilter Zieleintrag, force-Grenze, shared="true" ──

// Ein Held zieht eine geteilte Ausruestung "Relic" ueber einen `<entryLink>`
// herein. "Relic" traegt ihre Grenze selbst: max 1 je Kontingent, geteilt,
// ohne verschachtelte Auswahlen oder Unterkontingente mitzuzaehlen — jedes
// Vorkommen sitzt eine Auswahlebene unterhalb des Kontingents, genau wie die
// Uprising-Auswahl im gepinnten Szenario.
const SHARED_TARGET_FORCE_SCOPE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-shared-target-force-scope" name="Shared Target Force Scope Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Main Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
        <entryLinks>
          <entryLink id="${RELIC_LINK_ID}" name="Relic" targetId="${SHARED_RELIC_ID}" type="selectionEntry"/>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${SHARED_RELIC_ID}" name="Relic" type="upgrade" import="true" hidden="false" collective="false">
        <constraints>
          <constraint type="max" value="1" field="selections" scope="force" shared="true" includeChildSelections="false" includeChildForces="false" id="${RELIC_FORCE_MAX_ID}" percentValue="false"/>
        </constraints>
      </selectionEntry>
    </sharedSelectionEntries>
  </catalogue>`;

/** Ein Kontingent mit den gegebenen Helden-Instanzen (je Held ein Relic oder keins). */
function forceWithHeroRelics(reliceCountsPerHero) {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: reliceCountsPerHero.map(hasRelic => ({
        defId: HERO_ID,
        count: 1,
        children: hasRelic ? [{ defId: RELIC_LINK_ID, count: 1, children: [] }] : [],
      })),
    }],
  };
}

/** Zwei Kontingente derselben `forceEntry`, je eines mit einem Helden-mit-Relic. */
function twoForcesEachWithHeroRelic() {
  const forceWithOneHeroRelic = () => ({
    defId: FORCE_ID,
    count: 1,
    children: [{ defId: HERO_ID, count: 1, children: [{ defId: RELIC_LINK_ID, count: 1, children: [] }] }],
  });
  return { forces: [forceWithOneHeroRelic(), forceWithOneHeroRelic()] };
}

describe('Fall 1: verschachtelte Vorkommen zaehlen innerhalb des Kontingents', () => {
  it('feuert die force-Grenze bei zwei Helden mit je einem Relic mit Ist 2 gegen Grenze 1', () => {
    const report = evaluate(SHARED_TARGET_FORCE_SCOPE_XML, forceWithHeroRelics([true, true]));

    expectFiring(report, RELIC_FORCE_MAX_ID, { actual: 2, bound: 1 });
  });
});

describe('Fall 2: Randwert Ist 1 = Grenze 1, und der belegte Slot meldet current 1', () => {
  it('feuert die force-Grenze NICHT bei einem Helden mit einem Relic, und der belegte Slot meldet current 1', () => {
    const report = evaluate(SHARED_TARGET_FORCE_SCOPE_XML, forceWithHeroRelics([true]));

    expect(violationsOf(report, RELIC_FORCE_MAX_ID), 'Ist 1 gegen max 1 ist legal').toHaveLength(0);

    const occupied = occupiedCapabilityFor(report, [RELIC_LINK_ID, SHARED_RELIC_ID]);
    expect(occupied, 'der belegte Relic-Slot muss im Bericht auffindbar sein').toBeDefined();
    expect(occupied.current, 'der belegte Slot muss die eine Auswahl zaehlen, nicht 0').toBe(1);
  });
});

describe('Fall 3: das Kontingent ist nicht der Roster-Rahmen', () => {
  it('feuert die force-Grenze NICHT ueber zwei Geschwister-Kontingente hinweg — jedes zaehlt fuer sich', () => {
    const report = evaluate(SHARED_TARGET_FORCE_SCOPE_XML, twoForcesEachWithHeroRelic());

    expect(violationsOf(report, RELIC_FORCE_MAX_ID), 'je Kontingent 1 ist legal, includeChildForces="false" haelt das Geschwister-Kontingent aussen vor').toHaveLength(0);
  });
});

// ── Fixture 2 (Fall 4): dieselbe Struktur, aber shared="false" ───────────────

const RELIC_FORCE_MAX_NOT_SHARED_ID = 'max-one-relic-je-traeger-nicht-geteilt';

const NOT_SHARED_TARGET_FORCE_SCOPE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-not-shared-target-force-scope" name="Not Shared Target Force Scope Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Main Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
        <entryLinks>
          <entryLink id="${RELIC_LINK_ID}" name="Relic" targetId="${SHARED_RELIC_ID}" type="selectionEntry"/>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${SHARED_RELIC_ID}" name="Relic" type="upgrade" import="true" hidden="false" collective="false">
        <constraints>
          <constraint type="max" value="1" field="selections" scope="force" shared="false" includeChildSelections="false" includeChildForces="false" id="${RELIC_FORCE_MAX_NOT_SHARED_ID}" percentValue="false"/>
        </constraints>
      </selectionEntry>
    </sharedSelectionEntries>
  </catalogue>`;

describe('Fall 4: shared="false" bleibt je Instanz gebunden', () => {
  it('feuert die force-Grenze NICHT bei zwei Helden mit je einem Relic, wenn die Grenze nicht geteilt ist', () => {
    const report = evaluate(NOT_SHARED_TARGET_FORCE_SCOPE_XML, forceWithHeroRelics([true, true]));

    expect(violationsOf(report, RELIC_FORCE_MAX_NOT_SHARED_ID), 'je Traeger-Instanz zaehlt nur ihr eigenes Relic (1), nicht die Summe ueber alle Traeger').toHaveLength(0);
  });
});

// ── Fixture 3 (Fall 5): geklommene Kindkosten zaehlen im Rahmen des Traegers ──

const BANNER_LINK_ID = 'link-banner';
const SHARED_BANNER_ID = 'shared-banner';
const BANNER_CHILD_ID = 'entry-banner-pole';
const BANNER_COST_ID = 'cost-banner-guid';
const BANNER_OWN_COST = 10;
const BANNER_CHILD_COST = 5;
const BANNER_FORCE_MAX_ID = 'max-zehn-banner-je-kontingent';

// Ein geteilter Eintrag "Banner" traegt eigene Kosten von 10 und eine
// force-Grenze auf genau diese Kostenart (max 10, geteilt,
// includeChildSelections="false"). Im Roster traegt seine Instanz ein
// verschachteltes Kind mit eigenen Kosten von 5 in derselben Kostenart — ein
// direktes Kind des Traegers, das die Flagge nicht sperrt (§7.6/§9.4).
const SHARED_BANNER_FORCE_SCOPE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-shared-banner-force-scope" name="Shared Banner Force Scope Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Main Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
        <entryLinks>
          <entryLink id="${BANNER_LINK_ID}" name="Banner" targetId="${SHARED_BANNER_ID}" type="selectionEntry"/>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${SHARED_BANNER_ID}" name="Banner" type="upgrade" import="true" hidden="false" collective="false">
        <costs>
          <cost name="Points" typeId="${BANNER_COST_ID}" value="${BANNER_OWN_COST}"/>
        </costs>
        <constraints>
          <constraint type="max" value="${BANNER_OWN_COST}" field="${BANNER_COST_ID}" scope="force" shared="true" includeChildSelections="false" includeChildForces="false" id="${BANNER_FORCE_MAX_ID}" percentValue="false"/>
        </constraints>
        <selectionEntries>
          <selectionEntry id="${BANNER_CHILD_ID}" name="Banner Pole" type="upgrade">
            <costs>
              <cost name="Points" typeId="${BANNER_COST_ID}" value="${BANNER_CHILD_COST}"/>
            </costs>
          </selectionEntry>
        </selectionEntries>
      </selectionEntry>
    </sharedSelectionEntries>
  </catalogue>`;

describe('Fall 5: die Kosten des direkten Kindes zaehlen in den Rahmen des Traegers', () => {
  it('feuert die force-Grenze mit Ist 15 (Banner 10 plus sein direktes Kind 5) gegen 10', () => {
    const report = evaluate(SHARED_BANNER_FORCE_SCOPE_XML, {
      forces: [{
        defId: FORCE_ID,
        count: 1,
        children: [{
          defId: HERO_ID,
          count: 1,
          children: [{
            defId: BANNER_LINK_ID,
            count: 1,
            children: [{ defId: BANNER_CHILD_ID, count: 1, children: [] }],
          }],
        }],
      }],
    });

    // §7.6/§9.4: gezaehlt werden die Auswahlen unterhalb des Traegers;
    // `includeChildSelections="false"` liest eingeschraenkt, nicht leer, und sperrt
    // erst die Ebene unter dem direkten Kind.
    expect(violationsOf(report, BANNER_FORCE_MAX_ID)[0], 'Ist muss 15 sein: 10 am Banner plus 5 an seinem Kind')
      .toMatchObject({ actual: BANNER_OWN_COST + BANNER_CHILD_COST, bound: BANNER_OWN_COST });
  });
});
