/**
 * Issue 0168, AC4 — der Auswertungs-Cache trifft ueber einen Ansichtswechsel
 * hinweg.
 *
 * `useEvaluation` memoisiert nur innerhalb einer Montierung. Ein Wechsel von
 * Editor zu Spielmodus (oder zur Uebersicht und zurueck) montiert neu und wirft
 * das `useMemo` weg — ohne einen Cache auf der Ebene von `evaluateAppRoster`
 * rechnete die naechste Ansicht dasselbe unveraenderte Roster erneut aus. Der
 * Zaehler haengt an einem Durchreich-Mock der Fassade (dasselbe Muster wie in
 * `evaluationCache.describeCache.test.js`): beobachtet wird der `evaluate`-Lauf
 * UND die Referenzgleichheit des ausgelieferten Berichts.
 *
 * Die Caches sind WeakMaps ueber Objektidentitaeten und leben modulweit — jeder
 * Fall baut sich deshalb sein eigenes System- und Roster-Objekt.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../../domain/evaluator/evaluator.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, evaluate: vi.fn(actual.evaluate) };
});

import { evaluate } from '../../../domain/evaluator/evaluator.js';
import { useEvaluation } from '../../../contexts/ruleengine/readmodel/useEvaluation.js';
import { evaluateAppRoster } from '../../../contexts/ruleengine/acl/evaluationCache.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

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

/** Ein FRISCHES System-Objekt — eigene Identitaet je Fall. */
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

/** Eine Ansicht: montieren, den Bericht abholen, wieder abbauen. */
function viewReport(system, roster) {
  const view = renderHook(({ s, r }) => useEvaluation(s, r), {
    initialProps: { s: system, r: roster },
  });
  const report = view.result.current;
  view.unmount();
  return report;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Issue 0168: der Bericht haengt am Paar (System, Roster)', () => {
  it('zwei Aufrufe mit demselben Paar: EINE Auswertung, derselbe Bericht', () => {
    const system = appSystem();
    const roster = appRoster();

    const first = evaluateAppRoster(system, roster);
    const second = evaluateAppRoster(system, roster);

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('ein Ansichtswechsel wertet nicht erneut aus', () => {
    const system = appSystem();
    const roster = appRoster();

    // Editor auf, Editor zu, Spielmodus auf — dasselbe System, dasselbe Roster.
    const inEditor = viewReport(system, roster);
    const inPlayMode = viewReport(system, roster);

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(inPlayMode).toBe(inEditor);
    expect(inPlayMode.capabilities).toBe(inEditor.capabilities);
  });

  it('eine echte Aenderung am Roster wertet neu aus', () => {
    const system = appSystem();
    const roster = appRoster(1);
    const changed = appRoster(2);

    const before = evaluateAppRoster(system, roster);
    const after = evaluateAppRoster(system, changed);

    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(after).not.toBe(before);
    expect(after.costTotals[COST_TYPE_ID]).not.toBe(before.costTotals[COST_TYPE_ID]);
  });

  it('ein neues System-Objekt wertet neu aus', () => {
    const roster = appRoster();

    const first = evaluateAppRoster(appSystem(), roster);
    const second = evaluateAppRoster(appSystem(), roster);

    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
  });
});
