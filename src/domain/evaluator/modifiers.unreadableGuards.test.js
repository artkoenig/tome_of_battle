/**
 * Issue 0087 — Unlesbare Modifikator-Waechter werten fail-closed.
 *
 * Heute wird eine `<condition>`, `<conditionGroup>` oder `<repeat>`, die der
 * Leser nicht deuten kann, mit einer Diagnose verworfen und aus der
 * Waechterliste des Modifikators GEFILTERT — der Modifikator feuert dann mit
 * den verbleibenden (im Grenzfall: null) Waechtern, also OEFTER als der
 * Katalog kodiert. Diese Tests schreiben die Soll-Semantik fest:
 *
 * 1. Ein Modifikator mit mindestens einem unlesbaren Waechter feuert NICHT
 *    (fail-closed); die Diagnose bleibt erhalten und benennt den Traeger des
 *    Modifikators (`carrierId`/`carrierName`).
 * 2. `instanceOf`/`notInstanceOf` ohne `field` und/oder ohne `value` sind
 *    KEINE unlesbaren Waechter: fehlendes `field` gilt als
 *    `field="selections"`, fehlendes `value` heisst schlicht „kein
 *    Wertvergleich" (diese Operatoren nutzen ihn nicht). Keine
 *    `unsupportedCondition`-Diagnose; die Bedingung gatet den Modifikator
 *    korrekt in beide Richtungen.
 *
 * Unlesbare CONSTRAINTS behalten bewusst das heutige Verhalten (Verwurf mit
 * `unsupportedConstraint`) — dafuer gibt es hier keine Tests.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { DiagnosticKind } from './model.js';

/**
 * Wertet einen einzelnen synthetischen Katalog aus. Die Fassade ist zweistufig
 * (Main-Issue 75, Baustein 8): erst den Datensatz aufbereiten, dann auswerten. Der
 * Datensatz hat die Form `{ gameSystem, catalogues }` (ADR-0032); ein Einzelkatalog
 * ohne Spielsystem ist `{ catalogues: [xml] }`.
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const WARRIOR_ID = 'entry-warrior';
const WARRIOR_NAME = 'Warrior';
const ARCHER_ID = 'entry-archer';
const TOKEN_ID = 'entry-token';
const POINTS_ID = 'cost-points';
const MAX_POINTS_ID = 'max-points';

const WARRIOR_BASE_POINTS = 10;
const MODIFIER_POINTS = 5;
const MAX_POINTS = 12; // Basis 10 <= 12; ein einzelner feuernder +5-Modifikator (15) verletzt.

/** Baut ein Roster aus den gegebenen Auswahl-Instanzen (ohne Kontingent-Ebene). */
function roster(selections) {
  return { forces: selections };
}

/** Eine Auswahl-Instanz mit Anzahl und ohne Kinder. */
function selection(defId, count) {
  return { defId, count, children: [] };
}

/** Eine `atLeast 1`-Bedingung auf die Roster-Anzahl der gegebenen Ziel-Definition. */
function atLeastOne(childId) {
  return `<condition type="atLeast" field="selections" scope="roster" childId="${childId}" value="1"/>`;
}

// Die Reproduktion aus dem Audit: `greaterThan` mit `childId`, aber OHNE
// `value`-Attribut — fuer den Leser nicht deutbar.
const UNREADABLE_CONDITION = `<condition type="greaterThan" field="selections" scope="roster" childId="${ARCHER_ID}"/>`;

/**
 * Katalog: ein Warrior mit Basiskosten, einer MAX-Punktegrenze und dem
 * uebergebenen `<modifiers>`-Rumpf; Archer und Token existieren als Ziele der
 * Bedingungen/Wiederholungen.
 */
function warriorCatalogue(modifierBody) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-unreadable-guards" name="Unreadable Guards Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="${WARRIOR_NAME}" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_ID}" value="${WARRIOR_BASE_POINTS}"/>
          </costs>
          <constraints>
            <constraint id="${MAX_POINTS_ID}" type="max" value="${MAX_POINTS}" field="${POINTS_ID}" scope="roster"/>
          </constraints>
          ${modifierBody}
        </selectionEntry>
        <selectionEntry id="${ARCHER_ID}" name="Archer" type="unit"/>
        <selectionEntry id="${TOKEN_ID}" name="Token" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;
}

