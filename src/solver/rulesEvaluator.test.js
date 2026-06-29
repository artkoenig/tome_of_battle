import {
  extractModelProfiles,
  extractUpgradeProfiles,
  hasBlessing,
  getArmourSave,
  getWardSave
} from './rulesEvaluator.js';

console.log('--- RUNNING RULES EVALUATOR TESTS ---');

// Test 1: extractModelProfiles
const test1Profiles = [
  { name: 'Warrior', profileTypeName: 'Unit' },
  { name: 'Sword', profileTypeName: 'Weapon' },
  { name: 'Dragon', profileTypeName: 'Creature' },
  { name: 'Shield', profileTypeName: 'Armour' }
];
const modelProfiles = extractModelProfiles(test1Profiles);
const test1Passed = modelProfiles.length === 2 &&
                    modelProfiles.some(p => p.name === 'Warrior') &&
                    modelProfiles.some(p => p.name === 'Dragon');
console.log('Test 1 - extractModelProfiles: ', test1Passed ? 'PASSED' : 'FAILED');

// Test 2: extractUpgradeProfiles
const upgradeProfiles = extractUpgradeProfiles(test1Profiles);
const test2Passed = upgradeProfiles.length === 2 &&
                    upgradeProfiles.some(p => p.name === 'Sword') &&
                    upgradeProfiles.some(p => p.name === 'Shield');
console.log('Test 2 - extractUpgradeProfiles: ', test2Passed ? 'PASSED' : 'FAILED');

// Test 3: hasBlessing
const blessingProfiles = [
  { name: 'Grail Knight', profileTypeName: 'Unit' },
  { name: 'Shield', profileTypeName: 'Armour', description: 'Has the Blessing of the Lady' }
];
const hasBlessingTrue1 = hasBlessing(blessingProfiles, 'Grail Knights', 'Bretonnia');
const hasBlessingTrue2 = hasBlessing([], 'Segen der Herrin', 'Bretonnia');
const hasBlessingFalse = hasBlessing([], 'Empire Knights', 'The Empire');

const test3Passed = hasBlessingTrue1 && hasBlessingTrue2 && !hasBlessingFalse;
console.log('Test 3 - hasBlessing: ', test3Passed ? 'PASSED' : 'FAILED');

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

const test4Passed = noArmour === 7 &&
                    lightArmourOnly === 6 &&
                    heavyArmourShield === 4 &&
                    empireKnight === 1 &&
                    explicitSave === 4 &&
                    scalySkinSave === 4 &&
                    explicitASChar === 3 &&
                    flayedHauberk === 1 &&
                    stegadonHelm === 5 &&
                    shieldOfGhrond === 6;
console.log('Test 4 - getArmourSave: ', test4Passed ? 'PASSED' : `FAILED (noArmour: ${noArmour}, lightArmourOnly: ${lightArmourOnly}, heavyArmourShield: ${heavyArmourShield}, empireKnight: ${empireKnight}, explicitSave: ${explicitSave}, scalySkinSave: ${scalySkinSave}, explicitASChar: ${explicitASChar}, flayedHauberk: ${flayedHauberk}, stegadonHelm: ${stegadonHelm}, shieldOfGhrond: ${shieldOfGhrond})`);

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
const noWardSave = getWardSave([], 'Peasant', 'Bretonnia'); // null

const test5Passed = wardSave5Plus === 5 &&
                    wardSave4PlusGerman === 4 &&
                    wardSaveInParens === 5 &&
                    wardSavePlusFirst === 6 &&
                    explicitWSChar === 4 &&
                    noWardSave === null;
console.log('Test 5 - getWardSave: ', test5Passed ? 'PASSED' : `FAILED (wardSave5Plus: ${wardSave5Plus}, wardSave4PlusGerman: ${wardSave4PlusGerman}, wardSaveInParens: ${wardSaveInParens}, wardSavePlusFirst: ${wardSavePlusFirst}, explicitWSChar: ${explicitWSChar}, noWardSave: ${noWardSave})`);

const allEvaluatorTestsPassed = test1Passed && test2Passed && test3Passed && test4Passed && test5Passed;
if (allEvaluatorTestsPassed) {
  console.log('ALL RULES EVALUATOR TESTS SUCCESSFUL!');
  process.exit(0);
} else {
  console.error('SOME RULES EVALUATOR TESTS FAILED.');
  process.exit(1);
}
