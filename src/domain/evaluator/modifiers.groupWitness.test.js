/**
 * Zeugen aus **Bedingungsgruppen** (Issue 0101, ADR-0027,
 * `docs/evaluator-architecture.md` §3.6).
 *
 * Die Zeugen-Suche eines bedingten Grenzwert-Schritts darf nicht bei den
 * *direkten* Bedingungen aufhoeren: ein Modifikator, der **ausschliesslich**
 * ueber eine `<conditionGroup>` (beliebiger Verschachtelungstiefe) gegatet ist,
 * traegt `isConditional=true` — dann muss sein Kettenschritt auch den Zeugen der
 * gehaltenen Gruppen-Bedingung tragen, denn die Bedingung in der Gruppe ist
 * genauso benennbar wie eine direkte. Die Grenze aus ADR-0027 bleibt: eine
 * Bedingung ohne benennbares Ziel (Kategorie, Abwesenheit) erzeugt weiterhin
 * **keinen** erfundenen Zeugen.
 *
 * Geprueft wird — wie in `limitDerivation.test.js` — am Bericht der Fassade:
 * an der Herleitungskette (`violation.derivation.steps[].witness`) und an der
 * Ursachenliste (`violation.causes`) der gemeldeten Verletzung.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { ModifierKind } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const WARRIOR_ID = 'entry-warrior';
const BANNER_ID = 'entry-banner';
const BANNER_NAME = 'Bannertraeger';
const HORN_ID = 'entry-horn';
const HORN_NAME = 'Kriegshorn';
const ELITE_CAT_ID = 'cat-elite';
const MAX_WARRIORS_ID = 'max-warriors';
const BASE_MAX = 2;

const BANNER_WITNESS = { defId: BANNER_ID, name: BANNER_NAME };

/** Eine einzelne `<condition>` ueber die Zahl der Instanzen eines Ziels im Roster. */
function rosterCondition(type, childId, value) {
  return `<condition type="${type}" field="selections" scope="roster" childId="${childId}" value="${value}"/>`;
}

/** Huellt Bedingungs-/Untergruppen-XML in `<conditionGroups><conditionGroup type=…>`. */
function conditionGroup(type, innerXml) {
  return `<conditionGroups>
            <conditionGroup type="${type}">${innerXml}</conditionGroup>
          </conditionGroups>`;
}

/**
 * Ein Katalog, dessen Kriegereinheit eine MAX-Grenze traegt; `blocksXml` wird roh
 * in den Eintrag eingesetzt und kann `<modifiers>` **und** `<modifierGroups>`
 * enthalten. Bannertraeger und Kriegshorn stehen als benennbare Auswahlen bereit,
 * die Elite-Kategorie als nicht benennbares Bedingungsziel.
 */
function catalogueWith(blocksXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-group-witness" name="Group Witness Catalogue">
      <categoryEntries>
        <categoryEntry id="${ELITE_CAT_ID}" name="Elite"/>
      </categoryEntries>
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <constraints>
            <constraint id="${MAX_WARRIORS_ID}" type="max" value="${BASE_MAX}" field="selections" scope="roster"/>
          </constraints>
          ${blocksXml}
        </selectionEntry>
        <selectionEntry id="${BANNER_ID}" name="${BANNER_NAME}" type="upgrade"/>
        <selectionEntry id="${HORN_ID}" name="${HORN_NAME}" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;
}

function evaluate(catalogueXml, { warriors = 1, banners = 0, horns = 0 } = {}) {
  const forces = [{ defId: WARRIOR_ID, count: warriors, children: [] }];
  if (banners > 0) forces.push({ defId: BANNER_ID, count: banners, children: [] });
  if (horns > 0) forces.push({ defId: HORN_ID, count: horns, children: [] });
  return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), { forces });
}

/** Die **eine** Meldung des Berichts zu einer Grenz-Id. */
function violationOf(report, limitId) {
  const matches = report.violations.filter(violation => violation.limitId === limitId);
  expect(matches, `genau eine Meldung zu ${limitId}`).toHaveLength(1);
  return matches[0];
}

