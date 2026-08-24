/**
 * Issue 0086, Kriterium 2: der Bezugsrahmen `ancestor`.
 *
 * Die Regel in einem Satz (Issue 0086, Decisions „Semantik `ancestor`"): kein
 * Zaehlrahmen, sondern eine **Mitgliedschaftspruefung ueber die gesamte
 * strikte Vorfahrenkette** (reale Knoten, Kontingente eingeschlossen, die
 * definitionslose Wurzel ausgenommen — der Knoten selbst zaehlt NICHT). Ein
 * Vorfahre passt, wenn die Ziel-Id unter den Zielen liegt, unter denen er auch
 * im Zaehlindex zaehlbar waere: Definitions-Id, Link-Ziel-Id, **effektive**
 * Kategorien, roher Typ. Die Flags (`shared`, `includeChild…`) sind ohne
 * Wirkung; nur `field="selections"` ist gueltig, anderes Feld →
 * `unsupportedField` (wie `primary-catalogue`).
 *
 * Beleg aus den Fixtures (Issue 0086, Decisions): alle 10 Vorkommen sind
 * `instanceOf`-Conditions, und alle 10 `childId`s benennen **Kategorie-Ids** —
 * die Pruefung braucht deshalb die effektiven Kategorien der Vorfahren.
 *
 * Beobachtet wird durch die Fassade (wie `compare.instanceOf.test.js`): haelt
 * die Bedingung, feuert der gegatete Kosten-Modifikator und die exakt auf den
 * Basiswert gelegte Kostengrenze wird verletzt. Alle Erwartungen sind aus
 * Intent und Decisions abgeleitet, nicht aus dem heutigen Verhalten von
 * `query.js`.
 *
 * Instanzbaum (die Bedingung haengt am Banner, zuunterst):
 *
 *   root
 *   └─ host (Kontingent)
 *      └─ regiment       [type="unit", categoryLink → Undead]
 *         └─ champion    [type="model"]
 *            └─ banner   [upgrade; Modifikator auf die Bedingung gegatet]
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../domain/evaluator/evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Das Schluesselwort, wie es in den Katalogdaten steht (10 Fixture-Vorkommen). */
const ANCESTOR_SCOPE = 'ancestor';

const CAT_UNDEAD = 'cat-undead';
const CAT_MOUNTED = 'cat-mounted';
const HOST_FORCE_ID = 'force-host';
const REGIMENT_ID = 'entry-regiment';
const CHAMPION_ID = 'entry-champion';
const BANNER_ID = 'entry-banner';
const POINTS_ID = 'cost-points';
const MAX_BANNER_POINTS_ID = 'max-banner-points';

const BANNER_BASE_POINTS = 10;
const SURCHARGE = 5;
// Die Kostengrenze liegt exakt auf dem Basiswert: nur ein feuernder
// Modifikator verletzt sie (Ist 15 > Grenze 10).
const VIOLATING_POINTS = BANNER_BASE_POINTS + SURCHARGE;

/**
 * Der Katalog: ein Regiment (Kategorie Undead per Basis-`categoryLink`) mit
 * Champion und Banner; der Banner-Kosten-Modifikator ist auf `conditionXml`
 * gegatet. `regimentModifiersXml` erlaubt, dem Regiment zusaetzlich einen
 * Kategorie-Modifikator zu geben (effektive Kategorien).
 */
