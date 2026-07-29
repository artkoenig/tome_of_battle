import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Wertet einen einzelnen synthetischen Katalog ueber die zweistufige Fassade aus
 * (Konvention wie `report.test.js`): erst aufbereiten, dann auswerten.
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue 0099: Das Basis-`hidden` eines Verweisziels muss das Vorkommen erreichen.
//
// Semantik (Erb-Regel „eigene Angaben vor geerbten", `effectiveState.js`):
//  1. Ein `entryLink` OHNE eigenes `hidden`-Attribut uebernimmt das Basis-`hidden`
//     seines (transitiv aufgeloesten) Ziels.
//  2. Ein am Link explizit gesetztes `hidden` (true ODER false) geht dem Ziel vor.
//  3. `hidden`-Modifikatoren behalten ihren Vorrang vor beiden Basiswerten.
//
// Beobachtbar an der Fassade: der Faehigkeitsdatensatz (`capability.isHidden`)
// des belegten Slots im Bericht — dieselbe Beobachtungsstelle, die auch
// `report.test.js` fuer Sichtbarkeit nutzt.
// ─────────────────────────────────────────────────────────────────────────────

const SQUAD_ID = 'entry-squad';
const SHARED_ID = 'shared-target';
const LINK_ID = 'link-to-shared';
const CHAIN_LINK_ID = 'link-chain-outer';
const MID_LINK_ID = 'link-chain-mid';

/**
 * Ein Katalog mit einem Traeger-Eintrag („Squad"), unter dem die uebergebenen
 * `entryLink`s haengen, und den uebergebenen geteilten Eintraegen als Link-Ziele.
 */
function catalogueWith({ shared, links }) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-base-hidden" name="Base Hidden Inheritance Catalogue">
      <sharedSelectionEntries>${shared}</sharedSelectionEntries>
      <selectionEntries>
        <selectionEntry id="${SQUAD_ID}" name="Squad" type="unit">
          <entryLinks>${links}</entryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Roster: ein Squad mit genau einem Kind-Vorkommen der gegebenen Definitions-ID. */
function squadWithChild(childDefId) {
  return {
    forces: [{
      defId: SQUAD_ID,
      count: 1,
      children: [{ defId: childDefId, count: 1, children: [] }],
    }],
  };
}

/** Der Faehigkeitsdatensatz des BELEGTEN Slots einer Definitions-ID. */
function occupiedCapabilityOf(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId && capability.anchorKind === AnchorKind.OCCUPIED) {
      return capability;
    }
  }
  return null;
}

// ── Kriterium 1: Link ohne eigenes hidden erbt das Basis-hidden des Ziels ────

describe('Basis-hidden-Vererbung: Link ohne eigenes hidden-Attribut (Kriterium 1)', () => {
  it('uebernimmt das Basis-hidden="true" des geteilten Ziels: das Vorkommen ist versteckt', () => {
    // Genau die Reproduktion des Audits (2026-07-28): geteilter Eintrag
    // hidden="true", Link OHNE hidden-Attribut → das Vorkommen muss versteckt
    // sein. Heute meldet die Engine faelschlich isHidden: false.
    const report = evaluate(catalogueWith({
      shared: `<selectionEntry id="${SHARED_ID}" name="Hidden Shared" type="model" hidden="true"/>`,
      links: `<entryLink id="${LINK_ID}" name="Hidden Shared" targetId="${SHARED_ID}" type="selectionEntry"/>`,
    }), squadWithChild(LINK_ID));

    expect(occupiedCapabilityOf(report, LINK_ID)).not.toBeNull();
    expect(occupiedCapabilityOf(report, LINK_ID).isHidden).toBe(true);
  });

  it('erbt auch TRANSITIV ueber eine Link→Link-Kette: kein Link setzt hidden, das Endziel traegt hidden="true"', () => {
    // Kette: aeusserer Link → mittlerer Link → geteilter Eintrag hidden="true".
    // Der Resolver loest transitiv auf (`followEntryLink`); das Vorkommen des
    // aeusseren Links muss das Basis-hidden des Endziels tragen.
    const report = evaluate(catalogueWith({
      shared: `<selectionEntry id="${SHARED_ID}" name="Hidden Shared" type="model" hidden="true"/>`,
      links: `
        <entryLink id="${CHAIN_LINK_ID}" name="Outer" targetId="${MID_LINK_ID}" type="selectionEntry"/>
        <entryLink id="${MID_LINK_ID}" name="Mid" targetId="${SHARED_ID}" type="selectionEntry"/>`,
    }), squadWithChild(CHAIN_LINK_ID));

    expect(occupiedCapabilityOf(report, CHAIN_LINK_ID)).not.toBeNull();
    expect(occupiedCapabilityOf(report, CHAIN_LINK_ID).isHidden).toBe(true);
  });
});

