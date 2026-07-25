import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';
import { isSelectable, remainingAllowed, mandatoryOpenSlots } from './report.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Eigene, minimale Fixtures (ADR-0030: eigenes Datenmodell, eigene Fixtures) ──
// Slice 07: die zweite Sicht des Berichts — der Faehigkeitsdatensatz je Slot und
// die reinen UI-Projektions-Lookups. Die realistischen WHFB6-Fixtures und der
// Real-Katalog-Rauchtest sind bewusst NICHT hier, sondern in Slice 08 (E2E).

const WARRIOR_DEF_ID = 'entry-warrior';
const WARRIOR_NAME = 'Warrior';

/** Sucht den Faehigkeitsdatensatz eines Slots ueber die Definitions-ID (mit seinem Pfad). */
function slotByDefId(report, defId, { phantom = false } = {}) {
  for (const [path, capability] of report.capabilities) {
    if (capability.node.def?.id === defId && capability.node.isPhantom === phantom) {
      return { path, capability };
    }
  }
  return null;
}

/** Baut ein Roster mit einer einzelnen Instanz gegebener Definition und Anzahl. */
function rosterOf(defId, count) {
  return { forces: [{ defId, count, children: [] }] };
}

describe('Bericht: Faehigkeitsdatensatz einer MAX-Grenze', () => {
  const MAX_WARRIORS = 2;
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-max" name="Capability MAX Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit">
          <constraints>
            <constraint id="max-warriors" type="max" value="${MAX_WARRIORS}" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('weist effektives max, Stand und Restspielraum aus und meldet unter dem Max nicht gesperrt', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, MAX_WARRIORS - 1));

    const { path, capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(capability).toMatchObject({
      effectiveMin: null,
      effectiveMax: MAX_WARRIORS,
      current: MAX_WARRIORS - 1,
      headroom: 1,
      isBlocked: false,
      isMandatoryUnmet: false,
      isHidden: false,
      notes: [],
    });
    // UI-Projektion: rein aus dem Bericht abgeleitet.
    expect(isSelectable(report, path)).toBe(true);
    expect(remainingAllowed(report, path)).toBe(1);
    expect(mandatoryOpenSlots(report)).toHaveLength(0);
  });

  it('meldet einen Slot an seinem Max als gesperrt, mit Restspielraum 0', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, MAX_WARRIORS));

    const { path, capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(capability.isBlocked).toBe(true);
    expect(capability.headroom).toBe(0);
    expect(capability.current).toBe(MAX_WARRIORS);
    // Gesperrt ⇒ nicht auswaehlbar; kein Restspielraum mehr.
    expect(isSelectable(report, path)).toBe(false);
    expect(remainingAllowed(report, path)).toBe(0);
  });

  it('haelt Restspielraum bei 0 (nie negativ), wenn das Max ueberschritten ist', () => {
    const overLimit = MAX_WARRIORS + 1;
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, overLimit));

    const { capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(report.violations).toHaveLength(1);
    expect(capability.isBlocked).toBe(true);
    expect(capability.headroom).toBe(0);
    expect(capability.current).toBe(overLimit);
  });
});

describe('Bericht: Faehigkeitsdatensatz einer MIN-Grenze am realen Knoten', () => {
  const MIN_WARRIORS = 2;
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-min" name="Capability MIN Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit">
          <constraints>
            <constraint id="min-warriors" type="min" value="${MIN_WARRIORS}" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('meldet einen Slot unter seinem Min als Pflicht-unerfuellt und ohne Restspielraum (kein Max)', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, MIN_WARRIORS - 1));

    const { path, capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(capability).toMatchObject({
      effectiveMin: MIN_WARRIORS,
      effectiveMax: null,
      current: MIN_WARRIORS - 1,
      headroom: null,
      isMandatoryUnmet: true,
      isBlocked: false,
    });
    // Ohne Max weder gesperrt noch versteckt ⇒ auswaehlbar; offener Pflichtslot.
    expect(isSelectable(report, path)).toBe(true);
    expect(remainingAllowed(report, path)).toBeNull();
    expect(mandatoryOpenSlots(report)).toEqual([capability]);
  });

  it('meldet den Slot nicht mehr als Pflicht-unerfuellt, sobald das Min erreicht ist', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, MIN_WARRIORS));

    const { capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(capability.isMandatoryUnmet).toBe(false);
    expect(capability.current).toBe(MIN_WARRIORS);
    expect(mandatoryOpenSlots(report)).toHaveLength(0);
  });
});

