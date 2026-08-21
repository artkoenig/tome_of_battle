import { test, expect } from 'vitest';
import { groupProfilesByType } from './profileGrouping.js';

// Test 1: der Modell-Statblock wird als erste Gruppe zusammengefasst
test('groupProfilesByType fasst Modellprofile als erste Gruppe zusammen', () => {
  const profiles = [
    { name: 'Warrior', profileTypeName: 'Unit' },
    { name: 'Sword', profileTypeName: 'Weapon' },
    { name: 'Dragon', profileTypeName: 'Creature' },
    { name: 'Shield', profileTypeName: 'Armour' },
    { name: 'Great Weapon', profileTypeName: 'Waffe' }
  ];
  const [modelGroup] = groupProfilesByType(profiles);
  expect(modelGroup.isModel).toBe(true);
  expect(modelGroup.profiles.map(p => p.name)).toEqual(['Warrior', 'Dragon']);
});

// Test 2: groupProfilesByType groups every profile type generically
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
