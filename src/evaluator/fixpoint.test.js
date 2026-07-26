import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset } from './evaluator.js';

/**
 * Wertet einen einzelnen synthetischen Katalog aus. Die Fassade nimmt seit
 * ADR-0032 einen Datensatz `{ gameSystem, catalogues }`; ein Einzelkatalog ohne
 * Spielsystem ist `{ catalogues: [xml] }`.
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset({ catalogues: [catalogXml] }, roster);
}
import { DiagnosticKind } from './model.js';
import { prepareDataset } from './datasetPreparation.js';
import { buildEvalTree } from './evalTree.js';
import { evaluateToFixpoint, MAX_FIXPOINT_ROUNDS } from './fixpoint.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Faehrt die Fixpunktschleife direkt an einem Einzelkatalog. Ihr **Ausgang**
 * (Rundenzahl, Konvergenz) steht nur an ihrem Rueckgabewert: aus dem Bericht ist
 * er nicht rekonstruierbar, weil dort nur der Endzustand ankommt.
 */
function runFixpoint(catalogXml, rosterInstance) {
  const { resolved } = prepareDataset({ catalogues: [catalogXml] });
  const { root } = buildEvalTree(resolved, rosterInstance);
  return evaluateToFixpoint(root, resolved.categoryIds);
}

// ── Eigene, minimale Fixtures (ADR-0030: eigenes Datenmodell, eigene Fixtures) ──
// Diese Scheibe (Issue 05) legt die Fixpunktschleife um die Modifikator-Anwendung:
// Iteration bis zur Konvergenz, harte Rundenobergrenze, Nichtkonvergenz-Diagnose.

const WARRIOR_ID = 'entry-warrior';
const ALPHA_ID = 'entry-alpha';
const BETA_ID = 'entry-beta';
const ELITE_CAT_ID = 'cat-elite';
const CAT_A_ID = 'cat-a';
const CAT_B_ID = 'cat-b';
const POINTS_ID = 'cost-points';

/** Baut ein Roster aus den gegebenen Auswahl-Instanzen. */
function roster(forces) {
  return { forces };
}

/** Eine Auswahl-Instanz mit Anzahl und ohne Kinder. */
function selection(defId, count) {
  return { defId, count, children: [] };
}

/**
 * True, wenn der Bericht einen der beiden Nichtkonvergenz-Befunde traegt —
 * Oszillation oder erschoepftes Rundenbudget (Issue 75/03: die frueher eine
 * `NO_CONVERGENCE`-Diagnose ist in diese beiden getrennt).
 */
function hasNoConvergence(report) {
  return report.diagnostics.some(
    d => d.kind === DiagnosticKind.OSCILLATION || d.kind === DiagnosticKind.ROUND_BUDGET_EXHAUSTED,
  );
}

/** Der Faehigkeitsdatensatz des Slots mit dieser Definitions-ID (oder `null`). */
function slotByDefId(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.node.def?.id === defId) return capability;
  }
  return null;
}

describe('Konvergenz: Zaehlen haengt von effektiven Werten ab und umgekehrt', () => {
  const MAX_POINTS_ID = 'max-points';
  const BASE_POINTS = 10;
  const CATEGORY_BONUS = 5;
  const MAX_POINTS = 12;
  // Rueckkopplung ueber mehrere Runden:
  //   M1 (unbedingt): nimmt den Warrior in die Elite-Kategorie auf.
  //   M2: +5 Punkte, sobald armeeweit mindestens eine Elite-Selektion gezaehlt wird.
  // Runde 1 aendert nur die Kategorie (Elite noch nicht gezaehlt), Runde 2 sieht die
  // Elite-Zaehlung und hebt die Kosten, Runde 3 bestaetigt den Stand → Fixpunkt.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-converge" name="Converging Catalogue">
      <categoryEntries>
        <categoryEntry id="${ELITE_CAT_ID}" name="Elite"/>
      </categoryEntries>
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_ID}" value="${BASE_POINTS}"/>
          </costs>
          <constraints>
            <constraint id="${MAX_POINTS_ID}" type="max" value="${MAX_POINTS}" field="${POINTS_ID}" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="add" field="category" value="${ELITE_CAT_ID}"/>
            <modifier type="increment" field="${POINTS_ID}" value="${CATEGORY_BONUS}">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${ELITE_CAT_ID}" value="1"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('konvergiert zu stabilen effektiven Werten; der Bericht spiegelt den konvergierten Stand', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1)]));

    // Konvergierter Stand: Elite-Zaehlung greift → 10 + 5 = 15 > 12 → Verletzung.
    expect(hasNoConvergence(report)).toBe(false);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({
      actual: BASE_POINTS + CATEGORY_BONUS,
      bound: MAX_POINTS,
    });
  });

  it('meldet den Ausgang: konvergiert, mit der Zahl der tatsaechlich durchlaufenen Runden', () => {
    const outcome = runFixpoint(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1)]));

    expect(outcome.converged).toBe(true);
    // Die Rueckkopplung braucht mehr als eine Runde, bleibt aber unter der Obergrenze.
    expect(outcome.rounds).toBeGreaterThan(1);
    expect(outcome.rounds).toBeLessThan(MAX_FIXPOINT_ROUNDS);
  });
});