describe('Bericht: Faehigkeitsdatensatz eines Phantom-Pflichtslots (Pflicht-Absenz)', () => {
  const OGRE_DEF_ID = 'entry-ogre-bulls';
  const MIN_OGRE = 2;
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-phantom" name="Capability Phantom Catalogue">
      <selectionEntries>
        <selectionEntry id="${OGRE_DEF_ID}" name="Ogerbullen" type="unit">
          <constraints>
            <constraint id="min-ogre" type="min" value="${MIN_OGRE}" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  it('legt fuer den fehlenden Pflichteintrag einen Phantom-Slot mit Stand 0 und Pflicht-unerfuellt an', () => {
    // Roster ohne Ogerbullen — der Pflichteintrag fehlt ganz.
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, 3));

    const phantom = slotByDefId(report, OGRE_DEF_ID, { phantom: true });
    expect(phantom).not.toBeNull();
    expect(phantom.capability).toMatchObject({
      effectiveMin: MIN_OGRE,
      current: 0,
      headroom: null,
      isMandatoryUnmet: true,
    });
    // Der Phantom-Slot ist ein offener Pflichtslot des Berichts.
    expect(mandatoryOpenSlots(report)).toContainEqual(phantom.capability);
  });
});

describe('Bericht: versteckter Slot', () => {
  const HIDDEN_DEF_ID = 'entry-hidden-relic';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-hidden" name="Capability Hidden Catalogue">
      <selectionEntries>
        <selectionEntry id="${HIDDEN_DEF_ID}" name="Verborgenes Relikt" type="upgrade">
          <modifiers>
            <modifier operation="set" targetKind="hidden" value="true"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('meldet einen durch Modifikator versteckten Slot als versteckt und damit als nicht auswaehlbar', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(HIDDEN_DEF_ID, 1));

    const { path, capability } = slotByDefId(report, HIDDEN_DEF_ID);
    expect(capability.isHidden).toBe(true);
    expect(isSelectable(report, path)).toBe(false);
  });
});

describe('Bericht: bedingte Hinweise am Slot', () => {
  const BANNER_DEF_ID = 'entry-banner-unit';
  const NOTE_TEXT = 'Verbund erst ab zwei Einheiten';
  const NOTE_THRESHOLD = 2;
  // Ein APPEND_NOTE-Modifikator unter einer Bedingung: der Hinweis erscheint nur,
  // wenn die Bedingung (self >= 2 Selektionen) haelt.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-note" name="Capability Note Catalogue">
      <selectionEntries>
        <selectionEntry id="${BANNER_DEF_ID}" name="Bannertraeger" type="unit">
          <modifiers>
            <modifier operation="appendNote" targetKind="note" value="${NOTE_TEXT}">
              <conditions>
                <condition op="atLeast" field="selections" scope="self" value="${NOTE_THRESHOLD}"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('haengt den bedingten Hinweis an den betreffenden Slot, wenn die Bedingung haelt', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(BANNER_DEF_ID, NOTE_THRESHOLD));

    const { capability } = slotByDefId(report, BANNER_DEF_ID);
    expect(capability.notes).toEqual([NOTE_TEXT]);
  });

  it('laesst den Hinweis am Slot aus, wenn die Bedingung nicht haelt (der Hinweis ist wirklich bedingt)', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(BANNER_DEF_ID, NOTE_THRESHOLD - 1));

    const { capability } = slotByDefId(report, BANNER_DEF_ID);
    expect(capability.notes).toEqual([]);
  });
});

describe('Bericht: UI-Projektions-Lookups sind reine Bericht-Leser', () => {
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-lookup" name="Capability Lookup Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit">
          <constraints>
            <constraint id="max-warriors" type="max" value="3" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('behandelt einen unbekannten Pfad als nicht auswaehlbar und ohne Restspielraum, statt zu werfen', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, 1));

    expect(isSelectable(report, 'kein-solcher-pfad')).toBe(false);
    expect(remainingAllowed(report, 'kein-solcher-pfad')).toBeNull();
  });
});

describe('Bericht: alle ausgeloesten Diagnosen sind gesammelt', () => {
  const HERO_DEF_ID = 'entry-hero';
  const UNKNOWN_SCOPE = 'kein-rahmen';
  const POINTS_COST_ID = 'pts';
  // Ein einziger Katalog/Roster, der drei verschiedene Diagnose-Arten ausloest:
  //  - Null-Nenner (Prozentgrenze auf eine nirgends getragene Kostenart),
  //  - nicht aufloesbarer Bezugsrahmen (MIN-Grenze mit unbekanntem Scope),
  //  - unaufloesbare Definition (Roster verweist auf eine unbekannte ID).
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-diagnostics" name="Capability Diagnostics Catalogue">
      <selectionEntries>
        <selectionEntry id="${HERO_DEF_ID}" name="Held" type="unit">
          <constraints>
            <constraint id="pct-max" type="max" value="50" field="${POINTS_COST_ID}" scope="roster" percentValue="true"/>
            <constraint id="bad-scope-min" type="min" value="1" field="selections" scope="${UNKNOWN_SCOPE}"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('vereint Resolver-, Nichtaufloesungs- und Null-Nenner-Diagnosen im Bericht', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [
        { defId: HERO_DEF_ID, count: 1, children: [] },
        { defId: 'unbekannt', count: 1, children: [] },
      ],
    });

    expect(report.diagnostics).toContainEqual(expect.objectContaining({ kind: 'zeroDenominator' }));
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedScope', scope: UNKNOWN_SCOPE })
    );
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedDefinition', defId: 'unbekannt' })
    );
  });
});
