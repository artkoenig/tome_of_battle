/**
 * Issue 077, Plan-Punkt 6: die **Aufrufer** der Query-Kontexte reichen den
 * Herkunftsindex durch — hier der **Constraint**-Pfad (`constraints.js`).
 *
 * `query.primaryCatalogueScope.test.js` und
 * `query.primaryCatalogueContract.test.js` beobachten den Bezugsrahmen
 * ausschliesslich an einer `condition` (Modifikator-Pfad) und am Query-Primitiv
 * selbst. Eine **Grenze** mit `scope="primary-catalogue"` kommt in keinem der
 * beiden vor — der Constraint-Pfad zum Herkunftsindex ist damit von keiner
 * Erwartung gehalten.
 *
 * Dass der Fall in den echten Katalogen nicht vorkommt (alle 27 Vorkommen stehen
 * an einer `condition`, keines an einem `constraint` oder `repeat` — Issue 077,
 * Log), macht ihn nicht ungueltig: das Query-Primitiv ist laut seinem eigenen
 * Kopfkommentar „die alleinige Zaehlstelle der Engine", und „Grenze, Bedingung
 * und Wiederholung rufen ausschliesslich diese Funktion". Was der Rahmen einer
 * Bedingung antwortet, muss er einer Grenze genauso antworten. Der Fall braucht
 * deshalb einen **synthetischen** Katalog.
 *
 * Der Antwortvertrag ist derselbe (Issue 077, Abschnitt „Plan"); an einer Grenze
 * trifft er zwei getrennte Stellen:
 *
 * | Stelle in `constraints.js`        | Query                                        |
 * | ---                               | ---                                          |
 * | Nenner einer Prozentgrenze        | `targetId === null` → **1** („genau ein Katalog") |
 * | Ist-Wert der Grenze               | `targetId` = Id des Ankers → **0** (ein Eintrag ist kein Katalog) |
 *
 * Beobachtet wird durch die Fassade hindurch: die abgeleitete Schranke einer
 * Prozentgrenze ist im Verletzungsbericht unmittelbar sichtbar (`bound`), und
 * ein unaufgeloester Rahmen faellt fail-closed auf `unresolvedScope` samt
 * `zeroDenominator` zurueck — beides Aussagen des Berichts, keine Interna.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Das Schluesselwort, so wie es in den Katalogdaten steht. */
const PRIMARY_CATALOGUE = 'primary-catalogue';

const GAME_SYSTEM_ID = 'gs-0000-0000-0000';
const POINTS_ID = 'cost-points';

const CATALOGUE_A_ID = 'cat-army-a';
const CATALOGUE_B_ID = 'cat-army-b';
const FORCE_A_ID = 'force-of-a';
const FORCE_B_ID = 'force-of-b';
const ALPHA_ID = 'entry-alpha';
const LIMIT_ID = 'limit-under-test';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
  </gameSystem>`;

/**
 * Armeebuch A: sein Kontingent und die eine Einheit, die die Grenze unter Test
 * traegt.
 */
function catalogueA(constraintXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="${CATALOGUE_A_ID}" name="Army A" gameSystemId="${GAME_SYSTEM_ID}" library="false">
      <forceEntries><forceEntry id="${FORCE_A_ID}" name="Force of A"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${ALPHA_ID}" name="Alpha" type="unit">
          <costs><cost name="Points" typeId="${POINTS_ID}" value="1"/></costs>
          <constraints>${constraintXml}</constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Ein zweites Armeebuch im selben Datensatz — es traegt hier nur sein Kontingent. */
const CATALOGUE_B_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${CATALOGUE_B_ID}" name="Army B" gameSystemId="${GAME_SYSTEM_ID}" library="false">
    <forceEntries><forceEntry id="${FORCE_B_ID}" name="Force of B"/></forceEntries>
  </catalogue>`;

/**
 * Die Grenze unter Test: eine **echte** `<constraint>`, nicht eine `condition`.
 * `scope="primary-catalogue"` steht damit an der Stelle, an der `constraints.js`
 * seinen eigenen Query-Kontext baut.
 */
