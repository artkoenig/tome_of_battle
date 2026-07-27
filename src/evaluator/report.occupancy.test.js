/**
 * Der **Ist-Stand** eines Slots ist eine Zaehlung, kein Ersatzwert (Issue 82).
 *
 * Vorgeschichte: der Bericht las `current` ausschliesslich aus dem Ergebnis einer
 * Grenze — `maxResult?.actual ?? minResult?.actual ?? 0`. Steuerte keine Grenze ein
 * Ergebnis bei, blieb die 0 stehen, gleich wie viel an der Stelle stand. Dorthin
 * fuehren zwei Wege, und beide sind in echten Katalogen haeufig:
 *
 * - eine **unbegrenzt** erklaerte Obergrenze (`value="-1"`) gilt gar nicht und
 *   liefert deshalb kein Ergebnis (`constraints.js`) — in den WHFB6-Fixtures sind
 *   das 38 Grenzen, 28 davon `max/selections/scope="parent"`;
 * - eine Grenze **ohne Antwort** wird fail-closed nicht verglichen (Issue 77).
 *
 * Beide enden im selben erfundenen Nullwert, und die Oberflaeche liest genau dieses
 * Feld (ADR-0035). Der Ist-Stand kommt deshalb aus der **Belegung** des Slots
 * (`occupancy.js`), sobald keine Grenze einen beisteuert — und weiterhin aus der
 * ausgewiesenen Grenze, sobald eine da ist, damit `effectiveMin`/`effectiveMax`,
 * `current` und `headroom` dieselbe Messgroesse tragen (Main-Issue 76).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate, prepareDataset } from './evaluator.js';
import { AnchorKind, ConstraintKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Eigene, minimale Fixtures (ADR-0030) ─────────────────────────────────────

const UNLIMITED_MAX_ID = 'entry-unlimited-max';
const WITHOUT_LIMIT_ID = 'entry-without-limit';
const UNEVALUATED_MAX_ID = 'entry-unevaluated-max';
const BY_POINTS_ID = 'entry-limited-by-points';
const UNIT_ID = 'entry-unit';
const OPTION_ID = 'entry-option';
const POINTS_COST_TYPE_ID = 'cost-points';

/** Der Bezugsrahmen, den kein Knoten aufloest — die Grenze bleibt ohne Antwort. */
const UNRESOLVABLE_SCOPE = 'frame-that-no-node-carries';

/** Die Schreibweise, mit der ein Katalog eine Grenze als unbegrenzt erklaert. */
const UNLIMITED_VALUE = -1;

const POINTS_PER_UNIT = 10;
const MAX_POINTS = 100;
const CHOSEN_COUNT = 3;
const OPTION_COUNT = 2;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-occupancy" name="Occupancy Catalogue">
    <selectionEntries>
      <selectionEntry id="${UNLIMITED_MAX_ID}" name="Unlimited Max" type="unit">
        <constraints>
          <constraint id="max-unlimited" type="max" value="${UNLIMITED_VALUE}" field="selections" scope="parent" shared="true"/>
        </constraints>
      </selectionEntry>
      <selectionEntry id="${WITHOUT_LIMIT_ID}" name="Without Limit" type="unit"/>
      <selectionEntry id="${UNEVALUATED_MAX_ID}" name="Unevaluated Max" type="unit">
        <constraints>
          <constraint id="max-without-answer" type="max" value="1" field="selections" scope="${UNRESOLVABLE_SCOPE}" shared="true"/>
        </constraints>
      </selectionEntry>
      <selectionEntry id="${BY_POINTS_ID}" name="Limited By Points" type="unit">
        <costs>
          <cost name="Points" typeId="${POINTS_COST_TYPE_ID}" value="${POINTS_PER_UNIT}"/>
        </costs>
        <constraints>
          <constraint id="max-points" type="max" value="${MAX_POINTS}" field="${POINTS_COST_TYPE_ID}" scope="roster" shared="true"/>
        </constraints>
      </selectionEntry>
      <selectionEntry id="${UNIT_ID}" name="Unit" type="unit">
        <selectionEntries>
          <selectionEntry id="${OPTION_ID}" name="Option" type="upgrade"/>
        </selectionEntries>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Der Faehigkeitsdatensatz des einzigen Slots einer Definition. */
