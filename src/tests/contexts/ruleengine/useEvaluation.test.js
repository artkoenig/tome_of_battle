/**
 * Issue 0121, Task 3 — React-Hook `useEvaluation`
 * (`src/contexts/ruleengine/readmodel/useEvaluation.js`, existiert noch nicht; test-first).
 *
 * Der Hook verdrahtet die Evaluator-Fassade (`src/contexts/ruleengine/evaluator.js`) mit
 * dem App-Modell: `useEvaluation(system, roster)` bereitet die rohen XMLs des
 * Systems (`system.rawXmls`) einmal je System-Objektidentitaet auf
 * (`prepareDataset`), uebersetzt das App-Roster (`toEvaluatorRoster`) und
 * liefert `{ violations, slots, description, costTotals }`.
 *
 * Massgebliche Regeln aus der Intention:
 * 1. Signatur: `useEvaluation(system, roster)` →
 *    `{ violations, capabilities, description, costTotals, pathBySelectionId }`.
 * 2. Funktion: Ergebnis = `evaluate(prepareDataset({ gameSystem:
 *    rawXmls.gst[0].content, catalogues: rawXmls.cat.map(f => f.content) }),
 *    toEvaluatorRoster(roster).evalRoster)` + `describeDataset` desselben
 *    Griffs + `pathBySelectionId` des Adapters.
 * 3. Kriterium 8: `prepareDataset` laeuft hoechstens EINMAL je
 *    System-Objektidentitaet — ueber beliebig viele Roster-Aenderungen hinweg;
 *    erst ein neues System-Objekt loest eine neue Vorbereitung aus. Dasselbe
 *    Roster-Objekt bei rerender → kein weiterer `evaluate`-Lauf; neues
 *    Roster-Objekt → genau ein weiterer.
 * 4. Leere Eingaben (system null/undefined, rawXmls fehlt, roster null) →
 *    stabiles Leer-Ergebnis `{ violations: [], capabilities: leere Map,
 *    description: null, costTotals: {}, pathBySelectionId: leere Map }`,
 *    kein Throw.
 * 5. Rein ableitend: gleiche Eingaben (gleiche Objektidentitaeten) →
 *    referenzgleiches Ergebnisobjekt ueber rerender (useMemo-Stabilitaet).
 *
 * Die Fassade wird per Modul-Mock DURCHGEREICHT und dabei gezaehlt
 * (`vi.fn(actual.…)`): der Aufruf-Zaehler ist hier Vertragsgegenstand
 * (Kriterium 8), das Verhalten bleibt das echte. Erwartete Zahlen des
 * synthetischen Datensatzes sind aus `docs/battlescribe-data-format.md`
 * (§7.5 Kosten, §7.6 Constraints) abgeleitet, nicht aus dem Engine-Quelltext.
 *
 * Vertragsentscheidungen dieses Tests (im Namen der Tests markiert):
 * - "Leere Map" (Kriterium 4) heisst: eine echte `Map` mit `size === 0` —
 *   dieselbe Form, die der Bericht (`capabilities`) und der Adapter
 *   (`pathBySelectionId`) im gefuellten Fall liefern.
 * - Das Leer-Ergebnis ist ueber rerender mit denselben (leeren) Eingaben
 *   ebenfalls referenzstabil — Kriterium 5 gilt fuer alle Eingaben.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Die Fassade als zaehlender Durchreich-Mock: echte Implementierung, aber
// jeder Aufruf wird gezaehlt (Kriterium 8 macht den Zaehler zum Vertrag).
vi.mock('../../../contexts/ruleengine/evaluator.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    prepareDataset: vi.fn(actual.prepareDataset),
    evaluate: vi.fn(actual.evaluate),
    describeDataset: vi.fn(actual.describeDataset),
  };
});

import { prepareDataset, evaluate, describeDataset } from '../../../contexts/ruleengine/evaluator.js';
import { toEvaluatorRoster } from '../../../contexts/ruleengine/acl/rosterAdapter.js';
import { useEvaluation } from '../../../contexts/ruleengine/readmodel/useEvaluation.js';

// JSDOM stellt DOMParser fuer den Testlauf bereit (Konvention der
// Evaluator-Tests, z. B. `costProjection.test.js`, `rosterAdapter.test.js`).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Synthetischer Datensatz (Muster der Evaluator-Tests) ────────────────────
//
// Ein Spielsystem mit einer Kostenart „pts"; ein Katalog mit einem Kontingent
// und einer Einheit „Warrior" (10 pts, max 1 je Kontingent). Das Roster waehlt
// Warrior ×2 — eine echte max-Verletzung, Kosten 2 × 10 = 20 pts.

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

/** Das App-System-Objekt mit den rohen XMLs (Shape aus `src/platform/persistence/systemImport.js`). */
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

