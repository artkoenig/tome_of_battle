/**
 * Eine **unverlinkte** `categoryEntry` mit einer **PARENT**-skopierten Grenze
 * bekommt je Kontingent einen Kategorie-Anker.
 *
 * `docs/battlescribe-data-format.md` §5.5/§5.6: Grenzen haengen direkt an der
 * Kategorie-Definition und gelten auch, wenn **kein** Kontingent sie per
 * `categoryLink` fuehrt. Bis Issue 0147 galt das nur fuer die Rahmen `roster`
 * und `force` — eine Kategorie mit ausschliesslich PARENT-skopierten Grenzen
 * bekam gar keinen Anker, ihre Grenze blieb still unausgewertet.
 *
 * Real trifft das drei Regeln des Border-Patrols-Musters der `.gst`: die
 * Kategorien „Chariot" (`d36d-…`), „War Machine" (`f672-…`) und „Magical
 * Standard" (`942b-…`) tragen je genau eine PARENT-skopierte MAX-Grenze mit
 * Rohwert `-1` (unbegrenzt), die ein bedingter `set` auf 1 bzw. 0 zieht, sobald
 * der Schalter „Border Patrols rules" im Kontingent steht — und **kein**
 * `forceEntry` der sechs Fixture-Kataloge fuehrt eine dieser drei Kategorien.
 *
 * Der PARENT-Rahmen zaehlt dabei **je Kontingent**: `parent` loest am Anker auf
 * dessen Elternknoten auf, und die Ziel-Typ-Regel (§7.7) weitet nur den
 * `force`-Rahmen armeeweit auf, nicht diesen. Zwei Kontingente werden darum
 * getrennt geprueft — deshalb haengt der Anker an **jedem**.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../domain/evaluator/evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const CAT_ID = 'cat-chariot';
const LIMIT_ID = 'limit-chariot-max';
const FORCE_ID = 'force-standard';
const CHARIOT_ID = 'entry-chariot';
const SWITCH_ID = 'entry-patrol-switch';

// Ein Kontingent, das den Streitwagen und den Schalter anbietet, aber die
// Kategorie NICHT per `categoryLink` fuehrt — genau die reale Lage.
const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-parent-scope" name="Parent Scope Catalogue">
  <categoryEntries>
    <categoryEntry id="${CAT_ID}" name="Chariot">
      <constraints>
        <constraint id="${LIMIT_ID}" type="max" value="-1" field="selections" scope="parent" shared="true"/>
      </constraints>
      <modifiers>
        <modifier type="set" value="1" field="${LIMIT_ID}">
          <conditions>
            <condition type="atLeast" value="1" field="selections" scope="force" childId="${SWITCH_ID}" shared="true" includeChildSelections="true"/>
          </conditions>
        </modifier>
      </modifiers>
    </categoryEntry>
  </categoryEntries>
  <forceEntries>
    <forceEntry id="${FORCE_ID}" name="Standard"/>
  </forceEntries>
  <selectionEntries>
    <selectionEntry id="${CHARIOT_ID}" name="Chariot" type="unit">
      <categoryLinks><categoryLink targetId="${CAT_ID}"/></categoryLinks>
    </selectionEntry>
    <selectionEntry id="${SWITCH_ID}" name="Border Patrols rules" type="upgrade"/>
  </selectionEntries>
</catalogue>`;

/** Ein Kontingent mit `chariots` Streitwagen, optional dem Schalter. */
function force(chariots, withSwitch) {
  const children = [];
  for (let index = 0; index < chariots; index += 1) {
    children.push({ defId: CHARIOT_ID, count: 1, children: [] });
  }
  if (withSwitch) children.push({ defId: SWITCH_ID, count: 1, children: [] });
  return { defId: FORCE_ID, count: 1, children };
}

function evaluate(forces) {
  return evaluateDataset(prepareDataset({ catalogues: [CATALOGUE_XML] }), { forces });
}

/** Die Meldungen des Berichts zu der einen Grenze. */
function messagesOf(report) {
  return report.violations.filter(message => message.limitId === LIMIT_ID);
}

describe('Unverlinkte Kategorie mit PARENT-skopierter Grenze (Issue 0147)', () => {
  it('wertet die Grenze aus, obwohl kein Kontingent die Kategorie fuehrt', () => {
    const report = evaluate([force(2, true)]);

    expect(messagesOf(report)).toEqual([
      expect.objectContaining({ actual: 2, bound: 1 }),
    ]);
  });

  it('meldet nichts, solange die Grenze unbegrenzt bleibt (Rohwert -1)', () => {
    // Ohne den Schalter greift der `set`-Modifikator nicht: `-1` heisst
    // unbegrenzt, nicht „nichts erlaubt" (§7.6, Sentinel-Kasten).
    const report = evaluate([force(3, false)]);

    expect(messagesOf(report)).toEqual([]);
  });

  it('meldet nichts, wenn die Grenze genau erfuellt ist', () => {
    const report = evaluate([force(1, true)]);

    expect(messagesOf(report)).toEqual([]);
  });

  it('prueft jedes Kontingent getrennt — der Rahmen ist das Kontingent, nicht die Armee', () => {
    // Zwei Kontingente, beide mit Schalter: eines legal (1), eines nicht (2).
    // Ein einziger Anker liesse das zweite ungeprueft; ein armeeweiter Rahmen
    // meldete auch das legale mit.
    const report = evaluate([force(1, true), force(2, true)]);

    expect(messagesOf(report)).toEqual([
      expect.objectContaining({ actual: 2, bound: 1 }),
    ]);
  });

  it('haengt den Anker als Kategorie-Anker unter jedes Kontingent', () => {
    const report = evaluate([force(1, true), force(1, true)]);
    const anchors = [...report.capabilities.values()]
      .filter(capability => capability.defId === CAT_ID);

    expect(anchors).toHaveLength(2);
    for (const anchor of anchors) {
      expect(anchor).toMatchObject({ anchorKind: 'categoryAnchor', current: 1, effectiveMax: 1 });
    }
  });

  it('erzeugt keine unechte unresolvedScope-Diagnose', () => {
    const report = evaluate([force(1, true)]);

    expect((report.diagnostics ?? []).filter(diagnostic => diagnostic.kind === 'unresolvedScope')).toEqual([]);
  });
});
