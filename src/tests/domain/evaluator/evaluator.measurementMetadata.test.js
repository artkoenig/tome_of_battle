/**
 * Tests des **Opt-in-Messmodus** der Fassade (Issue 0138): die Engine misst ihre
 * eigenen Teilschritte und liefert das Ergebnis als Metadata aus — aber nur, wenn
 * der Aufrufer ausdruecklich `{ measure: true }` mitgibt.
 *
 * Drei Aussagen haelt diese Datei fest:
 *
 * 1. **Der Normalpfad bleibt, was er ist.** Ohne das Flag — und ebenso mit leeren
 *    Optionen oder `{ measure: false }` — liefern `prepareDataset` und `evaluate`
 *    exakt das heutige Ergebnis: dieselben vier Berichtsfelder, kein
 *    `measurement`, ein Griff ohne jede eigene Eigenschaft und keine Zeitmessung.
 *    Die Reinheit des Leitprinzips 1 (`docs/evaluator-architecture.md` §2) gilt
 *    fuer jeden bestehenden Aufrufer unveraendert (Kriterium 4).
 * 2. **Mit dem Flag kommt genau EIN Feld hinzu: `measurement`.** Der Bericht
 *    selbst bleibt identisch — die Messung darf kein Ergebnis veraendern —, und
 *    das eine zusaetzliche Feld traegt die drei Phasen der Auswertung, den
 *    Ausgang der Fixpunktschleife und die Knotenzahlen (Kriterien 2 und 3). Die
 *    Vorbereitung ist ein eigener Fassaden-Aufruf und traegt ihre Dauer am
 *    aufbereiteten Datensatz (Kriterium 1).
 * 3. **Die Gestalt ist die des heutigen Messverfahrens.** Phasennamen
 *    (`MeasuredPhase`), `{ rounds, converged, nonConvergence }` und
 *    `{ total, real, synthetic, byAnchorKind }` sind unveraendert die Groessen,
 *    die `scripts/lib/evaluator-measurement.js` heute selbst zusammenbaut —
 *    damit das Skript vom Nachbauer zum reinen Leser wird (Kriterium 5).
 *
 * Was die Messung **nicht** liefert, ist die Gesamtdauer: das Summieren, der
 * Median, die Wiederholungen und die Schwellen bleiben Mess-Politik des Skripts
 * (Kriterium 8).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import * as facade from '../../../domain/evaluator/evaluator.js';
import { evaluate, describeDataset, prepareDataset } from '../../../domain/evaluator/evaluator.js';
import { AnchorKind, DiagnosticKind } from '../../../domain/evaluator/model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Die vereinbarten Namen ────────────────────────────────────────────────────

/** Das eine Feld, das der Messmodus zusaetzlich anlegt. */
const MEASUREMENT_FIELD = 'measurement';

/** Die vier Felder, aus denen der Bericht der Fassade heute besteht. */
const TODAYS_REPORT_FIELDS = ['capabilities', 'costTotals', 'diagnostics', 'violations'];

/** Derselbe Bericht plus das Metadata-Feld. */
const MEASURED_REPORT_FIELDS = [...TODAYS_REPORT_FIELDS, MEASUREMENT_FIELD].sort();

/**
 * Die Phasen, wie `MeasuredPhase` sie benennt — hier als Literale
 * hingeschrieben, damit ein fehlender Re-Export der Fassade *einen* Test
 * scheitern laesst (den darauf gemuenzten) und nicht die ganze Datei.
 */
const PHASE = Object.freeze({
  PREPARATION: 'preparation',
  ITERATED_EVALUATION: 'iteratedEvaluation',
  POST_PASS: 'postPass',
  CONSTRAINTS_AND_REPORT: 'constraintsAndReport',
});

/** Die drei Phasen, die `evaluate` selbst ausfuehrt — in der Reihenfolge der Fassade. */
const EVALUATION_PHASES = [PHASE.ITERATED_EVALUATION, PHASE.POST_PASS, PHASE.CONSTRAINTS_AND_REPORT];

// ── Datensatz und Roster ──────────────────────────────────────────────────────

const GAME_SYSTEM_ID = 'gs-measure-0138';
const POINTS_COST_TYPE_ID = 'cost-points';
const FORCE_ID = 'force-army';
const WARRIOR_ID = 'entry-warrior';
const MAX_WARRIORS_LIMIT_ID = 'limit-max-warriors';
const MAX_WARRIORS = 2;