/** Ein App-Roster (Shape aus `src/shared/rostermodel/types.js`): Warrior ×2 im einen Kontingent. */
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

/** renderHook um `useEvaluation(system, roster)` mit props-gesteuertem rerender. */
function renderEvaluation(system, roster) {
  return renderHook(({ system: s, roster: r }) => useEvaluation(s, r), {
    initialProps: { system, roster },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 1: Signatur
// ═════════════════════════════════════════════════════════════════════════════

describe('useEvaluation: Signatur', () => {
  it('liefert { violations, slots, description, costTotals } in den vertraglichen Formen', () => {
    const { result } = renderEvaluation(appSystem(), appRoster());

    expect(Array.isArray(result.current.violations)).toBe(true);
    expect(result.current.slots.capabilities).toBeInstanceOf(Map);
    expect(result.current.description).toBeTypeOf('object');
    expect(result.current.description).not.toBeNull();
    expect(result.current.costTotals).toBeTypeOf('object');
    expect(result.current.slots.pathBySelectionId).toBeInstanceOf(Map);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 2: Funktion — Ergebnis entspricht Fassade + Adapter
// ═════════════════════════════════════════════════════════════════════════════

describe('useEvaluation: Auswertung des Systems und Rosters ueber die Fassade', () => {
  it('eine echte Verletzung des Datensatzes erscheint in violations (max 1, gewaehlt 2)', () => {
    const { result } = renderEvaluation(appSystem(), appRoster());

    const violation = result.current.violations.find(
      entry => entry.limitId === WARRIOR_MAX_LIMIT_ID,
    );
    expect(violation, 'Verletzung der max-1-Grenze').toBeDefined();
    expect(violation).toMatchObject({ actual: 2, bound: 1 });
  });

  it('slots.capabilities fuehrt den belegten Slot der Auswahl unter dem Pfad aus slots.pathBySelectionId', () => {
    const { result } = renderEvaluation(appSystem(), appRoster());

    const path = result.current.slots.pathBySelectionId.get('sel-warrior');
    expect(path, 'Pfad fuer sel-warrior').toBeDefined();
    expect(result.current.slots.capabilities.has(path)).toBe(true);
    const capability = result.current.slots.capabilities.get(path);
    expect(capability.defId).toBe(WARRIOR_ID);
    // „belegt": der Berichtswert von AnchorKind.OCCUPIED (Konvention wie in
    // `rosterAdapter.test.js`).
    expect(capability.anchorKind).toBe('occupied');
  });

  it('costTotals summiert je deklarierter Kostenart (Warrior ×2 × 10 pts = 20)', () => {
    const { result } = renderEvaluation(appSystem(), appRoster());

    expect(result.current.costTotals).toEqual({ [COST_TYPE_ID]: 2 * WARRIOR_POINTS });
  });

  it('description.costTypes ist gefuellt: die im Spielsystem deklarierte Kostenart mit Klartext-Namen', () => {
    const { result } = renderEvaluation(appSystem(), appRoster());

    expect(result.current.description.costTypes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: COST_TYPE_ID, name: 'pts' })]),
    );
  });

  it('entspricht der direkten Verdrahtung: evaluate(prepareDataset(rawXmls), Adapter-Roster) + describeDataset + Adapter-Pfade', () => {
    const { result } = renderEvaluation(appSystem(), appRoster());

    // Referenzrechnung mit derselben (durchgereichten) Fassade und demselben
    // Adapter — strukturell identische Eingaben, getrennte Objekte.
    const prepared = prepareDataset({
      gameSystem: GAME_SYSTEM_XML,
      catalogues: [CATALOGUE_XML],
    });
    const { evalRoster, pathBySelectionId } = toEvaluatorRoster(appRoster());
    const report = evaluate(prepared, evalRoster);
    const description = describeDataset(prepared);

    expect(result.current.violations.map(entry => entry.limitId)).toEqual(
      report.violations.map(entry => entry.limitId),
    );
    expect(result.current.costTotals).toEqual(report.costTotals);
    expect([...result.current.slots.capabilities.keys()].sort()).toEqual(
      [...report.capabilities.keys()].sort(),
    );
    expect(result.current.description).toEqual(description);
    expect(result.current.slots.pathBySelectionId).toEqual(pathBySelectionId);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 8 (Issue): Aufruf-Zaehler — Vorbereitung je System-Objektidentitaet,
// Auswertung je Roster-Objektidentitaet
// ═════════════════════════════════════════════════════════════════════════════

describe('useEvaluation: prepareDataset laeuft hoechstens einmal je System-Objektidentitaet', () => {
  it('erste Auswertung: genau ein prepareDataset-Lauf', () => {
    renderEvaluation(appSystem(), appRoster());

    expect(prepareDataset).toHaveBeenCalledTimes(1);
  });

  it('beliebig viele Roster-Aenderungen (neue Roster-Objekte) loesen KEINE neue Vorbereitung aus', () => {
    const system = appSystem();
    const { rerender } = renderEvaluation(system, appRoster());

    rerender({ system, roster: appRoster() });
    rerender({ system, roster: appRoster() });
    rerender({ system, roster: appRoster() });

    expect(prepareDataset).toHaveBeenCalledTimes(1);
  });

  it('ein NEUES System-Objekt (andere Identitaet, gleicher Inhalt) loest genau eine neue Vorbereitung aus', () => {
    const roster = appRoster();
    const { rerender } = renderEvaluation(appSystem(), roster);
    expect(prepareDataset).toHaveBeenCalledTimes(1);

    rerender({ system: appSystem(), roster });

    expect(prepareDataset).toHaveBeenCalledTimes(2);
  });
});

describe('useEvaluation: evaluate ist je Roster-Objektidentitaet memoisiert', () => {
  it('rerender mit demselben Roster-Objekt: kein weiterer evaluate-Lauf', () => {
    const system = appSystem();
    const roster = appRoster();
    const { rerender } = renderEvaluation(system, roster);
    const runsAfterFirstRender = evaluate.mock.calls.length;
    expect(runsAfterFirstRender).toBe(1);

    rerender({ system, roster });
    rerender({ system, roster });

    expect(evaluate).toHaveBeenCalledTimes(runsAfterFirstRender);
  });

  it('rerender mit einem NEUEN Roster-Objekt: genau ein weiterer evaluate-Lauf', () => {
    const system = appSystem();
    const { rerender } = renderEvaluation(system, appRoster());
    expect(evaluate).toHaveBeenCalledTimes(1);

    rerender({ system, roster: appRoster() });

    expect(evaluate).toHaveBeenCalledTimes(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 4: Leere Eingaben — stabiles Leer-Ergebnis, kein Throw
// ═════════════════════════════════════════════════════════════════════════════

/** Prueft das vertragliche Leer-Ergebnis (Vertragsentscheidung: echte Maps). */
function expectEmptyResult(result) {
  expect(result.violations).toEqual([]);
  expect(result.slots.capabilities).toBeInstanceOf(Map);
  expect(result.slots.capabilities.size).toBe(0);
  expect(result.description).toBeNull();
  expect(result.costTotals).toEqual({});
  expect(result.slots.pathBySelectionId).toBeInstanceOf(Map);
  expect(result.slots.pathBySelectionId.size).toBe(0);
}

describe('useEvaluation: leere Eingaben ergeben das stabile Leer-Ergebnis, ohne Throw', () => {
  it('system null → Leer-Ergebnis', () => {
    const { result } = renderEvaluation(null, appRoster());

    expectEmptyResult(result.current);
  });

  it('system undefined → Leer-Ergebnis', () => {
    const { result } = renderEvaluation(undefined, appRoster());

    expectEmptyResult(result.current);
  });

  it('system ohne rawXmls (Start-Migration noch nicht gelaufen) → Leer-Ergebnis, kein Throw', () => {
    const system = appSystem();
    delete system.rawXmls;

    const { result } = renderEvaluation(system, appRoster());

    expectEmptyResult(result.current);
  });

  it('roster null → Leer-Ergebnis', () => {
    const { result } = renderEvaluation(appSystem(), null);

    expectEmptyResult(result.current);
  });

  it('system null UND roster null → Leer-Ergebnis (Rand: alles leer)', () => {
    const { result } = renderEvaluation(null, null);

    expectEmptyResult(result.current);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 5: rein ableitend — referenzstabiles Ergebnis bei gleichen Eingaben
// ═════════════════════════════════════════════════════════════════════════════

describe('useEvaluation: gleiche Eingaben liefern ein referenzgleiches Ergebnisobjekt (useMemo-Stabilitaet)', () => {
  it('rerender mit denselben system-/roster-Objekten: result.current bleibt dieselbe Referenz', () => {
    const system = appSystem();
    const roster = appRoster();
    const { result, rerender } = renderEvaluation(system, roster);
    const first = result.current;

    rerender({ system, roster });

    expect(result.current).toBe(first);
  });

  it('Vertragsentscheidung: auch das Leer-Ergebnis ist ueber rerender referenzstabil', () => {
    const { result, rerender } = renderEvaluation(null, null);
    const first = result.current;

    rerender({ system: null, roster: null });

    expect(result.current).toBe(first);
  });
});
