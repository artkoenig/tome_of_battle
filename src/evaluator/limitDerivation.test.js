import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { ModifierKind } from './model.js';

/**
 * Die **Herleitungskette** eines Grenzwerts (Issue 75/04, ADR-0027): nicht nur der
 * Endwert, sondern der Weg dorthin — Basiswert, dann je angewandtem Modifikator
 * ein Schritt mit Art, rohem Wert, Wiederholungsfaktor und Zwischenwert, und bei
 * einem bedingten Schritt der **Zeuge**: die benennbare Auswahl, deren Vorhandensein
 * die Bedingung hat halten lassen.
 *
 * Geprueft wird am Bericht der Fassade: die Kette muss dort ankommen, wo die
 * Verletzung gemeldet wird — sonst waere sie im Nachhinein nur aus dem Endzustand
 * zu rekonstruieren, also genau die zweite Rechenstelle, die ADR-0034 ausschliesst.
 */

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const WARRIOR_ID = 'entry-warrior';
const BANNER_ID = 'entry-banner';
const BANNER_NAME = 'Bannertraeger';
const MAX_WARRIORS_ID = 'max-warriors';
const BASE_MAX = 2;

/** Eine Bedingung ueber die Zahl der Bannertraeger im Roster. */
function bannerCondition(type, value) {
  return `<conditions>
            <condition type="${type}" field="selections" scope="roster" childId="${BANNER_ID}" value="${value}"/>
          </conditions>`;
}

/**
 * Ein Katalog, dessen Kriegereinheit eine MAX-Grenze traegt, die der gegebene
 * Modifikator-Ausschnitt veraendert.
 */
function catalogueWith(modifiersXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-derivation" name="Derivation Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <constraints>
            <constraint id="${MAX_WARRIORS_ID}" type="max" value="${BASE_MAX}" field="selections" scope="roster"/>
          </constraints>
          <modifiers>${modifiersXml}</modifiers>
        </selectionEntry>
        <selectionEntry id="${BANNER_ID}" name="${BANNER_NAME}" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;
}

function evaluate(catalogueXml, { warriors, banners }) {
  const forces = [{ defId: WARRIOR_ID, count: warriors, children: [] }];
  if (banners > 0) forces.push({ defId: BANNER_ID, count: banners, children: [] });
  return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), { forces });
}

/** Die Herleitung der Kriegergrenze aus der gemeldeten Verletzung. */
function derivationOfViolation(report) {
  return report.violations.find(violation => violation.limitId === MAX_WARRIORS_ID)?.derivation ?? null;
}