describe('Jede Runde wendet Modifikatoren auf eine frische Basiskopie an', () => {
  const MAX_POINTS_ID = 'max-points';
  const BASE_POINTS = 10;
  const ADD_POINTS = 5;
  const MAX_POINTS = 14;
  // Ein **unbedingter** ADD-Modifikator. Startete eine Runde nicht von der Basis,
  // sondern vom Vorrunden-Stand, wuerde er ueber die Runden kumulieren (15, 20,
  // 25, …) und nie konvergieren. Frische Basiskopie ⇒ jede Runde 10 + 5 = 15.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-fresh-base" name="Fresh Base Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_ID}" value="${BASE_POINTS}"/>
          </costs>
          <constraints>
            <constraint id="${MAX_POINTS_ID}" type="max" value="${MAX_POINTS}" field="${POINTS_ID}" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="increment" field="${POINTS_ID}" value="${ADD_POINTS}"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('kumuliert nicht ueber Runden: der Modifikator wirkt genau einmal (15, nicht 20)', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1)]));

    // Konvergiert (kein Aufsummieren) und der effektive Wert ist die **einmalige**
    // Anwendung 10 + 5 = 15. Kumulierung wuerde stattdessen nie konvergieren.
    expect(hasNoConvergence(report)).toBe(false);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].actual).toBe(BASE_POINTS + ADD_POINTS);
  });
});

