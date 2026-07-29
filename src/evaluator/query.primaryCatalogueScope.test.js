/**
 * Issue 077: Bezugsrahmen `primary-catalogue`.
 *
 * Die Regel in einem Satz: eine Query mit `scope="primary-catalogue"` fragt, ob
 * das **Armeebuch** — der `<catalogue id=…>`, aus dem das umschliessende
 * Kontingent stammt — die in `childId` genannte Katalog-Id ist (Issue 077,
 * Kriterium 1: aus den Katalogdaten belegt; alle 27 Vorkommen tragen eine
 * Katalog-Wurzel-Id in `childId`).
 *
 * Der beschlossene Antwortvertrag (Issue 077, Abschnitt „Plan"):
 *
 * | Lage                                                        | Ergebnis |
 * | ---                                                          | ---      |
 * | `SELECTION_COUNT`, `targetId` = Katalog-Id des Kontingents   | 1        |
 * | `SELECTION_COUNT`, `targetId` ≠ dieser Katalog-Id            | 0        |
 * | `targetId === null` (Prozent-Nenner)                         | 1        |
 * | kein umschliessendes Kontingent / Herkunft unbekannt          | 0 **mit** `unresolvedScope` |
 *
 * Beobachtet wird durch die Fassade hindurch (wie
 * `query.selfGatedInstanceOf.test.js`): haelt die Bedingung, feuert der
 * gegatete Kosten-Modifikator und die Kostengrenze der Einheit wird verletzt.
 * Der zweite Beobachtungspunkt ist der Bericht selbst — Kriterium 2 verlangt,
 * dass die `unresolvedScope`-Diagnose fuer diesen Bezugsrahmen entfaellt.
 *
 * Die Faelle „kein umschliessendes Kontingent" (Query-Primitiv, unten) und
 * „Kontingent aus der `.gst`" pinnen das **unveraenderte** fail-closed
 * Verhalten (Issue 077, Decisions: „dann greift der Fail-closed-Zweig
 * (`unresolvedScope`), nicht eine stille Falschauskunft"). Der Scope-Waechter-
 * Pin auf `scope="unit"` aus diesem Lauf entfiel mit Issue 0086: `unit` ist
 * seither ein regulaerer Zaehlrahmen (`query.unitScope.test.js`).
 *
 * Bewusst NICHT gepinnt (offene Kanten, siehe Bericht des Test-Autors):
 * `scope="primary-catalogue"` **ohne** `childId` an einer nicht-prozentualen
 * Bedingung, und ein Roster mit Kontingenten aus mehreren Armeebuechern
 * gegenueber der Roster-Deutung des Rahmens (in den Daten kommt beides nicht
 * vor).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { parseCatalogue } from './catalogReader.js';
import { resolveCatalogue } from './resolver.js';
import { buildEvalTree } from './evalTree.js';
import { buildIndex } from './countIndex.js';
import { createBaseEffectiveState } from './effectiveState.js';
import { query, createQueryContext } from './query.js';
import { SELECTION_COUNT } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Das Schluesselwort, so wie es in den Katalogdaten steht. */
const PRIMARY_CATALOGUE = 'primary-catalogue';

const GAME_SYSTEM_ID = 'gs-0000-0000-0000';
const POINTS_ID = 'cost-points';

// Zwei **Armeebuecher** im selben Datensatz (ADR-0032). Jedes deklariert genau
// ein Kontingent; die beiden Einheiten stehen bewusst BEIDE in Katalog A, damit
// die Herkunft des **Kontingents** und die Herkunft des **Eintrags** sich
// unterscheiden lassen.
const CATALOGUE_A_ID = 'cat-army-a';
const CATALOGUE_B_ID = 'cat-army-b';
const FORCE_A_ID = 'force-of-a';
const FORCE_B_ID = 'force-of-b';
const ALPHA_ID = 'entry-alpha';
const BETA_ID = 'entry-beta';
const MAX_ALPHA_ID = 'max-alpha-points';
const MAX_BETA_ID = 'max-beta-points';

