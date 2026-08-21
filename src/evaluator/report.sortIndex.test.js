/**
 * Issue 0133, Kriterium 1 — `sortIndex` wird von `catalogReader.js` gelesen
 * und als rein deskriptives Datenfeld (kein Gültigkeits-Urteil) durch
 * `evalTree.js`/`report.js` bis auf die `capabilities`/Slot-Objekte
 * durchgereicht, die `SlotIndex#childSlotsOf` (`src/evaluation/slotIndex.js`) liefert.
 *
 * Kriterium 3 (Datenebene): `sortIndex` teilt sich einen gemeinsamen
 * Nummerierungsraum über Geschwister unterschiedlichen Typs hinweg — ein
 * `entryLink` und eine `selectionEntryGroup` unter demselben Rahmen tragen
 * hier je ihren eigenen numerischen Wert, unabhängig von ihrer Elementart;
 * die tatsächliche Interleaving-Sortierung ist UI-Sache
 * (`SelectionConfigurator.sortIndex.test.jsx`) — hier wird nur geprüft, dass
 * beide Werte unverfälscht am jeweiligen Slot ankommen.
 *
 * Aufbau: eigene minimale Fixtures und die zweistufige Fassade wie in
 * `report.sourceId.test.js` — dieselbe Zwei-Stufen-Fassade
 * (`prepareDataset` + `evaluate`), dieselbe Slot-Lookup-Konvention
 * (`slotOf`).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { prepareDataset, evaluate } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-main';
const COST_TYPE_ID = 'cost-pts';
const FORCE_DEF_ID = 'force-main';
const HERO_ID = 'entry-hero';

const TAGGED_ENTRY_ID = 'opt-tagged';
const UNTAGGED_ENTRY_ID = 'opt-untagged';
const NON_NUMERIC_ENTRY_ID = 'opt-non-numeric';
const ZERO_TAGGED_ENTRY_ID = 'opt-zero';
const TAGGED_GROUP_ID = 'grp-tagged';
const TAGGED_LINK_ID = 'link-tagged';
const LINK_TARGET_ID = 'shared-target';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries><forceEntry id="${FORCE_DEF_ID}" name="Main Force"/></forceEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${LINK_TARGET_ID}" name="Linked Target" type="upgrade">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
      </selectionEntry>
    </sharedSelectionEntries>
    <selectionEntries>
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="50"/></costs>
        <selectionEntries>
          <selectionEntry id="${TAGGED_ENTRY_ID}" name="Tagged" type="upgrade" sortIndex="4">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="3"/></costs>
          </selectionEntry>
          <selectionEntry id="${UNTAGGED_ENTRY_ID}" name="Untagged" type="upgrade">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="5"/></costs>
          </selectionEntry>
          <selectionEntry id="${NON_NUMERIC_ENTRY_ID}" name="NonNumeric" type="upgrade" sortIndex="abc">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="2"/></costs>
          </selectionEntry>
          <selectionEntry id="${ZERO_TAGGED_ENTRY_ID}" name="ZeroTagged" type="upgrade" sortIndex="0">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
          </selectionEntry>
        </selectionEntries>
        <selectionEntryGroups>
          <selectionEntryGroup id="${TAGGED_GROUP_ID}" name="Tagged Group" sortIndex="2">
            <selectionEntries>
              <selectionEntry id="opt-in-group" name="InGroup" type="upgrade">
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
              </selectionEntry>
            </selectionEntries>
          </selectionEntryGroup>
        </selectionEntryGroups>
        <entryLinks>
          <entryLink id="${TAGGED_LINK_ID}" name="Tagged Link" targetId="${LINK_TARGET_ID}" sortIndex="3">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
          </entryLink>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Der Bericht eines leeren Hero-Rosters — alles Übrige hängt als Angebots-Anker darunter. */
function report() {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  return evaluate(prepared, {
    forces: [{ defId: FORCE_DEF_ID, count: 1, children: [
      { defId: HERO_ID, count: 1, children: [] },
    ] }],
  });
}

/** Der Fähigkeitsdatensatz eines Slots per Definitions-Id (der erste Treffer im Bericht). */
function slotOf(built, defId) {
  for (const capability of built.capabilities.values()) {
    if (capability.defId === defId) return capability;
  }
  return undefined;
}

describe('SlotCapability.sortIndex: durchgereichtes Katalogattribut (Issue 0133, Kriterium 1)', () => {
  it('ein selectionEntry-Slot mit sortIndex trägt den Wert als Zahl im Fähigkeitsdatensatz', () => {
    const built = report();

    expect(slotOf(built, TAGGED_ENTRY_ID)).toMatchObject({ sortIndex: 4 });
  });

  it('ein selectionEntryGroup-Slot (Gruppen-Anker) trägt seinen eigenen sortIndex', () => {
    const built = report();

    const groupSlot = slotOf(built, TAGGED_GROUP_ID);
    expect(groupSlot).toMatchObject({ anchorKind: 'groupAnchor', sortIndex: 2 });
  });

  it('ein entryLink-Slot trägt seinen eigenen sortIndex (nicht den seines Ziels)', () => {
    const built = report();

    expect(slotOf(built, TAGGED_LINK_ID)).toMatchObject({ sortIndex: 3 });
    // Das Ziel ist hier nirgends selbst platziert, nur über den Link referenziert —
    // es bekommt daher (wie bei sourceId, vgl. report.sourceId.test.js) keinen
    // eigenen Slot, an dem ein geerbter sortIndex sichtbar werden könnte.
    expect(slotOf(built, LINK_TARGET_ID)).toBeUndefined();
  });

  it('ein Slot ohne sortIndex trägt null, nicht undefined — kein Fehler, kein Ablehnen des Katalogs (Kriterium 2)', () => {
    const built = report();

    expect(slotOf(built, UNTAGGED_ENTRY_ID)?.sortIndex).toBeNull();
    expect(built.diagnostics).toEqual([]);
  });

  it('ein nicht-numerischer sortIndex-Wert gilt als "kein sortIndex" (null), der Slot bleibt sonst intakt', () => {
    const built = report();

    const slot = slotOf(built, NON_NUMERIC_ENTRY_ID);
    expect(slot?.sortIndex).toBeNull();
    expect(slot?.anchorKind).toBe('offerAnchor');
  });

  it('sortIndex="0" bleibt als Zahl 0 erhalten, nicht als "kein sortIndex" behandelt', () => {
    const built = report();

    const slot = slotOf(built, ZERO_TAGGED_ENTRY_ID);
    expect(slot?.sortIndex).toBe(0);
    expect(slot?.sortIndex).not.toBeNull();
  });

  it('sortIndex ist rein deskriptiv: es ändert weder Kosten noch Grenzen des Slots', () => {
    const built = report();

    expect(slotOf(built, TAGGED_ENTRY_ID)).toMatchObject({
      sortIndex: 4,
      costs: { [COST_TYPE_ID]: 3 },
      isBlocked: false,
    });
  });
});
