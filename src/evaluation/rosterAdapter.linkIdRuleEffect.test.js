/**
 * Issue 0121, Task 14 (Kriterium 3) — **Wirkungstest** der Link-Id-Regel.
 *
 * Kriterium 3 nennt als Falsifikator: „Grenzen, die am Link definiert sind,
 * wirken in der UI (Verletzung erscheint, wenn sie ueberschritten werden)."
 * Bisher deklariert kein Test des Repos einen `constraint` an einem `entryLink`;
 * `src/hooks/useRoster.evaluator.test.js` haengt seine max-1-Grenze an den
 * `selectionEntry` — dort ist die Regel also nicht falsifizierbar. Diese Datei
 * schliesst die Beweisluecke.
 *
 * Aufbau (`docs/battlescribe-data-format.md` §7.2: „Ein `entryLink` kann eigene
 * `constraints`, `modifiers` und `costs` mitbringen"): das **Ziel** des Verweises
 * traegt eine grosszuegige Grenze (`max 5`), der **Verweis selbst** eine engere
 * (`max 1`); das App-Roster setzt die Auswahl ueber den Verweis mit Anzahl 2.
 * Beobachtet wird am Rand, den die Oberflaeche benutzt: `evaluateAppRoster`
 * (`useRoster`/`useEvaluation` laufen durch denselben Adapter und dieselbe
 * Fassade).
 *
 * Die **Gegenprobe** ist der Kern des Beweises: dasselbe Roster ohne
 * `entryLinkId` — also die Auswahl unter der **Ziel**-Id — bleibt ohne
 * Verletzung. Bildete der Adapter auf die Ziel-Id ab, blieben beide Faelle
 * stumm; genau darin unterscheiden sie sich.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluateAppRoster } from './evaluationCache.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-main';
const COST_TYPE_ID = 'cost-pts';
const FORCE_DEF_ID = 'force-main';
const WARRIOR_ID = 'entry-warrior';
const SHARED_WEAPON_ID = 'shared-great-weapon';
const WEAPON_LINK_ID = 'link-great-weapon';

/** Die enge Grenze am Verweis und die grosszuegige am Ziel. */
const LINK_MAX_LIMIT_ID = 'limit-link-max';
const LINK_MAX = 1;
const TARGET_MAX_LIMIT_ID = 'limit-target-max';
const TARGET_MAX = 5;

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes>
      <costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/>
    </costTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force"/>
    </forceEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${SHARED_WEAPON_ID}" name="Great Weapon" type="upgrade">
        <constraints>
          <constraint id="${TARGET_MAX_LIMIT_ID}" type="max" value="${TARGET_MAX}" field="selections" scope="parent" shared="true" includeChildSelections="false"/>
        </constraints>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="4"/></costs>
      </selectionEntry>
    </sharedSelectionEntries>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <entryLinks>
          <entryLink id="${WEAPON_LINK_ID}" name="Great Weapon" targetId="${SHARED_WEAPON_ID}" type="selectionEntry">
            <constraints>
              <constraint id="${LINK_MAX_LIMIT_ID}" type="max" value="${LINK_MAX}" field="selections" scope="parent" shared="true" includeChildSelections="false"/>
            </constraints>
          </entryLink>
        </entryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="10"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Das App-System-Objekt mit den rohen XMLs (Shape aus `src/db/systemImport.js`). */
function appSystem() {
  return {
    id: 'system-uuid',
    name: 'Test System',
    rawXmls: {
      gst: [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
      cat: [{ name: 'main.cat', content: CATALOGUE_XML }],
    },
  };
}

/**
 * Ein App-Roster mit einem Warrior und `count` Waffen darunter.
 *
 * `viaLink: true` ist der echte App-Zustand einer ueber den `entryLink`
 * gesetzten Auswahl (`entryLinkId` gefuellt); `viaLink: false` ist die
 * Gegenprobe — dieselbe Auswahl unter der Ziel-Id.
 */
function appRoster({ count, viaLink }) {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit: 10000,
    costLimitType: COST_TYPE_ID,
    forces: [{
      id: 'force-uuid-1',
      forceEntryId: FORCE_DEF_ID,
      catalogueId: 'cat-main',
      selections: [{
        id: 'sel-warrior',
        name: 'Warrior',
        entryLinkId: null,
        selectionEntryId: WARRIOR_ID,
        number: 1,
        category: null,
        selections: [{
          id: 'sel-weapon',
          name: 'Great Weapon',
          entryLinkId: viaLink ? WEAPON_LINK_ID : null,
          selectionEntryId: SHARED_WEAPON_ID,
          number: count,
          category: null,
          selections: [],
        }],
      }],
    }],
  };
}

const violationsOf = (roster) => evaluateAppRoster(appSystem(), roster).violations;

describe('Link-Id-Regel: eine am entryLink deklarierte Grenze wirkt (Issue 0121, Kriterium 3)', () => {
  it('die Grenze DES VERWEISES schlaegt an, wenn das Roster sie ueberschreitet', () => {
    const violations = violationsOf(appRoster({ count: LINK_MAX + 1, viaLink: true }));

    const violation = violations.find((entry) => entry.limitId === LINK_MAX_LIMIT_ID);
    expect(violation, 'Verletzung der max-1-Grenze des Verweises').toBeDefined();
    expect(violation).toMatchObject({
      origin: 'derivedLimit',
      severity: 'error',
      actual: LINK_MAX + 1,
      bound: LINK_MAX,
    });
    // Gemeldet wird der Verweis, nicht sein Ziel.
    expect(violation.anchor).toMatchObject({ defId: WEAPON_LINK_ID });
  });

  it('die grosszuegige Grenze des ZIELS meldet dabei nichts (sie ist nicht ueberschritten)', () => {
    const violations = violationsOf(appRoster({ count: LINK_MAX + 1, viaLink: true }));

    expect(violations.map((entry) => entry.limitId)).toEqual([LINK_MAX_LIMIT_ID]);
  });

  it('genau an der Grenze des Verweises bleibt es still (Rand)', () => {
    const violations = violationsOf(appRoster({ count: LINK_MAX, viaLink: true }));

    expect(violations).toEqual([]);
  });

  it('Gegenprobe: unter der ZIEL-Id abgebildet, bliebe die Verletzung aus', () => {
    const violations = violationsOf(appRoster({ count: LINK_MAX + 1, viaLink: false }));

    // Nur so ist der Test ueberhaupt aussagekraeftig: der Unterschied zwischen
    // beiden Faellen ist allein die uebergebene Definitions-Id.
    expect(violations).toEqual([]);
  });
});
