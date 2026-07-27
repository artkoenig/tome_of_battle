/**
 * Der **Faehigkeitsdatensatz** unterscheidet „es gibt keine Grenze" von „die
 * Grenze war nicht auswertbar" (Issue 77).
 *
 * Vorgeschichte: seit die Engine eine Query ohne Antwort mit einem Sentinel statt
 * einer erfundenen `0` beantwortet, verglich die Constraint-Schicht eine solche
 * Grenze nicht mehr — und liess sie **ersatzlos** fallen. Im Datensatz sah der Slot
 * danach aus wie einer ohne jede Obergrenze: `effectiveMax` und `headroom` `null`,
 * und `null` heisst dort laut Vertrag „keine Obergrenze". Aus „wir wissen es nicht"
 * war damit „unbegrenzt" geworden — dasselbe fail-open, das der Sentinel gerade
 * beseitigen sollte, nur eine Schicht weiter und ausgerechnet in dem Datensatz, aus
 * dem sich die Oberflaeche speist (ADR-0035).
 *
 * Gemessen und hier festgehalten ist genau dieser Fall: eine **Obergrenze 1 auf
 * einem nicht aufloesbaren Bezugsrahmen**, eine Auswahl getroffen.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate, prepareDataset } from './evaluator.js';
import { ConstraintKind, DiagnosticKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Eigene, minimale Fixtures (ADR-0030) ─────────────────────────────────────

const CATALOGUE_ID = 'cat-unevaluated';
const LIMITED_ID = 'entry-limited';
const UNLIMITED_ENTRY_ID = 'entry-without-limit';
const MANDATORY_ID = 'entry-mandatory';
const LIMITED_MAX_ID = 'limit-max-on-unresolvable-frame';
const MANDATORY_MIN_ID = 'limit-min-on-unresolvable-frame';

/**
 * Ein Bezugsrahmen, den kein Knoten aufloest: die Id benennt weder eine Kategorie
 * noch einen Vorfahren der Auswahl. Genau daran scheitert die Zaehlung — die Query
 * hat keine Antwort und meldet den Rahmen als unaufloesbar.
 */
const UNRESOLVABLE_SCOPE = 'frame-that-no-node-carries';

const DECLARED_MAX = 1;
const DECLARED_MIN = 1;
const CHOSEN = 1;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${CATALOGUE_ID}" name="Unevaluated Limits Catalogue">
    <selectionEntries>
      <selectionEntry id="${LIMITED_ID}" name="Limited" type="unit">
        <constraints>
          <constraint id="${LIMITED_MAX_ID}" type="max" value="${DECLARED_MAX}" field="selections" scope="${UNRESOLVABLE_SCOPE}" shared="true"/>
        </constraints>
      </selectionEntry>
      <selectionEntry id="${UNLIMITED_ENTRY_ID}" name="Without Limit" type="unit"/>
      <selectionEntry id="${MANDATORY_ID}" name="Mandatory" type="unit">
        <constraints>
          <constraint id="${MANDATORY_MIN_ID}" type="min" value="${DECLARED_MIN}" field="selections" scope="${UNRESOLVABLE_SCOPE}" shared="true"/>
        </constraints>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Der Faehigkeitsdatensatz des Slots einer Definition. */
function capabilityOf(report, defId) {
  const found = [...report.capabilities.values()].filter(capability => capability.defId === defId);
  expect(found).toHaveLength(1);
  return found[0];
}

/** Wertet ein Roster aus den gegebenen Wurzel-Auswahlen aus. */
function reportOf(defIds) {
  return evaluate(prepareDataset({ catalogues: [CATALOGUE_XML] }), {
    forces: defIds.map(defId => ({ defId, count: CHOSEN, children: [] })),
  });
}

describe('Faehigkeitsdatensatz: eine nicht auswertbare Grenze verschwindet nicht', () => {
  it('weist fuer eine Obergrenze ohne Antwort **keinen unbegrenzten** Spielraum aus', () => {
    const report = reportOf([LIMITED_ID]);

    const capability = capabilityOf(report, LIMITED_ID);
    // Der gemessene Fall: Obergrenze 1, eine Auswahl getroffen, Rahmen nicht
    // aufloesbar. Frueher stand hier `headroom: null` — also „unbegrenzt".
    expect(capability.headroom).toBe(0);
    expect(capability.isBlocked).toBe(true);
    expect(capability.unevaluatedLimitKinds).toEqual([ConstraintKind.MAX]);
  });

  it('unterscheidet das von einem Slot, der schlicht keine Obergrenze hat', () => {
    const report = reportOf([LIMITED_ID, UNLIMITED_ENTRY_ID]);

    const withoutLimit = capabilityOf(report, UNLIMITED_ENTRY_ID);
    expect(withoutLimit.effectiveMax).toBeNull();
    expect(withoutLimit.headroom).toBeNull();
    expect(withoutLimit.isBlocked).toBe(false);
    expect(withoutLimit.unevaluatedLimitKinds).toEqual([]);

    // Dieselben zwei Felder, zwei verschiedene Aussagen — genau die
    // Unterscheidung, die vorher fehlte.
    const unevaluated = capabilityOf(report, LIMITED_ID);
    expect(unevaluated.headroom).not.toBe(withoutLimit.headroom);
  });

  it('haelt die Untergrenze ohne Antwort ebenso fest — ohne eine offene Pflicht zu behaupten', () => {
    const report = reportOf([MANDATORY_ID]);

    const capability = capabilityOf(report, MANDATORY_ID);
    expect(capability.unevaluatedLimitKinds).toEqual([ConstraintKind.MIN]);
    // Was nicht ausgewertet werden konnte, ist auch nicht als unerfuellt zu
    // behaupten: die Meldung entstuende ohne jede Grundlage.
    expect(capability.isMandatoryUnmet).toBe(false);
    expect(capability.effectiveMin).toBeNull();
  });

  it('meldet die Grenze ohne Antwort nicht als Verletzung — sie behauptet nichts, sie schweigt sichtbar', () => {
    const report = reportOf([LIMITED_ID]);

    expect(report.violations).toHaveLength(0);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.UNRESOLVED_SCOPE, scope: UNRESOLVABLE_SCOPE }),
    );
  });
});