describe('Herleitungskette eines Grenzwerts', () => {
  it('traegt den Basiswert und keinen Schritt, wenn kein Modifikator gewirkt hat', () => {
    const report = evaluate(catalogueWith(''), { warriors: BASE_MAX + 1, banners: 0 });

    expect(derivationOfViolation(report)).toEqual({ base: BASE_MAX, steps: [] });
  });

  it('haelt einen unbedingten Schritt mit Art, rohem Wert, Faktor und Zwischenwert fest', () => {
    const catalogue = catalogueWith(`
      <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="1"/>`);

    const report = evaluate(catalogue, { warriors: BASE_MAX, banners: 0 });

    expect(derivationOfViolation(report)).toEqual({
      base: BASE_MAX,
      steps: [{
        kind: ModifierKind.DECREMENT,
        rawValue: '1',
        times: 1,
        result: BASE_MAX - 1,
        isConditional: false,
        witness: null,
      }],
    });
  });

  it('benennt bei einem bedingten Schritt die Auswahl, deren Vorhandensein ihn hat feuern lassen', () => {
    const catalogue = catalogueWith(`
      <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="2">
        ${bannerCondition('atLeast', 1)}
      </modifier>`);

    const report = evaluate(catalogue, { warriors: 1, banners: 1 });

    expect(derivationOfViolation(report).steps).toEqual([{
      kind: ModifierKind.DECREMENT,
      rawValue: '2',
      times: 1,
      result: BASE_MAX - 2,
      isConditional: true,
      witness: { defId: BANNER_ID, name: BANNER_NAME },
    }]);
  });

  it('laesst den Zeugen weg, wenn die Bedingung gerade wegen einer *Abwesenheit* haelt', () => {
    const catalogue = catalogueWith(`
      <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="2">
        ${bannerCondition('lessThan', 1)}
      </modifier>`);

    const report = evaluate(catalogue, { warriors: 1, banners: 0 });

    expect(derivationOfViolation(report).steps).toEqual([
      expect.objectContaining({ isConditional: true, witness: null }),
    ]);
  });

  it('zaehlt einen Schritt als bedingt, wenn erst seine Modifikatorgruppe die Bedingung traegt', () => {
    const catalogue = catalogueWith(`</modifiers>
          <modifierGroups>
            <modifierGroup>
              ${bannerCondition('atLeast', 1)}
              <modifiers>
                <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="2"/>
              </modifiers>
            </modifierGroup>
          </modifierGroups>
          <modifiers>`);

    const report = evaluate(catalogue, { warriors: 1, banners: 1 });

    expect(derivationOfViolation(report).steps).toEqual([
      expect.objectContaining({ isConditional: true, witness: { defId: BANNER_ID, name: BANNER_NAME } }),
    ]);
  });

  it('haelt den Wiederholungsfaktor fest, mit dem der Schritt gewirkt hat', () => {
    const catalogue = catalogueWith(`
      <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="1">
        <repeats>
          <repeat field="selections" scope="roster" childId="${BANNER_ID}" value="1" repeats="1"/>
        </repeats>
      </modifier>`);

    const report = evaluate(catalogue, { warriors: 1, banners: 2 });

    expect(derivationOfViolation(report).steps).toEqual([
      expect.objectContaining({ times: 2, result: BASE_MAX - 2 }),
    ]);
  });

  it('reiht mehrere Schritte in Dokumentreihenfolge, jeder mit seinem Zwischenwert', () => {
    const catalogue = catalogueWith(`
      <modifier type="increment" field="${MAX_WARRIORS_ID}" value="3"/>
      <modifier type="multiply" field="${MAX_WARRIORS_ID}" value="2"/>`);

    const report = evaluate(catalogue, { warriors: 100, banners: 0 });

    expect(derivationOfViolation(report).steps.map(step => step.result)).toEqual([
      BASE_MAX + 3,
      (BASE_MAX + 3) * 2,
    ]);
  });
});

describe('Herleitungskette und Fixpunktschleife', () => {
  const ELITE_CAT_ID = 'cat-elite';
  // Die Bedingung haengt an einer Kategorie, die der Krieger **selbst erst per
  // Modifikator** erhaelt: die Grenze aendert sich damit fruehestens in der zweiten
  // Runde. Kumulierte die Kette ueber Runden, stuenden hier mehrere Schritte.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-derivation-rounds" name="Derivation Rounds Catalogue">
      <categoryEntries>
        <categoryEntry id="${ELITE_CAT_ID}" name="Elite"/>
      </categoryEntries>
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <constraints>
            <constraint id="${MAX_WARRIORS_ID}" type="max" value="${BASE_MAX}" field="selections" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="add" field="category" value="${ELITE_CAT_ID}"/>
            <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="2">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${ELITE_CAT_ID}" value="1"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('baut die Kette je Runde frisch auf — der Schritt steht genau einmal darin', () => {
    const report = evaluate(CATALOGUE_XML, { warriors: 1, banners: 0 });

    const derivation = derivationOfViolation(report);
    expect(derivation.steps).toHaveLength(1);
    expect(derivation.steps[0].result).toBe(BASE_MAX - 2);
  });

  it('traegt keinen Zeugen, wenn die Bedingung auf eine Kategorie statt auf eine Auswahl zielt', () => {
    const report = evaluate(CATALOGUE_XML, { warriors: 1, banners: 0 });

    expect(derivationOfViolation(report).steps[0].witness).toBeNull();
  });
});
