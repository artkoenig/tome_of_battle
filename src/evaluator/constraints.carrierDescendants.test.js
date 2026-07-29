import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Wertet einen einzelnen synthetischen Katalog ueber die zweistufige Fassade aus
 * (Konvention wie `countIndex.linkedType.test.js`): erst aufbereiten, dann
 * auswerten.
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
 * erwartete Ist/Grenze-Paar. Bewusst keine Aussage ueber die ANZAHL der
 * Verletzungen — wie viele Anker eine geteilte Grenze traegt, ist
 * Berichtsform, nicht Zaehl-Semantik (gleiche Konvention wie der
 * E2E-Manifest-Runner ohne `count`).
 */
function expectFiring(report, limitId, { actual, bound }) {
  const violations = violationsOf(report, limitId);
  expect(violations.length, `Grenze ${limitId} muss feuern`).toBeGreaterThanOrEqual(1);
  for (const violation of violations) {
    expect(violation, `jede Verletzung von ${limitId} traegt Ist/Grenze`).toMatchObject({ actual, bound });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue 083: Eine Grenze zaehlt die Auswahlen UNTERHALB ihres Traegers im vom
// `scope` benannten Rahmen — nie die Vorkommen der eigenen Traeger-Id
// (Handbuch docs/battlescribe-data-format.md, Regelbox §7.6: der scope
// summiere "field's values of descendant selections of this constraint's
// parent entry").
//
// Beide Fixtures spiegeln die realen Vampire-Counts-Muster, an denen die zwei
// Grenzen des Issues stumm bleiben:
//  - eine max-1-parent-Grenze an einer per `<entryLink
//    type="selectionEntryGroup">` erreichten Gruppe (Muster 76e2c1c8-…,
//    "Magic Armour"): sie muss die MITGLIEDER der Gruppe zaehlen;
//  - eine geteilte max-1-roster-Grenze mit includeChildSelections="false" an
//    einem Zieleintrag (Muster 0aa08f91-…, "Armour of Heroes"): sie muss ALLE
//    Vorkommen des Eintrags im Roster zaehlen, auch verschachtelte —
//    "unchecked" heisst "just scope's field", nicht "nichts" (§7.6).
// Der Wachtposten: die analoge max-1-parent-Grenze AM Zieleintrag (Muster
// f25f23c2-…) feuert schon heute und muss es bleiben.
// ─────────────────────────────────────────────────────────────────────────────

const FORCE_ID = 'force-main';
const HERO_ID = 'entry-hero';

// ── Fixture 1: Grenzen an einer per Link erreichten Gruppe ───────────────────

const ARMOURY_LINK_ID = 'link-armoury';
const ARMOURY_GROUP_ID = 'group-armoury';
const SHIELD_ID = 'entry-shield';
const PLATE_ID = 'entry-plate';
const GROUP_MAX_LIMIT_ID = 'max-one-armour-an-der-gruppe';
const GROUP_MIN_LIMIT_ID = 'min-one-armour-an-der-gruppe';

// Ein Held zieht eine geteilte Gruppe "Armoury" ueber einen `<entryLink
// type="selectionEntryGroup">` herein. Die Gruppe traegt ihre Grenzen SELBST
// (min 1 / max 1 je Elternteil, Attributform wie 76e2c1c8-… im VC-Katalog) und
// enthaelt zwei Mitglieds-Eintraege.
const LINKED_GROUP_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-linked-group-limits" name="Linked Group Limits Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Main Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
        <entryLinks>
          <entryLink id="${ARMOURY_LINK_ID}" name="Armoury" targetId="${ARMOURY_GROUP_ID}" type="selectionEntryGroup"/>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>
    <sharedSelectionEntryGroups>
      <selectionEntryGroup id="${ARMOURY_GROUP_ID}" name="Armoury" hidden="false" collective="false" import="true">
        <constraints>
          <constraint field="selections" scope="parent" value="1" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false" id="${GROUP_MAX_LIMIT_ID}" type="max"/>
          <constraint field="selections" scope="parent" value="1" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false" id="${GROUP_MIN_LIMIT_ID}" type="min"/>
        </constraints>
        <selectionEntries>
          <selectionEntry id="${SHIELD_ID}" name="Shield" type="upgrade"/>
          <selectionEntry id="${PLATE_ID}" name="Plate" type="upgrade"/>
        </selectionEntries>
      </selectionEntryGroup>
    </sharedSelectionEntryGroups>
  </catalogue>`;

/** Ein Kontingent mit genau einem Helden, der die gegebenen Kinder traegt. */
function forceWithHero(heroChildren) {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: [{ defId: HERO_ID, count: 1, children: heroChildren }],
    }],
  };
}

describe('Kriterium 1+3 (Muster 76e2c1c8): eine Grenze an einer verlinkten Gruppe zaehlt die MITGLIEDER der Gruppe', () => {
  it('feuert die max-1-parent-Grenze der Gruppe bei zwei gewaehlten Mitgliedern mit Ist 2 gegen Grenze 1', () => {
    const report = evaluate(LINKED_GROUP_CATALOGUE_XML, forceWithHero([
      { defId: SHIELD_ID, count: 1, children: [] },
      { defId: PLATE_ID, count: 1, children: [] },
    ]));

    expectFiring(report, GROUP_MAX_LIMIT_ID, { actual: 2, bound: 1 });
  });

  it('feuert die max-1-parent-Grenze der Gruppe NICHT bei genau einem gewaehlten Mitglied (Randwert Ist 1 = Grenze 1)', () => {
    const report = evaluate(LINKED_GROUP_CATALOGUE_XML, forceWithHero([
      { defId: SHIELD_ID, count: 1, children: [] },
    ]));

    expect(violationsOf(report, GROUP_MAX_LIMIT_ID), 'Ist 1 gegen max 1 ist legal').toHaveLength(0);
  });

  it('ist die min-1-parent-Grenze der Gruppe durch EIN gewaehltes Mitglied erfuellt — die Mitglieder zaehlen, nicht die Traeger-Id', () => {
    // Zaehlte die Engine die Vorkommen der Gruppen-Id selbst (0 im Roster),
    // feuerte das Minimum faelschlich. Zaehlt sie die Mitglieder (1), schweigt es.
    const report = evaluate(LINKED_GROUP_CATALOGUE_XML, forceWithHero([
      { defId: SHIELD_ID, count: 1, children: [] },
    ]));

    expect(violationsOf(report, GROUP_MIN_LIMIT_ID), 'min 1 ist mit einem Mitglied erfuellt').toHaveLength(0);
  });
});

// ── Fixture 2: geteilter Zieleintrag hinter zwei Links (zwei Tueren, ein Ding) ──

const RELIC_LINK_A_ID = 'link-relic-a';
const RELIC_LINK_B_ID = 'link-relic-b';
const SHARED_RELIC_ID = 'shared-relic';
const RELIC_PARENT_MAX_ID = 'max-one-relic-je-traeger';
const RELIC_ROSTER_MAX_ID = 'max-one-relic-im-roster';

// Ein geteilter Eintrag "Relic" traegt seine Grenzen selbst (Attributform wie
// f25f23c2-…/0aa08f91-… im VC-Katalog): max 1 je Elternteil UND max 1 im ganzen
// Roster, beide shared="true" mit includeChildSelections="false". Der Held
// erreicht ihn ueber ZWEI verschiedene `<entryLink>`s.
const SHARED_TARGET_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-shared-target-limits" name="Shared Target Limits Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Main Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
        <entryLinks>
          <entryLink id="${RELIC_LINK_A_ID}" name="Relic (Tuer A)" targetId="${SHARED_RELIC_ID}" type="selectionEntry"/>
          <entryLink id="${RELIC_LINK_B_ID}" name="Relic (Tuer B)" targetId="${SHARED_RELIC_ID}" type="selectionEntry"/>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${SHARED_RELIC_ID}" name="Relic" type="upgrade" import="true" hidden="false" collective="false">
        <constraints>
          <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="${RELIC_PARENT_MAX_ID}" percentValue="false" includeChildSelections="false" includeChildForces="false"/>
          <constraint type="max" value="1" field="selections" scope="roster" shared="true" id="${RELIC_ROSTER_MAX_ID}" percentValue="false" includeChildSelections="false" includeChildForces="false"/>
        </constraints>
      </selectionEntry>
    </sharedSelectionEntries>
  </catalogue>`;

/** Ein Kontingent mit den gegebenen Helden-Instanzen. */
function forceWithHeroes(...heroChildrenPerHero) {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: heroChildrenPerHero.map(children => ({ defId: HERO_ID, count: 1, children })),
    }],
  };
}

