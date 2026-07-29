/**
 * Issue 0121, Task 5 — `useRoster` wechselt den Validierungspfad vom Solver
 * auf den Evaluator-Bericht (test-first; die neue Implementierung existiert
 * noch nicht).
 *
 * Intention: `useRoster(initialRoster, system, …)` (Signatur bleibt) liefert
 * statt der Solver-`validationErrors` künftig
 * - `violations`: die Evaluator-Verletzungen des aktuellen Rosters
 *   (Berichtsform der Fassade: origin/severity/anchor/limitId/limit/actual/
 *   bound/…),
 * - `capabilities`: die Slot-Map des Berichts (Map Slot-Pfad → Datensatz),
 * - `costTotals`: `Record<costTypeId, number>` — jede deklarierte Kostenart,
 *   auch ohne Vorkommen (Wert 0),
 * - `pathBySelectionId`: Map App-Selection-UUID → Slot-Pfad.
 * Nach einer Roster-Änderung über die vorhandene Hook-API (`removeUnit`)
 * aktualisieren sich `violations` und `costTotals`.
 *
 * Aufbau: synthetisches System mit `system.rawXmls` (Muster und Datensatz aus
 * `src/evaluation/useEvaluation.test.js`); die erwarteten Werte wurden per
 * Wegwerf-Skript gegen die echte Fassade verifiziert (Warrior ×2 gegen
 * max 1 je Kontingent → genau eine Verletzung, Kosten 20 pts; ohne die
 * Auswahl → keine Verletzung, Kosten 0 pts).
 *
 * Test-Harness-Entscheidung (wie im bestehenden `useRoster.test.js`): die
 * Solver-Fassade wird gestubbt (Abgleich = Identität, Kosten/Validierung
 * inert), damit ein noch vorhandener Alt-Pfad am synthetischen System nicht
 * scheitert — der Evaluator-Pfad läuft ECHT. Ist der Solver-Import aus dem
 * Hook bereits entfernt, ist der Mock wirkungslos.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoster } from './useRoster';

vi.mock('../solver/validator', async (importOriginal) => ({
  ...(await importOriginal()),
  calculateRosterCosts: vi.fn(() => ({})),
  validateRoster: vi.fn(() => []),
  syncRosterSelectionsWithSystem: vi.fn(roster => roster),
}));

// ── Synthetischer Datensatz (identisch zu useEvaluation.test.js) ────────────

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
 * Ein App-Roster (Shape aus `src/types.js`): Warrior ×2 im einen Kontingent —
 * eine echte Verletzung der max-1-Grenze, Kosten 2 × 10 = 20 pts.
 * (`costLimit` ist das Feld des Adapter-Vertrags; `costLimitValue` steht
 * daneben, weil der Alt-Pfad des Hooks es historisch las.)
 */
function appRoster() {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit: 10000,
    costLimitValue: 10000,
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

function renderRoster() {
  return renderHook(() => useRoster(appRoster(), appSystem(), vi.fn()));
}

describe('useRoster: Evaluator-Ergebnis statt Solver-validationErrors (Issue 0121, Task 5)', () => {
  it('liefert violations/capabilities/costTotals/pathBySelectionId in den vertraglichen Formen', () => {
    const { result } = renderRoster();

    expect(Array.isArray(result.current.violations)).toBe(true);
    expect(result.current.capabilities).toBeInstanceOf(Map);
    expect(result.current.costTotals).toBeTypeOf('object');
    expect(result.current.pathBySelectionId).toBeInstanceOf(Map);
  });

  it('eine echte Grenzverletzung des Rosters erscheint in violations (max 1 je Kontingent, gewählt 2)', () => {
    const { result } = renderRoster();

    const violation = result.current.violations.find(
      entry => entry.limitId === WARRIOR_MAX_LIMIT_ID,
    );
    expect(violation, 'Verletzung der max-1-Grenze').toBeDefined();
    expect(violation).toMatchObject({
      origin: 'derivedLimit',
      severity: 'error',
      actual: 2,
      bound: 1,
    });
    expect(violation.anchor).toMatchObject({ defId: WARRIOR_ID, name: 'Warrior' });
  });

  it('capabilities führt den belegten Slot der Auswahl unter dem Pfad aus pathBySelectionId', () => {
    const { result } = renderRoster();

    const path = result.current.pathBySelectionId.get('sel-warrior');
    expect(path, 'Slot-Pfad für sel-warrior').toBeDefined();
    expect(result.current.capabilities.has(path)).toBe(true);
    const capability = result.current.capabilities.get(path);
    expect(capability.defId).toBe(WARRIOR_ID);
    expect(capability.anchorKind).toBe('occupied');
  });

  it('costTotals summiert je deklarierter Kostenart (Warrior ×2 × 10 pts = 20)', () => {
    const { result } = renderRoster();

    expect(result.current.costTotals).toEqual({ [COST_TYPE_ID]: 2 * WARRIOR_POINTS });
  });

  it('nach removeUnit über die Hook-API aktualisieren sich violations und costTotals', () => {
    const { result } = renderRoster();
    expect(
      result.current.violations.some(entry => entry.limitId === WARRIOR_MAX_LIMIT_ID),
    ).toBe(true);

    act(() => {
      result.current.removeUnit('sel-warrior');
    });

    // Die Verletzung ist behoben …
    expect(
      result.current.violations.some(entry => entry.limitId === WARRIOR_MAX_LIMIT_ID),
    ).toBe(false);
    // … und die Kostensumme folgt dem neuen Roster: die deklarierte Kostenart
    // bleibt geführt, ihr Wert fällt auf 0 (Rand: Summe ohne Vorkommen).
    expect(result.current.costTotals).toEqual({ [COST_TYPE_ID]: 0 });
    // Die entfernte Auswahl hat keinen Slot-Pfad mehr.
    expect(result.current.pathBySelectionId.has('sel-warrior')).toBe(false);
  });
});