// ── Kriterium 2: explizites hidden am Link geht dem Ziel vor ─────────────────

describe('Basis-hidden-Vererbung: explizites hidden am Link (Kriterium 2)', () => {
  // PIN (heute gruen): das eigene hidden="true" des Links wirkt schon heute.
  // Der Test nagelt fest, dass die Reparatur der Vererbung es nicht verliert.
  it('haelt ein Vorkommen versteckt, dessen Link hidden="true" setzt, obwohl das Ziel kein hidden traegt', () => {
    const report = evaluate(catalogueWith({
      shared: `<selectionEntry id="${SHARED_ID}" name="Visible Shared" type="model"/>`,
      links: `<entryLink id="${LINK_ID}" name="Visible Shared" targetId="${SHARED_ID}" type="selectionEntry" hidden="true"/>`,
    }), squadWithChild(LINK_ID));

    expect(occupiedCapabilityOf(report, LINK_ID).isHidden).toBe(true);
  });

  // PIN (heute zufaellig gruen, weil der Leser jedes fehlende hidden zu false
  // materialisiert): Nach der Reparatur muss XML weiterhin „false gesetzt" von
  // „nicht gesetzt" unterscheiden — das explizite hidden="false" am Link schlaegt
  // das hidden="true" des Ziels. Eine naive Reparatur (z. B. ODER-Verknuepfung
  // der beiden Basiswerte) risse genau diesen Fall.
  it('haelt ein Vorkommen sichtbar, dessen Link explizit hidden="false" setzt, obwohl das Ziel hidden="true" traegt', () => {
    const report = evaluate(catalogueWith({
      shared: `<selectionEntry id="${SHARED_ID}" name="Hidden Shared" type="model" hidden="true"/>`,
      links: `<entryLink id="${LINK_ID}" name="Hidden Shared" targetId="${SHARED_ID}" type="selectionEntry" hidden="false"/>`,
    }), squadWithChild(LINK_ID));

    expect(occupiedCapabilityOf(report, LINK_ID).isHidden).toBe(false);
  });
});

// ── Kriterium 3: hidden-Modifikatoren behalten Vorrang vor beiden Basiswerten ─