const GAME_SYSTEM_XML = `<?xml version="1.0"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Measurement System">
    <costTypes><costType id="${POINTS_COST_TYPE_ID}" name="pts" defaultCostLimit="2000"/></costTypes>
    <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0"?>
  <catalogue id="cat-army" name="Army" gameSystemId="${GAME_SYSTEM_ID}" library="false">
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <constraints>
          <constraint id="${MAX_WARRIORS_LIMIT_ID}" type="max" value="${MAX_WARRIORS}" field="selections" scope="roster"/>
        </constraints>
        <costs><cost name="pts" typeId="${POINTS_COST_TYPE_ID}" value="5.0"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const DATASET = { gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] };

/** Der leere Grenzfall: kein Spielsystem, kein Katalog, kein Kontingent. */
const EMPTY_DATASET = { catalogues: [] };
const EMPTY_ROSTER = { forces: [] };

/** Ein Kontingent mit `count` Kriegern — bei `count > MAX_WARRIORS` reisst die Grenze. */
function armyOfWarriors(count) {
  return {
    forces: [{ defId: FORCE_ID, count: 1, children: [{ defId: WARRIOR_ID, count, children: [] }] }],
    costLimits: [{ costTypeId: POINTS_COST_TYPE_ID, value: 100 }],
  };
}

// ── Ein Katalog, dessen Fixpunktschleife oszilliert ───────────────────────────
// Die Einheit fuehrt die Kategorie „Tag" und entfernt sie per Modifikator, sobald
// die Kategorie im Roster gezaehlt wird. Runde fuer Runde kippt die
// Zugehoerigkeit — die zaehlrelevanten Werte kommen nie zur Ruhe.

const OSCILLATION_FORCE_ID = 'force-oscillation';
const OSCILLATION_TAG_ID = 'category-tag';
const OSCILLATION_ENTRY_ID = 'entry-flip';

const OSCILLATING_CATALOGUE_XML = `<?xml version="1.0"?>
  <catalogue id="cat-oscillation" name="Oscillation">
    <categoryEntries><categoryEntry id="${OSCILLATION_TAG_ID}" name="Tag" hidden="false"/></categoryEntries>
    <forceEntries><forceEntry id="${OSCILLATION_FORCE_ID}" name="Army"/></forceEntries>
    <selectionEntries>
      <selectionEntry id="${OSCILLATION_ENTRY_ID}" name="Flip" type="unit">
        <categoryLinks>
          <categoryLink id="cl-tag" name="Tag" targetId="${OSCILLATION_TAG_ID}" primary="true"/>
        </categoryLinks>
        <modifiers>
          <modifier type="remove" field="category" value="${OSCILLATION_TAG_ID}">
            <conditions>
              <condition type="atLeast" value="1" field="selections" scope="roster"
                         childId="${OSCILLATION_TAG_ID}" shared="true" includeChildSelections="true"/>
            </conditions>
          </modifier>
        </modifiers>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const OSCILLATING_DATASET = { catalogues: [OSCILLATING_CATALOGUE_XML] };
const OSCILLATING_ROSTER = {
  forces: [{
    defId: OSCILLATION_FORCE_ID,
    count: 1,
    children: [{ defId: OSCILLATION_ENTRY_ID, count: 1, children: [] }],
  }],
};

// ── Ein Katalog, der das Rundenbudget erschoepft, ohne zu oszillieren ─────────
// Eine Kaskade: jede Stufe schaltet ihre Kategorie zu, sobald die vorige gezaehlt
// wird. Damit entsteht Runde fuer Runde ein **neuer** zaehlrelevanter Zustand —
// kein Fingerabdruck wiederholt sich, es gibt also keine Zykluslaenge. Die
// Schleife laeuft in ihre harte Rundenobergrenze: der zweite Befund der
// Nichtkonvergenz, `roundBudgetExhausted` (`fixpoint.js`).

/** Stufen der Kaskade — mehr als die harte Rundenobergrenze, damit sie sie reisst. */
const CASCADE_LENGTH = 8;
const CASCADE_FORCE_ID = 'force-cascade';
const cascadeCategoryId = step => `cascade-category-${step}`;
const cascadeEntryId = step => `cascade-entry-${step}`;

