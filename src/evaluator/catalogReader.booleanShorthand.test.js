/**
 * Issue 0102, Punkt 6 (= Akzeptanzkriterium 2): die xs:boolean-Kurzformen
 * `"1"`/`"0"` gelten wie `"true"`/`"false"`.
 *
 * Vertrag (Issue-Plan, 2026-07-29):
 * - `hidden="1"` wirkt wie `hidden="true"` (`isHidden === true` an der
 *   gelesenen Definition); `hidden="0"` wie `hidden="false"` — insbesondere
 *   ueberschreibt ein `entryLink` mit `hidden="0"` das Basis-`hidden="true"`
 *   seines Ziels (Effektivzustand/Fassade: nicht versteckt; Repro-Muster wie
 *   `effectiveState.baseHiddenInheritance.test.js`).
 * - Auch `percentValue="1"` an constraint/condition/repeat liest sich als
 *   Prozent (`isPercent === true`) — eine gemeinsame Deutungsstelle.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const ENTRY_ID = 'entry-warrior';
const SHARED_ID = 'shared-target';
const SQUAD_ID = 'entry-squad';
const LINK_ID = 'link-to-shared';
const COST_TYPE_ID = 'cost-points';

/** Ein Katalog mit einem einzelnen Wurzel-Eintrag, der die gegebenen Attribute traegt. */
function entryCatalogue(attrs) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-bool" name="Boolean Catalogue">
      <selectionEntries>
        <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit" ${attrs}/>
      </selectionEntries>
    </catalogue>`;
}

/** Der einzige gelesene Wurzel-Eintrag. */
function parsedEntry(xml) {
  return parseCatalogue(xml).entries.find(def => def.id === ENTRY_ID);
}

// ── hidden="1"/"0" an der gelesenen Definition ───────────────────────────────

describe('parseCatalogue: hidden in xs:boolean-Kurzform', () => {
  it('liest hidden="1" wie hidden="true": die Definition ist versteckt', () => {
    expect(parsedEntry(entryCatalogue('hidden="1"')).isHidden).toBe(true);
  });

  it('KONTROLLE: hidden="0" liest sich wie hidden="false": die Definition ist sichtbar', () => {
    expect(parsedEntry(entryCatalogue('hidden="0"')).isHidden).toBe(false);
  });

  it('deutet die Kurzform auch an der gemeinsamen Boolean-Lesung anderer Elemente (costType hidden="1")', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-bool-cost" name="Boolean CostType Catalogue">
        <costTypes>
          <costType id="${COST_TYPE_ID}" name="pts" hidden="1"/>
        </costTypes>
      </catalogue>`;

    expect(parseCatalogue(xml).costTypes[0].isHidden).toBe(true);
  });
});

// ── hidden="0"/"1" am entryLink: explizit gesetzt, nicht "nicht gesetzt" ─────

describe('Fassade: hidden-Kurzform am entryLink (Repro-Muster Basis-hidden-Vererbung)', () => {
  /** Katalog: geteilter Eintrag als Link-Ziel, Link haengt unter einem Squad. */
  function linkCatalogue({ sharedAttrs, linkAttrs }) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-bool-link" name="Boolean Link Catalogue">
        <sharedSelectionEntries>
          <selectionEntry id="${SHARED_ID}" name="Shared" type="model" ${sharedAttrs}/>
        </sharedSelectionEntries>
        <selectionEntries>
          <selectionEntry id="${SQUAD_ID}" name="Squad" type="unit">
            <entryLinks>
              <entryLink id="${LINK_ID}" name="Shared" targetId="${SHARED_ID}" type="selectionEntry" ${linkAttrs}/>
            </entryLinks>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  /** Der Faehigkeitsdatensatz des belegten Link-Slots. */
  function occupiedLinkCapability(catalogXml) {
    const roster = {
      forces: [{
        defId: SQUAD_ID,
        count: 1,
        children: [{ defId: LINK_ID, count: 1, children: [] }],
      }],
    };
    const report = evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
    for (const capability of report.capabilities.values()) {
      if (capability.defId === LINK_ID && capability.anchorKind === AnchorKind.OCCUPIED) {
        return capability;
      }
    }
    return null;
  }

  it('haelt ein Vorkommen sichtbar, dessen Link explizit hidden="0" setzt, obwohl das Ziel hidden="true" traegt', () => {
    // Das verschaerfte Repro aus den Decisions (Review-Runde 2 von Issue 0099):
    // hidden="0" ist ein GESETZTES false und muss das Basis-hidden des Ziels
    // ueberschreiben — heute liest es sich als "nicht gesetzt" und erbt true.
    const capability = occupiedLinkCapability(linkCatalogue({
      sharedAttrs: 'hidden="true"',
      linkAttrs: 'hidden="0"',
    }));

    expect(capability).not.toBeNull();
    expect(capability.isHidden).toBe(false);
  });

  it('versteckt ein Vorkommen, dessen Link hidden="1" setzt, obwohl das Ziel sichtbar ist', () => {
    const capability = occupiedLinkCapability(linkCatalogue({
      sharedAttrs: '',
      linkAttrs: 'hidden="1"',
    }));

    expect(capability).not.toBeNull();
    expect(capability.isHidden).toBe(true);
  });
});

// ── percentValue="1" an constraint / condition / repeat ──────────────────────

describe('parseCatalogue: percentValue in xs:boolean-Kurzform', () => {
  it('liest percentValue="1" an einer Grenze als Prozentgrenze', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-pct-constraint" name="Percent Constraint Catalogue">
        <selectionEntries>
          <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
            <constraints>
              <constraint id="limit-half" type="max" value="50" percentValue="1" field="selections" scope="roster"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;

    expect(parsedEntry(xml).limits[0].isPercent).toBe(true);
  });

  it('liest percentValue="1" an einer Bedingung als Prozentvergleich', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-pct-condition" name="Percent Condition Catalogue">
        <selectionEntries>
          <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
            <modifiers>
              <modifier type="set" field="hidden" value="true">
                <conditions>
                  <condition type="atLeast" field="selections" scope="roster" value="25" percentValue="1"/>
                </conditions>
              </modifier>
            </modifiers>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;

    expect(parsedEntry(xml).modifiers[0].conditions[0].isPercent).toBe(true);
  });

  it('liest percentValue="1" an einem Repeat als prozentuale Schrittweite', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-pct-repeat" name="Percent Repeat Catalogue">
        <selectionEntries>
          <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
            <modifiers>
              <modifier type="increment" field="limit-any" value="1">
                <repeats>
                  <repeat field="selections" scope="roster" value="50" percentValue="1"/>
                </repeats>
              </modifier>
            </modifiers>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;

    expect(parsedEntry(xml).modifiers[0].repeats[0].isPercent).toBe(true);
  });

  it('KONTROLLE: percentValue="0" bleibt eine absolute Grenze', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-pct-zero" name="Percent Zero Catalogue">
        <selectionEntries>
          <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
            <constraints>
              <constraint id="limit-two" type="max" value="2" percentValue="0" field="selections" scope="roster"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;

    expect(parsedEntry(xml).limits[0].isPercent).toBe(false);
  });
});
