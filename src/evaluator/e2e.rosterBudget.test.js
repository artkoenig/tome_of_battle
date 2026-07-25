/**
 * Reale E2E-Belege, dass die **eingestellte Roster-Punktgrenze** die
 * budget-gesteuerten Katalogregeln treibt (Main-Issue 68, Slice 02). Eine
 * `limit::<costTypeId>`-Regel mit Bezugsrahmen `roster` erhaelt jetzt die
 * eingestellte Grenze der Kostenart statt still `0`:
 *
 *  - **Skalierung je Punkte-Stufe** an echten Definitive-Edition-Daten: die
 *    armeeweite Core-Mindestzahl steigt mit der gewaehlten Punktzahl (Basis 2 →
 *    3 bei 2000–2999 → 4 bei 3000–3999), genau wie es die `.gst` hinterlegt.
 *  - **Sichtbarkeit / Verfuegbarkeit** (dasselbe `set hidden`-Muster wie die
 *    reale „Lord"-Kategorie): ein Eintrag ist unter seiner Punktgrenze versteckt
 *    und ab ihr sichtbar.
 *  - **Fail-closed + Diagnose**: ohne budgetierte Punkte loest `limit::pts` nicht
 *    auf — die skalierenden Modifikatoren feuern nicht (Basiswert bleibt stehen)
 *    und es entsteht eine `UNRESOLVED_BUDGET_LIMIT`-Diagnose statt eines stillen 0.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';
import { DiagnosticKind } from './model.js';
import { selection, force, roster, violationOf, countDiagnostics } from './__fixtures__/e2eRoster.js';
import {
  orcsAndGoblinsDataset,
  ORCS_AND_GOBLINS_FORCE_ID,
  CORE_MIN_ID,
  CORE_CATEGORY_ID,
  CORE_CATEGORY_NAME,
  CORE_MIN_BASE_VALUE,
} from './__fixtures__/realCatalogs.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Die Kostenart „pts" (Punkte) der Definitive-Edition — Ziel jeder `limit::pts`-Regel. */
const POINTS_COST_TYPE_ID = 'ecfa-8486-4f6c-c249';

// Verifizierte Core-Mindestzahl-Stufen der `.gst` (Kategorie „Core", Grenze
// CORE_MIN_ID): der bedingungslose Basiswert und die budget-gestaffelten Stufen.
const CORE_MIN_AT_2000_2999 = 3;
const CORE_MIN_AT_3000_3999 = 4;

/** Ein leeres Orcs-Kontingent mit der gegebenen eingestellten Punktgrenze. */
function emptyForceWithPoints(points) {
  return {
    ...roster(force(ORCS_AND_GOBLINS_FORCE_ID, [])),
    costLimits: [{ costTypeId: POINTS_COST_TYPE_ID, value: points }],
  };
}

describe('E2E Roster-Budget: die Punktzahl skaliert die Core-Mindestzahl (echte Daten)', () => {
  it('haelt die Basis-Mindestzahl unter 2000 Punkten', () => {
    const report = evaluate(orcsAndGoblinsDataset(), emptyForceWithPoints(1000));

    expect(violationOf(report, CORE_MIN_ID)).toMatchObject({
      anchor: { defId: CORE_CATEGORY_ID, name: CORE_CATEGORY_NAME },
      actual: 0,
      bound: CORE_MIN_BASE_VALUE,
    });
  });

  it('hebt die Mindestzahl bei 2000–2999 Punkten auf 3', () => {
    const report = evaluate(orcsAndGoblinsDataset(), emptyForceWithPoints(2500));

    expect(violationOf(report, CORE_MIN_ID)).toMatchObject({ actual: 0, bound: CORE_MIN_AT_2000_2999 });
  });

  it('hebt die Mindestzahl bei 3000–3999 Punkten auf 4', () => {
    const report = evaluate(orcsAndGoblinsDataset(), emptyForceWithPoints(3500));

    expect(violationOf(report, CORE_MIN_ID)).toMatchObject({ actual: 0, bound: CORE_MIN_AT_3000_3999 });
  });

  it('meldet keine Budget-Diagnose, wenn die Punkte budgetiert sind', () => {
    const report = evaluate(orcsAndGoblinsDataset(), emptyForceWithPoints(2500));

    expect(countDiagnostics(report, DiagnosticKind.UNRESOLVED_BUDGET_LIMIT)).toBe(0);
  });
});