const CASCADING_CATALOGUE_XML = `<?xml version="1.0"?>
  <catalogue id="cat-cascade" name="Cascade">
    <categoryEntries>
      ${Array.from({ length: CASCADE_LENGTH }, (unused, index) =>
    `<categoryEntry id="${cascadeCategoryId(index + 1)}" name="Stufe ${index + 1}" hidden="false"/>`).join('\n      ')}
    </categoryEntries>
    <forceEntries><forceEntry id="${CASCADE_FORCE_ID}" name="Army"/></forceEntries>
    <selectionEntries>
      ${Array.from({ length: CASCADE_LENGTH }, (unused, index) => {
    const step = index + 1;
    // Die erste Stufe traegt ihre Kategorie von Haus aus; jede weitere bekommt
    // sie erst, wenn die vorige im Roster gezaehlt wird.
    return step === 1
      ? `<selectionEntry id="${cascadeEntryId(step)}" name="Stufe ${step}" type="unit">
        <categoryLinks>
          <categoryLink id="cl-cascade-${step}" name="Stufe ${step}" targetId="${cascadeCategoryId(step)}" primary="true"/>
        </categoryLinks>
      </selectionEntry>`
      : `<selectionEntry id="${cascadeEntryId(step)}" name="Stufe ${step}" type="unit">
        <modifiers>
          <modifier type="add" field="category" value="${cascadeCategoryId(step)}">
            <conditions>
              <condition type="atLeast" value="1" field="selections" scope="roster"
                         childId="${cascadeCategoryId(step - 1)}" shared="true" includeChildSelections="true"/>
            </conditions>
          </modifier>
        </modifiers>
      </selectionEntry>`;
  }).join('\n      ')}
    </selectionEntries>
  </catalogue>`;

const CASCADING_DATASET = { catalogues: [CASCADING_CATALOGUE_XML] };
const CASCADING_ROSTER = {
  forces: [{
    defId: CASCADE_FORCE_ID,
    count: 1,
    children: Array.from({ length: CASCADE_LENGTH }, (unused, index) => ({
      defId: cascadeEntryId(index + 1),
      count: 1,
      children: [],
    })),
  }],
};

// ── Ein Katalog mit abzaehlbaren Slots ────────────────────────────────────────
// Gewaehlt wird ein Krieger in einem Kontingent — zwei **reale** Knoten. Dazu
// kommen zwei synthetische: das Pflicht-Phantom der nicht gewaehlten Handwaffe
// (`min=1`) und der Angebots-Anker des nicht gewaehlten Bogenschuetzen.

const COUNTING_FORCE_ID = 'force-counting';
const COUNTING_WARRIOR_ID = 'entry-counting-warrior';
const COUNTING_WEAPON_ID = 'entry-counting-weapon';
const COUNTING_ARCHER_ID = 'entry-counting-archer';

const COUNTING_CATALOGUE_XML = `<?xml version="1.0"?>
  <catalogue id="cat-counting" name="Counting">
    <forceEntries><forceEntry id="${COUNTING_FORCE_ID}" name="Army"/></forceEntries>
    <selectionEntries>
      <selectionEntry id="${COUNTING_WARRIOR_ID}" name="Warrior" type="unit">
        <selectionEntries>
          <selectionEntry id="${COUNTING_WEAPON_ID}" name="Hand Weapon" type="upgrade">
            <constraints>
              <constraint id="min-hand-weapon" type="min" value="1" field="selections" scope="parent"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </selectionEntry>
      <selectionEntry id="${COUNTING_ARCHER_ID}" name="Archer" type="unit"/>
    </selectionEntries>
  </catalogue>`;

const COUNTING_DATASET = { catalogues: [COUNTING_CATALOGUE_XML] };
const COUNTING_ROSTER = {
  forces: [{
    defId: COUNTING_FORCE_ID,
    count: 1,
    children: [{ defId: COUNTING_WARRIOR_ID, count: 1, children: [] }],
  }],
};

// ── Ein Katalog, der **jede** Ankerart hervorbringt ───────────────────────────
// Damit die Aufschluesselung nach Ankerart nicht bloss aus Nullen besteht: das
// Kontingent fuehrt einen Kategorie-Link (Kategorie-Anker), die gewaehlte Einheit
// eine grenzentragende Auswahlgruppe (Gruppen-Anker) und ein Pflicht-Banner
// (Pflicht-Phantom); Gruppen-Optionen und der nicht gewaehlte Bogenschuetze
// werden angeboten (Angebots-Anker).