function primaryCatalogueConstraint(kind, value, { percent = false } = {}) {
  const percentAttr = percent ? ' percentValue="true"' : '';
  return `<constraint id="${LIMIT_ID}" type="${kind}" value="${value}" field="selections" scope="${PRIMARY_CATALOGUE}"${percentAttr}/>`;
}

/** Wertet den Zwei-Armeebuch-Datensatz mit der gegebenen Grenze aus. */
function evaluate(constraintXml, roster) {
  return evaluateDataset(
    prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogueA(constraintXml), CATALOGUE_B_XML] }),
    roster,
  );
}

/** Ein Roster mit `count` Alpha-Einheiten im Kontingent aus Armeebuch A. */
function rosterWithAlphas(count) {
  const children = count === 0 ? [] : [{ defId: ALPHA_ID, count, children: [] }];
  return { forces: [{ defId: FORCE_A_ID, count: 1, children }] };
}

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

/** Die Null-Nenner-Diagnosen des Berichts. */
function zeroDenominatorOf(report) {
  return (report.diagnostics ?? []).filter(diagnostic => diagnostic.kind === 'zeroDenominator');
}

// ── Der Nenner einer Prozentgrenze: „der Rahmen hat genau EINEN Katalog" ─────

describe('Prozentgrenze mit scope="primary-catalogue": der Nenner ist 1', () => {
  // Die abgeleitete Schranke ist `roundHalfUp(Nenner * Prozentsatz / 100)`. Bei
  // Nenner 1 liest man den Nenner also direkt an `bound` ab — 100 % ergibt 1,
  // 200 % ergibt 2. Waere der Rahmen unaufgeloest (Nenner 0), waere die Grenze
  // suspendiert und es gaebe ueberhaupt keine Verletzung.

  it('min 100 %: die Schranke ist 1 — die Grenze ist verletzt und wird gemeldet', () => {
    const report = evaluate(primaryCatalogueConstraint('min', 100, { percent: true }), rosterWithAlphas(2));

    const violations = violationsOf(report, LIMIT_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: 0, bound: 1 });
  });

  it('min 200 %: dieselbe Grenze bei doppeltem Prozentsatz ergibt die Schranke 2', () => {
    // Zwei Prozentsaetze gegen dieselbe Lage: nur ein Nenner von genau 1 erklaert
    // beide Schranken (1 und 2). Ein Nenner 2 ergaebe 2 und 4.
    const report = evaluate(primaryCatalogueConstraint('min', 200, { percent: true }), rosterWithAlphas(2));

    const violations = violationsOf(report, LIMIT_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: 0, bound: 2 });
  });

  it('min 100 %: der Bericht traegt weder unresolvedScope noch zeroDenominator', () => {
    const report = evaluate(primaryCatalogueConstraint('min', 100, { percent: true }), rosterWithAlphas(2));

    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
    expect(zeroDenominatorOf(report)).toEqual([]);
  });

  it('max 50 %: die Grenze ist erfuellt — keine Verletzung UND keine Diagnose', () => {
    // Die Lage aus der Review: `type="max" value="50" percentValue="true"
    // field="selections" scope="primary-catalogue"`, dazu zwei Auswahlen.
    // Nenner 1 → Schranke roundHalfUp(0,5) = 1; Ist 0 ≤ 1, die Grenze haelt.
    // Ohne aufgeloesten Rahmen waere der Nenner 0 und der Bericht truege
    // `unresolvedScope` samt `zeroDenominator`.
    const report = evaluate(primaryCatalogueConstraint('max', 50, { percent: true }), rosterWithAlphas(2));

    expect(violationsOf(report, LIMIT_ID)).toEqual([]);
    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
    expect(zeroDenominatorOf(report)).toEqual([]);
  });
});

// ── Der Nenner haengt am Rahmen, nicht am Bestand ────────────────────────────

