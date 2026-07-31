/**
 * Tests des **Opt-in-Messmodus** der Fassade (Issue 0138): die Engine misst ihre
 * eigenen Teilschritte und liefert das Ergebnis als Metadata aus — aber nur, wenn
 * der Aufrufer ausdruecklich `{ measure: true }` mitgibt.
 *
 * Die beiden Aussagen, die diese Datei festhaelt:
 *
 * 1. **Der Normalpfad bleibt, was er ist.** Ohne das Flag — und ebenso mit leeren
 *    Optionen oder `{ measure: false }` — liefern `prepareDataset` und `evaluate`
 *    exakt das heutige Ergebnis: dieselben vier Berichtsfelder, kein
 *    Metadata-Feld, kein aufbereiteter Datensatz mit neuer Eigenschaft und keine
 *    Zeitmessung. Die Reinheit des Leitprinzips 1
 *    (`docs/evaluator-architecture.md` §2) gilt fuer jeden bestehenden Aufrufer
 *    unveraendert (Kriterium 4).
 * 2. **Mit dem Flag kommt genau EIN Feld hinzu.** Der Bericht selbst bleibt
 *    identisch — die Messung darf das Ergebnis nicht veraendern —, und das eine
 *    zusaetzliche Feld traegt die Messung (Kriterien 1–3).
 *
 * Absichtlich **nicht** festgenagelt ist der *Name* des Metadata-Feldes und die
 * Verschachtelung darin: die Tests lesen das eine Feld, das mit dem Flag
 * hinzukommt, statt einen erfundenen Namen zu erwarten. Die einzigen
 * hingeschriebenen Namen sind die, die die Abnahmekriterien selbst nennen:
 * `rounds` und `converged` (Kriterium 3).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, describeDataset, prepareDataset } from './evaluator.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

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

/** Die vier Felder, aus denen der Bericht der Fassade heute besteht. */
const TODAYS_REPORT_FIELDS = ['capabilities', 'costTotals', 'diagnostics', 'violations'];

/** Ein Kontingent mit `count` Kriegern — bei `count > MAX_WARRIORS` reisst die Grenze. */
function armyOfWarriors(count) {
  return {
    forces: [{ defId: FORCE_ID, count: 1, children: [{ defId: WARRIOR_ID, count, children: [] }] }],
    costLimits: [{ costTypeId: POINTS_COST_TYPE_ID, value: 100 }],
  };
}

/** Die eigenen, aufzaehlbaren Felder eines Ergebnisses — sortiert und vergleichbar. */
function fieldsOf(result) {
  return Object.keys(result).sort();
}

/**
 * Die Felder, die `withFlag` gegenueber `withoutFlag` **zusaetzlich** traegt.
 * Kriterium 2 verlangt genau eines davon; welchen Namen es traegt, ist hier
 * bewusst offen.
 */
function additionalFieldsOf(withFlag, withoutFlag) {
  const known = new Set(fieldsOf(withoutFlag));
  return fieldsOf(withFlag).filter(field => !known.has(field));
}

/** Das eine Metadata-Feld eines gemessenen Ergebnisses — sein Wert, nicht sein Name. */
function metadataOf(withFlag, withoutFlag) {
  const additional = additionalFieldsOf(withFlag, withoutFlag);
  expect(
    additional,
    'Das gemessene Ergebnis traegt kein (oder mehr als ein) zusaetzliches Feld — erwartet wird genau EIN Metadata-Feld.',
  ).toHaveLength(1);
  return withFlag[additional[0]];
}

/**
 * Alle Werte, die irgendwo in `value` unter dem Feldnamen `name` stehen —
 * unabhaengig davon, wie tief die Metadata sie verschachtelt.
 */
