import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';

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

// ── Issue 079: Sentinel `-1` = „unbegrenzt" nur am *hingeschriebenen* Wert ──
// Beschlossene Semantik (docs/issues/079, Decisions): `-1` ist Sentinel dort,
// wo er als Rohwert einer Grenze ODER als Wert eines `set`-Modifikators auf
// eine Grenze steht. Ein *errechneter* negativer Wert (increment/decrement/
// multiply) ist nie unbegrenzt. Arithmetik auf einer unbegrenzten Grenze
// laesst sie unbegrenzt; ein spaeterer `set` auf einen konkreten Wert
// ueberschreibt.

const WARRIOR_ID = 'entry-warrior';
const ARCHER_ID = 'entry-archer';
const LIMIT_ID = 'max-warriors';

/** Baut ein Roster aus den gegebenen Instanzen. */
function roster(forces) {
  return { forces };
}

/** Eine Auswahl-Instanz mit Anzahl und ohne Kinder. */
function selection(defId, count) {
  return { defId, count, children: [] };
}

/**
 * Katalog mit einer MAX-Grenze (Selektionsanzahl, Roster-weit) am Warrior und
 * optionalen Modifikatoren auf genau dieser Grenze. Der Archer dient als
 * Bedingungs-Ausloeser fuer konditionale Modifikatoren.
 */
