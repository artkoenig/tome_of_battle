/**
 * Issue 077, die beiden Zeilen des Antwortvertrags, die
 * `query.primaryCatalogueScope.test.js` **nicht** haelt.
 *
 * Der Vertrag (Issue 077, Abschnitt „Plan") hat fuenf Zeilen; vier davon sind
 * dort gepinnt. Offen bleiben:
 *
 * | Lage                                                | Ergebnis |
 * | ---                                                 | ---      |
 * | ein anderes Feld als `SELECTION_COUNT`              | der bestehende `unsupportedField`-Pfad |
 *
 * und, aus Plan-Punkt 1 (`catalogSet.js`), die Reichweite des
 * **Herkunftsindex**: er erfasst die Kontingent-Definitionen eines Dokuments
 * „(Wurzel- **und** Unter-Kontingente)". Der Bezugsrahmen loest auf das
 * **innerste** umschliessende Kontingent auf — eine Auswahl in einem
 * geschachtelten Kontingent muss also dasselbe Armeebuch finden wie eine in
 * einem Wurzel-Kontingent, statt fail-closed zu werden.
 *
 * Beide Faelle brauchen einen **synthetischen** Katalog: die echten
 * Fixture-Kataloge stellen alle Kontingente auf Wurzelebene, und alle 27
 * `primary-catalogue`-Vorkommen tragen `field="selections"`. Fachlich zaehlen
 * die Kanten trotzdem — der Vertrag entscheidet sie, also haelt sie ein Test.
 *
 * Beobachtet wird wie in `query.primaryCatalogueScope.test.js`: durch die
 * Fassade hindurch (haelt die Bedingung, feuert der gegatete Kosten-Modifikator
 * und die Kostengrenze der Einheit wird verletzt) sowie am Query-Primitiv
 * selbst, wo der Rueckgabewert und die Diagnose unmittelbar sichtbar sind.
 *
 * Bewusst NICHT gepinnt (offene Kante, siehe Bericht des Test-Autors): ein
 * anderes Feld als `SELECTION_COUNT` **zusammen mit** `targetId === null` — der
 * Vertrag nennt fuer diese Lage zwei Zeilen (`1` fuer den Prozent-Nenner,
 * `unsupportedField` fuer das Feld) und sagt nicht, welche gewinnt.
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
import { FORCE_COUNT, costSumField } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Das Schluesselwort, so wie es in den Katalogdaten steht. */
const PRIMARY_CATALOGUE = 'primary-catalogue';

const GAME_SYSTEM_ID = 'gs-0000-0000-0000';
const POINTS_ID = 'cost-points';

const CATALOGUE_A_ID = 'cat-army-a';
const CATALOGUE_B_ID = 'cat-army-b';

// Drei Kontingent-Ebenen **eines** Armeebuchs: ein Wurzel-Kontingent, darin ein
// Unter-Kontingent, darin ein weiteres. Der Herkunftsindex soll alle drei
// kennen, nicht nur die Wurzel.
const FORCE_ROOT_ID = 'force-root';
const FORCE_SUB_ID = 'force-sub';
const FORCE_SUB_SUB_ID = 'force-sub-sub';

const ALPHA_ID = 'entry-alpha';
const MAX_ALPHA_ID = 'max-alpha-points';

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
function unitEntry(conditionXml) {
  return `<selectionEntry id="${ALPHA_ID}" name="Alpha" type="unit">
      <costs><cost name="Points" typeId="${POINTS_ID}" value="${UNIT_POINTS}"/></costs>
      <constraints>
        <constraint id="${MAX_ALPHA_ID}" type="max" value="${UNIT_POINTS}" field="${POINTS_ID}" scope="roster"/>
      </constraints>
      <modifiers>
        <modifier type="increment" field="${POINTS_ID}" value="${SURCHARGE}">
          <conditions>${conditionXml}</conditions>
        </modifier>
      </modifiers>
    </selectionEntry>`;
}

/**
 * Armeebuch A: ein Wurzel-Kontingent mit zwei Schachtelungsebenen darunter und
 * die eine Einheit, die in jeder Ebene stehen kann.
 */
function catalogueA(conditionXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="${CATALOGUE_A_ID}" name="Army A" gameSystemId="${GAME_SYSTEM_ID}" library="false">
      <forceEntries>
        <forceEntry id="${FORCE_ROOT_ID}" name="Root Force">
          <forceEntries>
            <forceEntry id="${FORCE_SUB_ID}" name="Sub Force">
              <forceEntries>
                <forceEntry id="${FORCE_SUB_SUB_ID}" name="Sub Sub Force"/>
              </forceEntries>
            </forceEntry>
          </forceEntries>
        </forceEntry>
      </forceEntries>
      <selectionEntries>${unitEntry(conditionXml)}</selectionEntries>
    </catalogue>`;
}

/** Ein zweites Armeebuch im selben Datensatz — Gegenstueck fuer den Nicht-Treffer. */
const CATALOGUE_B_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${CATALOGUE_B_ID}" name="Army B" gameSystemId="${GAME_SYSTEM_ID}" library="false">
    <forceEntries><forceEntry id="force-of-b" name="Force of B"/></forceEntries>
  </catalogue>`;

/** Wertet den Zwei-Armeebuch-Datensatz mit der gegebenen Bedingung aus. */
function evaluate(conditionXml, roster) {
  return evaluateDataset(
    prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogueA(conditionXml), CATALOGUE_B_XML] }),
    roster,
  );
}