describe('Basis-hidden-Vererbung: Modifikatoren behalten Vorrang (Kriterium 3)', () => {
  // PIN (heute gruen): ein set-hidden-true-Modifikator am Link versteckt das
  // Vorkommen, obwohl weder Link noch Ziel ein Basis-hidden tragen.
  it('versteckt ein Vorkommen per Modifikator am Link, obwohl beide Basiswerte sichtbar sind', () => {
    const report = evaluate(catalogueWith({
      shared: `<selectionEntry id="${SHARED_ID}" name="Visible Shared" type="model"/>`,
      links: `
        <entryLink id="${LINK_ID}" name="Visible Shared" targetId="${SHARED_ID}" type="selectionEntry">
          <modifiers>
            <modifier type="set" field="hidden" value="true"/>
          </modifiers>
        </entryLink>`,
    }), squadWithChild(LINK_ID));

    expect(occupiedCapabilityOf(report, LINK_ID).isHidden).toBe(true);
  });

  // PIN (heute zufaellig gruen, weil das Basis-hidden des Ziels das Vorkommen nie
  // erreicht): Nach der Reparatur muss der set-hidden-false-Modifikator am Link
  // weiterhin ueber dem dann GEERBTEN Basis-hidden="true" des Ziels stehen —
  // Modifikator schlaegt Basiswert, auch den geerbten.
  it('macht ein Vorkommen per Modifikator am Link sichtbar, obwohl das Ziel Basis-hidden="true" traegt', () => {
    const report = evaluate(catalogueWith({
      shared: `<selectionEntry id="${SHARED_ID}" name="Hidden Shared" type="model" hidden="true"/>`,
      links: `
        <entryLink id="${LINK_ID}" name="Hidden Shared" targetId="${SHARED_ID}" type="selectionEntry">
          <modifiers>
            <modifier type="set" field="hidden" value="false"/>
          </modifiers>
        </entryLink>`,
    }), squadWithChild(LINK_ID));

    expect(occupiedCapabilityOf(report, LINK_ID).isHidden).toBe(false);
  });

  // PIN (heute zufaellig gruen): ein Modifikator am ZIEL laeuft mit dem Knoten
  // als Traeger (Ziel-Modifikatoren wirken am Vorkommen) und schlaegt das
  // Basis-hidden="true" desselben Ziels — auch nachdem dieses Basis-hidden das
  // Vorkommen erreicht.
  it('macht ein Vorkommen per Modifikator am Ziel sichtbar, obwohl das Ziel Basis-hidden="true" traegt (Link ohne hidden)', () => {
    const report = evaluate(catalogueWith({
      shared: `
        <selectionEntry id="${SHARED_ID}" name="Hidden Shared" type="model" hidden="true">
          <modifiers>
            <modifier type="set" field="hidden" value="false"/>
          </modifiers>
        </selectionEntry>`,
      links: `<entryLink id="${LINK_ID}" name="Hidden Shared" targetId="${SHARED_ID}" type="selectionEntry"/>`,
    }), squadWithChild(LINK_ID));

    expect(occupiedCapabilityOf(report, LINK_ID).isHidden).toBe(false);
  });

  // KONTROLLE (heute gruen, laut Audit korrekt): ein set-hidden-true-Modifikator
  // am Ziel propagiert schon heute ans Vorkommen — die Reparatur des statischen
  // Basiswerts darf diese Modifikator-Propagation nicht beschaedigen.
  it('KONTROLLE: versteckt ein Vorkommen per Modifikator am Ziel, obwohl beide Basiswerte sichtbar sind', () => {
    const report = evaluate(catalogueWith({
      shared: `
        <selectionEntry id="${SHARED_ID}" name="Visible Shared" type="model">
          <modifiers>
            <modifier type="set" field="hidden" value="true"/>
          </modifiers>
        </selectionEntry>`,
      links: `<entryLink id="${LINK_ID}" name="Visible Shared" targetId="${SHARED_ID}" type="selectionEntry"/>`,
    }), squadWithChild(LINK_ID));

    expect(occupiedCapabilityOf(report, LINK_ID).isHidden).toBe(true);
  });
});

// ── Kontrollen: unveraenderte Faelle bleiben unveraendert ─────────────────────

describe('Basis-hidden-Vererbung: Kontrollen', () => {
  const PLAIN_HIDDEN_ID = 'entry-plain-hidden';
  const PLAIN_VISIBLE_ID = 'entry-plain-visible';

  it('KONTROLLE: ein gewoehnlicher Eintrag mit hidden="true" bleibt versteckt', () => {
    const report = evaluate(`<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-plain-hidden" name="Plain Hidden Catalogue">
        <selectionEntries>
          <selectionEntry id="${PLAIN_HIDDEN_ID}" name="Plain Hidden" type="unit" hidden="true"/>
        </selectionEntries>
      </catalogue>`, { forces: [{ defId: PLAIN_HIDDEN_ID, count: 1, children: [] }] });

    expect(occupiedCapabilityOf(report, PLAIN_HIDDEN_ID).isHidden).toBe(true);
  });

  it('KONTROLLE: ein gewoehnlicher Eintrag ohne hidden-Attribut bleibt sichtbar (XSD-Vorgabe)', () => {
    const report = evaluate(`<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-plain-visible" name="Plain Visible Catalogue">
        <selectionEntries>
          <selectionEntry id="${PLAIN_VISIBLE_ID}" name="Plain Visible" type="unit"/>
        </selectionEntries>
      </catalogue>`, { forces: [{ defId: PLAIN_VISIBLE_ID, count: 1, children: [] }] });

    expect(occupiedCapabilityOf(report, PLAIN_VISIBLE_ID).isHidden).toBe(false);
  });

  it('KONTROLLE: ein Link ohne hidden auf ein SICHTBARES Ziel bleibt sichtbar', () => {
    const report = evaluate(catalogueWith({
      shared: `<selectionEntry id="${SHARED_ID}" name="Visible Shared" type="model"/>`,
      links: `<entryLink id="${LINK_ID}" name="Visible Shared" targetId="${SHARED_ID}" type="selectionEntry"/>`,
    }), squadWithChild(LINK_ID));

    expect(occupiedCapabilityOf(report, LINK_ID).isHidden).toBe(false);
  });
});