describe('E2E Roster-Budget: fehlendes Budget → fail-closed + Diagnose (echte Daten)', () => {
  it('haelt die Core-Mindestzahl auf dem Basiswert und meldet die unaufloesbare Grenze', () => {
    // Ohne `costLimits` laesst sich `limit::pts` nicht aufloesen: die skalierenden
    // Modifikatoren feuern nicht (Basiswert 2 bleibt) und eine Diagnose entsteht.
    const report = evaluate(orcsAndGoblinsDataset(), roster(force(ORCS_AND_GOBLINS_FORCE_ID, [])));

    expect(violationOf(report, CORE_MIN_ID)).toMatchObject({ actual: 0, bound: CORE_MIN_BASE_VALUE });
    const pointsUnresolved = report.diagnostics.filter(
      d => d.kind === DiagnosticKind.UNRESOLVED_BUDGET_LIMIT && d.costTypeId === POINTS_COST_TYPE_ID,
    );
    expect(pointsUnresolved.length).toBeGreaterThan(0);
  });
});

// ── Sichtbarkeit/Verfuegbarkeit am `set hidden`-Muster der realen „Lord"-Kategorie ──
// Ein minimaler Katalog, der genau die belegte Form spiegelt: ein Eintrag wird
// versteckt, solange die eingestellte Punktgrenze unter einer Schwelle liegt
// (`set hidden=true` bei `limit::pts < schwelle`). So laesst sich die
// budget-abhaengige Verfuegbarkeit end-to-end ueber die Fassade pruefen.
const POINTS = 'pts';
const HIDE_BELOW = 1000;
const FORCE_ID = 'hq';
const SPECIAL_ARMY_ID = 'special-army';

const SYNTHETIC_CATALOGUE = `<?xml version="1.0"?>
  <catalogue id="syn" name="Synthetic Budget Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="HQ"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${SPECIAL_ARMY_ID}" name="Special Army">
        <modifiers>
          <modifier type="set" value="true" field="hidden">
            <conditions>
              <condition type="lessThan" value="${HIDE_BELOW}" field="limit::${POINTS}" scope="roster" childId="any" shared="true" includeChildSelections="true" includeChildForces="true"/>
            </conditions>
          </modifier>
        </modifiers>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Der Faehigkeitsdatensatz des Sonderheer-Eintrags aus dem Bericht. */
function specialArmyCapability(report) {
  return [...report.capabilities.values()].find(capability => capability.node.def.id === SPECIAL_ARMY_ID);
}

/** Ein Roster, das den Sonderheer-Eintrag unter dem Kontingent traegt, mit gegebener Punktgrenze. */
function armyWithPoints(points) {
  return {
    forces: [{ defId: FORCE_ID, count: 1, children: [selection(SPECIAL_ARMY_ID)] }],
    costLimits: [{ costTypeId: POINTS, value: points }],
  };
}

describe('E2E Roster-Budget: die Punktzahl steuert die Verfuegbarkeit (set hidden)', () => {
  it('versteckt den Eintrag unterhalb seiner Punktgrenze', () => {
    const report = evaluate({ catalogues: [SYNTHETIC_CATALOGUE] }, armyWithPoints(HIDE_BELOW - 500));

    expect(specialArmyCapability(report).isHidden).toBe(true);
  });

  it('gibt den Eintrag ab seiner Punktgrenze frei', () => {
    const report = evaluate({ catalogues: [SYNTHETIC_CATALOGUE] }, armyWithPoints(HIDE_BELOW + 500));

    expect(specialArmyCapability(report).isHidden).toBe(false);
  });
});
