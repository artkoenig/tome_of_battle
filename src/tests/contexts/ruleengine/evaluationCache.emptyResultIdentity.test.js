/**
 * Issue 0121, Pruefrunde 4, Befund C — die Referenzstabilitaet des
 * Leer-Ergebnisses, ueber die Raender hinweg.
 *
 * `evaluationCache.js` gibt in jedem Leerfall (kein System, kein Roh-XML, kein
 * Roster) **dieselbe** eingefrorene Referenz zurueck. Geprueft war davon bisher
 * nur ein Rerender **derselben** Hook-Instanz — das garantiert `useMemo`
 * ohnehin, unabhaengig von der geteilten Referenz; der Pruefer hat den Leerfall
 * probeweise auf ein frisches Objekt je Aufruf umgestellt, und alle Faelle
 * blieben gruen. Diese Datei schliesst die Beweisluecke; sie beschreibt kein
 * neues Verhalten.
 *
 * Sollverhalten: **jeder** Leerfall an **jedem** Rand liefert dieselbe
 * Objektreferenz — zwei Hook-Instanzen untereinander, zwei Direktaufrufe
 * untereinander, und Hook gegen Direktaufruf. Das gilt ueber die verschiedenen
 * Leer-Ursachen hinweg (System `null`, System ohne `rawXmls`, System ohne
 * `.gst`, Roster `null`): sie unterscheiden sich fuer die Oberflaeche nicht.
 *
 * Geprueft wird mit `toBe` (Referenz), nicht `toEqual` — genau diese
 * Unterscheidung ist der Gegenstand. Damit der Vergleich einen Gegenstand hat,
 * stellt jeder Fall zuerst fest, dass es wirklich das Leer-Ergebnis ist.
 *
 * Fixture-Muster: `useEvaluation.test.js` / `evaluationCache.evaluator.test.js`
 * (synthetischer Datensatz aus `rawXmls`, echte Fassade); beide Dateien bleiben
 * unberuehrt.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
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

function appRoster() {
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
            number: 1,
            category: null,
            selections: [],
          },
        ],
      },
    ],
  };
}

/** Ein System ohne `rawXmls` (Start-Migration noch nicht gelaufen). */
function systemWithoutRawXmls() {
  const system = appSystem();
  delete system.rawXmls;
  return system;
}

/** Ein System mit `rawXmls`, aber ohne `.gst`-Datei. */
function systemWithoutGst() {
  const system = appSystem();
  system.rawXmls = { gst: [], cat: system.rawXmls.cat };
  return system;
}

/** Vorbedingung jedes Falls: es ist wirklich das Leer-Ergebnis. */
function expectEmptyShape(result) {
  expect(result.violations).toEqual([]);
  expect(result.slots.capabilities.size).toBe(0);
  expect(result.description).toBeNull();
  expect(result.costTotals).toEqual({});
  expect(result.slots.pathBySelectionId.size).toBe(0);
  expect(result.slots.pathByForceId.size).toBe(0);
}

const hookResult = (system, roster) =>
  renderHook(({ s, r }) => useEvaluation(s, r), { initialProps: { s: system, r: roster } })
    .result.current;

/** Die Leer-Ursachen, je als Paar (system, roster) — fuer die Oberflaeche ununterscheidbar. */
const EMPTY_CAUSES = [
  ['system null', () => [null, appRoster()]],
  ['system undefined', () => [undefined, appRoster()]],
  ['system ohne rawXmls', () => [systemWithoutRawXmls(), appRoster()]],
  ['system ohne .gst', () => [systemWithoutGst(), appRoster()]],
  ['roster null', () => [appSystem(), null]],
  ['roster undefined', () => [appSystem(), undefined]],
  ['system und roster null', () => [null, null]],
];

describe('Leer-Ergebnis: dieselbe Referenz an jedem Rand (Issue 0121, Befund C)', () => {
  it('zwei Direktaufrufe (evaluateAppRoster) liefern dieselbe Referenz', () => {
    const first = evaluateAppRoster(null, appRoster());
    const second = evaluateAppRoster(null, appRoster());

    expectEmptyShape(first);
    expect(second).toBe(first);
  });

  it('zwei verschiedene Hook-Instanzen liefern dieselbe Referenz', () => {
    const first = hookResult(null, appRoster());
    const second = hookResult(null, appRoster());

    expectEmptyShape(first);
    expect(second).toBe(first);
  });

  it('Hook gegen Direktaufruf: dieselbe Referenz', () => {
    const fromHook = hookResult(null, appRoster());
    const fromDirect = evaluateAppRoster(null, appRoster());

    expectEmptyShape(fromHook);
    expect(fromDirect).toBe(fromHook);
  });

  it.each(EMPTY_CAUSES)('Leer-Ursache „%s": Hook und Direktaufruf teilen EINE Referenz', (_name, inputs) => {
    const [systemForHook, rosterForHook] = inputs();
    const [systemForDirect, rosterForDirect] = inputs();

    const fromHook = hookResult(systemForHook, rosterForHook);
    const fromDirect = evaluateAppRoster(systemForDirect, rosterForDirect);

    expectEmptyShape(fromHook);
    expect(fromDirect).toBe(fromHook);
  });

  it('alle Leer-Ursachen untereinander: EINE einzige Referenz, egal woran es liegt', () => {
    const results = EMPTY_CAUSES.map(([, inputs]) => {
      const [system, roster] = inputs();
      return evaluateAppRoster(system, roster);
    });

    expectEmptyShape(results[0]);
    for (const result of results) expect(result).toBe(results[0]);
  });

  it('alle Leer-Ursachen untereinander am HOOK-Rand: EINE einzige Referenz', () => {
    const results = EMPTY_CAUSES.map(([, inputs]) => {
      const [system, roster] = inputs();
      return hookResult(system, roster);
    });

    expectEmptyShape(results[0]);
    for (const result of results) expect(result).toBe(results[0]);
  });

  it('Rand: eine gefuellte Auswertung dazwischen aendert die Leer-Referenz nicht', () => {
    const before = evaluateAppRoster(null, appRoster());

    const filled = evaluateAppRoster(appSystem(), appRoster());
    expect(filled.slots.capabilities.size).toBeGreaterThan(0);

    const after = evaluateAppRoster(null, appRoster());
    const afterAtHook = hookResult(appSystem(), null);

    expect(after).toBe(before);
    expect(afterAtHook).toBe(before);
  });
});
