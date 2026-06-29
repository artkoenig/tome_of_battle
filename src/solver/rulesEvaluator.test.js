import { test, expect } from 'vitest';
import {
  extractModelProfiles,
  extractUpgradeProfiles,
  hasBlessing,
  getArmourSave,
  getWardSave
} from './rulesEvaluator.js';



// Test 1: extractModelProfiles
const test1Profiles = [
  { name: 'Warrior', profileTypeName: 'Unit' },
  { name: 'Sword', profileTypeName: 'Weapon' },
  { name: 'Dragon', profileTypeName: 'Creature' },
  { name: 'Shield', profileTypeName: 'Armour' }
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
                    talismanOfProtection === 6 &&
                    noWardSave === null).toBe(true);
});