describe('Nichtkonvergenz: oszillierende Kataloge werden sichtbar statt still falsch', () => {
  // (a) Zwei-Knoten-Zyklus „Modifikator A aktiviert B, B deaktiviert A":
  //   Beta nimmt sich in cat-b auf, sobald cat-a armeeweit gezaehlt wird;
  //   Alpha verlaesst cat-a, sobald cat-b armeeweit gezaehlt wird. Der Stand
  //   oszilliert und erreicht die Rundenobergrenze nie stabil.
  const OSCILLATING_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-oscillate" name="Oscillating Catalogue">
      <categoryEntries>
        <categoryEntry id="${CAT_A_ID}" name="A"/>
        <categoryEntry id="${CAT_B_ID}" name="B"/>
      </categoryEntries>
      <selectionEntries>
        <selectionEntry id="${ALPHA_ID}" name="Alpha" type="unit">
          <categoryLinks>
            <categoryLink targetId="${CAT_A_ID}"/>
          </categoryLinks>
          <modifiers>
            <modifier type="remove" field="category" value="${CAT_A_ID}">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${CAT_B_ID}" value="1"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${BETA_ID}" name="Beta" type="unit">
          <modifiers>
            <modifier type="add" field="category" value="${CAT_B_ID}">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${CAT_A_ID}" value="1"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('erzeugt eine Nichtkonvergenz-Diagnose und liefert dennoch einen Bericht (kein Absturz/Haenger)', () => {
    const report = evaluate(OSCILLATING_XML, roster([selection(ALPHA_ID, 1), selection(BETA_ID, 1)]));

    expect(hasNoConvergence(report)).toBe(true);
    expect(Array.isArray(report.violations)).toBe(true); // Bericht kommt zustande.
  });

  // (b) Ein-Knoten-Kosten-Oszillator, dessen letzter Stand **beobachtbar** ist:
  //   Kosten werden auf 20 gesetzt, solange die gezaehlte Kostensumme <= 10 ist;
  //   steigt sie auf 20, faellt der Modifikator und die Kosten fallen auf 10
  //   zurueck — und so fort. Der Bericht muss die Ergebnisse der letzten Runde
  //   tragen, nicht scheitern.
  const OSC_BASE_POINTS = 10;
  const OSC_SET_POINTS = 20;
  const OSC_TRIGGER_AT_MOST = 10;
  const OSC_MAX_POINTS = 15;
  const OSC_MAX_ID = 'max-points';
  const COST_OSCILLATOR_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cost-oscillate" name="Cost Oscillator Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_ID}" value="${OSC_BASE_POINTS}"/>
          </costs>
          <constraints>
            <constraint id="${OSC_MAX_ID}" type="max" value="${OSC_MAX_POINTS}" field="${POINTS_ID}" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="set" field="${POINTS_ID}" value="${OSC_SET_POINTS}">
              <conditions>
                <condition type="atMost" field="${POINTS_ID}" scope="roster" childId="${WARRIOR_ID}" value="${OSC_TRIGGER_AT_MOST}"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('liefert die Ergebnisse der letzten Runde neben der Nichtkonvergenz-Diagnose', () => {
    const report = evaluate(COST_OSCILLATOR_XML, roster([selection(WARRIOR_ID, 1)]));

    // Nicht konvergiert, aber der Bericht traegt den Constraint-Stand der letzten
    // Runde (Kosten auf 20 gesetzt) → 20 > 15 → Verletzung mit Ist-Wert 20.
    expect(hasNoConvergence(report)).toBe(true);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ actual: OSC_SET_POINTS, bound: OSC_MAX_POINTS });
  });

  it('meldet den Ausgang: nicht konvergiert, mit der ausgeschoepften Rundenobergrenze', () => {
    const outcome = runFixpoint(COST_OSCILLATOR_XML, roster([selection(WARRIOR_ID, 1)]));

    expect(outcome.converged).toBe(false);
    expect(outcome.rounds).toBe(MAX_FIXPOINT_ROUNDS);
  });

  it('nennt in der Nichtkonvergenz-Diagnose dieselbe Rundenzahl, die die Schleife meldet', () => {
    const outcome = runFixpoint(COST_OSCILLATOR_XML, roster([selection(WARRIOR_ID, 1)]));
    const oscillation = outcome.diagnostics.find(entry => entry.kind === DiagnosticKind.OSCILLATION);

    expect(oscillation).toMatchObject({ rounds: outcome.rounds });
  });

  it('meldet einen wiederkehrenden Zustand als Oszillation, mit seiner Zykluslaenge', () => {
    const outcome = runFixpoint(COST_OSCILLATOR_XML, roster([selection(WARRIOR_ID, 1)]));

    // 10 → 20 → 10 → …: der Ausgangszustand kehrt in Runde 2 wieder.
    expect(outcome.diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.OSCILLATION, cycleLength: 2 }),
    );
    // Der Befund schliesst den anderen aus: es ist kein blosses Rundenbudget-Problem.
    expect(outcome.diagnostics.some(entry => entry.kind === DiagnosticKind.ROUND_BUDGET_EXHAUSTED)).toBe(false);
  });

  it('markiert den Slot, dessen Wert nicht stabil ist — die Unsicherheit steht am Slot', () => {
    const report = evaluate(COST_OSCILLATOR_XML, roster([selection(WARRIOR_ID, 1)]));

    expect(slotByDefId(report, WARRIOR_ID).isValueUnstable).toBe(true);
  });
});

describe('Nichtkonvergenz: erschoepftes Rundenbudget ist ein anderer Befund als Oszillation', () => {
  // Eine **streng wachsende** Kette: jede Runde schaltet die naechste Stufe frei, sodass
  // in fuenf Runden kein Zustand wiederkehrt. Fachlich etwas anderes als ein Schwingen —
  // dieser Katalog koennte mit mehr Runden konvergieren.
  const BUDGET_BASE_POINTS = 10;
  const STEP_POINTS = 10;
  const THRESHOLDS = [10, 20, 30, 40, 50];
  const STEP_MODIFIERS = THRESHOLDS.map(
    threshold => `
          <modifier type="increment" field="${POINTS_ID}" value="${STEP_POINTS}">
            <conditions>
              <condition type="atLeast" field="${POINTS_ID}" scope="roster" childId="${WARRIOR_ID}" value="${threshold}"/>
            </conditions>
          </modifier>`,
  ).join('');
  const GROWING_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-growing" name="Growing Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_ID}" value="${BUDGET_BASE_POINTS}"/>
          </costs>
          <modifiers>${STEP_MODIFIERS}
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('meldet das erschoepfte Rundenbudget statt einer Oszillation, wenn kein Zustand wiederkehrt', () => {
    const outcome = runFixpoint(GROWING_XML, roster([selection(WARRIOR_ID, 1)]));

    expect(outcome.converged).toBe(false);
    expect(outcome.rounds).toBe(MAX_FIXPOINT_ROUNDS);
    expect(outcome.diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.ROUND_BUDGET_EXHAUSTED, rounds: MAX_FIXPOINT_ROUNDS }),
    );
    expect(outcome.diagnostics.some(entry => entry.kind === DiagnosticKind.OSCILLATION)).toBe(false);
  });
});