const UNIT_POINTS = 10;
const SURCHARGE = 5;
// Die Kostengrenze liegt genau auf dem Basiswert: nur ein feuernder Modifikator
// verletzt sie (Ist 15 > Grenze 10).
const VIOLATING_POINTS = UNIT_POINTS + SURCHARGE;

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
  </gameSystem>`;

/** Eine Einheit mit Kostengrenze und einem auf `conditionXml` gegateten Aufschlag. */
function unitEntry(entryId, limitId, conditionXml) {
  return `<selectionEntry id="${entryId}" name="${entryId}" type="unit">
      <costs><cost name="Points" typeId="${POINTS_ID}" value="${UNIT_POINTS}"/></costs>
      <constraints>
        <constraint id="${limitId}" type="max" value="${UNIT_POINTS}" field="${POINTS_ID}" scope="roster"/>
      </constraints>
      <modifiers>
        <modifier type="increment" field="${POINTS_ID}" value="${SURCHARGE}">
          <conditions>${conditionXml}</conditions>
        </modifier>
      </modifiers>
    </selectionEntry>`;
}

/** Armeebuch A: sein Kontingent und beide Einheiten, beide auf dieselbe Bedingung gegatet. */
function catalogueA(conditionXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="${CATALOGUE_A_ID}" name="Army A" gameSystemId="${GAME_SYSTEM_ID}" library="false">
      <forceEntries><forceEntry id="${FORCE_A_ID}" name="Force of A"/></forceEntries>
      <selectionEntries>
        ${unitEntry(ALPHA_ID, MAX_ALPHA_ID, conditionXml)}
        ${unitEntry(BETA_ID, MAX_BETA_ID, conditionXml)}
      </selectionEntries>
    </catalogue>`;
}

