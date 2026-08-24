/**
 * Issue 0090: `percentValue` an Condition und Repeat wird still ignoriert.
 *
 * BSData-Wiki (Condition/Repeat): "if checked, `Value` will be interpreted as
 * percentage"; die XSD traegt `percentValue` an der gemeinsamen `QueryBase`.
 * Diese Tests pinnen die Grenzen-Konvention der Prozent-Grenzen an Condition
 * und Repeat (AC 1+2): Nenner = dieselbe Query (Feld/Rahmen/Flags) mit Ziel
 * "alles im Rahmen", wirksamer Vergleichswert = roundHalfUp(Nenner * Wert / 100),
 * Null-Nenner nie still (recorded Default: Condition haelt nicht — unabhaengig
 * vom Vergleichstyp —, Repeat liefert 0 Schritte, jeweils mit
 * `zeroDenominator`-Diagnose).
 *
 * Black-box ueber die Fassade: eine Condition wird dadurch beobachtbar, ob ihr
 * gegateter Kosten-Modifikator feuert (Verletzung erscheint/verschwindet), ein
 * Repeat dadurch, wie oft der Modifikator stapelt (Ist-Wert der Verletzung).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../domain/evaluator/evaluator.js';

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
// Evaluator-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const WARRIOR_ID = 'entry-warrior';
const ARCHER_ID = 'entry-archer';
const FILLER_ID = 'entry-filler';
const TOKEN_ID = 'entry-token';
const POINTS_ID = 'cost-points';
const MANA_ID = 'cost-mana'; // taucht in keinem Eintrag als Kostenart auf → Nenner 0
const MAX_POINTS_ID = 'max-points';
const WARRIOR_BASE_POINTS = 10;
const SURCHARGE = 5;
const MAX_POINTS = 12; // Basiswert 10 <= 12: nur ein feuernder Modifikator verletzt.
const VIOLATING_POINTS = WARRIOR_BASE_POINTS + SURCHARGE; // 15 > 12

/** Baut ein Roster aus den gegebenen Auswahl-Instanzen. */
function roster(forces) {
  return { forces };
}

/** Eine Auswahl-Instanz mit Anzahl und ohne Kinder. */
function selection(defId, count) {
  return { defId, count, children: [] };
}

/**
 * Katalog mit einem Warrior, dessen Kosten ein Modifikator um {@link SURCHARGE}
 * anhebt — gegatet auf die uebergebene Bedingung. Archer und Filler tragen keine
 * Kosten; sie steuern nur den Ist-Wert (Archer-Anzahl) und den Nenner (alle
 * Selektionen im Roster).
 */