/** Die Bedingung „das Armeebuch des Kontingents ist `catalogueId`" ueber `field`. */
function primaryCatalogueCondition(type, catalogueId, { field = 'selections', value = 1 } = {}) {
  return `<condition type="${type}" value="${value}" field="${field}" scope="${PRIMARY_CATALOGUE}" childId="${catalogueId}" shared="true"/>`;
}

/** Ein Roster, dessen Kontingente von aussen nach innen geschachtelt sind, mit Alpha zuinnerst. */
function nestedRoster(...forceDefIds) {
  const alpha = { defId: ALPHA_ID, count: 1, children: [] };
  const innermost = forceDefIds.reduceRight(
    (child, defId) => ({ defId, count: 1, children: [child] }),
    alpha,
  );
  return { forces: [innermost] };
}

/** Alpha im Wurzel-Kontingent — die Lage, die schon heute gehalten ist (KONTROLLE). */
const ROSTER_ROOT_FORCE = nestedRoster(FORCE_ROOT_ID);
/** Alpha im Unter-Kontingent: `forceRoot` ist das innerste, also `force-sub`. */
const ROSTER_SUB_FORCE = nestedRoster(FORCE_ROOT_ID, FORCE_SUB_ID);
/** Alpha zwei Ebenen tief: die Rekursion muss weiter als eine Ebene tragen. */
const ROSTER_SUB_SUB_FORCE = nestedRoster(FORCE_ROOT_ID, FORCE_SUB_ID, FORCE_SUB_SUB_ID);

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

/** Die `unsupportedField`-Diagnosen des Berichts. */
function unsupportedFieldOf(report) {
  return (report.diagnostics ?? []).filter(diagnostic => diagnostic.kind === 'unsupportedField');
}

// ── Vertragszeile: ein anderes Feld als SELECTION_COUNT ─────────────────────

describe('anderes Feld als SELECTION_COUNT: der bestehende unsupportedField-Pfad', () => {
  // Beide Felder sind aus dem `field`-Attribut erreichbar: `field="forces"` ist
  // die Kontingentanzahl, ein Kostenart-Id die Kostensumme. Der Katalog nennt
  // in `childId` das Armeebuch, aus dem das Kontingent **tatsaechlich** stammt —
  // eine Auflösung als Identitaetspruefung ergaebe also 1 und liesse den
  // Modifikator feuern. Der Vertrag verlangt stattdessen den
  // `unsupportedField`-Pfad: keine Antwort, sondern eine Diagnose.

  it('field="forces": der Modifikator feuert NICHT, obwohl das Armeebuch stimmt', () => {
    const report = evaluate(
      primaryCatalogueCondition('atLeast', CATALOGUE_A_ID, { field: 'forces' }),
      ROSTER_ROOT_FORCE,
    );

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
  });

  it('field="forces": der Bericht traegt die unsupportedField-Diagnose', () => {
    const report = evaluate(
      primaryCatalogueCondition('atLeast', CATALOGUE_A_ID, { field: 'forces' }),
      ROSTER_ROOT_FORCE,
    );

    expect(unsupportedFieldOf(report).length).toBeGreaterThan(0);
  });

  it('field=<Kostenart>: der Modifikator feuert NICHT, obwohl das Armeebuch stimmt', () => {
    const report = evaluate(
      primaryCatalogueCondition('atLeast', CATALOGUE_A_ID, { field: POINTS_ID }),
      ROSTER_ROOT_FORCE,
    );

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
  });

  it('field=<Kostenart>: der Bericht traegt die unsupportedField-Diagnose', () => {
    const report = evaluate(
      primaryCatalogueCondition('atLeast', CATALOGUE_A_ID, { field: POINTS_ID }),
      ROSTER_ROOT_FORCE,
    );

    expect(unsupportedFieldOf(report).length).toBeGreaterThan(0);
  });

  it('KONTROLLE: dieselbe Bedingung mit field="selections" feuert sehr wohl — und ohne diese Diagnose', () => {
    // Damit die vier Erwartungen oben nicht daran haengen, dass der Modifikator
    // aus einem anderen Grund ausbleibt.
    const report = evaluate(primaryCatalogueCondition('atLeast', CATALOGUE_A_ID), ROSTER_ROOT_FORCE);

    const violations = violationsOf(report, MAX_ALPHA_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: VIOLATING_POINTS, bound: UNIT_POINTS });
    expect(unsupportedFieldOf(report)).toEqual([]);
  });
});

// ── Dieselbe Zeile am Query-Primitiv: Rueckgabewert und Diagnose direkt ──────

