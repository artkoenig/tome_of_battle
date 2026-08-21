import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoster } from './useRoster';
import { processImportedData } from '../parser/xmlParser';
import { buildRoster } from '../roster/createRoster';

/**
 * Issue 0157, AC3: der Preis, den der Aushebe-Dialog **vor** dem Ausheben
 * anzeigt, und der Preis der ausgehobenen Auswahl stimmen ueberein — und beide
 * stammen aus **einer** Quelle, dem Bericht.
 *
 * Der Dialog liest `capability.raiseCosts` am Angebots-Anker
 * (`CategoryUnitAdder.jsx`), die Karte `capability.totalCosts` am belegten Slot
 * (`UnitSelectionCard.jsx`). Der frueher danebenstehende zweite Rechenweg
 * (`getOptionDisplayCost` in `src/roster/rosterCounter.js`) ist entfallen; diese
 * Datei haelt fest, dass die eine verbliebene Quelle beide Zahlen traegt und
 * sie nicht auseinanderlaufen, wenn ein Pflicht-Kind mitkommt.
 *
 * Produktionsnaht, nichts gemockt: Katalog-XML → `processImportedData` →
 * `useRoster.addUnit` → `useEvaluation`.
 */

const GAME_SYSTEM_ID = 'gs-cost-agreement';
const CATALOGUE_ID = 'cat-cost-agreement';
const FORCE_DEF_ID = 'force-army';
const HERO_CATEGORY_ID = 'cat-heroes';
const PTS_ID = 'pts-guid-1111';

const CHAMPION_ID = 'entry-champion';
const SWORD_ID = 'entry-sword';

const CHAMPION_COST = 50;
const SWORD_COST = 10;
/** Was das Ausheben kostet: der Held und sein Pflicht-Schwert. */
const RECRUITED_COST = CHAMPION_COST + SWORD_COST;

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Cost Agreement">
    <costTypes>
      <costType id="${PTS_ID}" name="pts" defaultCostLimit="-1"/>
    </costTypes>
    <categoryEntries>
      <categoryEntry id="${HERO_CATEGORY_ID}" name="Heroes"/>
    </categoryEntries>
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Army">
        <categoryLinks>
          <categoryLink id="fcl-heroes" name="Heroes" targetId="${HERO_CATEGORY_ID}" primary="false"/>
        </categoryLinks>
      </forceEntry>
    </forceEntries>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${CATALOGUE_ID}" name="Army Book" gameSystemId="${GAME_SYSTEM_ID}">
    <selectionEntries>
      <selectionEntry id="${CHAMPION_ID}" name="Champion" type="unit" hidden="false">
        <costs>
          <cost name="pts" typeId="${PTS_ID}" value="${CHAMPION_COST}.0"/>
        </costs>
        <categoryLinks>
          <categoryLink id="cl-champion" name="Heroes" targetId="${HERO_CATEGORY_ID}" primary="true"/>
        </categoryLinks>
        <selectionEntries>
          <selectionEntry id="${SWORD_ID}" name="Sword" type="upgrade" hidden="false">
            <constraints>
              <constraint type="min" value="1.0" field="selections" scope="parent" shared="true" id="min-sword" includeChildSelections="false"/>
              <constraint type="max" value="1.0" field="selections" scope="parent" shared="true" id="max-sword" includeChildSelections="false"/>
            </constraints>
            <costs>
              <cost name="pts" typeId="${PTS_ID}" value="${SWORD_COST}.0"/>
            </costs>
          </selectionEntry>
        </selectionEntries>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Das App-System: geparste Kataloge und die Roh-XMLs, die der Bericht liest. */
const loadSystem = () => {
  const { system } = processImportedData(
    [{ name: 'cost-agreement.gst', content: GAME_SYSTEM_XML }],
    [{ name: 'cost-agreement.cat', content: CATALOGUE_XML }]
  );
  system.rawXmls = {
    gst: [{ name: 'cost-agreement.gst', content: GAME_SYSTEM_XML }],
    cat: [{ name: 'cost-agreement.cat', content: CATALOGUE_XML }],
  };
  return system;
};

const freshRoster = (system) => buildRoster(
  { name: 'Testliste', systemId: GAME_SYSTEM_ID, catId: CATALOGUE_ID, forceEntryId: FORCE_DEF_ID, limit: 2000 },
  system
);

/** Der Angebots-Anker des Helden unter dem Kontingent — was der Dialog anbietet. */
const offerOf = ({ capabilities, pathByForceId }, forceId) => {
  const forcePath = pathByForceId.get(forceId);
  for (const [path, capability] of capabilities) {
    if (capability.defId === CHAMPION_ID && capability.anchorKind === 'offerAnchor'
      && path.startsWith(`${forcePath}/`)) {
      return capability;
    }
  }
  return null;
};

describe('Aushebe-Schaetzung und ausgehobene Kosten stimmen ueberein (Issue 0157, AC3)', () => {
  it('nennt vor dem Ausheben denselben Preis, den die ausgehobene Auswahl kostet', () => {
    const system = loadSystem();
    const roster = freshRoster(system);
    const forceId = roster.forces[0].id;
    const { result } = renderHook(() => useRoster(roster, system, vi.fn(), undefined, false));

    const offer = offerOf(result.current, forceId);
    expect(offer).toBeTruthy();
    // Die Schaetzung des Dialogs: der Held samt seines Pflicht-Kindes.
    expect(offer.raiseCosts[PTS_ID]).toBe(RECRUITED_COST);

    const entry = system.catalogues
      .find(catalogue => catalogue.id === CATALOGUE_ID)
      .selectionEntries.find(selectionEntry => selectionEntry.id === CHAMPION_ID);
    act(() => {
      result.current.addUnit(entry, HERO_CATEGORY_ID);
    });

    const recruited = result.current.roster.forces[0].selections[0];
    expect(recruited.selectionEntryId).toBe(CHAMPION_ID);
    const recruitedSlot = result.current.capabilities
      .get(result.current.pathBySelectionId.get(recruited.id));
    expect(recruitedSlot.totalCosts[PTS_ID]).toBe(RECRUITED_COST);
    // Eine Quelle: derselbe Bericht traegt beide Zahlen.
    expect(recruitedSlot.totalCosts[PTS_ID]).toBe(offer.raiseCosts[PTS_ID]);
  });

  it('faehrt die Rostersumme des Berichts auf denselben Wert', () => {
    const system = loadSystem();
    const roster = freshRoster(system);
    const { result } = renderHook(() => useRoster(roster, system, vi.fn(), undefined, false));

    const entry = system.catalogues
      .find(catalogue => catalogue.id === CATALOGUE_ID)
      .selectionEntries.find(selectionEntry => selectionEntry.id === CHAMPION_ID);
    act(() => {
      result.current.addUnit(entry, HERO_CATEGORY_ID);
    });

    expect(result.current.costTotals[PTS_ID]).toBe(RECRUITED_COST);
  });
});