// ── Akzeptanzkriterium 1: die Gruppen-Bedingung liefert den Zeugen ────────────

describe('Zeuge einer Bedingung in einer Bedingungsgruppe (AK 1)', () => {
  it('benennt den Zeugen, wenn die einzige Bedingung des Modifikators in einer and-Gruppe steht', () => {
    const catalogue = catalogueWith(`
      <modifiers>
        <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="2">
          ${conditionGroup('and', `<conditions>${rosterCondition('atLeast', BANNER_ID, 1)}</conditions>`)}
        </modifier>
      </modifiers>`);

    const report = evaluate(catalogue, { warriors: 1, banners: 1 });

    expect(violationOf(report, MAX_WARRIORS_ID).derivation.steps).toEqual([
      expect.objectContaining({ isConditional: true, witness: BANNER_WITNESS }),
    ]);
  });

  it('findet den Zeugen auch in einer verschachtelten Untergruppe (Tiefe 2)', () => {
    const catalogue = catalogueWith(`
      <modifiers>
        <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="2">
          ${conditionGroup('and', conditionGroup('and', `<conditions>${rosterCondition('atLeast', BANNER_ID, 1)}</conditions>`))}
        </modifier>
      </modifiers>`);

    const report = evaluate(catalogue, { warriors: 1, banners: 1 });

    expect(violationOf(report, MAX_WARRIORS_ID).derivation.steps).toEqual([
      expect.objectContaining({ isConditional: true, witness: BANNER_WITNESS }),
    ]);
  });

  it('benennt den Zeugen, wenn erst die Bedingungsgruppe seiner Modifikatorgruppe die Bedingung traegt', () => {
    // Das Gate der Modifikatorgruppe besteht *nur* aus einer conditionGroup —
    // heute verwirft `gateWithin` genau diese, und der Schritt bleibt zeugenlos.
    const catalogue = catalogueWith(`
      <modifierGroups>
        <modifierGroup>
          ${conditionGroup('and', `<conditions>${rosterCondition('atLeast', BANNER_ID, 1)}</conditions>`)}
          <modifiers>
            <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="2"/>
          </modifiers>
        </modifierGroup>
      </modifierGroups>`);

    const report = evaluate(catalogue, { warriors: 1, banners: 1 });

    expect(violationOf(report, MAX_WARRIORS_ID).derivation.steps).toEqual([
      expect.objectContaining({ isConditional: true, witness: BANNER_WITNESS }),
    ]);
  });

  it('nennt bei einer or-Gruppe die anwesende Auswahl des haltenden Zweigs', () => {
    // Der Kriegshorn-Zweig steht *zuerst*, sein Ziel ist aber abwesend (0 gezaehlt)
    // — er kann laut ADR-0027 nie Zeuge sein. Der einzige moegliche Zeuge ist der
    // Bannertraeger des haltenden Zweigs; genau der muss benannt werden.
    const catalogue = catalogueWith(`
      <modifiers>
        <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="2">
          ${conditionGroup('or', `<conditions>
              ${rosterCondition('atLeast', HORN_ID, 1)}
              ${rosterCondition('atLeast', BANNER_ID, 1)}
            </conditions>`)}
        </modifier>
      </modifiers>`);

    const report = evaluate(catalogue, { warriors: 1, banners: 1, horns: 0 });

    expect(violationOf(report, MAX_WARRIORS_ID).derivation.steps).toEqual([
      expect.objectContaining({ isConditional: true, witness: BANNER_WITNESS }),
    ]);
  });
});

// ── Akzeptanzkriterium 2: §9.8 Ruestung+Schild mit Gruppen-Bedingung ──────────

