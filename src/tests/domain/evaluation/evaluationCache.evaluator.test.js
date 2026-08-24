/**
 * Issue 0121, Task 7 — modulweiter Auswertungs-Cache
 * (`src/domain/evaluation/evaluationCache.js`, existiert noch nicht; test-first).
 *
 * Intention:
 * - `evaluateAppRoster(system, roster)` liefert dieselbe Ergebnisform wie
 *   `useEvaluation` — `{ violations, slots, costTotals }` — und ist AUSSERHALB von React aufrufbar (reine
 *   Funktion, kein Hook). Leer-/Fehlfälle wie `useEvaluation`: system
 *   null/undefined/ohne (vollständiges) `rawXmls` oder roster null/undefined
 *   → Leer-Ergebnis ohne Throw (violations `[]`, leerer Slot-Index,
 *   costTotals `{}`).
 * - `describeSystem(system)` liefert das `describeDataset`-Ergebnis
 *   (costTypes/catalogues/creatableForces) OHNE Roster; system null oder ohne
 *   rawXmls → `null`.
 * - Der prepareDataset-Lauf ist je System-OBJEKT global geteilt (WeakMap
 *   o. ä.): zwei useEvaluation-Hook-Instanzen mit demselben System-Objekt
 *   plus ein `evaluateAppRoster`- und ein `describeSystem`-Aufruf ergeben
 *   zusammen GENAU EINEN `prepareDataset`-Aufruf. Das verschärft Kriterium 8
 *   des Issues von „je Hook-Instanz" auf „je Datensatz" — heute bereitet jede
 *   Hook-Instanz für sich vor (useMemo je Instanz), weshalb diese Tests
 *   fehlschlagen müssen.
 *
 * Aufbau: Spy-Muster und synthetischer Datensatz aus
 * `src/domain/evaluation/useEvaluation.test.js` (Fassade als zählender
 * Durchreich-Mock; Erwartungen aus `docs/battlescribe-data-format.md`
 * §7.5/§7.6 abgeleitet und per Wegwerf-Skript gegen die echte Fassade
 * verifiziert: Warrior ×2 gegen max 1 → eine Verletzung, Kosten 20 pts).
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

import { prepareDataset, evaluate, describeDataset } from '../../../domain/evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../../domain/evaluation/rosterAdapter.js';
import { useEvaluation } from '../../../domain/evaluation/useEvaluation.js';
import { evaluateAppRoster, describeSystem } from '../../../domain/evaluation/evaluationCache.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Synthetischer Datensatz (Muster aus useEvaluation.test.js) ──────────────

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const WARRIOR_ID = 'entry-warrior';
const COST_TYPE_ID = 'cost-pts';
const WARRIOR_MAX_LIMIT_ID = 'limit-warrior-max';
const WARRIOR_POINTS = 10;

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
        <constraints>
          <constraint type="max" value="1" field="selections" scope="force" shared="true" id="${WARRIOR_MAX_LIMIT_ID}" includeChildSelections="false"/>
        </constraints>
        <costs>
          <cost name="pts" typeId="${COST_TYPE_ID}" value="${WARRIOR_POINTS}"/>
        </costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Das App-System-Objekt mit den rohen XMLs (Shape aus `src/data/db/systemImport.js`). */
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

/** Ein App-Roster (Shape aus `src/domain/types.js`): Warrior ×2 im einen Kontingent. */
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
            number: 2,
            category: null,
            selections: [],
          },
        ],
      },
    ],
  };
}