/** Ein +5-Punkte-Modifikator mit dem gegebenen Waechter-Rumpf. */
function surchargeModifier(guardBody) {
  return `
    <modifiers>
      <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}">
        ${guardBody}
      </modifier>
    </modifiers>`;
}

/** Alle Diagnosen des Berichts mit der gegebenen Art. */
function diagnosticsOfKind(report, kind) {
  return report.diagnostics.filter((diag) => diag.kind === kind);
}

describe('Ein Modifikator, dessen einziger Waechter unlesbar ist, feuert nicht (Repro aus dem Audit)', () => {
  // greaterThan ohne value → Bedingung unlesbar → fail-closed: der Modifikator
  // bleibt aus, die Kosten bleiben beim Basiswert 10 <= 12.
  const CATALOGUE = warriorCatalogue(surchargeModifier(`
    <conditions>
      ${UNREADABLE_CONDITION}
    </conditions>`));

  it('erzeugt keine Verletzung, obwohl die Bedingung wegfiel (fail-closed statt bedingungslos)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });

  it('behaelt die unsupportedCondition-Diagnose und benennt den Traeger des Modifikators', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(report.diagnostics).toContainEqual(expect.objectContaining({
      kind: DiagnosticKind.UNSUPPORTED_CONDITION,
      carrierId: WARRIOR_ID,
      carrierName: WARRIOR_NAME,
    }));
  });
});

describe('Ein unlesbarer Waechter sperrt den Modifikator auch neben einem erfuellten lesbaren', () => {
  // Eine lesbare, ERFUELLTE Bedingung (Archer vorhanden) UND eine unlesbare:
  // fail-closed heisst „der Modifikator feuert nicht", nicht „die uebrigen
  // Waechter entscheiden".
  const CATALOGUE = warriorCatalogue(surchargeModifier(`
    <conditions>
      ${atLeastOne(ARCHER_ID)}
      ${UNREADABLE_CONDITION}
    </conditions>`));

  it('feuert nicht, obwohl die lesbare Bedingung haelt', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });
});

describe('Eine unlesbare Bedingung INNERHALB einer Bedingungsgruppe sperrt den tragenden Modifikator', () => {
  // `or`-Gruppe mit einem erfuellten lesbaren Zweig und einem unlesbaren:
  // ohne fail-closed wuerde der lesbare Zweig die Gruppe halten lassen und der
  // Modifikator feuern. Fail-closed sperrt den ganzen Modifikator.
  const CATALOGUE = warriorCatalogue(surchargeModifier(`
    <conditionGroups>
      <conditionGroup type="or">
        <conditions>
          ${atLeastOne(ARCHER_ID)}
          ${UNREADABLE_CONDITION}
        </conditions>
      </conditionGroup>
    </conditionGroups>`));

  it('feuert nicht, obwohl der lesbare or-Zweig haelt', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });

  it('benennt den Traeger des Modifikators an der unsupportedCondition-Diagnose', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(report.diagnostics).toContainEqual(expect.objectContaining({
      kind: DiagnosticKind.UNSUPPORTED_CONDITION,
      carrierId: WARRIOR_ID,
      carrierName: WARRIOR_NAME,
    }));
  });
});

describe('Eine Bedingungsgruppe mit unbekanntem Typ sperrt den tragenden Modifikator', () => {
  // groups.test.js sichert bereits die Lese-Diagnose (`nand` → Diagnose).
  // Hier die Verhaltensseite: die verworfene Gruppe darf den Modifikator nicht
  // von ihrem Gate befreien — er feuert nicht, obwohl die innere Bedingung haelt.
  const CATALOGUE = warriorCatalogue(surchargeModifier(`
    <conditionGroups>
      <conditionGroup type="nand">
        <conditions>
          ${atLeastOne(ARCHER_ID)}
        </conditions>
      </conditionGroup>
    </conditionGroups>`));

  it('feuert nicht, wenn seine einzige Gruppe unlesbar ist', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });

  it('benennt den Traeger des Modifikators an der unsupportedConditionGroup-Diagnose', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(report.diagnostics).toContainEqual(expect.objectContaining({
      kind: DiagnosticKind.UNSUPPORTED_CONDITION_GROUP,
      carrierId: WARRIOR_ID,
      carrierName: WARRIOR_NAME,
    }));
  });
});

