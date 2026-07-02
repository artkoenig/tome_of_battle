import { test, expect } from 'vitest';
import {
  extractModelProfiles,
  extractUpgradeProfiles,
  extractWeaponProfiles,
  extractArmourProfiles,
  groupProfilesByType,
  hasBlessing,
  getArmourSave,
  getWardSave
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

// Test 3: hasBlessing
const blessingProfiles = [
  { name: 'Grail Knight', profileTypeName: 'Unit' },
  { name: 'Shield', profileTypeName: 'Armour', description: 'Has the Blessing of the Lady' }
];
const hasBlessingTrue1 = hasBlessing(blessingProfiles, 'Grail Knights', 'Bretonnia');
const hasBlessingTrue2 = hasBlessing([], 'Segen der Herrin', 'Bretonnia');
const hasBlessingFalse = hasBlessing([], 'Empire Knights', 'The Empire');

test('hasBlessing', () => {
  expect(hasBlessingTrue1 && hasBlessingTrue2 && !hasBlessingFalse).toBe(true);
});

// Test 4: getArmourSave
const noArmour = getArmourSave([], 'Peasant', 'Bretonnia'); // 7 (no armour)
const lightArmourOnly = getArmourSave([{ name: 'Light Armour', characteristics: [{ name: 'Rules', value: 'Light Armour' }] }], 'Spearman', 'Empire'); // 6
const heavyArmourShield = getArmourSave([
  { name: 'Heavy Armour', characteristics: [{ name: 'Rules', value: 'Heavy Armour' }] },
  { name: 'Shield', characteristics: [{ name: 'Rules', value: 'Shield' }] }
], 'Ironbreaker', 'Dwarfs'); // 4 (5 base, -1 shield)
const empireKnight = getArmourSave([
  { name: 'Full Plate Armour', characteristics: [{ name: 'Rules', value: 'Full plate' }] },
  { name: 'Shield', characteristics: [{ name: 'Rules', value: 'Shield' }] },
  { name: 'Warhorse', characteristics: [{ name: 'Type', value: 'Barded Horse' }] }
], 'Empire Knight', 'Empire'); // 1 (4 base, -1 mounted, -1 shield, -1 barded)

const explicitSave = getArmourSave([
  { name: 'Dragon Armour', description: 'Gives a 5+ Armour Save' },
  { name: 'Shield', characteristics: [{ name: 'Rules', value: 'Shield' }] }
], 'Prince', 'High Elves'); // 4 (5 base, -1 shield)

const scalySkinSave = getArmourSave([
  { name: 'Scaly Skin', description: 'Has Scaly Skin 5+' },
  { name: 'Light Armour', characteristics: [{ name: 'Rules', value: 'Light Armour' }] }
], 'Saurus', 'Lizardmen'); // 4 (6 base, -2 from scaly skin 5+)

const explicitASChar = getArmourSave([
  { name: 'Some Item', characteristics: [{ name: 'AS', value: '3+' }] }
], 'Lord', 'Custom System'); // 3

const flayedHauberk = getArmourSave([
  { name: 'The Flayed Hauberk', characteristics: [{ name: 'Saving Throw Modifier', value: '1+' }] }
], 'Vampire', 'Vampire Counts'); // 1

const stegadonHelm = getArmourSave([
  { name: 'Sacred Stegadon Helm', characteristics: [{ name: 'Saving Throw Modifier', value: '+1 to armour save' }] },
  { name: 'Light Armour', characteristics: [{ name: 'Rules', value: 'Light Armour' }] }
], 'Skink', 'Lizardmen'); // 5 (6 base, -1 mod)

const shieldOfGhrond = getArmourSave([
  { name: 'Shield of Ghrond', characteristics: [{ name: 'Saving Throw Modifier', value: '-1 Sv' }] }
], 'Master', 'Dark Elves'); // 6 (-1 shield, characteristic mod ignored because it's a shield)

test('getArmourSave', () => {
  expect(noArmour === 7 &&
                    lightArmourOnly === 6 &&
                    heavyArmourShield === 4 &&
                    empireKnight === 1 &&
                    explicitSave === 4 &&
                    scalySkinSave === 4 &&
                    explicitASChar === 3 &&
                    flayedHauberk === 1 &&
                    stegadonHelm === 5 &&
                    shieldOfGhrond === 6).toBe(true);
});

// Test 5: getWardSave
const wardSave5Plus = getWardSave([
  { name: 'Talisman', description: '5+ ward save' }
], 'Lord', 'Chaos'); // 5
const wardSave4PlusGerman = getWardSave([
  { name: 'Talisman', description: 'Rettungswurf von 4+' }
], 'Lord', 'Chaos'); // 4
const wardSaveInParens = getWardSave([
  { name: 'Amulet', description: 'Provides a Ward Save (5+)' }
], 'Mage', 'High Elves'); // 5
const wardSavePlusFirst = getWardSave([
  { name: 'Mark', description: 'Gives +6 Ward Save' }
], 'Warrior', 'Chaos'); // 6
const explicitWSChar = getWardSave([
  { name: 'Some Item', characteristics: [{ name: 'WS', value: '4+' }] }
], 'Lord', 'Custom System'); // 4
const weaponSkillPlusWS = getWardSave([
  { name: 'Cathayan Longsword', description: 'One handed +1 WS, +1 I' }
], 'Maneater', 'Ogre Kingdoms'); // null (Weapon Skill, not Ward Save)
const talismanOfProtection = getWardSave([
  { name: 'Talisman of Protection', characteristics: [{ name: 'Magic stuff', value: '6+ ward save' }] }
], 'Lord', 'Custom System'); // 6
const noWardSave = getWardSave([], 'Peasant', 'Bretonnia'); // null

test('getWardSave', () => {
  expect(wardSave5Plus === 5 &&
                    wardSave4PlusGerman === 4 &&
                    wardSaveInParens === 5 &&
                    wardSavePlusFirst === 6 &&
                    explicitWSChar === 4 &&
                    weaponSkillPlusWS === null &&
                    talismanOfProtection === 6 &&
                    noWardSave === null).toBe(true);
});

// Test 6: getArmourSave with thick-skinned mounts
test('getArmourSave with thick-skinned mounts', () => {
  const saveWithBoar = getArmourSave([
    { name: 'Light Armour', description: 'Leichte Rüstung' },
    { name: 'Shield', description: 'Schild' }
  ], 'Orc Boar Boyz', 'Orcs and Goblins'); // Base (6) + Shield (-1) + Boar in selectionName (-2) = 3
  
  const saveWithHorse = getArmourSave([
    { name: 'Light Armour', description: 'Leichte Rüstung' },
    { name: 'Shield', description: 'Schild' },
    { name: 'horse' }
  ], 'Knight', 'Empire'); // Base (6) + Shield (-1) + Horse (-1) = 4

  const resBoarDetails = getArmourSave([
    { name: 'Light Armour', description: 'Leichte Rüstung' },
    { name: 'Shield', description: 'Schild' },
    { name: 'Boar' }
  ], 'Orc Boss', 'Orcs and Goblins', true);

  expect(saveWithBoar).toBe(3);
  expect(saveWithHorse).toBe(4);
  expect(resBoarDetails.save).toBe(3);
  expect(resBoarDetails.breakdown).toContain('Beritten (Dickhäutig) (-2)');
});

// Test 7: getArmourSave skips rule descriptions to avoid false positives
test('getArmourSave ignores rule descriptions containing mount/shield keywords', () => {
  const save = getArmourSave([
    { name: 'Choppa', description: 'Does not apply to Boar riders', isRule: true },
    { name: 'Warpaint', description: 'May carry a shield', isRule: true }
  ], 'Savage Orc Great Shaman', 'Orcs and Goblins');

  expect(save).toBe(7); // 7 means no armour save (it shouldn't match boar or shield)
});

// Test 8: getArmourSave ignores mount bonus for chariots
test('getArmourSave ignores mount bonus for chariots', () => {
  const save = getArmourSave([
    { name: 'Armour Save +5Sv', characteristics: [{ name: 'Saving Throw Modifier', value: '5+' }] }
  ], 'Goblin Wolf Chariot', 'Orcs and Goblins');

  expect(save).toBe(5); // Should remain 5+ (no wolf mount bonus)
});
