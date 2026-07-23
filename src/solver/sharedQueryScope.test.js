import { describe, test, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { validateRoster, evaluateCondition, getEntryAddAvailability } from './validator.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';

beforeAll(() => {
  const dom = new JSDOM();
  globalThis.DOMParser = dom.window.DOMParser;
});

// Befund K2 (Issue 50/05). Das BattleScribe-Attribut `shared` einer Query
// (Constraint oder Condition) entscheidet über ihren Bezugsrahmen:
//
//   shared="true"  (Vorgabe der XSD `QueryBase`): gezählt werden alle Instanzen
//                  des Eintrags im gesamten Roster.
//   shared="false": gezählt wird nur die eine Instanz, an der die Query hängt.
//
// Vorher wurde das Attribut zwar geparst, aber von keinem Verbraucher gelesen —
// die App zählte also immer aggregiert und meldete für nicht geteilte
// Beschränkungen Verstöße, die es nicht gab.

const POINTS = 'pts';
const CATALOGUE_ID = 'cat';
const FORCE_ENTRY_ID = 'fe-army';
const FORCE_ID = 'f1';
const HERO_ENTRY_ID = 'entry-hero';
const BANNER_ENTRY_ID = 'entry-banner';
const MAX_CONSTRAINT_ID = 'con-max-hero';
const ENTRY_MAX = 'entry-max';

/** Ein Katalog mit genau einem Helden-Eintrag, dessen max-Constraint konfigurierbar ist. */
function makeSystem({ scope, shared, maxValue = 1 }) {
  const constraint = {
    id: MAX_CONSTRAINT_ID, type: 'max', value: maxValue, field: 'selections', scope
  };
  if (shared !== undefined) constraint.shared = shared;

  return {
    id: 'sys',
    costTypes: [{ id: POINTS, name: 'Points' }],
    categoryEntries: [],
    forceEntries: [{ id: FORCE_ENTRY_ID, name: 'Army', categoryLinks: [] }],
    catalogues: [{
      id: CATALOGUE_ID,
      selectionEntries: [
        { id: HERO_ENTRY_ID, name: 'Hero', type: 'unit', constraints: [constraint] },
        { id: BANNER_ENTRY_ID, name: 'Banner', type: 'upgrade' }
      ]
    }]
  };
}

function heroSelection(id, number = 1, children = []) {
  return {
    id, name: 'Hero', selectionEntryId: HERO_ENTRY_ID, entryLinkId: null, number, selections: children
  };
}

function makeRoster(selections) {
  return {
    id: 'r', name: 'Roster', catalogueId: CATALOGUE_ID, costLimit: 2000, costLimitType: POINTS,
    forces: [{ id: FORCE_ID, forceEntryId: FORCE_ENTRY_ID, catalogueId: CATALOGUE_ID, selections }]
  };
}

const heroMaxViolations = errors => errors.filter(error => error.type === ENTRY_MAX);

describe('Nicht geteilte Beschränkung (shared="false") zählt nur ihre eigene Instanz', () => {
  test.each([['roster'], ['force']])(
    'scope="%s": zwei getrennte Instanzen verletzen ein Maximum von 1 nicht',
    (scope) => {
      const roster = makeRoster([heroSelection('s1'), heroSelection('s2')]);

      const shared = validateRoster(roster, makeSystem({ scope, shared: true }));
      const notShared = validateRoster(roster, makeSystem({ scope, shared: false }));

      // Der alte Stand kannte nur diesen aggregierten Zweig — daran scheitert er hier.
      expect(heroMaxViolations(shared).length).toBeGreaterThan(0);
      expect(heroMaxViolations(notShared)).toEqual([]);
    }
  );

  test('die Instanz selbst wird weiterhin gezählt: number=2 verletzt ein Maximum von 1', () => {
    const roster = makeRoster([heroSelection('s1', 2)]);

    const errors = validateRoster(roster, makeSystem({ scope: 'roster', shared: false }));

    // Der Verstoß feuert überhaupt nur, wenn die number=2-Instanz mitgezählt wird
    // (ein Maximum von 1 wäre bei korrektem Nicht-Zählen nicht verletzt); die
    // verletzte Obergrenze steckt im `count`-Parameter.
    expect(heroMaxViolations(errors)).toHaveLength(1);
    expect(heroMaxViolations(errors)[0].messageParams.count).toBe(1);
  });

  test('geschachtelte Instanzen zählen nur mit includeChildSelections', () => {
    const nested = heroSelection('s-outer', 1, [heroSelection('s-inner')]);
    const roster = makeRoster([nested]);
    const systemWithNesting = (includeChildSelections) => {
      const system = makeSystem({ scope: 'roster', shared: false });
      system.catalogues[0].selectionEntries[0].constraints[0].includeChildSelections = includeChildSelections;
      return system;
    };

    expect(heroMaxViolations(validateRoster(roster, systemWithNesting(false)))).toEqual([]);
    expect(heroMaxViolations(validateRoster(roster, systemWithNesting(true))).length).toBeGreaterThan(0);
  });
});

describe('Geteilte Beschränkung (Vorgabe) zählt unverändert über das ganze Roster', () => {
  test.each([['roster'], ['force']])('scope="%s": zwei Instanzen verletzen ein Maximum von 1', (scope) => {
    const roster = makeRoster([heroSelection('s1'), heroSelection('s2')]);

    const errors = validateRoster(roster, makeSystem({ scope, shared: true }));

    expect(heroMaxViolations(errors).length).toBeGreaterThan(0);
  });

  test('ein fehlendes shared-Attribut zählt als geteilt (XSD-Vorgabe true)', () => {
    const roster = makeRoster([heroSelection('s1'), heroSelection('s2')]);

    const errors = validateRoster(roster, makeSystem({ scope: 'roster', shared: undefined }));

    expect(heroMaxViolations(errors).length).toBeGreaterThan(0);
  });
});

describe('Aushebe-Verfügbarkeit folgt der Zählweise (ADR-0022)', () => {
  const availabilityOfSecondHero = (shared) => {
    const system = makeSystem({ scope: 'roster', shared });
    const roster = makeRoster([heroSelection('s1')]);
    const entry = system.catalogues[0].selectionEntries[0];
    return getEntryAddAvailability({
      entry, categoryId: null, force: roster.forces[0], roster, system
    });
  };

  test('geteilt: der zweite Held ist gesperrt, weil er das Maximum überschreitet', () => {
    expect(availabilityOfSecondHero(true).available).toBe(false);
  });

  test('nicht geteilt: der zweite Held bleibt wählbar — jede Instanz zählt für sich', () => {
    expect(availabilityOfSecondHero(false).available).toBe(true);
  });
});

describe('Bedingungen werten `shared` genauso aus', () => {
  const bannerSelection = (id) => ({
    id, name: 'Banner', selectionEntryId: BANNER_ENTRY_ID, entryLinkId: null, number: 1, selections: []
  });

  // Das Roster enthält zwei Banner, die geprüfte Instanz trägt aber nur eines davon.
  const heroWithOneBanner = heroSelection('s-hero', 1, [bannerSelection('s-banner-1')]);
  const conditionCtx = {
    roster: makeRoster([heroWithOneBanner, heroSelection('s-hero-2', 1, [bannerSelection('s-banner-2')])]),
    system: makeSystem({ scope: 'roster', shared: true }),
    selectionCounts: { [BANNER_ENTRY_ID]: 2 },
    selection: heroWithOneBanner,
    parentCatalogueId: CATALOGUE_ID
  };

  const bannerCondition = (shared) => ({
    type: 'atLeast', value: 2, field: 'selections', scope: 'roster',
    childId: BANNER_ENTRY_ID, includeChildSelections: true, shared
  });

  test('geteilt: die armeeweite Zählung erfüllt „mindestens 2 Banner"', () => {
    expect(evaluateCondition(bannerCondition(true), conditionCtx)).toBe(true);
  });

  test('nicht geteilt: nur das eine Banner dieser Instanz zählt, die Bedingung greift nicht', () => {
    expect(evaluateCondition(bannerCondition(false), conditionCtx)).toBe(false);
  });

  test('nicht geteilt: eine Instanz mit zwei eigenen Bannern erfüllt die Bedingung', () => {
    const heroWithTwoBanners = heroSelection('s-hero', 1, [bannerSelection('b1'), bannerSelection('b2')]);
    const ctx = { ...conditionCtx, selection: heroWithTwoBanners };

    expect(evaluateCondition(bannerCondition(false), ctx)).toBe(true);
  });

  test('nicht geteilt ohne bekannte Instanz: es gibt nichts zu zählen', () => {
    const ctx = { ...conditionCtx, selection: null };

    expect(evaluateCondition(bannerCondition(false), ctx)).toBe(false);
  });

  test('scope="parent" bleibt unberührt — er ist bereits an eine Instanz gebunden', () => {
    const parentCondition = {
      type: 'atLeast', value: 1, field: 'selections', scope: 'parent',
      childId: BANNER_ENTRY_ID, shared: false
    };

    expect(evaluateCondition(parentCondition, conditionCtx)).toBe(true);
  });
});

describe('Parser: shared folgt der XSD-Vorgabe true', () => {
  const catalogueXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<catalogue id="cat-shared" name="Shared Test" gameSystemId="sys" xmlns="http://www.battlescribe.net/schema/catalogueSchema">
  <selectionEntries>
    <selectionEntry id="e-default" name="Default" type="unit">
      <constraints>
        <constraint id="c-default" type="max" value="1" field="selections" scope="roster"/>
      </constraints>
      <modifiers>
        <modifier type="set" field="c-default" value="2">
          <conditions>
            <condition type="atLeast" value="1" field="selections" scope="roster" childId="e-default"/>
          </conditions>
        </modifier>
      </modifiers>
    </selectionEntry>
    <selectionEntry id="e-explicit" name="Explicit" type="unit">
      <constraints>
        <constraint id="c-false" type="max" value="1" field="selections" scope="roster" shared="false"/>
        <constraint id="c-true" type="max" value="1" field="selections" scope="roster" shared="true"/>
      </constraints>
      <modifiers>
        <modifier type="set" field="c-false" value="2">
          <conditions>
            <condition type="atLeast" value="1" field="selections" scope="roster" childId="e-explicit" shared="false"/>
          </conditions>
        </modifier>
      </modifiers>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

  const entriesById = () => {
    const catalogue = parseCatalogueXML(catalogueXml);
    return Object.fromEntries(catalogue.selectionEntries.map(entry => [entry.id, entry]));
  };

  test('ein fehlendes Attribut wird als true geparst, nicht als false', () => {
    const entries = entriesById();

    expect(entries['e-default'].constraints[0].shared).toBe(true);
    expect(entries['e-default'].modifiers[0].conditions[0].shared).toBe(true);
  });

  test('ein ausdrückliches shared-Attribut wird übernommen', () => {
    const entries = entriesById();
    const constraintsById = Object.fromEntries(
      entries['e-explicit'].constraints.map(con => [con.id, con])
    );

    expect(constraintsById['c-false'].shared).toBe(false);
    expect(constraintsById['c-true'].shared).toBe(true);
    expect(entries['e-explicit'].modifiers[0].conditions[0].shared).toBe(false);
  });
});
