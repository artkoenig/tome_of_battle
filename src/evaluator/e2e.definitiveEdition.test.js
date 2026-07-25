/**
 * End-to-End-Tests der Reinraum-Engine ueber die **Fassade** `evaluate()` — die
 * erste Nahtstelle (`docs/evaluator-architecture.md` §2, Leitprinzip 1). Sie
 * fahren die ganze Pipeline (eigener Leser → Resolver → Join/Phantome → Index →
 * Fixpunkt/Modifikatoren → Constraints → Bericht) an realistischen WHFB6-Faellen,
 * modelliert an der „Definitive Edition" (siehe
 * `__fixtures__/definitiveEditionCatalogue.js`):
 *
 * - eine **armeeweite Pflichteinheit** (Ogerbullen/Bulls), die beim Fehlen
 *   anschlaegt und bei Vorhandensein erfuellt ist,
 * - eine **Mischung der Grenz-Arten** (min/max Selektion, Prozent/Kosten),
 * - ein **bedingter Modifikator** mit `instanceOf`, der eine Grenze anhebt,
 * - **Kategorien**, die die Zaehlung treiben (Core-Anteil, Characters-Gate).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';
import { mandatoryOpenSlots } from './report.js';
import {
  CATALOGUE_XML,
  buildRoster,
  BULLS_ID,
  BULLS_MANDATORY_MIN_ID,
  BULLS_MIN,
  BULLS_POINTS,
  IRONGUTS_MAX_ID,
  IRONGUTS_BASE_MAX,
  IRONGUTS_RAISED_MAX,
  TYRANT_MAX_ID,
  TYRANT_MAX,
  TYRANT_POINTS,
  CORE_PERCENT_MIN_ID,
} from './__fixtures__/definitiveEditionCatalogue.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit — das Primitiv, das der
// eigene XML-Leser der Engine nutzt (wie in den uebrigen Evaluator-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Die Verletzung zu einer Grenz-Id, oder `undefined`, wenn keine vorliegt. */
function violationOf(report, limitId) {
  return report.violations.find(violation => violation.limitId === limitId);
}

describe('E2E: armeeweite Pflichteinheit (Ogerbullen/Bulls)', () => {
  it('schlaegt an, wenn die Pflichteinheit in der ganzen Armee fehlt', () => {
    // Nur Ironguts, kein einziger Bulls-Trupp → die roster-weite min-Grenze
    // findet 0 Instanzen und wird am synthetisierten Phantom-Anker verletzt.
    const report = evaluate(CATALOGUE_XML, buildRoster({ ironguts: 1 }));

    const bullsViolation = violationOf(report, BULLS_MANDATORY_MIN_ID);
    expect(bullsViolation).toEqual({
      limitId: BULLS_MANDATORY_MIN_ID,
      anchor: { defId: BULLS_ID, name: 'Bulls' },
      actual: 0,
      bound: BULLS_MIN,
      delta: BULLS_MIN,
    });
  });

  it('fuehrt die fehlende Pflichteinheit als offenen Pflichtslot der UI-Projektion', () => {
    const report = evaluate(CATALOGUE_XML, buildRoster({ ironguts: 1 }));

    const openBullsSlot = mandatoryOpenSlots(report).find(slot => slot.node.def.id === BULLS_ID);
    expect(openBullsSlot).toBeDefined();
    expect(openBullsSlot.isMandatoryUnmet).toBe(true);
    expect(openBullsSlot.current).toBe(0);
  });

  it('ist erfuellt, sobald mindestens ein Trupp der Pflichteinheit vorhanden ist', () => {
    const report = evaluate(CATALOGUE_XML, buildRoster({ bulls: 1 }));

    expect(violationOf(report, BULLS_MANDATORY_MIN_ID)).toBeUndefined();
  });
});