describe('anderes Feld als SELECTION_COUNT am Query-Primitiv', () => {
  const MINIMAL_CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="${CATALOGUE_A_ID}" name="Army A">
      <forceEntries><forceEntry id="${FORCE_ROOT_ID}" name="Root Force"/></forceEntries>
      <selectionEntries><selectionEntry id="${ALPHA_ID}" name="Alpha" type="unit"/></selectionEntries>
    </catalogue>`;

  /** Der Knoten einer Definition im Auswertungsbaum (der erste reale Treffer). */
  function findNode(node, defId) {
    if (node.def !== null && node.def !== undefined && node.def.id === defId && node.instance !== null) {
      return node;
    }
    for (const child of node.children ?? []) {
      const found = findNode(child, defId);
      if (found !== null) return found;
    }
    return null;
  }

  /**
   * Ein Query-Kontext am Alpha-Knoten **mit** gefuelltem Herkunftsindex: das
   * umschliessende Kontingent ist auffindbar, die Antwort haengt also allein am
   * Feld.
   */
  function contextAtAlpha() {
    const resolved = resolveCatalogue(parseCatalogue(MINIMAL_CATALOGUE));
    const { root } = buildEvalTree(resolved, ROSTER_ROOT_FORCE);
    const index = buildIndex(root, createBaseEffectiveState(root));
    const diagnostics = [];
    const ctx = createQueryContext({
      node: findNode(root, ALPHA_ID),
      root,
      index,
      categoryIds: resolved.categoryIds,
      diagnostics,
      primaryCatalogueByForceDefId: new Map([[FORCE_ROOT_ID, CATALOGUE_A_ID]]),
    });
    return { ctx, diagnostics };
  }

  it('FORCE_COUNT: liefert 0 und meldet unsupportedField — nicht 1, obwohl die Katalog-Id passt', () => {
    const { ctx, diagnostics } = contextAtAlpha();

    const result = query(ctx, FORCE_COUNT, PRIMARY_CATALOGUE, CATALOGUE_A_ID, { shared: true });

    expect(result).toBe(0);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unsupportedField', field: FORCE_COUNT }),
    );
  });

  it('COST_SUM: liefert 0 und meldet unsupportedField', () => {
    const { ctx, diagnostics } = contextAtAlpha();
    const field = costSumField(POINTS_ID);

    const result = query(ctx, field, PRIMARY_CATALOGUE, CATALOGUE_A_ID, { shared: true });

    expect(result).toBe(0);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unsupportedField', field }),
    );
  });

  it('KONTROLLE: SELECTION_COUNT im selben Kontext liefert 1 und meldet nichts', () => {
    const { ctx, diagnostics } = contextAtAlpha();

    const result = query(ctx, { kind: 'selectionCount' }, PRIMARY_CATALOGUE, CATALOGUE_A_ID, { shared: true });

    expect(result).toBe(1);
    expect(diagnostics).toEqual([]);
  });
});

// ── Herkunftsindex: Wurzel- UND Unter-Kontingente ───────────────────────────

describe('Herkunftsindex: auch ein Unter-Kontingent findet sein Armeebuch', () => {
  // `forceRoot` zeigt auf das **innerste** umschliessende Kontingent. Steht die
  // Auswahl in einem geschachtelten Kontingent, ist das nicht die Wurzel — der
  // Index muss die Unter-Kontingente also mitfuehren, sonst faellt die Auswertung
  // fail-closed aus (`unresolvedScope`), obwohl das Armeebuch feststeht.

  it('KONTROLLE: im Wurzel-Kontingent feuert der Modifikator', () => {
    const report = evaluate(primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID), ROSTER_ROOT_FORCE);

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(1);
    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });

  it('eine Ebene tief: der Modifikator feuert genauso', () => {
    const report = evaluate(primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID), ROSTER_SUB_FORCE);

    const violations = violationsOf(report, MAX_ALPHA_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: VIOLATING_POINTS, bound: UNIT_POINTS });
  });

  it('eine Ebene tief: und der Bericht traegt KEINE unresolvedScope-Diagnose', () => {
    const report = evaluate(primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID), ROSTER_SUB_FORCE);

    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });

  it('zwei Ebenen tief: die Erfassung ist rekursiv, nicht eine Ebene weit', () => {
    const report = evaluate(primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID), ROSTER_SUB_SUB_FORCE);

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(1);
    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });

  it('Nicht-Treffer im Unter-Kontingent: 0 ist eine Antwort — kein Modifikator und trotzdem keine Diagnose', () => {
    // Der Unterschied zum fail-closed-Fall liegt genau hier: ohne aufgeloestes
    // Armeebuch bliebe der Modifikator ebenfalls aus, aber mit `unresolvedScope`.
    const report = evaluate(primaryCatalogueCondition('instanceOf', CATALOGUE_B_ID), ROSTER_SUB_FORCE);

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });

  it('notInstanceOf im Unter-Kontingent: die Umkehrung feuert beim fremden Armeebuch', () => {
    const report = evaluate(primaryCatalogueCondition('notInstanceOf', CATALOGUE_B_ID), ROSTER_SUB_FORCE);

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(1);
    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });
});