describe('§9.8 Ruestung+Schild: Gruppen-Max mit Bedingung in einer and-Gruppe (AK 2)', () => {
  const KNIGHT_ID = 'entry-knight';
  const ARMOUR_ID = 'entry-armour';
  const SHIELD_ID = 'entry-shield';
  const SHIELD_NAME = 'Shield';
  const GROUP_MAX_ID = 'max-armour-group';

  /**
   * Das kanonische Muster aus `docs/battlescribe-data-format.md` §9.8: eine
   * Armour-Gruppe mit `max="1"` (scope parent) und einem `increment`-Modifier auf
   * genau diese Constraint-Id, gekoppelt an die Schild-Auswahl — hier liegt die
   * Schild-Bedingung in einer `and`-Bedingungsgruppe statt direkt am Modifier.
   */
  function armourCatalogue(conditionBlockXml) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-armour-shield" name="Armour Shield Catalogue">
        <selectionEntries>
          <selectionEntry id="${KNIGHT_ID}" name="Knight" type="unit">
            <selectionEntryGroups>
              <selectionEntryGroup id="group-armour" name="Armour">
                <modifiers>
                  <modifier type="increment" field="${GROUP_MAX_ID}" value="1">
                    ${conditionBlockXml}
                  </modifier>
                </modifiers>
                <constraints>
                  <constraint id="${GROUP_MAX_ID}" type="max" value="1" field="selections" scope="parent"/>
                </constraints>
                <selectionEntries>
                  <selectionEntry id="${ARMOUR_ID}" name="Heavy Armour" type="upgrade"/>
                  <selectionEntry id="${SHIELD_ID}" name="${SHIELD_NAME}" type="upgrade"/>
                </selectionEntries>
              </selectionEntryGroup>
            </selectionEntryGroups>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  const SHIELD_CONDITION = `<condition type="equalTo" field="selections" scope="parent"
      childId="${SHIELD_ID}" value="1" includeChildSelections="true"/>`;

  // Zwei Ruestungen + ein Schild: das effektive Max steht auf 2 (Schild gewaehlt),
  // drei Gruppen-Auswahlen verletzen es — die Verletzung existiert in beiden
  // Varianten, nur die Benennung des Schilds unterscheidet sie heute.
  function evaluateOverfilledGroup(catalogueXml) {
    return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), {
      forces: [{
        defId: KNIGHT_ID,
        count: 1,
        children: [
          { defId: ARMOUR_ID, count: 2, children: [] },
          { defId: SHIELD_ID, count: 1, children: [] },
        ],
      }],
    });
  }

  it('nennt den Schild als Ausloeser, wenn seine Bedingung in einer and-Gruppe liegt', () => {
    const report = evaluateOverfilledGroup(armourCatalogue(
      conditionGroup('and', `<conditions>${SHIELD_CONDITION}</conditions>`),
    ));

    const violation = violationOf(report, GROUP_MAX_ID);
    expect(violation.bound).toBe(2);
    expect(violation.causes).toEqual([{
      witness: { defId: SHIELD_ID, name: SHIELD_NAME },
      modifierKind: ModifierKind.INCREMENT,
      value: 2,
    }]);
  });

  it('KONTROLLE: dieselbe Verletzung nennt den Schild bereits heute, wenn die Bedingung direkt am Modifier haengt', () => {
    // PIN (heute gruen): identischer Aufbau, nur ohne Gruppen-Huelle. Belegt, dass
    // Katalog, Roster und Verletzung tragen — die Gruppen-Variante scheitert also
    // allein an der Zeugen-Suche, nicht am Aufbau.
    const report = evaluateOverfilledGroup(armourCatalogue(
      `<conditions>${SHIELD_CONDITION}</conditions>`,
    ));

    const violation = violationOf(report, GROUP_MAX_ID);
    expect(violation.bound).toBe(2);
    expect(violation.causes).toEqual([{
      witness: { defId: SHIELD_ID, name: SHIELD_NAME },
      modifierKind: ModifierKind.INCREMENT,
      value: 2,
    }]);
  });
});

// ── Akzeptanzkriterium 3: keine erfundenen Zeugen, Direkt-Verhalten stabil ────