function capabilityOf(report, defId) {
  const found = [...report.capabilities.values()].filter(capability => capability.defId === defId);
  expect(found).toHaveLength(1);
  return found[0];
}

/** Wertet ein Roster aus den gegebenen Wurzel-Auswahlen aus. */
function reportOf(selections) {
  return evaluate(prepareDataset({ catalogues: [CATALOGUE_XML] }), { forces: selections });
}

/** Eine Wurzel-Auswahl gegebener Anzahl, ohne Unterauswahlen. */
function selectionOf(defId, count, children = []) {
  return { defId, count, children };
}

describe('Faehigkeitsdatensatz: der Ist-Stand ohne ausgewiesene Grenze', () => {
  it('meldet bei ausschliesslich unbegrenzter Obergrenze den echten Stand statt 0', () => {
    const report = reportOf([selectionOf(UNLIMITED_MAX_ID, CHOSEN_COUNT)]);

    const capability = capabilityOf(report, UNLIMITED_MAX_ID);
    expect(capability.current).toBe(CHOSEN_COUNT);
    // Unveraendert: „unbegrenzt" bleibt die Aussage der Grenzen-Felder — der
    // Ist-Stand sagt nichts ueber sie, er zaehlt nur.
    expect(capability.effectiveMax).toBeNull();
    expect(capability.headroom).toBeNull();
    expect(capability.isBlocked).toBe(false);
    expect(capability.unevaluatedLimitKinds).toEqual([]);
  });

  it('meldet auch ohne jede Grenze den echten Stand', () => {
    const report = reportOf([selectionOf(WITHOUT_LIMIT_ID, CHOSEN_COUNT)]);

    expect(capabilityOf(report, WITHOUT_LIMIT_ID).current).toBe(CHOSEN_COUNT);
  });

  it('meldet den echten Stand auch dann, wenn die einzige Grenze keine Antwort hatte — und bleibt daneben fail-closed', () => {
    const report = reportOf([selectionOf(UNEVALUATED_MAX_ID, CHOSEN_COUNT)]);

    const capability = capabilityOf(report, UNEVALUATED_MAX_ID);
    // Der Stand ist bekannt: er kommt aus der Zaehlung, nicht aus der Grenze.
    expect(capability.current).toBe(CHOSEN_COUNT);
    // Die Grenze bleibt unbeantwortet — daran aendert die Zaehlung nichts (Issue 77).
    expect(capability.unevaluatedLimitKinds).toEqual([ConstraintKind.MAX]);
    expect(capability.headroom).toBe(0);
    expect(capability.isBlocked).toBe(true);
  });

  it('erfindet nichts in die andere Richtung: ein Angebots-Slot ohne Auswahl bleibt bei 0', () => {
    const report = reportOf([selectionOf(UNIT_ID, 1)]);

    const capability = capabilityOf(report, OPTION_ID);
    expect(capability.anchorKind).toBe(AnchorKind.OFFER_ANCHOR);
    expect(capability.current).toBe(0);
  });

  it('zaehlt eine belegte Unterauswahl in ihrem eigenen Rahmen', () => {
    const report = reportOf([selectionOf(UNIT_ID, 1, [selectionOf(OPTION_ID, OPTION_COUNT)])]);

    const capability = capabilityOf(report, OPTION_ID);
    expect(capability.anchorKind).toBe(AnchorKind.OCCUPIED);
    expect(capability.current).toBe(OPTION_COUNT);
  });
});

describe('Faehigkeitsdatensatz: die ausgewiesene Grenze bestimmt weiterhin den Ist-Stand', () => {
  it('weist bei einer Kostengrenze die Kostensumme aus, nicht die Zahl der Auswahlen', () => {
    const report = reportOf([selectionOf(BY_POINTS_ID, CHOSEN_COUNT)]);

    const capability = capabilityOf(report, BY_POINTS_ID);
    // Die Belegung waere hier CHOSEN_COUNT — und in der falschen Einheit. `current`,
    // `effectiveMax` und `headroom` tragen dieselbe Messgroesse (Main-Issue 76).
    expect(capability.effectiveMax).toBe(MAX_POINTS);
    expect(capability.current).toBe(CHOSEN_COUNT * POINTS_PER_UNIT);
    expect(capability.headroom).toBe(MAX_POINTS - CHOSEN_COUNT * POINTS_PER_UNIT);
  });
});
