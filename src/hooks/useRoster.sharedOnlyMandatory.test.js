import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoster } from './useRoster';
import { processImportedData } from '../parser/xmlParser';
import { buildRoster } from '../utils/createRoster';

/**
 * Issue 0153 — "A shared honour reachable only from a hero is auto-added to
 * the army", at the production seam: real catalogue XML, the real sweep
 * (`src/roster/listRules.js`) and the real fresh-roster auto-add effect in
 * `useRoster.js`. Nothing is mocked, following the pattern of
 * `useRoster.costedMandatoryAutoAdd.test.js`.
 *
 * The catalogue mirrors the real ergofang/definitive High Elves shape named
 * in the issue: "Pure of Heart" (`d0ce-b0c4-fcc1-6cac`) lives only in
 * `sharedSelectionEntries`, `type="upgrade"`, no sub-options, its own
 * `min=1 scope="roster" includeChildSelections="true"
 * includeChildForces="true"`, offered through exactly one place — the shared
 * group "Honours" (`45a3-3e65-6c49-5cc0`) — which the character entry
 * "Hero" links by an `entryLink` of type `selectionEntryGroup`.
 *
 * Alongside it (criterion 2) sits a second, independent mandatory rule
 * declared at catalogue root as an `entryLink` onto a shared target carrying
 * the `min` itself — the root-`entryLink`-onto-shared-target form the issue
 * calls out as a case Issue 0138/0140's fixtures never covered.
 */

const GAME_SYSTEM_ID = 'gs-whfb6-honours';
const CATALOGUE_ID = 'cat-high-elves';
const FORCE_DEF_ID = 'force-high-elf-army';

const PTS_ID = 'cost-pts';

const HERO_ID = 'char-hero';
const HONOURS_GROUP_ID = '45a3-3e65-6c49-5cc0';
const HONOUR_LINK_ID = 'link-pure-of-heart';
const PURE_OF_HEART_ID = 'd0ce-b0c4-fcc1-6cac';

const ROOT_MANDATORY_TARGET_ID = 'shared-mandatory-target';
const ROOT_MANDATORY_LINK_ID = 'link-root-mandatory';
const ROOT_MANDATORY_NAME = 'Shared Mandatory Rule';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Warhammer Fantasy Battles (honours)">
    <costTypes>
      <costType id="${PTS_ID}" name="pts" defaultCostLimit="-1"/>
    </costTypes>
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="High Elf Army"/>
    </forceEntries>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${CATALOGUE_ID}" name="High Elves" gameSystemId="${GAME_SYSTEM_ID}">

    <!-- Criterion 2: a root entryLink onto a shared target carrying the min. -->
    <entryLinks>
      <entryLink id="${ROOT_MANDATORY_LINK_ID}" name="${ROOT_MANDATORY_NAME}" targetId="${ROOT_MANDATORY_TARGET_ID}" type="selectionEntry"/>
    </entryLinks>

    <selectionEntries>
      <!-- The character that reaches the shared honour by linking its group. -->
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit" hidden="false">
        <entryLinks>
          <entryLink id="link-honours" name="Honours" targetId="${HONOURS_GROUP_ID}" type="selectionEntryGroup"/>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>

    <sharedSelectionEntryGroups>
      <selectionEntryGroup id="${HONOURS_GROUP_ID}" name="Honours">
        <entryLinks>
          <entryLink id="${HONOUR_LINK_ID}" name="Pure of Heart" targetId="${PURE_OF_HEART_ID}" type="selectionEntry"/>
        </entryLinks>
      </selectionEntryGroup>
    </sharedSelectionEntryGroups>

    <sharedSelectionEntries>
      <!-- "Pure of Heart" — shared-only, no candidate for the force-level auto-add. -->
      <selectionEntry id="${PURE_OF_HEART_ID}" name="Pure of Heart" type="upgrade" hidden="false">
        <constraints>
          <constraint type="max" value="1.0" field="selections" scope="roster" shared="true" id="c-max-roster"/>
          <constraint type="max" value="1.0" field="selections" scope="parent" shared="true" id="c-max-parent"/>
          <constraint type="min" value="1.0" field="selections" scope="roster" shared="true" id="c-min-roster" includeChildSelections="true" includeChildForces="true"/>
        </constraints>
      </selectionEntry>

      <!-- Criterion 2's shared target: no own sub-options, min=1 scope=roster. -->
      <selectionEntry id="${ROOT_MANDATORY_TARGET_ID}" name="${ROOT_MANDATORY_NAME}" type="upgrade" hidden="false">
        <constraints>
          <constraint type="min" value="1.0" field="selections" scope="roster" shared="true" id="c-min-root-mandatory"/>
        </constraints>
      </selectionEntry>
    </sharedSelectionEntries>

  </catalogue>`;

function appSystem() {
  const { system } = processImportedData(
    [{ name: 'whfb.gst', content: GAME_SYSTEM_XML }],
    [{ name: 'high-elves.cat', content: CATALOGUE_XML }]
  );
  system.rawXmls = {
    gst: [{ name: 'whfb.gst', content: GAME_SYSTEM_XML }],
    cat: [{ name: 'high-elves.cat', content: CATALOGUE_XML }],
  };
  return system;
}

/** A contingent as the create-roster dialog produces it: `selections` starts empty. */
function freshlyCreatedRoster() {
  return buildRoster(
    { name: 'New High Elf Army', systemId: 'system-uuid', catId: CATALOGUE_ID, forceEntryId: FORCE_DEF_ID, limit: 2000 },
    { costTypes: [{ id: PTS_ID }], forceEntries: [{ id: FORCE_DEF_ID }] }
  );
}

function render(roster, isFreshRoster) {
  return renderHook(() => useRoster(roster, appSystem(), vi.fn(), undefined, isFreshRoster));
}

const rootEntryIds = (result) =>
  result.current.roster.forces[0].selections.map(s => s.selectionEntryId ?? s.entryLinkId);

describe('a fresh High Elves contingent carries no selection of a shared-only honour (Issue 0153, criterion 1)', () => {
  it('does not add Pure of Heart at force level, however its own constraints read', () => {
    const { result } = render(freshlyCreatedRoster(), true);

    expect(rootEntryIds(result)).not.toContain(PURE_OF_HEART_ID);
  });
});

describe('a root-declared mandatory rule is still set automatically (Issue 0153, criterion 2)', () => {
  it('adds the root entryLink onto the shared mandatory target', () => {
    const { result } = render(freshlyCreatedRoster(), true);

    expect(rootEntryIds(result)).toContain(ROOT_MANDATORY_LINK_ID);
  });

  it('adds exactly one force-level selection, and it is the root-linked rule, not the honour', () => {
    const { result } = render(freshlyCreatedRoster(), true);

    expect(rootEntryIds(result)).toEqual([ROOT_MANDATORY_LINK_ID]);
  });
});