/** Prueft das vertragliche Leer-Ergebnis (Formen wie useEvaluation). */
function expectEmptyResult(result) {
  expect(result.violations).toEqual([]);
  expect(result.slots.capabilities).toBeInstanceOf(Map);
  expect(result.slots.capabilities.size).toBe(0);
  expect(result.costTotals).toEqual({});
  expect(result.slots.pathBySelectionId).toBeInstanceOf(Map);
  expect(result.slots.pathBySelectionId.size).toBe(0);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// evaluateAppRoster: Ergebnisform wie useEvaluation, ausserhalb von React
// ═════════════════════════════════════════════════════════════════════════════

describe('evaluateAppRoster: dieselbe Ergebnisform wie useEvaluation, ohne React', () => {
  it('liefert violations/slots/costTotals in den vertraglichen Formen', () => {
    const result = evaluateAppRoster(appSystem(), appRoster());

    expect(Array.isArray(result.violations)).toBe(true);
    expect(result.slots.capabilities).toBeInstanceOf(Map);
    expect(result.costTotals).toBeTypeOf('object');
    expect(result.slots.pathBySelectionId).toBeInstanceOf(Map);
  });

  it('eine echte Verletzung des Datensatzes erscheint in violations (max 1, gewaehlt 2)', () => {
    const result = evaluateAppRoster(appSystem(), appRoster());

    const violation = result.violations.find(
      entry => entry.limitId === WARRIOR_MAX_LIMIT_ID,
    );
    expect(violation, 'Verletzung der max-1-Grenze').toBeDefined();
    expect(violation).toMatchObject({ actual: 2, bound: 1 });
  });

  it('costTotals summiert je deklarierter Kostenart (Warrior ×2 × 10 pts = 20)', () => {
    const result = evaluateAppRoster(appSystem(), appRoster());

    expect(result.costTotals).toEqual({ [COST_TYPE_ID]: 2 * WARRIOR_POINTS });
  });

  it('slots.capabilities fuehrt den belegten Slot unter dem Pfad aus slots.pathBySelectionId', () => {
    const result = evaluateAppRoster(appSystem(), appRoster());

    const path = result.slots.pathBySelectionId.get('sel-warrior');
    expect(path, 'Pfad fuer sel-warrior').toBeDefined();
    expect(result.slots.capabilities.has(path)).toBe(true);
    expect(result.slots.capabilities.get(path)).toMatchObject({
      defId: WARRIOR_ID,
      anchorKind: 'occupied',
    });
  });

  it('entspricht der direkten Verdrahtung: evaluate(prepareDataset(rawXmls), Adapter-Roster)', () => {
    const result = evaluateAppRoster(appSystem(), appRoster());

    // Referenzrechnung mit derselben (durchgereichten) Fassade und demselben
    // Adapter — strukturell identische Eingaben, getrennte Objekte.
    const prepared = prepareDataset({
      gameSystem: GAME_SYSTEM_XML,
      catalogues: [CATALOGUE_XML],
    });
    const { evalRoster, pathBySelectionId } = toEvaluatorRoster(appRoster());
    const report = evaluate(prepared, evalRoster);

    expect(result.violations.map(entry => entry.limitId)).toEqual(
      report.violations.map(entry => entry.limitId),
    );
    expect(result.costTotals).toEqual(report.costTotals);
    expect([...result.slots.capabilities.keys()].sort()).toEqual(
      [...report.capabilities.keys()].sort(),
    );
    expect(result.slots.pathBySelectionId).toEqual(pathBySelectionId);
  });
});

describe('evaluateAppRoster: Leer-/Fehlfaelle wie useEvaluation — Leer-Ergebnis, kein Throw', () => {
  it('system null → Leer-Ergebnis', () => {
    expectEmptyResult(evaluateAppRoster(null, appRoster()));
  });

  it('system undefined → Leer-Ergebnis', () => {
    expectEmptyResult(evaluateAppRoster(undefined, appRoster()));
  });

  it('system ohne rawXmls (Start-Migration noch nicht gelaufen) → Leer-Ergebnis, kein Throw', () => {
    const system = appSystem();
    delete system.rawXmls;

    expectEmptyResult(evaluateAppRoster(system, appRoster()));
  });

  it('system mit rawXmls ohne .gst-Datei → Leer-Ergebnis, kein Throw', () => {
    const system = appSystem();
    system.rawXmls = { gst: [], cat: system.rawXmls.cat };

    expectEmptyResult(evaluateAppRoster(system, appRoster()));
  });

  it('roster null → Leer-Ergebnis', () => {
    expectEmptyResult(evaluateAppRoster(appSystem(), null));
  });

  it('system null UND roster null → Leer-Ergebnis (Rand: alles leer)', () => {
    expectEmptyResult(evaluateAppRoster(null, null));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// describeSystem: die Datensatz-Beschreibung ohne Roster
// ═════════════════════════════════════════════════════════════════════════════

describe('describeSystem: describeDataset-Ergebnis ohne Roster', () => {
  it('liefert costTypes/catalogues/creatableForces des Datensatzes', () => {
    const description = describeSystem(appSystem());

    expect(description).not.toBeNull();
    expect(description.costTypes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: COST_TYPE_ID, name: 'pts' })]),
    );
    expect(description.catalogues).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'cat-main', name: 'Main Catalogue' })]),
    );
    expect(description.creatableForces).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: FORCE_DEF_ID, name: 'Main Force' })]),
    );
  });

  it('entspricht describeDataset(prepareDataset(rawXmls)) desselben Datensatzes', () => {
    const description = describeSystem(appSystem());

    const reference = describeDataset(prepareDataset({
      gameSystem: GAME_SYSTEM_XML,
      catalogues: [CATALOGUE_XML],
    }));

    expect(description).toEqual(reference);
  });

  it('system null → null', () => {
    expect(describeSystem(null)).toBeNull();
  });

  it('system undefined → null', () => {
    expect(describeSystem(undefined)).toBeNull();
  });

  it('system ohne rawXmls → null', () => {
    const system = appSystem();
    delete system.rawXmls;

    expect(describeSystem(system)).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Der Katalog-Vorlauf ist je System-Objekt GLOBAL geteilt (WeakMap o. ä.)
// ═════════════════════════════════════════════════════════════════════════════

describe('prepareDataset laeuft genau einmal je System-Objekt — geteilt ueber Hooks und Modul-Aufrufe', () => {
  it('zwei useEvaluation-Hook-Instanzen mit demselben System-Objekt teilen sich EINEN prepareDataset-Lauf', () => {
    const system = appSystem();

    renderHook(() => useEvaluation(system, appRoster()));
    renderHook(() => useEvaluation(system, appRoster()));

    expect(prepareDataset).toHaveBeenCalledTimes(1);
  });

  it('Hook-Instanzen + evaluateAppRoster + describeSystem mit demselben System-Objekt: zusammen GENAU EIN prepareDataset-Lauf', () => {
    const system = appSystem();

    renderHook(() => useEvaluation(system, appRoster()));
    renderHook(() => useEvaluation(system, appRoster()));
    evaluateAppRoster(system, appRoster());
    describeSystem(system);

    expect(prepareDataset).toHaveBeenCalledTimes(1);
  });

  it('wiederholte evaluateAppRoster-Aufrufe mit demselben System-Objekt bereiten nicht erneut vor', () => {
    const system = appSystem();

    evaluateAppRoster(system, appRoster());
    evaluateAppRoster(system, appRoster());
    evaluateAppRoster(system, appRoster());

    expect(prepareDataset).toHaveBeenCalledTimes(1);
  });

  it('ein NEUES System-Objekt (andere Identitaet, gleicher Inhalt) loest genau eine neue Vorbereitung aus', () => {
    evaluateAppRoster(appSystem(), appRoster());
    expect(prepareDataset).toHaveBeenCalledTimes(1);

    evaluateAppRoster(appSystem(), appRoster());

    expect(prepareDataset).toHaveBeenCalledTimes(2);
  });
});
