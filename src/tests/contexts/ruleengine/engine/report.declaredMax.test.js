import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';

globalThis.DOMParser = new JSDOM().window.DOMParser;

/**
 * Issue 0204: the capability record names the **declared** counting max next to the
 * effective one, so the UI can keep a single-choice option a checkbox when a
 * modifier lowers its max to 0 — without reading the catalogue a second time.
 */

const UNIT_ID = 'entry-noble';
const OPTION_ID = 'entry-general';

function catalogueWith(modifierXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-declared-max" name="Declared Max Catalogue">
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Noble" type="unit">
          <selectionEntries>
            <selectionEntry id="${OPTION_ID}" name="General" type="upgrade">
              <modifiers>${modifierXml}</modifiers>
              <constraints>
                <constraint id="max-general" type="max" value="1" field="selections" scope="parent"/>
              </constraints>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

function optionSlotOf(catalogueXml) {
  const report = evaluate(
    prepareDataset({ catalogues: [catalogueXml] }),
    { forces: [{ defId: UNIT_ID, count: 1, children: [] }] },
  );
  return [...report.capabilities.values()].find(capability => capability.defId === OPTION_ID);
}

describe('Bericht: deklariertes Max neben dem effektiven', () => {
  it('meldet das deklarierte Max 1, auch wenn ein Modifikator das effektive Max auf 0 setzt', () => {
    const slot = optionSlotOf(catalogueWith('<modifier type="set" value="0" field="max-general"/>'));

    expect(slot).toMatchObject({ effectiveMax: 0, declaredMax: 1 });
  });

  it('KONTROLLE: ohne Modifikator sind deklariertes und effektives Max gleich', () => {
    const slot = optionSlotOf(catalogueWith(''));

    expect(slot).toMatchObject({ effectiveMax: 1, declaredMax: 1 });
  });

  it('meldet kein deklariertes Max, wo kein effektives berichtet wird', () => {
    const slot = optionSlotOf(catalogueWith('<modifier type="set" value="-1" field="max-general"/>'));

    expect(slot).toMatchObject({ effectiveMax: null, declaredMax: null });
  });
});
