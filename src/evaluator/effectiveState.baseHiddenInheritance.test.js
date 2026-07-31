import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
// Semantik (`effectiveState.js`), Stand Issue 0135:
//  1. Ein `entryLink` uebernimmt das Basis-`hidden` seines (transitiv aufgeloesten)
//     Ziels — unabhaengig davon, ob er selbst eines traegt.
//  2. Verweis und Ziel wirken zusammen (ODER): versteckt ist ein Vorkommen, wenn
//     EINE der beiden Seiten es versteckt. Die frueher hier notierte Vorrangregel
//     „ein am Link explizit gesetztes `hidden` geht dem Ziel vor" gilt nur noch in
//     ihrer „true"-Haelfte; siehe den Kommentar am Kriterium-2-Block unten.
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

  // ZURUECKGENOMMEN (Issue 0135, Kriterium 1): frueher galt hier „explizites
  // hidden="false" am Link schlaegt das hidden='true' des Ziels". An echten
  // Katalogen ist diese Haelfte der Regel falsch — Battlescribe schreibt das
  // Attribut an JEDEM entryLink (0 von 2302 in den DE-Fixtures lassen es weg),
  // sodass das Basis-hidden eines Ziels ein Vorkommen nie erreichte und das
  // gaengigste Gatter-Muster der Kataloge (geteilte Definition hidden="true" +
  // bedingter Aufdeck-Modifikator, 37 von 42 Faellen in den Fixtures) wirkungslos
  // blieb. Versteckt ist ein Vorkommen jetzt, wenn Verweis ODER Ziel es sind.
  it('versteckt ein Vorkommen, dessen Link explizit hidden="false" setzt, weil das Ziel hidden="true" traegt', () => {
    const report = evaluate(catalogueWith({
      shared: `<selectionEntry id="${SHARED_ID}" name="Hidden Shared" type="model" hidden="true"/>`,
      links: `<entryLink id="${LINK_ID}" name="Hidden Shared" targetId="${SHARED_ID}" type="selectionEntry" hidden="false"/>`,
    }), squadWithChild(LINK_ID));

    expect(occupiedCapabilityOf(report, LINK_ID).isHidden).toBe(true);
  });

  // Die Gegenprobe zur zurueckgenommenen Haelfte: dasselbe Katalogmuster, aber
  // mit dem bedingten Aufdeck-Modifikator am Ziel — er muss das geerbte
  // hidden="true" schlagen, sonst waere das Muster nur andersherum kaputt.
  it('macht dasselbe Vorkommen sichtbar, sobald ein Aufdeck-Modifikator am Ziel greift', () => {
    const report = evaluate(catalogueWith({
      shared: `
        <selectionEntry id="${SHARED_ID}" name="Hidden Shared" type="model" hidden="true">
          <modifiers>
            <modifier type="set" field="hidden" value="false"/>
          </modifiers>
        </selectionEntry>`,
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

// ─────────────────────────────────────────────────────────────────────────────
// Echte Katalogdaten: das Blutlinien-Gatter in einer `modifierGroup`
//
// Die Oder-Regel aus Kriterium 1/2 darf keinen Aufdeck-Modifikator verlieren, der
// nicht in `<modifiers>`, sondern in einer bedingten `<modifierGroup>` steht
// (`Catalogue.xsd:523-538`) — ein Ort, den Kataloge gleichberechtigt nutzen.
//
// Zwei geteilte Eintraege der Vampire Counts gattern genau so, jeweils auf eine
// Blutlinie: „Full Plate Armour" (`hidden="true"`, aufgedeckt durch Blood Dragon,
// angeboten per Link mit `hidden="false"` an Vampirlord und Vampirgraf) und
// „Necrarch additional casting dice" (aufgedeckt durch Necrarch). Beide Faelle
// waren in der ersten Fassung von Issue 0135 faelschlich als Katalog-Datenfehler
// notiert; der Test nagelt fest, dass sie es nicht sind.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_DIR = join(process.cwd(), 'src/evaluator/__fixtures__/whfb6-definitive');

/** Liest eine Datei der eingefrorenen Definitive-Edition-Kataloge. */
function fixture(fileName) {
  return readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
}

const VC_STANDARD_FORCE_ID = 'e989-15b8-7eb6-9668';
const BLOODLINES_ID = 'a56a-eb32-5a45-16fd';
const BLOOD_DRAGON_ID = '9fd9-e05c-ffcb-2c4d';
const NECRARCH_ID = '5017-296d-edef-4562';
const VAMPIRE_LORD_ID = 'b77b-88d5-5e80-e178';
const VAMPIRE_COUNT_ID = '6822-0110-a7c9-cbb0';

/** Die beiden Verweise auf „Full Plate Armour" (`3869-2f40-dd21-6971`). */
const FULL_PLATE_LINKS = Object.freeze([
  { unitId: VAMPIRE_LORD_ID, linkId: '7444-fade-d336-53b9', unit: '0-1 Vampire Lord' },
  { unitId: VAMPIRE_COUNT_ID, linkId: 'a4d1-6e85-bee8-55d1', unit: 'Vampire Count' },
]);

/** Die Verweise auf „Necrarch additional casting dice" (`68c7-4c56-8f0b-ad91`). */
const NECRARCH_DICE_LINKS = Object.freeze([
  { unitId: VAMPIRE_LORD_ID, linkId: 'b71c-a60d-b956-74bc', unit: '0-1 Vampire Lord' },
  { unitId: VAMPIRE_COUNT_ID, linkId: 'd2e6-8ca6-4f19-5b55', unit: 'Vampire Count' },
]);

/**
 * Der aufbereitete DE-Datensatz (gst + Vampire Counts) — einmal je Testlauf.
 * `prepareDataset` traegt den Loewenanteil der Laufzeit dieser Faelle; ohne die
 * Memoisierung geraet die Datei unter der Parallellast der Suite an das
 * 5-Sekunden-Zeitlimit.
 */
let preparedVampireCounts = null;
function vampireCountsDataset() {
  preparedVampireCounts ??= prepareDataset({
    gameSystem: fixture('Warhammer Fantasy Battles (6th definitive edition).gst'),
    catalogues: [fixture('Vampire Counts (6th definitive edition).cat')],
  });
  return preparedVampireCounts;
}

/** Ein Vampir im Kontingent „Standard (VC-AB)", wahlweise mit einer Blutlinie. */
function evaluateVampire({ unitId, bloodlineId }) {
  const children = [];
  if (bloodlineId) {
    children.push({
      defId: BLOODLINES_ID,
      count: 1,
      children: [{ defId: bloodlineId, count: 1, children: [] }],
    });
  }
  children.push({ defId: unitId, count: 1, children: [] });

  return evaluateDataset(
    vampireCountsDataset(), { forces: [{ defId: VC_STANDARD_FORCE_ID, count: 1, children }] });
}

/** Der Faehigkeitsdatensatz einer Definitions-ID, gleich welcher Ankerart. */
function anyCapabilityOf(report, defId) {
  return [...report.capabilities.values()].find(capability => capability.defId === defId) ?? null;
}

describe('Echte Katalogdaten: Aufdecken durch eine bedingte modifierGroup', () => {
  for (const { unitId, linkId, unit } of FULL_PLATE_LINKS) {
    it(`versteckt „Full Plate Armour" an ${unit} ohne Blutlinie`, () => {
      const capability = anyCapabilityOf(evaluateVampire({ unitId, bloodlineId: null }), linkId);

      expect(capability, `kein Slot fuer ${linkId}`).not.toBeNull();
      expect(capability.isHidden).toBe(true);
    });

    it(`zeigt „Full Plate Armour" an ${unit}, sobald Blood Dragon gefuehrt wird`, () => {
      const capability = anyCapabilityOf(
        evaluateVampire({ unitId, bloodlineId: BLOOD_DRAGON_ID }), linkId);

      expect(capability, `kein Slot fuer ${linkId}`).not.toBeNull();
      expect(capability.isHidden).toBe(false);
    });

    it(`haelt „Full Plate Armour" an ${unit} unter einer FREMDEN Blutlinie versteckt`, () => {
      const capability = anyCapabilityOf(
        evaluateVampire({ unitId, bloodlineId: NECRARCH_ID }), linkId);

      expect(capability, `kein Slot fuer ${linkId}`).not.toBeNull();
      expect(capability.isHidden).toBe(true);
    });
  }

  for (const { unitId, linkId, unit } of NECRARCH_DICE_LINKS) {
    it(`deckt „Necrarch additional casting dice" an ${unit} genau unter Necrarch auf`, () => {
      const ohne = anyCapabilityOf(evaluateVampire({ unitId, bloodlineId: null }), linkId);
      const necrarch = anyCapabilityOf(
        evaluateVampire({ unitId, bloodlineId: NECRARCH_ID }), linkId);
      const fremd = anyCapabilityOf(
        evaluateVampire({ unitId, bloodlineId: BLOOD_DRAGON_ID }), linkId);

      expect(ohne, `kein Slot fuer ${linkId}`).not.toBeNull();
      expect(ohne.isHidden).toBe(true);
      expect(necrarch.isHidden).toBe(false);
      expect(fremd.isHidden).toBe(true);
    });
  }
});
