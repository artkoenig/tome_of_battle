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

const test4Passed = noArmour === 7 &&
                    lightArmourOnly === 6 &&
                    heavyArmourShield === 4 &&
                    empireKnight === 1;
console.log('Test 4 - getArmourSave: ', test4Passed ? 'PASSED' : `FAILED (noArmour: ${noArmour}, lightArmourOnly: ${lightArmourOnly}, heavyArmourShield: ${heavyArmourShield}, empireKnight: ${empireKnight})`);

// Test 5: getWardSave
const wardSave5Plus = getWardSave([
  { name: 'Talisman', description: '5+ ward save' }
], 'Lord', 'Chaos'); // 5
const wardSave4PlusGerman = getWardSave([
  { name: 'Talisman', description: 'Rettungswurf von 4+' }
], 'Lord', 'Chaos'); // 4
const noWardSave = getWardSave([], 'Peasant', 'Bretonnia'); // null

const test5Passed = wardSave5Plus === 5 &&
                    wardSave4PlusGerman === 4 &&
                    noWardSave === null;
console.log('Test 5 - getWardSave: ', test5Passed ? 'PASSED' : `FAILED (wardSave5Plus: ${wardSave5Plus}, wardSave4PlusGerman: ${wardSave4PlusGerman}, noWardSave: ${noWardSave})`);

const allEvaluatorTestsPassed = test1Passed && test2Passed && test3Passed && test4Passed && test5Passed;
if (allEvaluatorTestsPassed) {
  console.log('ALL RULES EVALUATOR TESTS SUCCESSFUL!');
  process.exit(0);
} else {
  console.error('SOME RULES EVALUATOR TESTS FAILED.');
  process.exit(1);
}