describe('Nach-Durchlauf: die synthetischen Anker bekommen ihre Werte nach der Konvergenz', () => {
  // Die Schleife iteriert nur ueber die realen Knoten; der Anker fuer den fehlenden
  // Pflichteintrag wird **einmal danach** ausgewertet — gegen den finalen Zaehlindex.
  // Der Bannertraeger fehlt, seine Grenzen haengen deshalb an einem Phantom:
  //   * sein Hoechstmass wird bedingt angehoben (1 → 4),
  //   * er wird bedingt versteckt,
  //   * sein Anzeigename wird bedingt ergaenzt.
  // Die Bedingung haengt an der Elite-Kategorie, die der Krieger **selbst erst per
  // Modifikator** erhaelt: der Anker sieht damit nachweislich den konvergierten
  // Bestand und nicht den Ausgangszustand.
  const BANNER_ID = 'entry-banner';
  const MIN_BANNER_ID = 'min-banner';
  const MAX_BANNER_ID = 'max-banner';
  const BASE_MAX_BANNERS = 1;
  const MAX_BANNER_BONUS = 3;
  const BANNER_NAME = 'Banner';
  const BANNER_NAME_SUFFIX = ' (Elite)';
  const ELITE_CONDITION = `
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${ELITE_CAT_ID}" value="1"/>
              </conditions>`;
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-anchor-post-pass" name="Anchor Post Pass Catalogue">
      <categoryEntries>
        <categoryEntry id="${ELITE_CAT_ID}" name="Elite"/>
      </categoryEntries>
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <modifiers>
            <modifier type="add" field="category" value="${ELITE_CAT_ID}"/>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${BANNER_ID}" name="${BANNER_NAME}" type="upgrade">
          <constraints>
            <constraint id="${MIN_BANNER_ID}" type="min" value="1" field="selections" scope="roster"/>
            <constraint id="${MAX_BANNER_ID}" type="max" value="${BASE_MAX_BANNERS}" field="selections" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="increment" field="${MAX_BANNER_ID}" value="${MAX_BANNER_BONUS}">${ELITE_CONDITION}
            </modifier>
            <modifier type="set" field="hidden" value="true">${ELITE_CONDITION}
            </modifier>
            <modifier type="append" field="name" value="${BANNER_NAME_SUFFIX}">${ELITE_CONDITION}
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('wertet Hoechstmass, Sichtbarkeit und Anzeigenamen des Ankers modifikator-bewusst aus', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1)]));

    expect(slotByDefId(report, BANNER_ID)).toMatchObject({
      effectiveMax: BASE_MAX_BANNERS + MAX_BANNER_BONUS,
      isHidden: true,
      name: `${BANNER_NAME}${BANNER_NAME_SUFFIX}`,
      isMandatoryUnmet: true,
    });
  });

  it('laesst den Anker aus der Zaehlung heraus: er hebt seine eigene MIN-Grenze nicht auf', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1)]));

    // Zaehlte der Anker mit, laege der Ist-Wert bei 1 und die Pflicht waere erfuellt.
    expect(report.violations).toContainEqual(
      expect.objectContaining({ limitId: MIN_BANNER_ID, actual: 0, bound: 1 }),
    );
  });

  it('markiert bei konvergierenden Daten keinen einzigen Slot als instabil', () => {
    const report = evaluate(CATALOGUE_XML, roster([selection(WARRIOR_ID, 1)]));

    expect([...report.capabilities.values()].every(capability => capability.isValueUnstable === false)).toBe(true);
  });
});