describe('Grenzen der Zeugen-Suche bleiben (AK 3)', () => {
  it('erfindet keinen Zeugen, wenn die Gruppen-Bedingung auf eine Kategorie zielt', () => {
    // PIN (heute gruen): eine Kategorie ist keine benennbare Auswahl (ADR-0027).
    // Der Krieger traegt sich selbst per Modifikator in die Elite-Kategorie ein,
    // die Gruppen-Bedingung zaehlt die Kategorie — der Schritt bleibt zeugenlos,
    // auch nachdem die Suche Bedingungsgruppen durchlaeuft.
    const catalogue = catalogueWith(`
      <modifiers>
        <modifier type="add" field="category" value="${ELITE_CAT_ID}"/>
        <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="2">
          ${conditionGroup('and', `<conditions>${rosterCondition('atLeast', ELITE_CAT_ID, 1)}</conditions>`)}
        </modifier>
      </modifiers>`);

    const report = evaluate(catalogue, { warriors: 1 });

    const violation = violationOf(report, MAX_WARRIORS_ID);
    expect(violation.derivation.steps).toEqual([
      expect.objectContaining({ isConditional: true, witness: null }),
    ]);
    // Ohne benennbare Ursache entfaellt das Feld ganz (ADR-0027) — kein leerer Block.
    expect('causes' in violation).toBe(false);
  });

  it('erfindet keinen Zeugen, wenn die Gruppen-Bedingung wegen einer Abwesenheit haelt', () => {
    // PIN (heute gruen): die Bedingung haelt, *weil* kein Bannertraeger da ist —
    // es gibt nichts Anwesendes zu benennen (ADR-0027, „Ehrlichkeit vor
    // Vollstaendigkeit").
    const catalogue = catalogueWith(`
      <modifiers>
        <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="2">
          ${conditionGroup('and', `<conditions>${rosterCondition('lessThan', BANNER_ID, 1)}</conditions>`)}
        </modifier>
      </modifiers>`);

    const report = evaluate(catalogue, { warriors: 1, banners: 0 });

    const violation = violationOf(report, MAX_WARRIORS_ID);
    expect(violation.derivation.steps).toEqual([
      expect.objectContaining({ isConditional: true, witness: null }),
    ]);
    expect('causes' in violation).toBe(false);
  });

  it('KONTROLLE: eine direkte Bedingung liefert ihren Zeugen wie bisher', () => {
    // PIN (heute gruen): das bestehende Direkt-Verhalten darf die Erweiterung der
    // Suche nicht veraendern.
    const catalogue = catalogueWith(`
      <modifiers>
        <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="2">
          <conditions>${rosterCondition('atLeast', BANNER_ID, 1)}</conditions>
        </modifier>
      </modifiers>`);

    const report = evaluate(catalogue, { warriors: 1, banners: 1 });

    expect(violationOf(report, MAX_WARRIORS_ID).derivation.steps).toEqual([
      expect.objectContaining({ isConditional: true, witness: BANNER_WITNESS }),
    ]);
  });

  it('KONTROLLE: bei direkter Bedingung plus Bedingungsgruppe bleibt der Zeuge der direkten Bedingung', () => {
    // PIN (heute gruen): beide Bedingungen halten, beide Ziele sind anwesend.
    // Die direkte Bedingung steht in Dokumentreihenfolge vorn — ihr Zeuge (der
    // Bannertraeger) darf durch die Gruppen-Suche nicht verdraengt werden.
    const catalogue = catalogueWith(`
      <modifiers>
        <modifier type="decrement" field="${MAX_WARRIORS_ID}" value="2">
          <conditions>${rosterCondition('atLeast', BANNER_ID, 1)}</conditions>
          ${conditionGroup('and', `<conditions>${rosterCondition('atLeast', HORN_ID, 1)}</conditions>`)}
        </modifier>
      </modifiers>`);

    const report = evaluate(catalogue, { warriors: 1, banners: 1, horns: 1 });

    expect(violationOf(report, MAX_WARRIORS_ID).derivation.steps).toEqual([
      expect.objectContaining({ isConditional: true, witness: BANNER_WITNESS }),
    ]);
  });
});
