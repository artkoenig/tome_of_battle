/**
 * Issue 0204: an entry whose effective **primary category** is hidden in its
 * contingent is itself hidden. The WHFB6 Definitive game system gates Lords
 * below 2000 points only through `set hidden=true` on the `Lord`
 * `categoryEntry` — the category's own max stays at 1 — so without this rule a
 * 1000-point army is offered Lords.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';
import { AnchorKind } from '../../../../contexts/ruleengine/engine/model.js';

globalThis.DOMParser = new JSDOM().window.DOMParser;

const FORCE_ID = 'force-army';
const CATEGORY_ID = 'cat-lord';
const CATEGORY_LINK_ID = 'link-lord';
const LORD_ID = 'entry-lord';
const OTHER_ID = 'entry-other';
const PTS = 'pts';

const SYNTHETIC = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-0204" name="Primary Category Gate">
  <costTypes><costType id="${PTS}" name="pts" defaultCostLimit="-1"/></costTypes>
  <categoryEntries>
    <categoryEntry id="${CATEGORY_ID}" name="Lord" hidden="false">
      <modifiers>
        <modifier type="set" value="true" field="hidden">
          <conditions>
            <condition type="lessThan" value="2000" field="limit::${PTS}" scope="roster" childId="any" shared="true"/>
          </conditions>
        </modifier>
      </modifiers>
    </categoryEntry>
  </categoryEntries>
  <forceEntries>
    <forceEntry id="${FORCE_ID}" name="Army">
      <categoryLinks>
        <categoryLink id="${CATEGORY_LINK_ID}" name="Lord" targetId="${CATEGORY_ID}" primary="false"/>
      </categoryLinks>
    </forceEntry>
  </forceEntries>
  <selectionEntries>
    <selectionEntry id="${LORD_ID}" name="Lord Unit" type="unit">
      <categoryLinks><categoryLink id="cl-lord" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
    </selectionEntry>
    <selectionEntry id="${OTHER_ID}" name="Other Unit" type="unit"/>
  </selectionEntries>
</catalogue>`;

function roster(points, children = []) {
  return {
    forces: [{ defId: FORCE_ID, count: 1, children }],
    costLimits: [{ costTypeId: PTS, value: points }],
  };
}

function capabilityOf(report, defId, anchorKind) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId && capability.anchorKind === anchorKind) return capability;
  }
  return null;
}

const synthetic = prepareDataset({ catalogues: [SYNTHETIC] });

describe('Versteckte Primaerkategorie versteckt ihre Eintraege (Issue 0204)', () => {
  it('versteckt das Angebot eines Eintrags, dessen Primaerkategorie versteckt ist', () => {
    const report = evaluateDataset(synthetic, roster(1000));
    expect(capabilityOf(report, LORD_ID, AnchorKind.OFFER_ANCHOR).isHidden).toBe(true);
  });

  it('KONTROLLE: laesst Eintraege anderer Kategorien sichtbar', () => {
    const report = evaluateDataset(synthetic, roster(1000));
    expect(capabilityOf(report, OTHER_ID, AnchorKind.OFFER_ANCHOR).isHidden).toBe(false);
  });

  it('deckt das Angebot wieder auf, sobald die Kategorie sichtbar wird', () => {
    const report = evaluateDataset(synthetic, roster(2000));
    expect(capabilityOf(report, LORD_ID, AnchorKind.OFFER_ANCHOR).isHidden).toBe(false);
  });

  it('meldet einen trotzdem gewaehlten Eintrag als versteckte Auswahl', () => {
    const report = evaluateDataset(synthetic, roster(1000, [{ defId: LORD_ID, count: 1, children: [] }]));
    expect(report.violations.some(v => v.origin === 'hiddenSelection')).toBe(true);
  });
});

describe('WHFB6 Definitive: keine Lords unter 2000 Punkten (Issue 0204)', () => {
  const dir = join(process.cwd(), 'src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive');
  const dataset = prepareDataset({
    gameSystem: readFileSync(join(dir, 'Warhammer Fantasy Battles (6th definitive edition).gst'), 'utf8'),
    catalogues: [readFileSync(join(dir, 'Vampire Counts (6th definitive edition).cat'), 'utf8')],
  });
  const STANDARD_FORCE = 'e989-15b8-7eb6-9668';
  const MASTER_NECROMANCER = '4ee2-ac3a-3cc6-11af';
  const real = points => ({
    forces: [{ defId: STANDARD_FORCE, count: 1, children: [] }],
    costLimits: [{ costTypeId: 'ecfa-8486-4f6c-c249', value: points }],
  });

  it('versteckt den Master Necromancer bei 1000 Punkten', () => {
    const report = evaluateDataset(dataset, real(1000));
    expect(capabilityOf(report, MASTER_NECROMANCER, AnchorKind.OFFER_ANCHOR).isHidden).toBe(true);
  });

  it('bietet den Master Necromancer bei 2000 Punkten an', () => {
    const report = evaluateDataset(dataset, real(2000));
    expect(capabilityOf(report, MASTER_NECROMANCER, AnchorKind.OFFER_ANCHOR).isHidden).toBe(false);
  });
});