function catalogue(conditionXml, { regimentModifiersXml = '' } = {}) {
  return `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-ancestor" name="Ancestor Catalogue">
    <categoryEntries>
      <categoryEntry id="${CAT_UNDEAD}" name="Undead"/>
      <categoryEntry id="${CAT_MOUNTED}" name="Mounted"/>
    </categoryEntries>
    <forceEntries><forceEntry id="${HOST_FORCE_ID}" name="Host"/></forceEntries>
    <selectionEntries>
      <selectionEntry id="${REGIMENT_ID}" name="Regiment" type="unit">
        <categoryLinks><categoryLink targetId="${CAT_UNDEAD}"/></categoryLinks>
        ${regimentModifiersXml}
        <selectionEntries>
          <selectionEntry id="${CHAMPION_ID}" name="Champion" type="model">
            <selectionEntries>
              <selectionEntry id="${BANNER_ID}" name="Banner" type="upgrade">
                <costs><cost name="Points" typeId="${POINTS_ID}" value="${BANNER_BASE_POINTS}"/></costs>
                <constraints>
                  <constraint id="${MAX_BANNER_POINTS_ID}" type="max" value="${BANNER_BASE_POINTS}" field="${POINTS_ID}" scope="roster"/>
                </constraints>
                <modifiers>
                  <modifier type="increment" field="${POINTS_ID}" value="${SURCHARGE}">
                    <conditions>${conditionXml}</conditions>
                  </modifier>
                </modifiers>
              </selectionEntry>
            </selectionEntries>
          </selectionEntry>
        </selectionEntries>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;
}

/**
 * Die Bedingung in der Fixture-Form (`value="1"`, `shared="true"`,
 * `includeChildSelections="true"` — wie alle 10 realen Vorkommen).
 */
function ancestorCondition(type, targetId, { shared = true, field = 'selections' } = {}) {
  return `<condition type="${type}" value="1" field="${field}" scope="${ANCESTOR_SCOPE}" childId="${targetId}" shared="${shared}" includeChildSelections="true"/>`;
}

/** Roster: host → regiment → champion → banner. */
const ROSTER = {
  forces: [{
    defId: HOST_FORCE_ID, count: 1, children: [{
      defId: REGIMENT_ID, count: 1, children: [{
        defId: CHAMPION_ID, count: 1, children: [
          { defId: BANNER_ID, count: 1, children: [] },
        ],
      }],
    }],
  }],
};

/** Wertet den Katalog mit der gegebenen Bedingung gegen das Roster aus. */
function evaluate(conditionXml, options) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogue(conditionXml, options)] }), ROSTER);
}

/** Die Verletzungen des Berichts zur Banner-Grenze. */
function bannerViolations(report) {
  return report.violations.filter(message => message.limitId === MAX_BANNER_POINTS_ID);
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

// ── instanceOf gegen eine Kategorie: die effektiven Kategorien der Vorfahren ──

describe('instanceOf mit Kategorie-Ziel: ein Vorfahre traegt die Kategorie effektiv', () => {
  it('haelt, wenn ein Vorfahre die Kategorie per Basis-categoryLink traegt (Modifikator feuert)', () => {
    const report = evaluate(ancestorCondition('instanceOf', CAT_UNDEAD));

    const violations = bannerViolations(report);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: VIOLATING_POINTS, bound: BANNER_BASE_POINTS });
  });

  it('haelt nicht, wenn kein Vorfahre die Kategorie traegt (Modifikator bleibt aus)', () => {
    const report = evaluate(ancestorCondition('instanceOf', CAT_MOUNTED));

    expect(bannerViolations(report)).toHaveLength(0);
  });

  it('liest die EFFEKTIVEN Kategorien: eine per Kategorie-Modifikator hinzugefuegte Kategorie trifft', () => {
    // Das Regiment traegt Mounted nicht als Basis-Link, sondern erst durch
    // einen (unbedingten) `add category`-Modifikator — die Vorfahrenpruefung
    // muss die effektiven Kategorien lesen (Issue 0086, Decisions: alle 10
    // realen childIds sind Kategorie-Ids).
    const report = evaluate(ancestorCondition('instanceOf', CAT_MOUNTED), {
      regimentModifiersXml: `<modifiers><modifier type="add" value="${CAT_MOUNTED}" field="category"/></modifiers>`,
    });

    const violations = bannerViolations(report);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: VIOLATING_POINTS, bound: BANNER_BASE_POINTS });
  });

  it('Kriterium 3 im Kleinen: der Bericht traegt keine unresolvedScope-Diagnose fuer diesen Rahmen', () => {
    expect(unresolvedScopeOf(evaluate(ancestorCondition('instanceOf', CAT_UNDEAD)), ANCESTOR_SCOPE)).toEqual([]);
    expect(unresolvedScopeOf(evaluate(ancestorCondition('instanceOf', CAT_MOUNTED)), ANCESTOR_SCOPE)).toEqual([]);
  });
});

// ── notInstanceOf: dieselbe Frage, invers ────────────────────────────────────

describe('notInstanceOf: haelt genau dann, wenn KEIN Vorfahre auf das Ziel aufloest', () => {
  it('haelt NICHT, wenn ein Vorfahre die Kategorie traegt — der heutige Zaehlwert 0 wirkte hier fail-open', () => {
    const report = evaluate(ancestorCondition('notInstanceOf', CAT_UNDEAD));

    expect(bannerViolations(report)).toHaveLength(0);
  });

  it('haelt, wenn kein Vorfahre die Kategorie traegt (Modifikator feuert)', () => {
    const report = evaluate(ancestorCondition('notInstanceOf', CAT_MOUNTED));

    const violations = bannerViolations(report);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: VIOLATING_POINTS, bound: BANNER_BASE_POINTS });
  });
});

// ── Ziel = Definitions-Id eines Vorfahren ────────────────────────────────────

describe('instanceOf mit Eintrags-Ziel: die Definitions-Id eines Vorfahren trifft', () => {
  it('der direkte Elternknoten (champion) trifft', () => {
    const report = evaluate(ancestorCondition('instanceOf', CHAMPION_ID));

    expect(bannerViolations(report)).toHaveLength(1);
  });

  it('auch ein weiter entfernter Vorfahre (regiment) trifft — die GESAMTE Kette wird geprueft', () => {
    const report = evaluate(ancestorCondition('instanceOf', REGIMENT_ID));

    expect(bannerViolations(report)).toHaveLength(1);
  });

  it('Kontingente sind Teil der Kette: die forceEntry-Id des umschliessenden Kontingents trifft', () => {
    // Decisions: „reale Knoten, Kontingente eingeschlossen".
    const report = evaluate(ancestorCondition('instanceOf', HOST_FORCE_ID));

    expect(bannerViolations(report)).toHaveLength(1);
  });

  it('der Knoten selbst zaehlt NICHT als sein eigener Vorfahre — die eigene Id trifft nicht', () => {
    // Strikte Vorfahrenkette (Decisions): banner steht nicht in seiner
    // eigenen Kette; kein Vorfahre heisst banner → die Bedingung haelt nicht.
    const report = evaluate(ancestorCondition('instanceOf', BANNER_ID));

    expect(bannerViolations(report)).toHaveLength(0);
  });
});

// ── Die Flags sind ohne Wirkung ──────────────────────────────────────────────

describe('Flags ohne Wirkung: eine Vorfahrenkette wird durch eine Instanz nicht enger', () => {
  it('shared="false" aendert nichts am Treffer', () => {
    const report = evaluate(ancestorCondition('instanceOf', CAT_UNDEAD, { shared: false }));

    const violations = bannerViolations(report);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: VIOLATING_POINTS, bound: BANNER_BASE_POINTS });
  });
});

// ── Nur field="selections" ist gueltig ───────────────────────────────────────

describe('anderes Feld als selections: der unsupportedField-Pfad (wie primary-catalogue)', () => {
  it('field=<Kostenart>: der Modifikator feuert NICHT, obwohl der Vorfahre die Kategorie traegt', () => {
    const report = evaluate(ancestorCondition('instanceOf', CAT_UNDEAD, { field: POINTS_ID }));

    expect(bannerViolations(report)).toHaveLength(0);
  });

  it('field=<Kostenart>: der Bericht traegt die unsupportedField-Diagnose', () => {
    const report = evaluate(ancestorCondition('instanceOf', CAT_UNDEAD, { field: POINTS_ID }));

    expect(unsupportedFieldOf(report).length).toBeGreaterThan(0);
  });
});