/** Armeebuch B: nur sein Kontingent — die Einheiten kommen aus A. */
const CATALOGUE_B_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${CATALOGUE_B_ID}" name="Army B" gameSystemId="${GAME_SYSTEM_ID}" library="false">
    <forceEntries><forceEntry id="${FORCE_B_ID}" name="Force of B"/></forceEntries>
  </catalogue>`;

/** Wertet den Zwei-Armeebuch-Datensatz mit der gegebenen Bedingung aus. */
function evaluate(conditionXml, roster) {
  return evaluateDataset(
    prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogueA(conditionXml), CATALOGUE_B_XML] }),
    roster,
  );
}

/**
 * Die Bedingung „das Armeebuch des Kontingents ist `catalogueId`".
 * `value="1"` ist die in den Katalogdaten belegte Form
 * (`instanceOf`/`notInstanceOf` lesen den Wert ohnehin nicht schwellwertig).
 */
function primaryCatalogueCondition(type, catalogueId, { value = 1, shared = true, percent = false } = {}) {
  const percentAttr = percent ? ' percentValue="true"' : '';
  return `<condition type="${type}" value="${value}" field="selections" scope="${PRIMARY_CATALOGUE}" childId="${catalogueId}" shared="${shared}"${percentAttr}/>`;
}

/** Roster: Kontingent aus Armeebuch A mit einer Alpha-Einheit. */
const ROSTER_FORCE_A = {
  forces: [{ defId: FORCE_A_ID, count: 1, children: [{ defId: ALPHA_ID, count: 1, children: [] }] }],
};

/**
 * Roster mit **beiden** Kontingenten: Alpha steht im Kontingent aus Armeebuch A,
 * Beta im Kontingent aus Armeebuch B — obwohl beide Eintraege in Katalog A
 * deklariert sind. Genau hier trennt sich „Herkunft des Kontingents" von
 * „Herkunft des Eintrags".
 */
const ROSTER_BOTH_FORCES = {
  forces: [
    { defId: FORCE_A_ID, count: 1, children: [{ defId: ALPHA_ID, count: 1, children: [] }] },
    { defId: FORCE_B_ID, count: 1, children: [{ defId: BETA_ID, count: 1, children: [] }] },
  ],
};

/** Die Verletzungen des Berichts zu einer Grenz-Id. */
function violationsOf(report, limitId) {
  return report.violations.filter(message => message.limitId === limitId);
}

/** Die `unresolvedScope`-Diagnosen des Berichts zu einem Bezugsrahmen. */
function unresolvedScopeOf(report, scope) {
  return (report.diagnostics ?? []).filter(
    diagnostic => diagnostic.kind === 'unresolvedScope' && diagnostic.scope === scope,
  );
}

// ── Kriterium 2: instanceOf ──────────────────────────────────────────────────

describe('instanceOf: das Armeebuch des umschliessenden Kontingents', () => {
  const HIT = primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID);
  const MISS = primaryCatalogueCondition('instanceOf', CATALOGUE_B_ID);

  it('Treffer: das Kontingent stammt aus dem genannten Armeebuch — der Modifikator feuert', () => {
    const report = evaluate(HIT, ROSTER_FORCE_A);

    const violations = violationsOf(report, MAX_ALPHA_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: VIOLATING_POINTS, bound: UNIT_POINTS });
  });

  it('Nicht-Treffer: ein anderes Armeebuch — der Modifikator bleibt aus', () => {
    const report = evaluate(MISS, ROSTER_FORCE_A);

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
  });

  it('Kriterium 2: im Treffer-Fall traegt der Bericht KEINE unresolvedScope-Diagnose fuer diesen Rahmen', () => {
    const report = evaluate(HIT, ROSTER_FORCE_A);

    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });

  it('Kriterium 2: auch im Nicht-Treffer-Fall entfaellt die unresolvedScope-Diagnose — 0 ist eine Antwort, kein Datenfehler', () => {
    const report = evaluate(MISS, ROSTER_FORCE_A);

    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });
});

// ── Kriterium 2: notInstanceOf (der Nicht-Treffer ist hier der feuernde Fall) ─

describe('notInstanceOf: die Umkehrung derselben Frage', () => {
  const HIT = primaryCatalogueCondition('notInstanceOf', CATALOGUE_A_ID);
  const MISS = primaryCatalogueCondition('notInstanceOf', CATALOGUE_B_ID);

  it('Treffer: das Kontingent stammt aus genau diesem Armeebuch — die Bedingung haelt NICHT, kein Modifikator', () => {
    const report = evaluate(HIT, ROSTER_FORCE_A);

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
  });

  it('Nicht-Treffer: ein anderes Armeebuch — die Bedingung haelt, der Modifikator feuert', () => {
    const report = evaluate(MISS, ROSTER_FORCE_A);

    const violations = violationsOf(report, MAX_ALPHA_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: VIOLATING_POINTS, bound: UNIT_POINTS });
  });

  it('Kriterium 2: keine unresolvedScope-Diagnose in beiden Lagen', () => {
    expect(unresolvedScopeOf(evaluate(HIT, ROSTER_FORCE_A), PRIMARY_CATALOGUE)).toEqual([]);
    expect(unresolvedScopeOf(evaluate(MISS, ROSTER_FORCE_A), PRIMARY_CATALOGUE)).toEqual([]);
  });
});

// ── Der Rahmen ist das Kontingent, nicht das Roster und nicht der Eintrag ────

describe('Bezugsrahmen: das Armeebuch des KONTINGENTS, in dem die Auswahl steht', () => {
  it('childId = Armeebuch A: nur die Einheit im A-Kontingent feuert — die im B-Kontingent nicht', () => {
    // Beide Eintraege sind in Katalog A deklariert; massgeblich ist trotzdem das
    // Armeebuch, aus dem das jeweils umschliessende Kontingent stammt.
    const report = evaluate(primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID), ROSTER_BOTH_FORCES);

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(1);
    expect(violationsOf(report, MAX_BETA_ID)).toHaveLength(0);
  });

  it('childId = Armeebuch B: die Lage kehrt sich um — nur die Einheit im B-Kontingent feuert', () => {
    const report = evaluate(primaryCatalogueCondition('instanceOf', CATALOGUE_B_ID), ROSTER_BOTH_FORCES);

    expect(violationsOf(report, MAX_BETA_ID)).toHaveLength(1);
    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
  });
});

// ── shared: ein Katalog wird durch shared="false" nicht enger ────────────────

describe('shared="false" verengt den Katalog-Rahmen nicht (Issue 077, Plan)', () => {
  it('Treffer mit shared="false": der Modifikator feuert wie mit shared="true"', () => {
    const report = evaluate(
      primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID, { shared: false }),
      ROSTER_FORCE_A,
    );

    const violations = violationsOf(report, MAX_ALPHA_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: VIOLATING_POINTS, bound: UNIT_POINTS });
  });

  it('Nicht-Treffer mit shared="false": der Modifikator bleibt aus', () => {
    const report = evaluate(
      primaryCatalogueCondition('instanceOf', CATALOGUE_B_ID, { shared: false }),
      ROSTER_FORCE_A,
    );

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
  });
});

// ── Prozent-Nenner: der Rahmen hat genau EINEN Katalog ──────────────────────

describe('Prozent-Query: der Nenner „alles im Rahmen" ist 1', () => {
  const PERCENT_HIT = primaryCatalogueCondition('atLeast', CATALOGUE_A_ID, { value: 100, percent: true });

  it('atLeast 100 % feuert — Nenner 1 ergibt die Schwelle 1, und der Ist-Wert ist 1', () => {
    // Nenner (Ziel `null`) = 1 → Schwelle roundHalfUp(1 * 100 / 100) = 1;
    // Ist = 1 (Treffer) → 1 >= 1 → die Bedingung haelt. Waere der Nenner 0,
    // hielte sie laut Null-Nenner-Konvention nicht; waere er 2, ergaebe sich
    // die Schwelle 2 und 1 >= 2 waere falsch.
    const report = evaluate(PERCENT_HIT, ROSTER_FORCE_A);

    const violations = violationsOf(report, MAX_ALPHA_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: VIOLATING_POINTS, bound: UNIT_POINTS });
  });

  it('und hinterlaesst keine zeroDenominator-Diagnose', () => {
    const report = evaluate(PERCENT_HIT, ROSTER_FORCE_A);

    expect(report.diagnostics.some(diagnostic => diagnostic.kind === 'zeroDenominator')).toBe(false);
  });
});

// ── fail-closed bleibt: Herkunft des Kontingents unbekannt (PIN) ─────────────

describe('PIN: Kontingent aus der .gst — die Herkunft ist kein Armeebuch, es bleibt fail-closed', () => {
  // Quelle der Erwartung ist woertlich die Decisions-Notiz des Issues: „Sie
  // versagt erst, wenn ein Datensatz Kontingente in der `.gst` deklariert —
  // dann greift der Fail-closed-Zweig (`unresolvedScope`), nicht eine stille
  // Falschauskunft." Ein Kontingent der `.gst` gehoert also NICHT in den
  // Herkunftsindex; ein Armeebuch ist es nicht.
  const FORCE_IN_GAME_SYSTEM_ID = 'force-in-gamesystem';
  const GAME_SYSTEM_WITH_FORCE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
      <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
      <forceEntries><forceEntry id="${FORCE_IN_GAME_SYSTEM_ID}" name="System Force"/></forceEntries>
    </gameSystem>`;

  const ROSTER_SYSTEM_FORCE = {
    forces: [{ defId: FORCE_IN_GAME_SYSTEM_ID, count: 1, children: [{ defId: ALPHA_ID, count: 1, children: [] }] }],
  };

  /** Wertet dieselben Kataloge aus, aber mit dem Kontingent aus der `.gst`. */
  function evaluateWithSystemForce(conditionXml) {
    return evaluateDataset(
      prepareDataset({
        gameSystem: GAME_SYSTEM_WITH_FORCE_XML,
        catalogues: [catalogueA(conditionXml), CATALOGUE_B_XML],
      }),
      ROSTER_SYSTEM_FORCE,
    );
  }

  it('instanceOf haelt nicht (kein Modifikator) und der Bericht traegt die unresolvedScope-Diagnose', () => {
    const report = evaluateWithSystemForce(primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID));

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedScope', scope: PRIMARY_CATALOGUE }),
    );
  });
});

