/**
 * E2E-Belege der Regel „Armee zu teuer" ueber die Fassade `evaluate`
 * (Main-Issue 68, Slice 03): uebersteigt die am ROSTER-Rahmen verplante Summe
 * einer Kostenart die eingestellte Grenze, erscheint eine roster-weite
 * Budget-Verletzung in **derselben** `violations`-Liste wie die uebrigen
 * Verletzungen — mit synthetischem roster-weitem Anker. Auf oder unter der Grenze
 * entsteht keine; mehrere Kostenarten werden je gegen ihre eigene Grenze geprueft.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';
import {
  rosterBudgetLimitId,
  ROSTER_BUDGET_ANCHOR_ID,
  ROSTER_BUDGET_ANCHOR_NAME,
} from './model.js';
import { selection, force, violationOf } from './__fixtures__/e2eRoster.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const HQ_FORCE_ID = 'hq';
const UNIT_ID = 'unit';
const BANNER_ID = 'banner';
const WIZARD_ID = 'wizard';
const POINTS = 'pts';
const MANA = 'mana';

// Die verplanten Kosten der Armee: eine Einheit (100 Punkte) mit einer
// geschachtelten Banner-Aufwertung (50 Punkte) plus ein Magier (30 Mana).
const UNIT_POINTS = 100;
const BANNER_POINTS = 50;
const WIZARD_MANA = 30;
const ROSTER_POINTS = UNIT_POINTS + BANNER_POINTS; // 150 — inkl. geschachtelter Auswahl
const ROSTER_MANA = WIZARD_MANA; // 30

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-budget" name="Budget Catalogue">
    <forceEntries>
      <forceEntry id="${HQ_FORCE_ID}" name="HQ"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${UNIT_ID}" name="Unit" type="unit">
        <costs>
          <cost name="Points" typeId="${POINTS}" value="${UNIT_POINTS}"/>
        </costs>
      </selectionEntry>
      <selectionEntry id="${BANNER_ID}" name="Banner" type="upgrade">
        <costs>
          <cost name="Points" typeId="${POINTS}" value="${BANNER_POINTS}"/>
        </costs>
      </selectionEntry>
      <selectionEntry id="${WIZARD_ID}" name="Wizard" type="unit">
        <costs>
          <cost name="Mana" typeId="${MANA}" value="${WIZARD_MANA}"/>
        </costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/**
 * Ein Roster mit einer Einheit (samt geschachtelter Banner-Aufwertung) und einem
 * Magier, mit den uebergebenen eingestellten Kostengrenzen.
 */
function armyWithLimits(costLimits) {
  return {
    forces: [force(HQ_FORCE_ID, [
      selection(UNIT_ID, 1, [selection(BANNER_ID, 1)]),
      selection(WIZARD_ID, 1),
    ])],
    costLimits,
  };
}

describe('E2E Budget-Regel: Ueberschreitung meldet eine roster-weite Verletzung', () => {
  it('meldet die Verletzung inklusive geschachtelter Auswahlkosten, wenn die Punkte die Grenze uebersteigen', () => {
    // Grenze 120 < 150; ohne Mitzaehlen der geschachtelten Banner-Kosten (100 <= 120)
    // gaebe es keine Verletzung — der Beleg, dass die ROSTER-Summe die Schachtelung erfasst.
    const report = evaluate({ catalogues: [CATALOGUE_XML] }, armyWithLimits([{ costTypeId: POINTS, value: 120 }]));

    expect(violationOf(report, rosterBudgetLimitId(POINTS))).toEqual({
      limitId: rosterBudgetLimitId(POINTS),
      anchor: { defId: ROSTER_BUDGET_ANCHOR_ID, name: ROSTER_BUDGET_ANCHOR_NAME },
      actual: ROSTER_POINTS,
      bound: 120,
      delta: 120 - ROSTER_POINTS,
    });
  });

  it('meldet keine Verletzung genau auf der Grenze', () => {
    const report = evaluate({ catalogues: [CATALOGUE_XML] }, armyWithLimits([{ costTypeId: POINTS, value: ROSTER_POINTS }]));

    expect(report.violations).toHaveLength(0);
  });

  it('meldet keine Verletzung unter der Grenze', () => {
    const report = evaluate({ catalogues: [CATALOGUE_XML] }, armyWithLimits([{ costTypeId: POINTS, value: 200 }]));

    expect(report.violations).toHaveLength(0);
  });
});

describe('E2E Budget-Regel: mehrere Kostenarten, je gegen ihre eigene Grenze', () => {
  it('meldet nur die ueberschrittene Kostenart, nicht die eingehaltene', () => {
    // Punkte 150 > 120 (verletzt); Mana 30 <= 50 (eingehalten).
    const report = evaluate({ catalogues: [CATALOGUE_XML] }, armyWithLimits([
      { costTypeId: POINTS, value: 120 },
      { costTypeId: MANA, value: 50 },
    ]));

    expect(report.violations).toHaveLength(1);
    expect(violationOf(report, rosterBudgetLimitId(POINTS))).toMatchObject({ actual: ROSTER_POINTS, bound: 120 });
    expect(violationOf(report, rosterBudgetLimitId(MANA))).toBeUndefined();
  });

  it('meldet je eine Verletzung, wenn beide Kostenarten ihre Grenze uebersteigen', () => {
    // Punkte 150 > 120 und Mana 30 > 20.
    const report = evaluate({ catalogues: [CATALOGUE_XML] }, armyWithLimits([
      { costTypeId: POINTS, value: 120 },
      { costTypeId: MANA, value: 20 },
    ]));

    expect(report.violations).toHaveLength(2);
    expect(violationOf(report, rosterBudgetLimitId(POINTS))).toMatchObject({ actual: ROSTER_POINTS, bound: 120 });
    expect(violationOf(report, rosterBudgetLimitId(MANA))).toMatchObject({ actual: ROSTER_MANA, bound: 20 });
  });
});
