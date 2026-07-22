import { describe, test, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { processImportedData } from '../parser/xmlParser.js';
import { getUnitOptions } from './optionsCollector.js';
import { resolveEntry } from './catalogResolver.js';
import { createSelectionFromDef } from './selectionFactory.js';
import { replaceSelectionById, rootSelectionsOf } from './rosterTree.js';
import { withChangedOptionCount } from './subSelectionEditing.js';
import { validateRoster } from './rosterValidator.js';

// Issue 57/04 — end-to-end against the REAL Vampire Counts catalogue.
// Master Necromancer → group "Mounts" (max 1) → entryLink "Nightmare" (an upgrade-type
// mount, NOT an independent sub-unit) → nested selectionEntry "Barding" (max 1). This is
// the same shape as the Empire Captain → Mounts → Empire Warhorse → Barding case reported.
//
// The bug: selecting Barding attached it as a direct child of the UNIT (a sibling of the
// mount) and its id polluted the Mounts group's max-1 count, so it could not be chosen.
// The fix threads the mount's roster selection as the sub-option's owner, so Barding nests
// under the mount. This test drives the exact edit pipeline useRoster uses.

const CATALOG_DIR = path.resolve('src/solver/__fixtures__/whfb6');
const GST_FILE = 'Warhammer Fantasy Battle 6th edition.gst';
const CAT_FILE = 'Vampire Counts.cat';

const MASTER_NECROMANCER_ID = '4ee2-ac3a-3cc6-11af';
const MOUNTS_GROUP_ID = 'fe59-4e8b-24e8-3316';
const NIGHTMARE_LINK_ID = 'ba19-24a1-412f-569e';
const BARDING_ID = '3fa3-1556-3275-1f71';

let system;
let catalogueId;

beforeAll(() => {
  const jsdomObj = new JSDOM();
  globalThis.DOMParser = jsdomObj.window.DOMParser;
  if (!globalThis.crypto) globalThis.crypto = crypto;
  else if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = crypto.randomUUID;

  const gstContent = fs.readFileSync(path.join(CATALOG_DIR, GST_FILE), 'utf8');
  const cat = { name: CAT_FILE, content: fs.readFileSync(path.join(CATALOG_DIR, CAT_FILE), 'utf8') };
  system = processImportedData([{ name: 'gst', content: gstContent }], [cat]).system;
  catalogueId = system.catalogues[0].id;
});

describe('Grouped upgrade-mount sub-option nests under the mount (Master Necromancer → Nightmare → Barding)', () => {
  const buildNecromancerRoster = () => {
    const necroEntry = system.catalogues[0].selectionEntries.find(e => e.id === MASTER_NECROMANCER_ID);
    const unit = createSelectionFromDef({ system, resolveEntry, catalogueId, entry: necroEntry, categoryId: 'characters' });
    return { catalogueId, name: 'test', forces: [{ id: 'force-1', catalogueId, selections: [unit] }] };
  };

  // Mirrors useRoster.subSelectionOperations.increaseCount, including the fix: the edit
  // targets the collected option's ownerSelectionId when present, else the unit itself.
  const selectOption = (roster, collectedOption) => {
    const unitId = rootSelectionsOf(roster)[0].id;
    const targetId = collectedOption.ownerSelectionId || unitId;
    const roots = replaceSelectionById(rootSelectionsOf(roster), targetId, node => ({
      ...node,
      selections: withChangedOptionCount(
        node.selections || [], collectedOption.option.id, 1,
        () => createSelectionFromDef({ system, resolveEntry, catalogueId, entry: collectedOption.option })
      )
    }));
    return { ...roster, forces: [{ ...roster.forces[0], selections: roots }] };
  };

  const optionsOf = (roster) => getUnitOptions(system, catalogueId, rootSelectionsOf(roster)[0]);

  test('Barding attaches under the mount selection, not as a direct child of the unit', () => {
    let roster = buildNecromancerRoster();

    const mountOption = optionsOf(roster).find(o => o.option.id === NIGHTMARE_LINK_ID);
    expect(mountOption).toBeDefined();
    roster = selectOption(roster, mountOption);

    const bardingOption = optionsOf(roster).find(o => o.option.id === BARDING_ID);
    expect(bardingOption).toBeDefined();
    roster = selectOption(roster, bardingOption);

    const unit = rootSelectionsOf(roster)[0];
    const mountSelection = unit.selections.find(s => s.entryLinkId === NIGHTMARE_LINK_ID);
    expect(mountSelection).toBeDefined();

    const bardingIsUnderMount = (mountSelection.selections || [])
      .some(s => (s.entryLinkId || s.selectionEntryId) === BARDING_ID);
    const bardingIsDirectUnitChild = unit.selections
      .some(s => (s.entryLinkId || s.selectionEntryId) === BARDING_ID);

    expect(bardingIsUnderMount).toBe(true);
    expect(bardingIsDirectUnitChild).toBe(false);
  });

  test('mount + barding stay within the Mounts group max of 1 (no validation error)', () => {
    let roster = buildNecromancerRoster();
    roster = selectOption(roster, optionsOf(roster).find(o => o.option.id === NIGHTMARE_LINK_ID));
    roster = selectOption(roster, optionsOf(roster).find(o => o.option.id === BARDING_ID));

    const errors = validateRoster(roster, system).filter(e => e.severity === 'error');
    expect(errors).toEqual([]);

    // The sub-option no longer pollutes the Mounts group's counted item ids.
    const mountsMax = optionsOf(roster).find(o => o.groupId === MOUNTS_GROUP_ID)
      ?.groupConstraints?.find(c => c.type === 'max' && c.scope === 'parent');
    expect(mountsMax).toBeDefined();
    expect(mountsMax.groupItemIds.has(BARDING_ID)).toBe(false);
  });
});