// Der fruehere Scope-Waechter-Pin dieses Laufs — `scope="unit"` bleibt
// unaufgeloest, „Issue 0086 ist NICHT Gegenstand" — ist mit der Umsetzung von
// Issue 0086 gegenstandslos: `unit` ist jetzt ein regulaerer Zaehlrahmen
// (`query.unitScope.test.js`); dass ein weiterhin unbekanntes Schluesselwort
// diagnostiziert bleibt, pinnt dort Kriterium 4.

// ── Query-Primitiv: kein umschliessendes Kontingent (PIN) ───────────────────

describe('PIN: ohne umschliessendes Kontingent bleibt es bei 0 und unresolvedScope', () => {
  // Dieselbe Naht wie `query.matrix.test.js`: das Query-Primitiv direkt. An der
  // Wurzel (dem ROSTER-Rahmen) gibt es kein Kontingent, aus dem ein Armeebuch
  // abzuleiten waere — der Vertrag verlangt dort 0 **mit** Diagnose.
  const MINIMAL_CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="${CATALOGUE_A_ID}" name="Army A">
      <forceEntries><forceEntry id="${FORCE_A_ID}" name="Force of A"/></forceEntries>
      <selectionEntries><selectionEntry id="${ALPHA_ID}" name="Alpha" type="unit"/></selectionEntries>
    </catalogue>`;

  it('liefert 0 und eine unresolvedScope-Diagnose an der Wurzel des Instanzbaums', () => {
    const resolved = resolveCatalogue(parseCatalogue(MINIMAL_CATALOGUE));
    const { root } = buildEvalTree(resolved, ROSTER_FORCE_A);
    const index = buildIndex(root, createBaseEffectiveState(root));
    const diagnostics = [];
    const ctx = createQueryContext({ node: root, root, index, categoryIds: resolved.categoryIds, diagnostics });

    const result = query(ctx, SELECTION_COUNT, PRIMARY_CATALOGUE, CATALOGUE_A_ID, { shared: true });

    expect(result).toBe(0);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedScope', scope: PRIMARY_CATALOGUE }),
    );
  });
});