describe('E2E: Mischung der Grenz-Arten (min/max Selektion, Prozent/Kosten)', () => {
  it('verletzt die Selektions-Obergrenze eines einzelnen Tyrant', () => {
    // Zwei Tyrants ueberschreiten die harte Obergrenze von einem je Armee.
    const report = evaluate(CATALOGUE_XML, buildRoster({ bulls: 1, tyrants: 2 }));

    const tyrantViolation = violationOf(report, TYRANT_MAX_ID);
    expect(tyrantViolation).toMatchObject({
      limitId: TYRANT_MAX_ID,
      actual: 2,
      bound: TYRANT_MAX,
    });
  });

  it('verletzt die Prozent-/Kosten-Grenze, wenn der Kern-Anteil unter 25 % faellt', () => {
    // 1 Bulls (35 Core) + 1 Tyrant (200 Characters) = 235 Punkte gesamt.
    // Grenzwert = round(235 * 25 %) = 59; der Kern traegt nur 35 → Verletzung.
    const report = evaluate(CATALOGUE_XML, buildRoster({ bulls: 1, tyrants: 1 }));

    const coreViolation = violationOf(report, CORE_PERCENT_MIN_ID);
    const totalPoints = BULLS_POINTS + TYRANT_POINTS;
    const expectedBound = Math.floor((totalPoints * 25) / 100 + 0.5);
    expect(coreViolation).toMatchObject({
      limitId: CORE_PERCENT_MIN_ID,
      actual: BULLS_POINTS,
      bound: expectedBound,
    });
  });

  it('haelt die Prozent-/Kosten-Grenze, wenn der Kern-Anteil ueber 25 % liegt', () => {
    // 4 Bulls (140 Core) + 1 Tyrant (200) = 340 Punkte, Grenzwert 85; Kern 140 ≥ 85.
    const report = evaluate(CATALOGUE_XML, buildRoster({ bulls: 4, tyrants: 1 }));

    expect(violationOf(report, CORE_PERCENT_MIN_ID)).toBeUndefined();
  });
});

describe('E2E: bedingter Modifikator mit instanceOf, von Kategorien getrieben', () => {
  it('erzwingt die Basis-Obergrenze der Ironguts, solange kein Charakter in der Armee steht', () => {
    // Kein Tyrant → Kategorie Characters ist leer → instanceOf haelt nicht →
    // die Ironguts-Obergrenze bleibt beim Basiswert 2; drei Trupps verletzen sie.
    const report = evaluate(CATALOGUE_XML, buildRoster({ bulls: 4, ironguts: 3 }));

    const irongutsViolation = violationOf(report, IRONGUTS_MAX_ID);
    expect(irongutsViolation).toMatchObject({
      limitId: IRONGUTS_MAX_ID,
      actual: 3,
      bound: IRONGUTS_BASE_MAX,
    });
  });

  it('hebt die Ironguts-Obergrenze an, sobald ein Charakter (Kategorie Characters) vorhanden ist', () => {
    // Ein Tyrant fuellt die Kategorie Characters → instanceOf haelt → der
    // Modifikator setzt die Ironguts-Obergrenze auf 4; drei Trupps sind erlaubt.
    const report = evaluate(CATALOGUE_XML, buildRoster({ bulls: 4, ironguts: 3, tyrants: 1 }));

    expect(violationOf(report, IRONGUTS_MAX_ID)).toBeUndefined();
  });

  it('verletzt erst die *angehobene* Obergrenze 4 — der bedingte Grenzwert wirkt sichtbar', () => {
    // Charakter vorhanden → Obergrenze 4; fuenf Ironguts ueberschreiten sie.
    const report = evaluate(CATALOGUE_XML, buildRoster({ bulls: 4, ironguts: 5, tyrants: 1 }));

    const irongutsViolation = violationOf(report, IRONGUTS_MAX_ID);
    expect(irongutsViolation).toMatchObject({
      limitId: IRONGUTS_MAX_ID,
      actual: 5,
      bound: IRONGUTS_RAISED_MAX,
    });
  });
});

describe('E2E: eine regelkonforme Armee erzeugt keine Verletzung', () => {
  it('meldet ueber die ganze Pipeline hinweg keine Verletzung fuer eine gueltige Liste', () => {
    // 6 Bulls (210 Core) + 2 Ironguts (88) + 1 Tyrant (200) = 498 Punkte.
    // Bulls-Pflicht erfuellt, Kern 210 ≥ 125 (25 %), Ironguts 2 ≤ Obergrenze,
    // Tyrant 1 ≤ 1 — alle Schichten komponieren zu einem sauberen Bericht.
    const report = evaluate(CATALOGUE_XML, buildRoster({ bulls: 6, ironguts: 2, tyrants: 1 }));

    expect(report.violations).toHaveLength(0);
    expect(report.diagnostics).toHaveLength(0);
  });
});
