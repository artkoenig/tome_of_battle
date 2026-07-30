import { test, expect } from 'vitest';
import {
  extractModelProfiles,
  extractUpgradeProfiles,
  extractWeaponProfiles,
  extractArmourProfiles,
  groupProfilesByType
} from './rulesEvaluator.js';



// Test 1: extractModelProfiles
const test1Profiles = [
  { name: 'Warrior', profileTypeName: 'Unit' },
  { name: 'Sword', profileTypeName: 'Weapon' },
  { name: 'Dragon', profileTypeName: 'Creature' },
  { name: 'Shield', profileTypeName: 'Armour' },
  { name: 'Great Weapon', profileTypeName: 'Waffe' }
];
const modelProfiles = extractModelProfiles(test1Profiles);
test('extractModelProfiles', () => {
  expect(modelProfiles.length === 2 &&
                    modelProfiles.some(p => p.name === 'Warrior') &&
                    modelProfiles.some(p => p.name === 'Dragon')).toBe(true);
});

// Test 2: extractUpgradeProfiles
const upgradeProfiles = extractUpgradeProfiles(test1Profiles);
test('extractUpgradeProfiles', () => {
  expect(upgradeProfiles.length === 2 &&
                    upgradeProfiles.some(p => p.name === 'Sword') &&
                    upgradeProfiles.some(p => p.name === 'Shield')).toBe(true);
});

// Test 2b: extractWeaponProfiles
const weaponProfiles = extractWeaponProfiles(test1Profiles);
test('extractWeaponProfiles', () => {
  expect(weaponProfiles.length === 2 &&
                    weaponProfiles.some(p => p.name === 'Sword') &&
                    weaponProfiles.some(p => p.name === 'Great Weapon')).toBe(true);
});

// Test 2c: extractArmourProfiles
const armourProfilesTest = extractArmourProfiles(test1Profiles);
test('extractArmourProfiles', () => {
  expect(armourProfilesTest.length === 1 &&
                    armourProfilesTest[0].name === 'Shield').toBe(true);
});

// Test 2d: groupProfilesByType groups every profile type generically
test('groupProfilesByType', () => {
  const profiles = [
    { id: 'm1', name: 'Warrior', profileTypeName: 'Unit' },
    { id: 'w1', name: 'Sword', profileTypeName: 'Weapon' },
    { id: 'a1', name: 'Shield', profileTypeName: 'Armour' },
    { id: 'w2', name: 'Bow', profileTypeName: 'Weapon' },
    { id: 'mi1', name: 'Ruby Ring', profileTypeName: 'Magic Item' },
    { id: 'b1', name: 'War Banner', profileTypeName: 'Banner' }
  ];
  const groups = groupProfilesByType(profiles);

  // Model group is always first and aggregates model/unit profiles.
  expect(groups[0].isModel).toBe(true);
  expect(groups[0].profiles.map(p => p.name)).toEqual(['Warrior']);

  // Remaining groups are keyed by profileTypeName, in collection order.
  const nonModel = groups.filter(g => !g.isModel);
  expect(nonModel.map(g => g.typeName)).toEqual(['Weapon', 'Armour', 'Magic Item', 'Banner']);

  // Same-type profiles are collapsed into one group.
  const weapons = nonModel.find(g => g.typeName === 'Weapon');
  expect(weapons.profiles.map(p => p.name)).toEqual(['Sword', 'Bow']);

  // Non-array input is handled gracefully.
  expect(groupProfilesByType(null)).toEqual([]);
});