function catalogueWithLimit(rawValue, modifiersXml = '') {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-sentinel" name="Sentinel Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <constraints>
            <constraint id="${LIMIT_ID}" type="max" value="${rawValue}" field="selections" scope="roster"/>
          </constraints>
          ${modifiersXml ? `<modifiers>${modifiersXml}</modifiers>` : ''}
        </selectionEntry>
        <selectionEntry id="${ARCHER_ID}" name="Archer" type="unit"/>
      </selectionEntries>
    </catalogue>`;
}

/** Bedingung „mindestens ein Archer im Roster" fuer konditionale Modifikatoren. */
const IF_ARCHER = `<conditions>
  <condition type="atLeast" field="selections" scope="roster" childId="${ARCHER_ID}" value="1"/>
</conditions>`;

/** Nur die Verletzungen der untersuchten Grenze. */
function limitViolations(report) {
  return report.violations.filter(violation => violation.limitId === LIMIT_ID);
}

// ── Kriterium A: Rohwert -1 ohne Modifikatoren ist unbegrenzt ──

describe('A: MAX-Grenze mit Rohwert -1 ohne Modifikatoren ist unbegrenzt', () => {
  const CATALOGUE_XML = catalogueWithLimit(-1);

  it('feuert nicht bei einer Auswahl', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1)]));

    expect(limitViolations(report)).toHaveLength(0);
  });

  it('feuert auch bei sehr vielen Auswahlen nicht', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 999)]));

    expect(limitViolations(report)).toHaveLength(0);
  });
});

// ── Kriterium B: Rohwert -1, per `set` auf einen konkreten Deckel gezogen ──
// (Border-Patrols-Muster; echte Referenz: Orcs and goblins.cat,
// Constraint ad41-8936-7a56-1717, max="-1" per set auf 25.)

describe('B: Rohwert -1 wird per bedingtem `set` zum konkreten Deckel', () => {
  const CAP = 25;
  const CATALOGUE_XML = catalogueWithLimit(-1, `
    <modifier type="set" field="${LIMIT_ID}" value="${CAP}">${IF_ARCHER}</modifier>`);

  it('feuert oberhalb des gesetzten Deckels, wenn die Bedingung haelt', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, CAP + 1), selection(ARCHER_ID, 1)]));

    expect(limitViolations(report)).toHaveLength(1);
    expect(limitViolations(report)[0]).toMatchObject({ actual: CAP + 1, bound: CAP });
  });

  it('feuert nicht genau auf dem gesetzten Deckel', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, CAP), selection(ARCHER_ID, 1)]));

    expect(limitViolations(report)).toHaveLength(0);
  });

  it('bleibt unbegrenzt, wenn die Bedingung nicht haelt (Rohwert -1 wirkt)', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, CAP + 1)]));

    expect(limitViolations(report)).toHaveLength(0);
  });
});

// ── Kriterium C: konkreter Rohwert, per `set -1` aufgehoben ──
// (Reale Kataloge nutzen `set value="-1"`, um ein Limit aufzuheben.)

describe('C: `set` auf -1 hebt eine konkrete MAX-Grenze auf', () => {
  const BASE_MAX = 1;
  const CATALOGUE_XML = catalogueWithLimit(BASE_MAX, `
    <modifier type="set" field="${LIMIT_ID}" value="-1">${IF_ARCHER}</modifier>`);

  it('feuert nicht mehr, wenn die Bedingung haelt — auch weit ueber dem Basiswert', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 50), selection(ARCHER_ID, 1)]));

    expect(limitViolations(report)).toHaveLength(0);
  });

  it('feuert gegen den Basiswert, solange die Bedingung nicht haelt (Kontrolle)', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, BASE_MAX + 1)]));

    expect(limitViolations(report)).toHaveLength(1);
    expect(limitViolations(report)[0]).toMatchObject({ actual: BASE_MAX + 1, bound: BASE_MAX });
  });
});

// ── Kriterium D: errechnet negativ ist NICHT unbegrenzt ──
// Die zentrale Verwechslung aus dem Issue: ein decrement, der die Grenze
// rechnerisch auf -1 (oder darunter) zieht, heisst „nichts erlaubt" — die
// Grenze darf nicht stillschweigend verschwinden.

describe('D: ein per decrement errechneter negativer Grenzwert ist nicht unbegrenzt', () => {
  it('decrement exakt auf -1 (Rohwert 1, decrement 2): eine Auswahl verletzt die Grenze', () => {
    const catalogueXml = catalogueWithLimit(1, `
      <modifier type="decrement" field="${LIMIT_ID}" value="2"/>`);

    const report = evaluate(catalogueXml, roster([selection(WARRIOR_ID, 1)]));

    expect(limitViolations(report)).toHaveLength(1);
    expect(limitViolations(report)[0]).toMatchObject({ actual: 1, bound: -1 });
  });

  it('decrement unter -1 (Rohwert 1, decrement 3): eine Auswahl verletzt die Grenze', () => {
    const catalogueXml = catalogueWithLimit(1, `
      <modifier type="decrement" field="${LIMIT_ID}" value="3"/>`);

    const report = evaluate(catalogueXml, roster([selection(WARRIOR_ID, 1)]));

    expect(limitViolations(report)).toHaveLength(1);
    expect(limitViolations(report)[0]).toMatchObject({ actual: 1, bound: -2 });
  });
});

// ── Kriterium E: Arithmetik auf „unbegrenzt" laesst unbegrenzt; `set` ueberschreibt ──

describe('E: increment/decrement/multiply auf einer unbegrenzten Grenze lassen sie unbegrenzt', () => {
  it('increment auf Rohwert -1: die Grenze bleibt unbegrenzt und feuert nie', () => {
    const catalogueXml = catalogueWithLimit(-1, `
      <modifier type="increment" field="${LIMIT_ID}" value="5"/>`);

    const report = evaluate(catalogueXml, roster([selection(WARRIOR_ID, 999)]));

    expect(limitViolations(report)).toHaveLength(0);
  });

  it('decrement auf Rohwert -1: die Grenze bleibt unbegrenzt und feuert nie', () => {
    const catalogueXml = catalogueWithLimit(-1, `
      <modifier type="decrement" field="${LIMIT_ID}" value="5"/>`);

    const report = evaluate(catalogueXml, roster([selection(WARRIOR_ID, 999)]));

    expect(limitViolations(report)).toHaveLength(0);
  });

  it('multiply auf Rohwert -1: die Grenze bleibt unbegrenzt und feuert nie', () => {
    const catalogueXml = catalogueWithLimit(-1, `
      <modifier type="multiply" field="${LIMIT_ID}" value="3"/>`);

    const report = evaluate(catalogueXml, roster([selection(WARRIOR_ID, 999)]));

    expect(limitViolations(report)).toHaveLength(0);
  });

  describe('ein spaeterer `set` auf einen konkreten Wert ueberschreibt „unbegrenzt"', () => {
    const CAP = 3;
    const CATALOGUE_XML = catalogueWithLimit(-1, `
      <modifier type="increment" field="${LIMIT_ID}" value="5"/>
      <modifier type="set" field="${LIMIT_ID}" value="${CAP}"/>`);

    it('feuert oberhalb des gesetzten Werts', () => {
      const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, CAP + 1)]));

      expect(limitViolations(report)).toHaveLength(1);
      expect(limitViolations(report)[0]).toMatchObject({ actual: CAP + 1, bound: CAP });
    });

    it('feuert nicht genau auf dem gesetzten Wert', () => {
      const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, CAP)]));

      expect(limitViolations(report)).toHaveLength(0);
    });
  });
});

// ── Kriterium F (Review-Nachtrag): multiply mit 0 auf „unbegrenzt" ──
// Arithmetik auf einer unbegrenzten Grenze laesst sie unbegrenzt — auch der
// Sonderfall Faktor 0 (rechnerisch -1 * 0 = 0). Insbesondere darf keine
// Verletzung mit einem unsinnigen Grenzwert (etwa NaN) entstehen.

describe('F: multiply mit 0 auf Rohwert -1 laesst die Grenze unbegrenzt', () => {
  const CATALOGUE_XML = catalogueWithLimit(-1, `
    <modifier type="multiply" field="${LIMIT_ID}" value="0"/>`);

  it('feuert nicht bei drei Auswahlen (Review-Repro: dort erschien eine Verletzung mit bound NaN)', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 3)]));

    expect(limitViolations(report)).toHaveLength(0);
  });

  it('feuert auch bei sehr vielen Auswahlen nicht', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 999)]));

    expect(limitViolations(report)).toHaveLength(0);
  });
});

// ── Kriterium G (Review-Nachtrag): unbegrenzte Prozentgrenze bei Nenner 0 ──
// „Unbegrenzt bleibt unbegrenzt, unabhaengig vom Nenner": eine Prozentgrenze
// mit Rohwert -1 hat keinen Grenzwert, den ein Nenner skalieren koennte. Ein
// leerer Bezugsrahmen (Nenner 0) darf deshalb weder eine Verletzung noch eine
// Null-Nenner-Diagnose (`kind: 'zeroDenominator'`, wie in constraints.test.js
// gepinnt) fuer diese Grenze erzeugen.

describe('G: unbegrenzte Prozentgrenze (Rohwert -1) mit Nenner 0', () => {
  const MANA_COST_ID = 'cost-mana-guid';
  const POINTS_COST_ID = 'cost-points-guid';
  // Prozentgrenze auf eine Kostenart, die im Roster niemand traegt → Nenner 0.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-sentinel-percent" name="Sentinel Percent Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_COST_ID}" value="10"/>
          </costs>
          <constraints>
            <constraint id="${LIMIT_ID}" type="max" value="-1" percentValue="true" field="${MANA_COST_ID}" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('erzeugt keine Verletzung', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 2)]));

    expect(limitViolations(report)).toHaveLength(0);
  });

  it('erzeugt keine Null-Nenner-Diagnose fuer diese Grenze', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 2)]));

    expect(report.diagnostics ?? []).not.toContainEqual(
      expect.objectContaining({ limitId: LIMIT_ID })
    );
  });
});
