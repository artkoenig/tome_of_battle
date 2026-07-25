import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';
import { parseCatalogue } from './catalogReader.js';
import { resolveCatalogue } from './resolver.js';
import { buildEvalTree } from './evalTree.js';
import { buildIndex } from './countIndex.js';
import { createBaseEffectiveState } from './effectiveState.js';
import { applyAllModifiers } from './modifiers.js';
import { createQueryContext, query } from './query.js';
import { SELECTION_COUNT } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Eigene, minimale Fixtures (ADR-0030: eigenes Datenmodell, eigene Fixtures) ──
// Diese Scheibe (Issue 04) fuehrt die Effektiv-Werte-Schicht ein: Bedingungen,
// Wiederholungen und Modifikatoren in Dokumentreihenfolge, in **einem** Durchlauf
// (die Fixpunktschleife ist Slice 05).

const WARRIOR_ID = 'entry-warrior';
const ARCHER_ID = 'entry-archer';
const TOKEN_ID = 'entry-token';
const ELITE_CAT_ID = 'cat-elite';
const POINTS_ID = 'cost-points';

/** Baut ein Roster aus den gegebenen Kontingent-/Auswahl-Instanzen. */
function roster(forces) {
  return { forces };
}

/** Eine Auswahl-Instanz mit Anzahl und ohne Kinder. */
function selection(defId, count) {
  return { defId, count, children: [] };
}

/** Baut die Auswertungs-Stufen bis zum Baum und liefert Wurzel und Kategorien. */
function buildTree(catalogXml, rosterInput) {
  const catalogue = parseCatalogue(catalogXml);
  const resolved = resolveCatalogue(catalogue);
  const { root } = buildEvalTree(resolved, rosterInput);
  return { root, categoryIds: resolved.categoryIds };
}

describe('Bedingungen steuern, ob ein Modifikator die effektiven Kosten aendert', () => {
  const MAX_POINTS_ID = 'max-points';
  const WARRIOR_BASE_POINTS = 10;
  const MODIFIER_POINTS = 5;
  const MAX_POINTS = 12;
  // Warrior: +5 Punkte, aber nur wenn mindestens ein Archer im Roster steht.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cond" name="Condition Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_ID}" value="${WARRIOR_BASE_POINTS}"/>
          </costs>
          <constraints>
            <constraint id="${MAX_POINTS_ID}" type="max" value="${MAX_POINTS}" field="${POINTS_ID}" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${ARCHER_ID}" value="1"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${ARCHER_ID}" name="Archer" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  it('aendert den effektiven Wert, wenn die Bedingung haelt', () => {
    // Bedingung haelt (ein Archer) → effektiv 15 Punkte → 1 * 15 = 15 > 12.
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].actual).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS);
  });

  it('laesst den Basiswert unveraendert, wenn die Bedingung nicht haelt', () => {
    // Kein Archer → Bedingung faellt → Basiswert 10 → 10 <= 12, keine Verletzung.
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });
});

describe('Modifikatoren auf dasselbe Ziel wirken in Dokumentreihenfolge', () => {
  const MAX_POINTS_ID = 'max-points';
  const BASE_POINTS = 5;
  const ADD_VALUE = 10;
  const MULTIPLY_VALUE = 2;
  const MAX_POINTS = 1; // absichtlich klein: beide Reihenfolgen verletzen, der Ist-Wert zeigt die Ordnung.

  /** Katalog mit den beiden Modifikatoren in der uebergebenen Reihenfolge. */
  function catalogueWithOrder(firstModifier, secondModifier) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-order" name="Order Catalogue">
        <selectionEntries>
          <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
            <costs>
              <cost name="Points" typeId="${POINTS_ID}" value="${BASE_POINTS}"/>
            </costs>
            <constraints>
              <constraint id="${MAX_POINTS_ID}" type="max" value="${MAX_POINTS}" field="${POINTS_ID}" scope="roster"/>
            </constraints>
            <modifiers>
              ${firstModifier}
              ${secondModifier}
            </modifiers>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  const INCREMENT = `<modifier type="increment" field="${POINTS_ID}" value="${ADD_VALUE}"/>`;
  const MULTIPLY = `<modifier type="multiply" field="${POINTS_ID}" value="${MULTIPLY_VALUE}"/>`;

  it('increment dann multiply: (5 + 10) * 2 = 30', () => {
    const report = evaluate(catalogueWithOrder(INCREMENT, MULTIPLY), roster([selection(WARRIOR_ID, 1)]));

    expect(report.violations[0].actual).toBe((BASE_POINTS + ADD_VALUE) * MULTIPLY_VALUE);
  });

  it('multiply dann increment: (5 * 2) + 10 = 20 — dieselben Modifikatoren, andere Ordnung, anderes Ergebnis', () => {
    const report = evaluate(catalogueWithOrder(MULTIPLY, INCREMENT), roster([selection(WARRIOR_ID, 1)]));

    expect(report.violations[0].actual).toBe(BASE_POINTS * MULTIPLY_VALUE + ADD_VALUE);
  });
});