function fieldsNamed(value, name, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return [];
  seen.add(value);
  const entries = value instanceof Map ? [...value.entries()] : Object.entries(value);
  const found = [];
  for (const [key, child] of entries) {
    if (key === name) found.push(child);
    found.push(...fieldsNamed(child, name, seen));
  }
  return found;
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

describe('evaluate: das Metadata-Feld erscheint nur unter `{ measure: true }`', () => {
  it('legt mit dem Flag genau EIN Feld zusaetzlich zum heutigen Bericht an', () => {
    const prepared = prepareDataset(DATASET);
    const roster = armyOfWarriors(MAX_WARRIORS + 1);

    const plain = evaluate(prepared, roster);
    const measured = evaluate(prepared, roster, { measure: true });

    // Der Ausgangspunkt: der heutige Bericht, unveraendert.
    expect(fieldsOf(plain)).toEqual(TODAYS_REPORT_FIELDS);
    // Und das gemessene Ergebnis: dieselben vier Felder plus genau eines.
    expect(TODAYS_REPORT_FIELDS.every(field => fieldsOf(measured).includes(field))).toBe(true);
    expect(additionalFieldsOf(measured, plain)).toHaveLength(1);
  });

  it('misst auch den leeren Grenzfall: leerer Datensatz, leeres Roster', () => {
    const prepared = prepareDataset(EMPTY_DATASET);

    const plain = evaluate(prepared, EMPTY_ROSTER);
    const measured = evaluate(prepared, EMPTY_ROSTER, { measure: true });

    expect(plain.capabilities.size).toBe(0);
    expect(additionalFieldsOf(measured, plain)).toHaveLength(1);
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

  it('traegt die Metadata bei jedem gemessenen Lauf und nie im ungemessenen dazwischen', () => {
    const prepared = prepareDataset(DATASET);
    const roster = armyOfWarriors(MAX_WARRIORS);

    const first = evaluate(prepared, roster, { measure: true });
    const between = evaluate(prepared, roster);
    const second = evaluate(prepared, roster, { measure: true });

    expect(fieldsOf(between)).toEqual(TODAYS_REPORT_FIELDS);
    expect(additionalFieldsOf(first, between)).toHaveLength(1);
    // Der zweite gemessene Lauf traegt dieselbe Metadata-Form wie der erste: die
    // Messung ist kein Einmal-Effekt des ersten Aufrufs.
    expect(additionalFieldsOf(second, between)).toEqual(additionalFieldsOf(first, between));
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

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 3: der Ausgang der Fixpunktschleife steht in der Metadata
// ─────────────────────────────────────────────────────────────────────────────

describe('evaluate: die Metadata meldet den Ausgang der Fixpunktschleife', () => {
  // Die Fassade verwirft `rounds`/`converged` heute (`evaluator.js`
  // destrukturiert sie nicht), obwohl `evaluateToFixpoint` sie berechnet. Beide
  // Namen stehen so in Kriterium 3; wie tief die Metadata sie verschachtelt,
  // laesst dieser Test offen.
  it('nennt die Zahl der Runden und dass die Schleife konvergiert ist', () => {
    const prepared = prepareDataset(DATASET);
    const roster = armyOfWarriors(MAX_WARRIORS + 1);

    const metadata = metadataOf(evaluate(prepared, roster, { measure: true }), evaluate(prepared, roster));

    const rounds = fieldsNamed(metadata, 'rounds');
    expect(rounds, 'Die Metadata nennt die Fixpunkt-Runden nicht als `rounds`.').toHaveLength(1);
    expect(typeof rounds[0]).toBe('number');
    expect(rounds[0]).toBeGreaterThanOrEqual(1);

    // Dieser Datensatz traegt keinen einzigen Modifikator: die Schleife kommt in
    // der ersten Runde zur Ruhe.
    expect(fieldsNamed(metadata, 'converged')).toEqual([true]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 1 (+ 4): die Vorbereitung
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

  it('liefert mit `{ measure: true }` einen Griff, der Auswertung und Beschreibung unveraendert traegt', () => {
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