describe('Kriterium 1+3 (Muster 0aa08f91): eine geteilte roster-Grenze mit includeChildSelections="false" zaehlt verschachtelte Vorkommen im ganzen Roster', () => {
  it('feuert bei zwei Vorkommen an ZWEI Traegern mit Ist 2 gegen Grenze 1 — die parent-Grenze schweigt', () => {
    const report = evaluate(SHARED_TARGET_CATALOGUE_XML, forceWithHeroes(
      [{ defId: RELIC_LINK_A_ID, count: 1, children: [] }],
      [{ defId: RELIC_LINK_B_ID, count: 1, children: [] }],
    ));

    expectFiring(report, RELIC_ROSTER_MAX_ID, { actual: 2, bound: 1 });

    // Je Traeger nur ein Exemplar: die parent-Grenze bleibt still.
    expect(violationsOf(report, RELIC_PARENT_MAX_ID), 'je Traeger 1 ist legal').toHaveLength(0);
  });

  it('feuert auch bei zwei Vorkommen an EINEM Traeger (zwei Tueren) mit Ist 2 gegen Grenze 1', () => {
    const report = evaluate(SHARED_TARGET_CATALOGUE_XML, forceWithHeroes(
      [
        { defId: RELIC_LINK_A_ID, count: 1, children: [] },
        { defId: RELIC_LINK_B_ID, count: 1, children: [] },
      ],
    ));

    expectFiring(report, RELIC_ROSTER_MAX_ID, { actual: 2, bound: 1 });
  });

  it('feuert NICHT bei genau einem Vorkommen im Roster (Randwert Ist 1 = Grenze 1)', () => {
    const report = evaluate(SHARED_TARGET_CATALOGUE_XML, forceWithHeroes(
      [{ defId: RELIC_LINK_A_ID, count: 1, children: [] }],
    ));

    expect(violationsOf(report, RELIC_ROSTER_MAX_ID), 'Ist 1 gegen max 1 ist legal').toHaveLength(0);
  });
});

describe('Wachtposten Kriterium 2 (Muster f25f23c2): die parent-Grenze AM Zieleintrag feuert bei zwei Tueren unter einem Traeger — heute schon gruen', () => {
  it('feuert mit Ist 2 gegen Grenze 1, wenn ein Traeger denselben Eintrag ueber beide Links nimmt', () => {
    const report = evaluate(SHARED_TARGET_CATALOGUE_XML, forceWithHeroes(
      [
        { defId: RELIC_LINK_A_ID, count: 1, children: [] },
        { defId: RELIC_LINK_B_ID, count: 1, children: [] },
      ],
    ));

    expectFiring(report, RELIC_PARENT_MAX_ID, { actual: 2, bound: 1 });
  });
});
