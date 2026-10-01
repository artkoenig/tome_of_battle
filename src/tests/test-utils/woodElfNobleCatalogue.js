/**
 * A synthetic but shape-faithful slice of Wood Elves (6th definitive edition)
 * for Issue 0203: the Wood Elf Noble and his Long Bow.
 *
 * The real entryLink "Long Bow" `218f-067f-2488-2fc4` carries min 1 / max 1
 * (scope parent) and three modifiers — max set to 0, min set to 0, hidden set to
 * true — each conditioned on the unit holding a selection of the category
 * "Battle standard bearer" `2ef7-3efe-a448-423f`. That category comes from the
 * shared upgrade "Battle Standard Bearer", which carries it as a non-primary
 * categoryLink in the game system (as in the definitive `.gst`).
 *
 * Next to it sit the two halves of AC3, conditioned on the same trigger:
 * "Spear" is only hidden (its max stays 1), "Shield" is only capped at 0 (it
 * stays visible).
 *
 * There is no Wood Elves catalogue in the fixtures, hence the slice.
 */

import { processImportedData } from '../../platform/battlescribe/xmlParser';
import { buildRoster } from '../../contexts/armylist/model/createRoster';

export const GAME_SYSTEM_ID = 'gs-whfb6-definitive';
export const CATALOGUE_ID = 'cat-wood-elves';
export const FORCE_DEF_ID = 'force-wood-elves';
export const PTS_ID = 'ecfa-8486-4f6c-c249';

export const BSB_CATEGORY_ID = '2ef7-3efe-a448-423f';
export const BSB_ENTRY_ID = 'e9ad-f1ce-aebf-6d23';
export const NOBLE_ID = 'entry-wood-elf-noble';
export const BSB_LINK_ID = 'link-noble-bsb';
export const LONG_BOW_LINK_ID = '218f-067f-2488-2fc4';
export const LONG_BOW_ENTRY_ID = 'entry-long-bow';
export const SPEAR_ID = 'entry-noble-spear';
export const SHIELD_ID = 'entry-noble-shield';

const WHEN_BSB = `<conditions>
  <condition type="atLeast" value="1" field="selections" scope="unit" childId="${BSB_CATEGORY_ID}" shared="true" includeChildSelections="true"/>
</conditions>`;

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Warhammer Fantasy Battles (6th definitive edition)">
    <costTypes><costType id="${PTS_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
    <categoryEntries>
      <categoryEntry id="${BSB_CATEGORY_ID}" name="Battle standard bearer" hidden="false"/>
    </categoryEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${BSB_ENTRY_ID}" name="Battle Standard Bearer" hidden="false" collective="false" import="true" type="upgrade">
        <constraints>
          <constraint field="selections" scope="parent" value="1" percentValue="false" shared="true" includeChildSelections="true" includeChildForces="false" id="c-bsb-max" type="max"/>
        </constraints>
        <costs><cost name="pts" typeId="${PTS_ID}" value="25"/></costs>
        <categoryLinks>
          <categoryLink name="Battle standard bearer" hidden="false" id="cl-bsb" targetId="${BSB_CATEGORY_ID}" primary="false"/>
        </categoryLinks>
      </selectionEntry>
    </sharedSelectionEntries>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${CATALOGUE_ID}" name="Wood Elves (6th definitive edition)" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries><forceEntry id="${FORCE_DEF_ID}" name="Wood Elf Army"/></forceEntries>
    <selectionEntries>
      <selectionEntry id="${NOBLE_ID}" name="Wood Elf Noble" hidden="false" collective="false" import="true" type="unit">
        <costs><cost name="pts" typeId="${PTS_ID}" value="65"/></costs>
        <selectionEntries>
          <selectionEntry id="${SPEAR_ID}" name="Spear" hidden="false" collective="false" import="true" type="upgrade">
            <modifiers>
              <modifier type="set" value="true" field="hidden">${WHEN_BSB}</modifier>
            </modifiers>
            <constraints>
              <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="c-spear-max" includeChildSelections="false"/>
            </constraints>
            <costs><cost name="pts" typeId="${PTS_ID}" value="2"/></costs>
          </selectionEntry>
          <selectionEntry id="${SHIELD_ID}" name="Shield" hidden="false" collective="false" import="true" type="upgrade">
            <modifiers>
              <modifier type="set" value="0" field="c-shield-max">${WHEN_BSB}</modifier>
            </modifiers>
            <constraints>
              <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="c-shield-max" includeChildSelections="false"/>
            </constraints>
            <costs><cost name="pts" typeId="${PTS_ID}" value="2"/></costs>
          </selectionEntry>
        </selectionEntries>
        <entryLinks>
          <entryLink import="true" name="Battle Standard Bearer" hidden="false" id="${BSB_LINK_ID}" collective="false" targetId="${BSB_ENTRY_ID}" type="selectionEntry"/>
          <entryLink import="true" name="Long Bow" hidden="false" id="${LONG_BOW_LINK_ID}" collective="false" targetId="${LONG_BOW_ENTRY_ID}" type="selectionEntry">
            <modifiers>
              <modifier type="set" value="0" field="c-long-bow-max">${WHEN_BSB}</modifier>
              <modifier type="set" value="0" field="c-long-bow-min">${WHEN_BSB}</modifier>
              <modifier type="set" value="true" field="hidden">${WHEN_BSB}</modifier>
            </modifiers>
            <constraints>
              <constraint type="min" value="1" field="selections" scope="parent" shared="true" id="c-long-bow-min" includeChildSelections="false"/>
              <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="c-long-bow-max" includeChildSelections="false"/>
            </constraints>
          </entryLink>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${LONG_BOW_ENTRY_ID}" name="Long Bow" hidden="false" collective="false" import="true" type="upgrade">
        <costs><cost name="pts" typeId="${PTS_ID}" value="0"/></costs>
      </selectionEntry>
    </sharedSelectionEntries>
  </catalogue>`;

/** The app system object: parsed catalogues and the raw XMLs the report reads. */
export function woodElfSystem() {
  const gst = [{ name: 'whfb6.gst', content: GAME_SYSTEM_XML }];
  const cat = [{ name: 'wood-elves.cat', content: CATALOGUE_XML }];
  const { system } = processImportedData(gst, cat);
  system.rawXmls = { gst, cat };
  return system;
}

/** An empty Wood Elf contingent, as the create-roster dialog builds it. */
export function emptyWoodElfRoster() {
  return buildRoster(
    { name: 'Wood Elves', systemId: 'system-uuid', catId: CATALOGUE_ID, forceEntryId: FORCE_DEF_ID, limit: 2000 },
    { costTypes: [{ id: PTS_ID }], forceEntries: [{ id: FORCE_DEF_ID }] }
  );
}

/**
 * The catalogue entries the editor hands to the commands.
 * @param {Object} system
 */
export function nobleEntriesOf(system) {
  const noble = system.catalogues[0].selectionEntries.find(entry => entry.id === NOBLE_ID);
  return {
    noble,
    bsb: noble.entryLinks.find(link => link.id === BSB_LINK_ID),
    spear: noble.selectionEntries.find(entry => entry.id === SPEAR_ID),
    shield: noble.selectionEntries.find(entry => entry.id === SHIELD_ID),
  };
}

/**
 * The definition id a selection stands for (link before target).
 * @param {{ entryLinkId?: string|null, selectionEntryId?: string|null }} selection
 */
export const defIdOf = (selection) => selection.entryLinkId || selection.selectionEntryId;
