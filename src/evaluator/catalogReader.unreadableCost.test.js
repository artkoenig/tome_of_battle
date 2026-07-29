/**
 * Issue 0102, Punkt 7 (= Akzeptanzkriterium 3): unlesbare Kosten erzeugen eine
 * Diagnose statt still zu entfallen.
 *
 * Vertrag (Issue-Plan, 2026-07-29): ein `<cost>` ohne lesbaren `value`
 * (fehlend/leer/nicht numerisch) oder ohne `typeId` erzeugt die Diagnose
 * `DiagnosticKind.UNREADABLE_COST` (String-Wert `'unreadableCost'`) mit Payload
 * `{ costTypeId, value }` (Rohwerte, ggf. null) in
 * `parseCatalogue(...).diagnostics` — und fehlt weiterhin in `costs`. Ein
 * lesbares `<cost>` erzeugt keine Diagnose.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';
import { DiagnosticKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const ENTRY_ID = 'entry-warrior';
const COST_TYPE_ID = 'cost-points';
const UNREADABLE_COST_KIND = 'unreadableCost';

/** Ein Katalog mit einem Eintrag, der genau das gegebene <cost>-Element traegt. */
function catalogueWithCost(costXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cost" name="Cost Catalogue">
      <selectionEntries>
        <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
          <costs>${costXml}</costs>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Parst und liefert den Eintrag samt Diagnosen. */
function parseSingleCost(costXml) {
  const catalogue = parseCatalogue(catalogueWithCost(costXml));
  return {
    costs: catalogue.entries.find(def => def.id === ENTRY_ID).costs,
    diagnostics: catalogue.diagnostics,
  };
}

describe('DiagnosticKind.UNREADABLE_COST', () => {
  it('existiert mit dem vereinbarten String-Wert', () => {
    expect(DiagnosticKind.UNREADABLE_COST).toBe(UNREADABLE_COST_KIND);
  });
});

describe('parseCatalogue: unlesbare Kosten werden diagnostiziert', () => {
  it('meldet ein <cost> ohne value-Attribut mit den Rohwerten (value: null)', () => {
    const { costs, diagnostics } = parseSingleCost(
      `<cost name="pts" typeId="${COST_TYPE_ID}"/>`,
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: UNREADABLE_COST_KIND, costTypeId: COST_TYPE_ID, value: null }),
    );
    expect(costs).toEqual({});
  });

  it('meldet ein <cost> mit leerem value', () => {
    const { costs, diagnostics } = parseSingleCost(
      `<cost name="pts" typeId="${COST_TYPE_ID}" value=""/>`,
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: UNREADABLE_COST_KIND, costTypeId: COST_TYPE_ID, value: '' }),
    );
    expect(costs).toEqual({});
  });

  it('meldet ein <cost> mit nicht numerischem value mit dem Rohtext', () => {
    const { costs, diagnostics } = parseSingleCost(
      `<cost name="pts" typeId="${COST_TYPE_ID}" value="viele"/>`,
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: UNREADABLE_COST_KIND, costTypeId: COST_TYPE_ID, value: 'viele' }),
    );
    expect(costs).toEqual({});
  });

  it('meldet ein <cost> ohne typeId (costTypeId: null) — derselbe Fehlerpfad, dieselbe Diagnose', () => {
    const { costs, diagnostics } = parseSingleCost('<cost name="pts" value="10"/>');

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: UNREADABLE_COST_KIND, costTypeId: null, value: '10' }),
    );
    expect(costs).toEqual({});
  });

  it('erzeugt fuer ein lesbares <cost> keine Diagnose und traegt den Wert in costs', () => {
    const { costs, diagnostics } = parseSingleCost(
      `<cost name="pts" typeId="${COST_TYPE_ID}" value="10"/>`,
    );

    expect(diagnostics.filter(d => d.kind === UNREADABLE_COST_KIND)).toEqual([]);
    expect(costs).toEqual({ [COST_TYPE_ID]: 10 });
  });

  it('laesst ein lesbares Geschwister-<cost> neben einem unlesbaren unangetastet', () => {
    const { costs, diagnostics } = parseSingleCost(`
      <cost name="pts" typeId="${COST_TYPE_ID}" value="10"/>
      <cost name="dice" typeId="cost-dice" value="unlesbar"/>`);

    expect(costs).toEqual({ [COST_TYPE_ID]: 10 });
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: UNREADABLE_COST_KIND, costTypeId: 'cost-dice', value: 'unlesbar' }),
    );
  });
});