function gatedCatalogue(conditionXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-percent-condition" name="Percent Condition Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_ID}" value="${WARRIOR_BASE_POINTS}"/>
          </costs>
          <constraints>
            <constraint id="${MAX_POINTS_ID}" type="max" value="${MAX_POINTS}" field="${POINTS_ID}" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="increment" field="${POINTS_ID}" value="${SURCHARGE}">
              <conditions>${conditionXml}</conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${ARCHER_ID}" name="Archer" type="unit"/>
        <selectionEntry id="${FILLER_ID}" name="Filler" type="unit"/>
      </selectionEntries>
    </catalogue>`;
}

/** Bedingung auf die Archer-Anzahl im Roster; `percentAttr` steuert das Attribut. */
function archerCondition(type, value, percentAttr) {
  const percent = percentAttr === undefined ? '' : ` percentValue="${percentAttr}"`;
  return `<condition type="${type}" field="selections" scope="roster" childId="${ARCHER_ID}" value="${value}"${percent}/>`;
}

describe('AC 1: Condition mit percentValue="true" vergleicht prozentual gegen den Rahmen-Nenner', () => {
  it('haelt, wenn der Ist-Anteil den Prozentsatz uebersteigt — der Absolutvergleich wuerde nicht feuern', () => {
    // Nenner (alle Selektionen im Roster) = 1 Warrior + 3 Archer = 4.
    // Wirksamer Vergleichswert = roundHalfUp(4 * 50 / 100) = 2 → 3 > 2 → Bedingung haelt.
    // Absolut gelesen: 3 > 50 → falsch → der Modifikator bliebe stumm.
    const catalogue = gatedCatalogue(archerCondition('greaterThan', 50, 'true'));

    const report = evaluate(catalogue, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 3)]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ actual: VIOLATING_POINTS });
  });

  it('haelt nicht, wenn der Ist-Anteil unter dem Prozentsatz bleibt — der Absolutvergleich wuerde feuern', () => {
    // Nenner = 1 Warrior + 3 Archer + 122 Filler = 126.
    // Wirksamer Vergleichswert = roundHalfUp(126 * 2 / 100) = 3 → 3 > 3 → falsch.
    // Absolut gelesen: 3 > 2 → wahr → der Modifikator feuerte faelschlich.
    const catalogue = gatedCatalogue(archerCondition('greaterThan', 2, 'true'));

    const report = evaluate(catalogue, roster([
      selection(WARRIOR_ID, 1),
      selection(ARCHER_ID, 3),
      selection(FILLER_ID, 122),
    ]));

    expect(report.violations).toHaveLength(0);
  });
});

describe('Rundung des wirksamen Vergleichswerts: kaufmaennisch (round half up), wie bei Prozent-Grenzen', () => {
  const HALF_SHARE = gatedCatalogue(archerCondition('greaterThan', 50, 'true'));

  it('PIN gegen floor: 50 % von 5 = 2.5 → Schwelle 3 — Ist 3 ist nicht mehr als 3, Modifikator bleibt aus', () => {
    // Nenner = 1 Warrior + 3 Archer + 1 Filler = 5. Bei Abrunden (floor → 2)
    // feuerte der Modifikator mit 3 > 2; kaufmaennisch (3) bleibt er aus.
    const report = evaluate(HALF_SHARE, roster([
      selection(WARRIOR_ID, 1),
      selection(ARCHER_ID, 3),
      selection(FILLER_ID, 1),
    ]));

    expect(report.violations).toHaveLength(0);
  });

  it('Ist 4 ueberschreitet die aufgerundete Schwelle 3 — der Modifikator feuert', () => {
    // Nenner = 1 Warrior + 4 Archer = 5 → Schwelle roundHalfUp(2.5) = 3 → 4 > 3.
    const report = evaluate(HALF_SHARE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 4)]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ actual: VIOLATING_POINTS });
  });

  it('PIN gegen ceil: 40 % von 6 = 2.4 → Schwelle 2 — Ist 3 feuert', () => {
    // Nenner = 1 Warrior + 3 Archer + 2 Filler = 6 → roundHalfUp(2.4) = 2 → 3 > 2.
    // Bei Aufrunden (ceil → 3) bliebe der Modifikator mit 3 > 3 aus.
    const catalogue = gatedCatalogue(archerCondition('greaterThan', 40, 'true'));

    const report = evaluate(catalogue, roster([
      selection(WARRIOR_ID, 1),
      selection(ARCHER_ID, 3),
      selection(FILLER_ID, 2),
    ]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ actual: VIOLATING_POINTS });
  });
});

describe('Null-Nenner an einer Prozent-Condition (recorded Default: haelt nicht, nie still)', () => {
  // Prozent-Condition auf eine Kostenart, die niemand im Roster traegt → Nenner 0.
  // `lessThan` absichtlich: absolut gelesen waere 0 < 50 wahr — der Default sagt,
  // bei Nenner 0 haelt die Condition NICHT, unabhaengig vom Vergleichstyp.
  function zeroDenominatorCatalogue(percentAttr) {
    return gatedCatalogue(
      `<condition type="lessThan" field="${MANA_ID}" scope="roster" value="50" percentValue="${percentAttr}"/>`
    );
  }

  it('haelt nicht — auch beim lessThan-Typ — und hinterlaesst eine zeroDenominator-Diagnose', () => {
    const report = evaluate(zeroDenominatorCatalogue('true'), roster([selection(WARRIOR_ID, 1)]));

    expect(report.violations).toHaveLength(0);
    // PIN: Praesenz der Diagnose, nicht ihre Anzahl — die Multiplizitaet ueber
    // Fixpunkt-Runden ist Implementierungsdetail.
    expect(report.diagnostics).toContainEqual(expect.objectContaining({ kind: 'zeroDenominator' }));
  });

  it('KONTROLLE: percentValue="false" liest absolut — 0 < 50 feuert, ohne Null-Nenner-Diagnose', () => {
    const report = evaluate(zeroDenominatorCatalogue('false'), roster([selection(WARRIOR_ID, 1)]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ actual: VIOLATING_POINTS });
    expect(report.diagnostics.some(d => d.kind === 'zeroDenominator')).toBe(false);
  });
});

describe('AC 2: Repeat mit percentValue="true" leitet die Schrittweite prozentual ab', () => {
  /**
   * Warrior: +{@link SURCHARGE} Punkte je Schritt der uebergebenen Wiederholung;
   * Token treiben den Ist-Wert der Wiederholung und den Nenner.
   */
  function repeatCatalogue(repeatXml) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-percent-repeat" name="Percent Repeat Catalogue">
        <selectionEntries>
          <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
            <costs>
              <cost name="Points" typeId="${POINTS_ID}" value="${WARRIOR_BASE_POINTS}"/>
            </costs>
            <constraints>
              <constraint id="${MAX_POINTS_ID}" type="max" value="${MAX_POINTS}" field="${POINTS_ID}" scope="roster"/>
            </constraints>
            <modifiers>
              <modifier type="increment" field="${POINTS_ID}" value="${SURCHARGE}">
                <repeats>${repeatXml}</repeats>
              </modifier>
            </modifiers>
          </selectionEntry>
          <selectionEntry id="${TOKEN_ID}" name="Token" type="upgrade"/>
        </selectionEntries>
      </catalogue>`;
  }

  const tokenRepeat = (value) =>
    `<repeat field="selections" scope="roster" childId="${TOKEN_ID}" value="${value}" percentValue="true"/>`;

  it('zaehlt Schritte gegen die prozentual abgeleitete Schrittweite (25 % von 4 = 1)', () => {
    // Nenner = 1 Warrior + 3 Token = 4 → wirksame Schrittweite roundHalfUp(4 * 25/100) = 1.
    // 3 Token → floor(3 / 1) = 3 Schritte → 10 + 5*3 = 25 (Default roundUp=false).
    // Absolut gelesen: floor(3 / 25) = 0 Schritte → der Modifikator bliebe stumm.
    const report = evaluate(repeatCatalogue(tokenRepeat(25)), roster([
      selection(WARRIOR_ID, 1),
      selection(TOKEN_ID, 3),
    ]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({
      actual: WARRIOR_BASE_POINTS + SURCHARGE * 3,
    });
  });

  it('rundet die wirksame Schrittweite kaufmaennisch (25 % von 10 = 2.5 → 3), PIN gegen floor', () => {
    // Nenner = 1 Warrior + 9 Token = 10 → Schrittweite roundHalfUp(2.5) = 3.
    // 9 Token → floor(9 / 3) = 3 Schritte → Ist 25. Bei floor-Schrittweite (2)
    // waeren es floor(9 / 2) = 4 Schritte → Ist 30.
    const report = evaluate(repeatCatalogue(tokenRepeat(25)), roster([
      selection(WARRIOR_ID, 1),
      selection(TOKEN_ID, 9),
    ]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({
      actual: WARRIOR_BASE_POINTS + SURCHARGE * 3,
    });
  });

  it('rundet x.4 ab (30 % von 8 = 2.4 → 2), PIN gegen ceil', () => {
    // Nenner = 1 Warrior + 7 Token = 8 → Schrittweite roundHalfUp(2.4) = 2.
    // 7 Token → floor(7 / 2) = 3 Schritte → Ist 25. Bei ceil-Schrittweite (3)
    // waeren es floor(7 / 3) = 2 Schritte → Ist 20.
    const report = evaluate(repeatCatalogue(tokenRepeat(30)), roster([
      selection(WARRIOR_ID, 1),
      selection(TOKEN_ID, 7),
    ]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({
      actual: WARRIOR_BASE_POINTS + SURCHARGE * 3,
    });
  });

  it('PIN: eine prozentual zu 0 abgeleitete Schrittweite ergibt 0 Schritte (recorded Default)', () => {
    // Nenner = 1 Warrior + 3 Token = 4 → wirksame Schrittweite roundHalfUp(4 * 4/100)
    // = roundHalfUp(0.16) = 0 → 0 Schritte, wie der bestehende Laufzeit-Schutz fuer
    // perValue === 0 — KEINE neue Diagnose (degenerierter abgeleiteter Wert, kein
    // verschlucktes Attribut) und insbesondere keine zeroDenominator-Diagnose
    // (der Nenner ist 4, nicht 0).
    // Heute gruen (absolut: floor(3 / 4) = 0 Schritte ebenfalls) — der PIN schuetzt
    // gegen die rote Variante: eine naive Implementierung, die durch die abgeleitete
    // 0 teilt (Infinity/NaN-Schritte, riesige Stapelzahlen oder Absturz).
    const report = evaluate(repeatCatalogue(tokenRepeat(4)), roster([
      selection(WARRIOR_ID, 1),
      selection(TOKEN_ID, 3),
    ]));

    expect(report.violations).toHaveLength(0);
    expect(report.diagnostics.some(d => d.kind === 'zeroDenominator')).toBe(false);
  });

  it('liefert bei Null-Nenner 0 Schritte und eine zeroDenominator-Diagnose', () => {
    // Prozent-Repeat auf eine Kostenart, die niemand traegt → Nenner 0 → 0 Schritte,
    // nie still (recorded Default).
    const report = evaluate(
      repeatCatalogue(`<repeat field="${MANA_ID}" scope="roster" value="50" percentValue="true"/>`),
      roster([selection(WARRIOR_ID, 1), selection(TOKEN_ID, 3)])
    );

    expect(report.violations).toHaveLength(0);
    // PIN: Praesenz, nicht Anzahl (wie oben).
    expect(report.diagnostics).toContainEqual(expect.objectContaining({ kind: 'zeroDenominator' }));
  });
});

describe('KONTROLLEN: wo percentValue keine Wirkung haben darf, bleibt alles wie heute', () => {
  it('KONTROLLE: instanceOf ignoriert percentValue="true" — feuert bei vorhandener Ziel-Instanz', () => {
    // Wiki explizit: percentValue "has no effect" bei instanceOf/notInstanceOf.
    const catalogue = gatedCatalogue(archerCondition('instanceOf', 50, 'true'));

    const report = evaluate(catalogue, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ actual: VIOLATING_POINTS });
  });

  it('KONTROLLE: notInstanceOf ignoriert percentValue="true" — haelt nicht bei vorhandener Ziel-Instanz', () => {
    const catalogue = gatedCatalogue(archerCondition('notInstanceOf', 50, 'true'));

    const report = evaluate(catalogue, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });

  it('KONTROLLE: percentValue="false" vergleicht absolut wie bisher', () => {
    // 3 Archer > 2 (absolut) → feuert; der grosse Nenner spielt keine Rolle.
    const catalogue = gatedCatalogue(archerCondition('greaterThan', 2, 'false'));

    const report = evaluate(catalogue, roster([
      selection(WARRIOR_ID, 1),
      selection(ARCHER_ID, 3),
      selection(FILLER_ID, 122),
    ]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ actual: VIOLATING_POINTS });
  });

  it('KONTROLLE: fehlendes percentValue vergleicht absolut wie bisher', () => {
    const catalogue = gatedCatalogue(archerCondition('greaterThan', 2));

    const report = evaluate(catalogue, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 3)]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ actual: VIOLATING_POINTS });
  });
});