describe('Der Nenner bleibt 1, wie viele Auswahlen auch im Kontingent stehen', () => {
  // Die Wiederholung als Grenzfall: ein Zaehlrahmen waechst mit dem Bestand,
  // dieser Rahmen nicht — er zaehlt Kataloge, und es ist genau einer.
  const CONSTRAINT = primaryCatalogueConstraint('min', 200, { percent: true });

  it('eine Auswahl: Schranke 2', () => {
    const violations = violationsOf(evaluate(CONSTRAINT, rosterWithAlphas(1)), LIMIT_ID);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ bound: 2 });
  });

  it('fuenf Auswahlen: unveraendert Schranke 2', () => {
    const violations = violationsOf(evaluate(CONSTRAINT, rosterWithAlphas(5)), LIMIT_ID);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ bound: 2 });
  });

  it('gar keine Auswahl: der leere Fall hinterlaesst keine Diagnose', () => {
    // Ohne gewaehlte Alpha bleibt nur der Angebots-Anker — er wird voll
    // ausgewertet, meldet aber nie. Auch dort muss der Rahmen aufloesen.
    const report = evaluate(CONSTRAINT, rosterWithAlphas(0));

    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
    expect(zeroDenominatorOf(report)).toEqual([]);
  });
});

// ── Der Ist-Wert der Grenze: die zweite Query-Stelle in constraints.js ───────

describe('Nicht-prozentuale Grenze: auch der Ist-Wert loest den Rahmen auf', () => {
  // Ohne Prozentsatz gibt es keinen Nenner — die einzige Query ist die des
  // Ist-Werts. Sie fragt nach der Anker-Id (einem Eintrag), die nie eine
  // Katalog-Id ist: die Antwort ist 0, und zwar als **Antwort**, nicht als
  // Fehlschlag.

  it('max 0: die Grenze haelt und der Bericht bleibt ohne unresolvedScope', () => {
    const report = evaluate(primaryCatalogueConstraint('max', 0), rosterWithAlphas(2));

    expect(violationsOf(report, LIMIT_ID)).toEqual([]);
    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });

  it('min 1: die Grenze ist verletzt (Ist 0) und der Bericht bleibt ohne unresolvedScope', () => {
    const report = evaluate(primaryCatalogueConstraint('min', 1), rosterWithAlphas(2));

    const violations = violationsOf(report, LIMIT_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: 0, bound: 1 });
    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });
});

// ── fail-closed bleibt fail-closed, auch an einer Grenze (PIN) ───────────────

describe('PIN: Kontingent aus der .gst — die Grenze wird fail-closed suspendiert', () => {
  // Der Gegenpol zu allem oben: steht das Kontingent in der `.gst`, gibt es kein
  // Armeebuch, und der Vertrag verlangt 0 **mit** `unresolvedScope` (Issue 077,
  // Decisions). An einer Prozentgrenze heisst das zusaetzlich: Nenner 0 →
  // `zeroDenominator` → die Grenze ist suspendiert und meldet nichts. Genau
  // dieses Diagnosepaar ist die Lage, in die der Constraint-Pfad faellt, wenn er
  // den Herkunftsindex nicht bekommt.
  const FORCE_IN_GAME_SYSTEM_ID = 'force-in-gamesystem';
  const GAME_SYSTEM_WITH_FORCE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
      <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
      <forceEntries><forceEntry id="${FORCE_IN_GAME_SYSTEM_ID}" name="System Force"/></forceEntries>
    </gameSystem>`;

  function evaluateWithSystemForce(constraintXml) {
    return evaluateDataset(
      prepareDataset({
        gameSystem: GAME_SYSTEM_WITH_FORCE_XML,
        catalogues: [catalogueA(constraintXml), CATALOGUE_B_XML],
      }),
      { forces: [{ defId: FORCE_IN_GAME_SYSTEM_ID, count: 1, children: [{ defId: ALPHA_ID, count: 2, children: [] }] }] },
    );
  }

  it('min 100 %: keine Verletzung, dafuer unresolvedScope und zeroDenominator', () => {
    const report = evaluateWithSystemForce(primaryCatalogueConstraint('min', 100, { percent: true }));

    expect(violationsOf(report, LIMIT_ID)).toEqual([]);
    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE).length).toBeGreaterThan(0);
    expect(zeroDenominatorOf(report).length).toBeGreaterThan(0);
  });
});