describe('Wiederholungen multiplizieren die Modifikator-Wirkung', () => {
  const MAX_POINTS_ID = 'max-points';
  const WARRIOR_BASE_POINTS = 10;
  const MODIFIER_POINTS = 5;
  const MAX_POINTS = 12;
  const PER_TOKEN = 1;
  // Warrior: +5 Punkte je Token im Roster (Wiederholung ueber die Token-Anzahl).
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-repeat" name="Repeat Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_ID}" value="${WARRIOR_BASE_POINTS}"/>
          </costs>
          <constraints>
            <constraint id="${MAX_POINTS_ID}" type="max" value="${MAX_POINTS}" field="${POINTS_ID}" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}">
              <repeats>
                <repeat field="selections" scope="roster" childId="${TOKEN_ID}" perValue="${PER_TOKEN}"/>
              </repeats>
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${TOKEN_ID}" name="Token" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;

  it('multipliziert die Wirkung mit der ganzzahligen Wiederholungszahl (value * times)', () => {
    const tokens = 3; // times = floor(3 / 1) = 3 → 10 + 5*3 = 25.
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1), selection(TOKEN_ID, tokens)]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].actual).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS * tokens);
  });

  it('laesst den Modifikator bei Wiederholungszahl 0 inaktiv', () => {
    // Keine Token → times = floor(0 / 1) = 0 → Modifikator inaktiv → Basiswert 10 <= 12.
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });
});

describe('Modifikatoren aendern effektive Grenzwerte (durch resolveBound)', () => {
  const MAX_WARRIORS_ID = 'max-warriors';
  const BASE_MAX = 2;
  const LIMIT_BONUS = 3;
  // Die MAX-Grenze der Warrior-Anzahl steigt um 3, wenn ein Archer im Roster steht.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-limit" name="Limit Modifier Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <constraints>
            <constraint id="${MAX_WARRIORS_ID}" type="max" value="${BASE_MAX}" field="selections" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="increment" field="${MAX_WARRIORS_ID}" value="${LIMIT_BONUS}">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${ARCHER_ID}" value="1"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${ARCHER_ID}" name="Archer" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  it('hebt den effektiven Grenzwert an, wenn die Bedingung haelt', () => {
    // Grenze wird 5 → 4 Warriors <= 5, keine Verletzung.
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 4), selection(ARCHER_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });

  it('behaelt den Basis-Grenzwert, wenn die Bedingung nicht haelt', () => {
    // Kein Archer → Grenze bleibt 2 → 4 Warriors > 2, Verletzung gegen den Basiswert.
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 4)]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ actual: 4, bound: BASE_MAX });
  });
});

describe('Modifikatoren aendern effektive Prozent-Grenzwerte (durch dieselbe resolveBound-Stelle)', () => {
  const SHARE_ID = 'max-share';
  // Basis: MAX 50 % der Roster-Selektionen; mit einem Archer wird daraus 100 %.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-percent-mod" name="Percent Modifier Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <constraints>
            <constraint id="${SHARE_ID}" type="max" value="50" percentValue="true" field="selections" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="set" field="${SHARE_ID}" value="100">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${ARCHER_ID}" value="1"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${ARCHER_ID}" name="Archer" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  it('leitet die Prozentgrenze aus dem effektiven Prozentsatz ab, wenn die Bedingung haelt', () => {
    // Nenner = 3 + 1 = 4; effektiv 100 % → Grenze 4 → 3 Warriors <= 4, keine Verletzung.
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 3), selection(ARCHER_ID, 1)]));

    expect(report.violations).toHaveLength(0);
  });

  it('verwendet den Basis-Prozentsatz, wenn die Bedingung nicht haelt', () => {
    // Kein Archer → 50 % von 3 = round(1.5) = 2 → 3 Warriors > 2, Verletzung.
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 3)]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ actual: 3, bound: 2 });
  });
});

