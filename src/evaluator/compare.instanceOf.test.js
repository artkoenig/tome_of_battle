/**
 * Fokussierte Tests der Mitgliedschafts-Operatoren `instanceOf` / `notInstanceOf`
 * (`ConditionKind.INSTANCE_OF` / `ConditionKind.NOT_INSTANCE_OF`,
 * `docs/evaluator-architecture.md` §4.1) — an echten Definitive-Edition-Daten geerdet.
 *
 * Battlescribe (BSData §7.7, XSD `Catalogue.xsd`) kennt **zwei getrennte** type-Werte,
 * kein wertbasiertes Vorzeichen: `instanceOf` haelt, wenn im Bezugsrahmen mindestens
 * eine Instanz des Ziels existiert (`actual > 0`); `notInstanceOf` haelt bei deren
 * **Abwesenheit** (`actual === 0`). Der `value` ist nicht schwellwertig — die belegte
 * Definitive-Edition-Form ist `notInstanceOf value="1"` (Abwesenheit gefordert).
 *
 * Der private `compare()` wird — wie in den uebrigen Modifikator-Tests — ueber die
 * Fassade und einen bedingten Modifikator ausgeuebt: haelt die Bedingung, feuert der
 * Modifikator und hebt die effektiven Kosten ueber die Grenze.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const WARRIOR_ID = 'entry-warrior';
const ARCHER_ID = 'entry-archer';
const POINTS_ID = 'cost-points';
const MAX_POINTS_ID = 'max-points';
const WARRIOR_BASE_POINTS = 10;
const SURCHARGE = 5;
const MAX_POINTS = 10; // exakt der Basiswert: nur ein feuernder Modifikator verletzt ihn.

/**
 * Katalog mit einem Warrior, dessen Kosten ein Modifikator um {@link SURCHARGE}
 * anhebt — gegatet auf eine Bedingung mit Operator `op` und `value`, die auf die
 * Anzahl der Archer im Roster zielt.
 */
function catalogueGatedOn(op, value) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-instanceof" name="instanceOf Catalogue">
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
              <conditions>
                <condition type="${op}" field="selections" scope="roster" childId="${ARCHER_ID}" value="${value}"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${ARCHER_ID}" name="Archer" type="unit"/>
      </selectionEntries>
    </catalogue>`;
}

/** Baut ein Roster mit einem Warrior und optional einem Archer. */
function roster({ withArcher }) {
  const forces = [{ defId: WARRIOR_ID, count: 1, children: [] }];
  if (withArcher) forces.push({ defId: ARCHER_ID, count: 1, children: [] });
  return { forces };
}

/** Ist-Wert der (einzigen) Verletzung, oder `undefined`, wenn keine vorliegt. */
function violationActual(report) {
  return report.violations[0]?.actual;
}

describe('instanceOf: Mitgliedschaft gefordert', () => {
  const CATALOGUE = catalogueGatedOn('instanceOf', 1);

  it('haelt, wenn mindestens eine Ziel-Instanz existiert (Modifikator feuert)', () => {
    const report = evaluate(CATALOGUE, roster({ withArcher: true }));

    expect(report.violations).toHaveLength(1);
    expect(violationActual(report)).toBe(WARRIOR_BASE_POINTS + SURCHARGE);
  });

  it('haelt nicht, wenn keine Ziel-Instanz existiert (Modifikator bleibt aus)', () => {
    const report = evaluate(CATALOGUE, roster({ withArcher: false }));

    expect(report.violations).toHaveLength(0);
  });
});

describe('notInstanceOf: Abwesenheit gefordert (echte Definitive-Edition-Form value="1")', () => {
  // Wie die reale Fixture "notInstanceOf Ironskin Tribe" (value="1"): der value ist
  // NICHT schwellwertig; der eigene Operator fordert die Abwesenheit des Ziels.
  const CATALOGUE = catalogueGatedOn('notInstanceOf', 1);

  it('haelt, wenn keine Ziel-Instanz existiert (Modifikator feuert)', () => {
    const report = evaluate(CATALOGUE, roster({ withArcher: false }));

    expect(report.violations).toHaveLength(1);
    expect(violationActual(report)).toBe(WARRIOR_BASE_POINTS + SURCHARGE);
  });

  it('haelt nicht, wenn eine Ziel-Instanz existiert (Modifikator bleibt aus)', () => {
    const report = evaluate(CATALOGUE, roster({ withArcher: true }));

    expect(report.violations).toHaveLength(0);
  });
});
