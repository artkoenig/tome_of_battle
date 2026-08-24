/**
 * Issue 0121, Pruefrunde 4, Befund B — der `describeDataset`-Cache hat einen
 * Falsifikator.
 *
 * Seit der Zusammenlegung von Hook und Direktaufruf cached
 * `src/domain/evaluation/evaluationCache.js` neben `prepareDataset` auch
 * `describeDataset` je aufbereitetem Datensatz. Diese Zusage stand bisher nur
 * im Log des Issues: der Pruefer hat den Cache probeweise ausgeschaltet und
 * **alle** Faelle blieben gruen. Diese Datei schliesst die Beweisluecke — sie
 * beschreibt kein neues Verhalten, sondern haelt das vorhandene fest.
 *
 * Sollverhalten: `describeDataset` laeuft **hoechstens einmal je Datensatz**,
 * geteilt ueber alle Raender hinweg — mehrere `describeSystem`-Aufrufe, mehrere
 * `evaluateAppRoster`-Aufrufe mit verschiedenen Rostern, mehrere
 * `useEvaluation`-Instanzen. Erst ein neues System-Objekt loest eine neue
 * Beschreibung aus. Beobachtet wird beides: der Aufruf-Zaehler UND die
 * Referenzgleichheit der ausgelieferten Beschreibung (`toBe`) — eine Zahl
 * allein liesse offen, ob alle Raender wirklich dieselbe Beschreibung sehen.
 *
 * Der Zaehler haengt an einem Durchreich-Mock der Fassade — dasselbe Muster,
 * mit dem `evaluationCache.evaluator.test.js` und `useEvaluation.test.js` schon
 * `prepareDataset` festhalten; beide Dateien bleiben unberuehrt.
 *
 * Wichtig fuer die Isolation: die Caches sind WeakMaps ueber
 * **Objektidentitaeten** und leben modulweit. Jeder Fall baut sich deshalb sein
 * eigenes System-Objekt (`appSystem()`); `vi.clearAllMocks()` setzt nur die
 * Zaehler zurueck, nicht die Caches.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Die Fassade als zaehlender Durchreich-Mock: echte Implementierung, jeder
// Aufruf gezaehlt — der Zaehler ist hier Vertragsgegenstand.
vi.mock('../../../domain/evaluator/evaluator.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    prepareDataset: vi.fn(actual.prepareDataset),
    evaluate: vi.fn(actual.evaluate),
    describeDataset: vi.fn(actual.describeDataset),
  };
});

import { describeDataset } from '../../../domain/evaluator/evaluator.js';
import { useEvaluation } from '../../../domain/evaluation/useEvaluation.js';
import { evaluateAppRoster, describeSystem } from '../../../domain/evaluation/evaluationCache.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Synthetischer Datensatz (Muster aus `useEvaluation.test.js`) ────────────

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const WARRIOR_ID = 'entry-warrior';
const COST_TYPE_ID = 'cost-pts';

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
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <costs>
          <cost name="pts" typeId="${COST_TYPE_ID}" value="10"/>
        </costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Ein FRISCHES System-Objekt — eigene Identitaet, damit die Faelle nicht kollidieren. */
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

/** Ein App-Roster mit `count` Warriors — jeder Aufruf ein neues Objekt. */
function appRoster(count = 1) {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit: 10000,
    costLimitType: COST_TYPE_ID,
    forces: [
      {
        id: 'force-uuid-1',
        forceEntryId: FORCE_DEF_ID,
        catalogueId: 'cat-main',
        selections: [
          {
            id: 'sel-warrior',
            name: 'Warrior',
            entryLinkId: null,
            selectionEntryId: WARRIOR_ID,
            number: count,
            category: null,
            selections: [],
          },
        ],
      },
    ],
  };
}

const hookResult = (system, roster) =>
  renderHook(({ s, r }) => useEvaluation(s, r), { initialProps: { s: system, r: roster } })
    .result.current;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('describeDataset laeuft hoechstens einmal je Datensatz (Issue 0121, Befund B)', () => {
  it('zwei describeSystem-Aufrufe mit demselben System-Objekt: EIN Lauf, dieselbe Beschreibung', () => {
    const system = appSystem();

    const first = describeSystem(system);
    const second = describeSystem(system);

    expect(describeDataset).toHaveBeenCalledTimes(1);
    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it('mehrere evaluateAppRoster-Aufrufe mit VERSCHIEDENEN Rostern: EIN Lauf, dieselbe Beschreibung', () => {
    const system = appSystem();

    const first = evaluateAppRoster(system, appRoster(1));
    const second = evaluateAppRoster(system, appRoster(2));
    const third = evaluateAppRoster(system, appRoster(3));

    expect(describeDataset).toHaveBeenCalledTimes(1);
    expect(first.description).not.toBeNull();
    expect(second.description).toBe(first.description);
    expect(third.description).toBe(first.description);
  });

  it('zwei useEvaluation-Instanzen mit demselben System-Objekt: EIN Lauf, dieselbe Beschreibung', () => {
    const system = appSystem();

    const first = hookResult(system, appRoster(1));
    const second = hookResult(system, appRoster(2));

    expect(describeDataset).toHaveBeenCalledTimes(1);
    expect(first.description).not.toBeNull();
    expect(second.description).toBe(first.description);
  });

  it('alle Raender zusammen (describeSystem + evaluateAppRoster + zwei Hook-Instanzen): GENAU EIN Lauf', () => {
    const system = appSystem();

    const fromDescribe = describeSystem(system);
    const fromDirect = evaluateAppRoster(system, appRoster(1));
    const fromHookA = hookResult(system, appRoster(2));
    const fromHookB = hookResult(system, appRoster(3));

    expect(describeDataset).toHaveBeenCalledTimes(1);
    expect(fromDescribe).not.toBeNull();
    expect(fromDirect.description).toBe(fromDescribe);
    expect(fromHookA.description).toBe(fromDescribe);
    expect(fromHookB.description).toBe(fromDescribe);
  });

  it('Wiederholung: zehn Aufrufe ueber beide Raender bleiben bei EINEM Lauf', () => {
    const system = appSystem();

    for (let round = 0; round < 5; round += 1) {
      evaluateAppRoster(system, appRoster(round));
      describeSystem(system);
    }

    expect(describeDataset).toHaveBeenCalledTimes(1);
  });

  it('ein NEUES System-Objekt (andere Identitaet, gleicher Inhalt) loest genau eine neue Beschreibung aus', () => {
    const firstDescription = describeSystem(appSystem());
    expect(describeDataset).toHaveBeenCalledTimes(1);

    const secondDescription = describeSystem(appSystem());

    expect(describeDataset).toHaveBeenCalledTimes(2);
    expect(secondDescription).not.toBe(firstDescription);
    expect(secondDescription).toEqual(firstDescription);
  });

  it('Rand: ohne Datensatz (system null / ohne .gst) laeuft describeDataset gar nicht', () => {
    const withoutGst = appSystem();
    withoutGst.rawXmls = { gst: [], cat: withoutGst.rawXmls.cat };

    expect(describeSystem(null)).toBeNull();
    expect(describeSystem(withoutGst)).toBeNull();
    expect(evaluateAppRoster(null, appRoster(1)).description).toBeNull();
    expect(evaluateAppRoster(withoutGst, appRoster(1)).description).toBeNull();

    expect(describeDataset).toHaveBeenCalledTimes(0);
  });
});