describe('Die Zaehlung stuetzt sich auf effektive Kategorien, nicht auf Basis-Kategorien', () => {
  // Warrior traegt in der Basis KEINE Kategorie; ein Modifikator nimmt ihn in die
  // Elite-Kategorie auf. Danach zaehlt eine Kategorie-Query den Warrior mit.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-effcat" name="Effective Category Catalogue">
      <categoryEntries>
        <categoryEntry id="${ELITE_CAT_ID}" name="Elite"/>
      </categoryEntries>
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <modifiers>
            <modifier type="add" field="category" value="${ELITE_CAT_ID}"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
  const WARRIOR_COUNT = 3;

  /** Zaehlt die Elite-Kategorie armeeweit gegen den gegebenen Index. */
  function countElite(root, categoryIds, index) {
    const ctx = createQueryContext({ node: root.children[0], root, index, categoryIds, diagnostics: [] });
    return query(ctx, SELECTION_COUNT, ELITE_CAT_ID, ELITE_CAT_ID, { shared: true });
  }

  it('zaehlt einen Knoten nach kategorie-aenderndem Modifikator in der neuen Kategorie', () => {
    const { root, categoryIds } = buildTree(CATALOGUE_XML, roster([selection(WARRIOR_ID, WARRIOR_COUNT)]));
    const baseIndex = buildIndex(root, createBaseEffectiveState(root));

    // Basis-Kategorien: Warrior ist NICHT Elite → 0.
    expect(countElite(root, categoryIds, baseIndex)).toBe(0);

    const effective = applyAllModifiers(root, baseIndex, categoryIds, []);
    const effectiveIndex = buildIndex(root, effective);

    // Effektive Kategorien: Warrior ist jetzt Elite → zaehlt mit seiner Anzahl.
    expect(countElite(root, categoryIds, effectiveIndex)).toBe(WARRIOR_COUNT);
  });
});

describe('Sichtbarkeit und bedingte Hinweise als effektive Werte', () => {
  const NOTE_TEXT = 'Nur mit Bannertraeger.';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-note-hidden" name="Note And Hidden Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <modifiers>
            <modifier type="set" field="hidden" value="true"/>
            <modifier type="append" field="notes" value="${NOTE_TEXT}">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${WARRIOR_ID}" value="2"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  function effectiveFor(rosterInput) {
    const { root, categoryIds } = buildTree(CATALOGUE_XML, rosterInput);
    const baseIndex = buildIndex(root, createBaseEffectiveState(root));
    const effective = applyAllModifiers(root, baseIndex, categoryIds, []);
    return { node: root.children[0], effective };
  }

  it('versteckt den Knoten und haengt den Hinweis an, wenn die Bedingung haelt', () => {
    const { node, effective } = effectiveFor(roster([selection(WARRIOR_ID, 2)]));

    expect(effective.isHidden(node)).toBe(true);
    expect(effective.notesOf(node)).toEqual([NOTE_TEXT]);
  });

  it('haengt den bedingten Hinweis nicht an, wenn die Bedingung nicht haelt', () => {
    const { node, effective } = effectiveFor(roster([selection(WARRIOR_ID, 1)]));

    expect(effective.isHidden(node)).toBe(true); // unbedingt versteckt
    expect(effective.notesOf(node)).toEqual([]); // Hinweis-Bedingung faellt
  });
});

describe('Keine kumulative Drift innerhalb einer Auswertung', () => {
  const WARRIOR_BASE_POINTS = 10;
  const MODIFIER_POINTS = 5;
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-drift" name="No Drift Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_ID}" value="${WARRIOR_BASE_POINTS}"/>
          </costs>
          <modifiers>
            <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('liefert bei erneuter Anwendung von den Basiswerten aus denselben effektiven Wert', () => {
    const { root, categoryIds } = buildTree(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1)]));
    const baseIndex = buildIndex(root, createBaseEffectiveState(root));
    const node = root.children[0];

    const first = applyAllModifiers(root, baseIndex, categoryIds, []);
    const second = applyAllModifiers(root, baseIndex, categoryIds, []);

    // Beide Anwendungen ergeben 15 (10 + 5) — kein Aufsummieren zu 20 ueber Laeufe.
    const expected = WARRIOR_BASE_POINTS + MODIFIER_POINTS;
    expect(first.currentCost(node, POINTS_ID)).toBe(expected);
    expect(second.currentCost(node, POINTS_ID)).toBe(expected);
  });

  it('mutiert die Basisdefinitionen nicht (die frische Kopie bleibt getrennt)', () => {
    const { root, categoryIds } = buildTree(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1)]));
    const baseIndex = buildIndex(root, createBaseEffectiveState(root));
    const node = root.children[0];

    applyAllModifiers(root, baseIndex, categoryIds, []);

    // Die Basisdefinition traegt weiterhin den unveraenderten Basiswert.
    expect(node.def.costs[POINTS_ID]).toBe(WARRIOR_BASE_POINTS);
  });
});