describe('Eine unlesbare Wiederholung sperrt den Modifikator ganz (nicht „einmal statt je N")', () => {
  // `<repeat>` ohne `value` (Schrittweite unlesbar): der Modifikator darf
  // NICHT einmal bedingungslos angewendet werden — er bleibt ganz aus.
  const CATALOGUE = warriorCatalogue(surchargeModifier(`
    <repeats>
      <repeat field="selections" scope="roster" childId="${TOKEN_ID}"/>
    </repeats>`));

  it('wendet den Modifikator kein einziges Mal an', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(TOKEN_ID, 3)]));

    expect(report.violations).toHaveLength(0);
  });

  it('behaelt die unsupportedRepeat-Diagnose und benennt den Traeger des Modifikators', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(TOKEN_ID, 3)]));

    expect(report.diagnostics).toContainEqual(expect.objectContaining({
      kind: DiagnosticKind.UNSUPPORTED_REPEAT,
      carrierId: WARRIOR_ID,
      carrierName: WARRIOR_NAME,
    }));
  });
});

describe('instanceOf ohne `field` wird ausgewertet wie field="selections", nicht verworfen', () => {
  const CATALOGUE = warriorCatalogue(surchargeModifier(`
    <conditions>
      <condition type="instanceOf" scope="roster" childId="${ARCHER_ID}" value="1"/>
    </conditions>`));

  it('feuert bei vorhandener Ziel-Instanz — ohne unsupportedCondition-Diagnose', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(diagnosticsOfKind(report, DiagnosticKind.UNSUPPORTED_CONDITION)).toEqual([]);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].actual).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS);
  });

  it('feuert nicht, wenn keine Ziel-Instanz existiert (die Bedingung gatet, statt zu entfallen)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });
});

describe('instanceOf ohne `value` wird ausgewertet (der Operator vergleicht keinen Wert)', () => {
  const CATALOGUE = warriorCatalogue(surchargeModifier(`
    <conditions>
      <condition type="instanceOf" field="selections" scope="roster" childId="${ARCHER_ID}"/>
    </conditions>`));

  it('feuert bei vorhandener Ziel-Instanz — ohne unsupportedCondition-Diagnose', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(diagnosticsOfKind(report, DiagnosticKind.UNSUPPORTED_CONDITION)).toEqual([]);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].actual).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS);
  });

  it('feuert nicht, wenn keine Ziel-Instanz existiert (die Bedingung gatet, statt zu entfallen)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });
});

describe('notInstanceOf ohne `field` UND ohne `value` wird ausgewertet, nicht verworfen', () => {
  const CATALOGUE = warriorCatalogue(surchargeModifier(`
    <conditions>
      <condition type="notInstanceOf" scope="roster" childId="${ARCHER_ID}"/>
    </conditions>`));

  it('feuert bei Abwesenheit der Ziel-Instanz — ohne unsupportedCondition-Diagnose', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1)]));

    expect(diagnosticsOfKind(report, DiagnosticKind.UNSUPPORTED_CONDITION)).toEqual([]);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].actual).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS);
  });

  it('feuert nicht, wenn eine Ziel-Instanz existiert (die Bedingung gatet, statt zu entfallen)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });
});

describe('Positivkontrolle: lesbare Waechter feuern weiter wie bisher (kein Ueberblocken)', () => {
  const CATALOGUE = warriorCatalogue(surchargeModifier(`
    <conditions>
      ${atLeastOne(ARCHER_ID)}
    </conditions>`));

  it('feuert bei erfuellter lesbarer Bedingung und meldet keine Diagnose', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(report.diagnostics).toEqual([]);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].actual).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS);
  });

  it('feuert nicht bei nicht erfuellter lesbarer Bedingung', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });
});