const ANCHOR_FORCE_ID = 'force-anchors';
const ANCHOR_CATEGORY_ID = 'category-core';
const ANCHOR_CATEGORY_LINK_ID = 'force-link-core';
const ANCHOR_WARRIOR_ID = 'entry-anchors-warrior';
const ANCHOR_GROUP_ID = 'group-anchors-weapons';
const ANCHOR_BANNER_ID = 'entry-anchors-banner';

const ANCHOR_CATALOGUE_XML = `<?xml version="1.0"?>
  <catalogue id="cat-anchors" name="Anchors">
    <categoryEntries><categoryEntry id="${ANCHOR_CATEGORY_ID}" name="Core" hidden="false"/></categoryEntries>
    <forceEntries>
      <forceEntry id="${ANCHOR_FORCE_ID}" name="Army">
        <categoryLinks>
          <categoryLink id="${ANCHOR_CATEGORY_LINK_ID}" name="Core" targetId="${ANCHOR_CATEGORY_ID}" primary="false">
            <constraints>
              <constraint id="max-core" type="max" value="3" field="selections" scope="force"/>
            </constraints>
          </categoryLink>
        </categoryLinks>
      </forceEntry>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${ANCHOR_WARRIOR_ID}" name="Warrior" type="unit">
        <categoryLinks>
          <categoryLink id="cl-anchors-core" name="Core" targetId="${ANCHOR_CATEGORY_ID}" primary="true"/>
        </categoryLinks>
        <selectionEntryGroups>
          <selectionEntryGroup id="${ANCHOR_GROUP_ID}" name="Weapons">
            <constraints>
              <constraint id="max-anchors-weapons" type="max" value="1" field="selections" scope="parent"/>
            </constraints>
            <selectionEntries>
              <selectionEntry id="entry-anchors-sword" name="Sword" type="upgrade"/>
              <selectionEntry id="entry-anchors-axe" name="Axe" type="upgrade"/>
            </selectionEntries>
          </selectionEntryGroup>
        </selectionEntryGroups>
        <selectionEntries>
          <selectionEntry id="${ANCHOR_BANNER_ID}" name="Banner" type="upgrade">
            <constraints>
              <constraint id="min-anchors-banner" type="min" value="1" field="selections" scope="parent"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </selectionEntry>
      <selectionEntry id="entry-anchors-archer" name="Archer" type="unit"/>
    </selectionEntries>
  </catalogue>`;

const ANCHOR_DATASET = { catalogues: [ANCHOR_CATALOGUE_XML] };
const ANCHOR_ROSTER = {
  forces: [{
    defId: ANCHOR_FORCE_ID,
    count: 1,
    children: [{ defId: ANCHOR_WARRIOR_ID, count: 1, children: [] }],
  }],
};

// ── Helfer ───────────────────────────────────────────────────────────────────

/** Die eigenen, aufzaehlbaren Felder eines Ergebnisses — sortiert und vergleichbar. */
function fieldsOf(result) {
  return Object.keys(result).sort();
}

/** Die Metadata eines gemessenen Ergebnisses — mit klarer Meldung, wenn sie fehlt. */
function measurementOf(result) {
  expect(result[MEASUREMENT_FIELD], 'Das Ergebnis traegt kein `measurement`-Feld.').toBeDefined();
  return result[MEASUREMENT_FIELD];
}

/** Die Metadata eines gemessen aufbereiteten Datensatzes — ebenso mit klarer Meldung. */
function preparationMeasurementOf(prepared) {
  expect(prepared[MEASUREMENT_FIELD], 'Der aufbereitete Datensatz traegt kein `measurement`-Feld.').toBeDefined();
  return prepared[MEASUREMENT_FIELD];
}

