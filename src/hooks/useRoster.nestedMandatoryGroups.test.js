import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { useRoster } from './useRoster';
import { processImportedData } from '../parser/xmlParser';
import { buildRoster } from '../utils/createRoster';

/**
 * Issue 0145, increment 1, Kriterium 1 — a mandatory member is created at any
 * group depth, through the production recruitment path (`useRoster.addUnit`),
 * against the real fixture catalogues. Nothing is mocked: `processImportedData`
 * parses the real `.gst`/`.cat`, `buildRoster` builds the fresh contingent
 * (`isFreshRoster` left omitted so the list-rule auto-add of Issue 0138/0140
 * stays out of the way and `addUnit` is the only thing acting), and `addUnit`
 * is the very call the recruit dialog makes.
 */

const DEFINITIVE_DIR = path.resolve('src/evaluator/__fixtures__/whfb6-definitive');
const DEFINITIVE_GST = 'Warhammer Fantasy Battles (6th definitive edition).gst';

/** Loads one of the six fixture catalogues, byte for byte, and parses it for real. */
function loadCatalogue(catFile) {
  const gstContent = fs.readFileSync(path.join(DEFINITIVE_DIR, DEFINITIVE_GST), 'utf8');
  const catContent = fs.readFileSync(path.join(DEFINITIVE_DIR, catFile), 'utf8');
  const { system } = processImportedData(
    [{ name: DEFINITIVE_GST, content: gstContent }],
    [{ name: catFile, content: catContent }],
  );
  const catalogue = system.catalogues[0];
  // The definitive edition carries its contingent on the catalogue, not the game system.
  const forceEntryId = (catalogue.forceEntries?.[0] ?? system.forceEntries?.[0])?.id;
  return { system, catalogue, forceEntryId };
}

/** Recruits `entryId` into a fresh roster through the real hook and returns its selection node. */
function recruitEntry(catFile, entryId) {
  const { system, catalogue, forceEntryId } = loadCatalogue(catFile);
  expect(forceEntryId, `force entry for ${catFile}`).toBeTruthy();
  const entry = catalogue.selectionEntries.find(e => e.id === entryId);
  expect(entry, `entry ${entryId} in ${catFile}`).toBeTruthy();

  const roster = buildRoster(
    { name: 'test roster', systemId: system.id, catId: catalogue.id, forceEntryId, limit: 3000 },
    { costTypes: system.costTypes, forceEntries: [{ id: forceEntryId }] }
  );

  const { result } = renderHook(() => useRoster(roster, system, vi.fn()));

  act(() => {
    result.current.addUnit(entry, null);
  });

  return result.current.roster.forces[0].selections[0];
}

const VAMPIRE_COUNTS_CAT = 'Vampire Counts (6th definitive edition).cat';
const ORCS_AND_GOBLINS_CAT = 'Orcs and goblins (6th definitive edition).cat';
const ZACHARIAS_ID = '1c05-5813-2f0c-f878';
const HILL_GOBLINS_ID = 'f23f-1816-93a7-3059';

describe('Issue 0145 AC1 — Zacharias the Everliving gains "Magic Level 4" from "Wizard Level" nested inside "Magic"', () => {
  it('creates "Magic Level 4" exactly once', () => {
    const zacharias = recruitEntry(VAMPIRE_COUNTS_CAT, ZACHARIAS_ID);

    const magicLevel4 = zacharias.selections.filter(s => s.name === 'Magic Level 4');
    expect(magicLevel4).toHaveLength(1);
  });

  it('still creates "Zombie Dragon" and each of the six Bloodline powers exactly once', () => {
    const zacharias = recruitEntry(VAMPIRE_COUNTS_CAT, ZACHARIAS_ID);
    const names = zacharias.selections.map(s => s.name);

    for (const expectedName of [
      'Zombie Dragon',
      'Dark Acolyte',
      'Forbidden Lore',
      'Master of the Black Arts',
      'The Awakening',
      'Unholy Cynosure',
      'Nehekhara’s Noble Blood',
    ]) {
      expect(names.filter(n => n === expectedName), expectedName).toHaveLength(1);
    }
  });

  it('does not create "Lore of Necromancy" — its group ("Lores of Magic") has a max but no min', () => {
    const zacharias = recruitEntry(VAMPIRE_COUNTS_CAT, ZACHARIAS_ID);

    expect(zacharias.selections.map(s => s.name)).not.toContain('Lore of Necromancy');
  });

  it('does not create any of the five Equipment members — their group carries no constraints at all', () => {
    const zacharias = recruitEntry(VAMPIRE_COUNTS_CAT, ZACHARIAS_ID);
    const names = zacharias.selections.map(s => s.name);

    for (const equipmentName of [
      'Handweapon',
      'Circlet of Rathek (Talisman)',
      'Book of Nagash (Arcane Item)',
      'Scrolls of Semhtep (Arcane Item)',
      'Staff of Kaphamon (Enchanted Item)',
    ]) {
      expect(names, equipmentName).not.toContain(equipmentName);
    }
  });

  it('creates no child name twice, over the whole child list — a double population anywhere fails here', () => {
    const zacharias = recruitEntry(VAMPIRE_COUNTS_CAT, ZACHARIAS_ID);
    const names = zacharias.selections.map(s => s.name);

    const duplicated = names.filter((name, index) => names.indexOf(name) !== index);
    expect(duplicated).toEqual([]);
  });
});

describe('Issue 0145 AC1 — a second, independently reached nested site', () => {
  it('"0-1 Hill Goblins" gains "Hand Weapon" exactly once, from the itemised branch of a nested group', () => {
    const hillGoblins = recruitEntry(ORCS_AND_GOBLINS_CAT, HILL_GOBLINS_ID);

    const handWeapons = hillGoblins.selections.filter(s => s.name === 'Hand Weapon');
    expect(handWeapons).toHaveLength(1);
  });
});