/** Zaehlt die Aufrufe der Zeitgeber, solange `run` laeuft. */
function countingClockCalls(run) {
  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  let calls = 0;
  performance.now = function countedPerformanceNow(...args) {
    calls += 1;
    return realPerformanceNow.apply(this, args);
  };
  Date.now = function countedDateNow(...args) {
    calls += 1;
    return realDateNow.apply(this, args);
  };
  try {
    run();
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
  }
  return calls;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 2 (+ 4): das Metadata-Feld der Auswertung
// ─────────────────────────────────────────────────────────────────────────────

describe('evaluate: das Feld `measurement` erscheint nur unter `{ measure: true }`', () => {
  it('legt mit dem Flag genau ein Feld zusaetzlich zum heutigen Bericht an', () => {
    const prepared = prepareDataset(DATASET);
    const roster = armyOfWarriors(MAX_WARRIORS + 1);

    expect(fieldsOf(evaluate(prepared, roster))).toEqual(TODAYS_REPORT_FIELDS);
    expect(fieldsOf(evaluate(prepared, roster, { measure: true }))).toEqual(MEASURED_REPORT_FIELDS);
  });

  it('misst auch den leeren Grenzfall: leerer Datensatz, leeres Roster', () => {
    const prepared = prepareDataset(EMPTY_DATASET);

    const measured = evaluate(prepared, EMPTY_ROSTER, { measure: true });

    expect(measured.capabilities.size).toBe(0);
    expect(fieldsOf(measured)).toEqual(MEASURED_REPORT_FIELDS);
    // Auch ohne einen einzigen Knoten hat jede Phase eine Dauer.
    for (const phase of EVALUATION_PHASES) {
      expect(measurementOf(measured).phases[phase], `Phase ${phase} fehlt`).toBeGreaterThanOrEqual(0);
    }
    expect(measurementOf(measured).tree.total).toBe(0);
  });

  it('laesst den Bericht selbst unangetastet — die Messung veraendert kein Ergebnis', () => {
    const prepared = prepareDataset(DATASET);
    const roster = armyOfWarriors(MAX_WARRIORS + 1);

    const plain = evaluate(prepared, roster);
    const measured = evaluate(prepared, roster, { measure: true });

    expect(measured.violations).toEqual(plain.violations);
    expect(measured.capabilities).toEqual(plain.capabilities);
    expect(measured.costTotals).toEqual(plain.costTotals);
    expect(measured.diagnostics).toEqual(plain.diagnostics);
    expect(measured.violations.map(violation => violation.limitId)).toContain(MAX_WARRIORS_LIMIT_ID);
  });

  it('misst jeden gemessenen Lauf und nie den ungemessenen dazwischen', () => {
    const prepared = prepareDataset(DATASET);
    const roster = armyOfWarriors(MAX_WARRIORS);

    const first = evaluate(prepared, roster, { measure: true });
    const between = evaluate(prepared, roster);
    const second = evaluate(prepared, roster, { measure: true });

    // Die Messung ist kein Einmal-Effekt des ersten Aufrufs — und sie faerbt den
    // ungemessenen Lauf dazwischen nicht ein.
    expect(fieldsOf(first)).toEqual(MEASURED_REPORT_FIELDS);
    expect(fieldsOf(between)).toEqual(TODAYS_REPORT_FIELDS);
    expect(fieldsOf(second)).toEqual(MEASURED_REPORT_FIELDS);
  });

  it('bleibt ohne Flag, mit leeren Optionen und mit `{ measure: false }` beim heutigen Bericht', () => {
    const prepared = prepareDataset(DATASET);
    const roster = armyOfWarriors(MAX_WARRIORS + 1);

    for (const options of [undefined, {}, { measure: false }]) {
      const result = options === undefined ? evaluate(prepared, roster) : evaluate(prepared, roster, options);
      expect(fieldsOf(result), `Optionen ${JSON.stringify(options)} sind nicht der Normalpfad`).toEqual(
        TODAYS_REPORT_FIELDS,
      );
    }
  });
});

describe('evaluate: die drei Phasen, die `evaluate` selbst ausfuehrt', () => {
  it('weist genau diese drei Phasen aus, in der Reihenfolge der Fassade', () => {
    const measurement = measurementOf(
      evaluate(prepareDataset(DATASET), armyOfWarriors(MAX_WARRIORS), { measure: true }),
    );

    // Nicht mehr: die Vorbereitung ist ein eigener Fassaden-Aufruf und traegt
    // ihre Dauer am aufbereiteten Datensatz, nicht hier.
    expect(Object.keys(measurement.phases)).toEqual(EVALUATION_PHASES);
  });

  it('misst jede Phase als nicht-negative, endliche Millisekundenzahl', () => {
    const measurement = measurementOf(
      evaluate(prepareDataset(DATASET), armyOfWarriors(MAX_WARRIORS), { measure: true }),
    );

    for (const phase of EVALUATION_PHASES) {
      expect(typeof measurement.phases[phase], `Phase ${phase} ist keine Zahl`).toBe('number');
      expect(measurement.phases[phase], `Phase ${phase} ist negativ`).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(measurement.phases[phase]), `Phase ${phase} ist keine endliche Dauer`).toBe(true);
    }
  });

  it('bleibt in der Summe innerhalb der Wanduhr des Aufrufs', () => {
    const prepared = prepareDataset(DATASET);
    const roster = armyOfWarriors(MAX_WARRIORS + 1);

    const startedAt = performance.now();
    const measured = evaluate(prepared, roster, { measure: true });
    const elapsedMs = performance.now() - startedAt;

    const measurement = measurementOf(measured);
    const sum = EVALUATION_PHASES.reduce((total, phase) => total + measurement.phases[phase], 0);
    // Die drei Phasen liegen INNERHALB des einen Aufrufs: ihre Summe kann seine
    // Dauer nicht ueberschreiten. Faellt das, misst die Instrumentierung etwas
    // anderes als den Abschnitt, den sie benennt.
    expect(sum).toBeLessThanOrEqual(elapsedMs);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 3: Fixpunkt-Runden und Knotenzahlen
// ─────────────────────────────────────────────────────────────────────────────

describe('evaluate: die Metadata meldet den Ausgang der Fixpunktschleife', () => {
  it('meldet bei konvergierenden Daten Runden, Konvergenz und keine Nichtkonvergenz', () => {
    const measurement = measurementOf(
      evaluate(prepareDataset(DATASET), armyOfWarriors(MAX_WARRIORS + 1), { measure: true }),
    );

    expect(typeof measurement.fixpoint.rounds).toBe('number');
    expect(measurement.fixpoint.rounds).toBeGreaterThanOrEqual(1);
    // Dieser Datensatz traegt keinen einzigen Modifikator: die Schleife kommt zur Ruhe.
    expect(measurement.fixpoint.converged).toBe(true);
    expect(measurement.fixpoint.nonConvergence).toBeNull();
  });

  it('meldet bei oszillierenden Daten die Nichtkonvergenz als die Diagnose der Schleife', () => {
    const measured = evaluate(prepareDataset(OSCILLATING_DATASET), OSCILLATING_ROSTER, { measure: true });

    // Kontrolle des Falls: der Katalog oszilliert wirklich — sonst traegt der
    // Test seine Aussage nicht.
    const oscillation = measured.diagnostics.find(entry => entry.kind === DiagnosticKind.OSCILLATION);
    expect(oscillation, 'Der Katalog oszilliert nicht (mehr) — der Fall traegt den Test nicht.').toBeDefined();

    const measurement = measurementOf(measured);
    expect(measurement.fixpoint.converged).toBe(false);
    expect(measurement.fixpoint.rounds).toBe(oscillation.rounds);
    // Die **Art** der Nichtkonvergenz ist die Diagnose selbst (Oszillation mit
    // Zykluslaenge bzw. erschoepftes Rundenbudget) — abgelesen, nicht nachgebaut.
    expect(measurement.fixpoint.nonConvergence).toEqual(oscillation);
  });

  // Die Schleife kennt ZWEI Befunde der Nichtkonvergenz (`fixpoint.js`): die
  // Oszillation oben und das erschoepfte Rundenbudget hier. Beide muessen als
  // „Art der Nichtkonvergenz" in der Metadata ankommen — wuerde die Messung nur
  // den einen kennen, meldete sie fuer den anderen `converged: false` **ohne**
  // Begruendung, und der Laufzeit-Ausreisser bliebe unerklaert.
  it('meldet auch das erschoepfte Rundenbudget als die Diagnose der Schleife', () => {
    const measured = evaluate(prepareDataset(CASCADING_DATASET), CASCADING_ROSTER, { measure: true });

    // Kontrolle des Falls: die Kaskade reisst die Rundenobergrenze, **ohne** zu
    // oszillieren — sonst pruefte dieser Test denselben Befund wie der obige.
    const exhausted = measured.diagnostics.find(entry => entry.kind === DiagnosticKind.ROUND_BUDGET_EXHAUSTED);
    expect(exhausted, 'Die Kaskade erschoepft das Rundenbudget nicht (mehr) — der Fall traegt den Test nicht.')
      .toBeDefined();
    expect(measured.diagnostics.some(entry => entry.kind === DiagnosticKind.OSCILLATION)).toBe(false);

    const measurement = measurementOf(measured);
    expect(measurement.fixpoint.converged).toBe(false);
    expect(measurement.fixpoint.rounds).toBe(exhausted.rounds);
    expect(measurement.fixpoint.nonConvergence).toEqual(exhausted);
  });
});

describe('evaluate: die Metadata zaehlt die Knoten des Auswertungsbaums', () => {
  it('zaehlt reale und synthetische Knoten getrennt und schluesselt sie nach Ankerart auf', () => {
    const measured = evaluate(prepareDataset(COUNTING_DATASET), COUNTING_ROSTER, { measure: true });

    // Die Slots des Berichts sind dieselben Knoten — der Bericht ist die
    // beobachtbare Gegenprobe zur Zaehlung.
    const slots = [...measured.capabilities.values()];
    const tally = Object.fromEntries(
      Object.values(AnchorKind).map(kind => [kind, slots.filter(slot => slot.anchorKind === kind).length]),
    );

    // Der Fall ist abzaehlbar: Kontingent + Krieger (belegt), Pflicht-Phantom der
    // Handwaffe, Angebots-Anker des Bogenschuetzen.
    expect(tally).toEqual({
      [AnchorKind.OCCUPIED]: 2,
      [AnchorKind.MANDATORY_PHANTOM]: 1,
      [AnchorKind.GROUP_ANCHOR]: 0,
      [AnchorKind.CATEGORY_ANCHOR]: 0,
      [AnchorKind.OFFER_ANCHOR]: 1,
    });

    const tree = measurementOf(measured).tree;
    expect(tree.total).toBe(4);
    expect(tree.real).toBe(2);
    expect(tree.synthetic).toBe(2);
    // Jede Ankerart ist gefuehrt, auch die im Fall nicht vorkommenden — mit 0.
    expect(tree.byAnchorKind).toEqual(tally);
    expect(tree.total).toBe(measured.capabilities.size);
  });

  // Der Fall oben laesst Gruppen- und Kategorie-Anker auf 0 — eine Zaehlung, die
  // beide gar nicht mitzaehlt, faellt dort nicht auf. Dieser Fall bringt **jede**
  // Ankerart hervor und zaehlt sie mit einem Wert ungleich 0.
  it('zaehlt auch Gruppen- und Kategorie-Anker, nicht nur belegte Slots und Angebote', () => {
    const measured = evaluate(prepareDataset(ANCHOR_DATASET), ANCHOR_ROSTER, { measure: true });

    const slots = [...measured.capabilities.values()];
    const tally = Object.fromEntries(
      Object.values(AnchorKind).map(kind => [kind, slots.filter(slot => slot.anchorKind === kind).length]),
    );

    // Abzaehlbar: Kontingent + Krieger (belegt), Pflicht-Phantom des Banners,
    // Gruppen-Anker der Waffengruppe, Kategorie-Anker des Kontingent-Links,
    // Angebots-Anker fuer Schwert, Axt und den nicht gewaehlten Bogenschuetzen.
    expect(tally).toEqual({
      [AnchorKind.OCCUPIED]: 2,
      [AnchorKind.MANDATORY_PHANTOM]: 1,
      [AnchorKind.GROUP_ANCHOR]: 1,
      [AnchorKind.CATEGORY_ANCHOR]: 1,
      [AnchorKind.OFFER_ANCHOR]: 3,
    });

    const tree = measurementOf(measured).tree;
    expect(tree.byAnchorKind).toEqual(tally);
    expect(tree.byAnchorKind[AnchorKind.GROUP_ANCHOR]).toBeGreaterThan(0);
    expect(tree.byAnchorKind[AnchorKind.CATEGORY_ANCHOR]).toBeGreaterThan(0);
    expect(tree.total).toBe(8);
    expect(tree.real).toBe(2);
    expect(tree.synthetic).toBe(6);
    expect(tree.total).toBe(measured.capabilities.size);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 1 (+ 4): die Vorbereitung misst sich selbst
// ─────────────────────────────────────────────────────────────────────────────

describe('prepareDataset: der Normalpfad bleibt unveraendert', () => {
  it('liefert ohne Flag weiterhin einen Griff ohne jede eigene Eigenschaft', () => {
    const prepared = prepareDataset(DATASET);

    expect(Object.keys(prepared)).toEqual([]);
    expect(Object.getOwnPropertyNames(prepared)).toEqual([]);
    expect(prepared.resolved).toBeUndefined();
  });

  it('bleibt auch mit leeren Optionen und mit `{ measure: false }` der heutige Griff', () => {
    for (const options of [{}, { measure: false }]) {
      const prepared = prepareDataset(DATASET, options);

      expect(Object.getOwnPropertyNames(prepared), `Optionen ${JSON.stringify(options)} sind nicht der Normalpfad`)
        .toEqual([]);
      expect(fieldsOf(evaluate(prepared, armyOfWarriors(MAX_WARRIORS)))).toEqual(TODAYS_REPORT_FIELDS);
    }
  });
});

describe('prepareDataset: mit `{ measure: true }` traegt der Griff seine eigene Dauer', () => {
  it('traegt genau die eine Phase der Vorbereitung als `measurement`', () => {
    const prepared = prepareDataset(DATASET, { measure: true });

    expect(Object.keys(prepared)).toEqual([MEASUREMENT_FIELD]);
    const phases = preparationMeasurementOf(prepared).phases;
    expect(Object.keys(phases)).toEqual([PHASE.PREPARATION]);
    expect(typeof phases[PHASE.PREPARATION]).toBe('number');
    expect(phases[PHASE.PREPARATION]).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(phases[PHASE.PREPARATION])).toBe(true);
  });

  it('misst auch die Vorbereitung des leeren Datensatzes', () => {
    const prepared = prepareDataset(EMPTY_DATASET, { measure: true });

    expect(preparationMeasurementOf(prepared).phases[PHASE.PREPARATION]).toBeGreaterThanOrEqual(0);
  });

  it('bleibt derselbe Griff: Auswertung und Beschreibung liefern unveraendert dasselbe', () => {
    const roster = armyOfWarriors(MAX_WARRIORS + 1);
    const plainPrepared = prepareDataset(DATASET);
    const measuredPrepared = prepareDataset(DATASET, { measure: true });

    const againstPlain = evaluate(plainPrepared, roster);
    const againstMeasured = evaluate(measuredPrepared, roster);

    expect(againstMeasured.violations).toEqual(againstPlain.violations);
    expect(againstMeasured.capabilities).toEqual(againstPlain.capabilities);
    expect(againstMeasured.costTotals).toEqual(againstPlain.costTotals);
    expect(againstMeasured.diagnostics).toEqual(againstPlain.diagnostics);
    expect(describeDataset(measuredPrepared)).toEqual(describeDataset(plainPrepared));
    // Der gemessene Griff traegt sein `measurement` unabhaengig davon, wie oft er
    // ausgewertet wurde: die Dauer gehoert zur Vorbereitung, nicht zum Aufruf.
    expect(Object.keys(measuredPrepared)).toEqual([MEASUREMENT_FIELD]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 4: kein Zeitgeber auf dem Normalpfad
// ─────────────────────────────────────────────────────────────────────────────

describe('Normalpfad: die Engine liest keine Uhr', () => {
  it('ruft weder in `prepareDataset` noch in `evaluate` einen Zeitgeber auf', () => {
    const calls = countingClockCalls(() => {
      const prepared = prepareDataset(DATASET);
      evaluate(prepared, armyOfWarriors(MAX_WARRIORS + 1));
    });

    expect(calls, 'Der Normalpfad hat eine Uhr gelesen — die Messung laeuft nicht opt-in.').toBe(0);
  });

  it('ruft auch mit leeren Optionen und mit `{ measure: false }` keinen Zeitgeber auf', () => {
    const calls = countingClockCalls(() => {
      evaluate(prepareDataset(DATASET, {}), armyOfWarriors(MAX_WARRIORS), {});
      evaluate(prepareDataset(DATASET, { measure: false }), armyOfWarriors(MAX_WARRIORS), { measure: false });
    });

    expect(calls, 'Ein nicht gesetztes Flag hat die Messung eingeschaltet.').toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 5: die Fassade benennt, was das Messverfahren aus der Metadata liest
// ─────────────────────────────────────────────────────────────────────────────

describe('Fassade: die Namen, die das Messverfahren aus der Metadata liest', () => {
  it('exportiert `MeasuredPhase` mit den vier Phasen der Auswertung', () => {
    // Die Phasen sind die der Engine — sie gehoeren an ihre Fassade, nicht in
    // das Messgeraet. Das Skript liest die Namen von hier, statt sie zu setzen.
    expect(facade.MeasuredPhase).toEqual(PHASE);
  });

  it('exportiert `DiagnosticKind` unveraendert aus dem Modell', () => {
    // Die Diagnosen des Berichts tragen diese Werte; sie zu benennen ist Teil
    // seines Vertrags. Die Ausgabe des Messverfahrens liest daran die Art der
    // Nichtkonvergenz ab, ohne in die Engine zu greifen.
    expect(facade.DiagnosticKind).toEqual(DiagnosticKind);
  });
});
