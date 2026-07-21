import { describe, test, expect } from 'vitest';
import { collectUnitProfilesAndRules } from './validator.js';

describe('collectUnitProfilesAndRules — Profile gewählter Unterauswahlen', () => {
  const CATALOGUE_ID = 'cat-profiles';
  const BASE_UNIT_ID = 'base-unit';
  const BLOODLINE_UPGRADE_ID = 'upgrade-bloodline-1';
  const BASE_PROFILE_ID = 'prof-base';
  const BLOODLINE_PROFILE_ID = 'prof-bloodline-1';
  const BLOODLINE_RULE_ID = 'rule-bloodline-1';

  function createSystem() {
    return {
      id: 'sys-profiles',
      name: 'Test Profiles System',
      catalogues: [{
        id: CATALOGUE_ID,
        sharedSelectionEntries: [{
          id: BASE_UNIT_ID,
          name: 'Base Unit',
          profiles: [{ id: BASE_PROFILE_ID, name: 'Base Profile', profileTypeName: 'Unit' }],
          selectionEntryGroups: [{
            id: 'group-bloodline',
            selectionEntries: [{
              id: BLOODLINE_UPGRADE_ID,
              name: 'Bloodline 1',
              profiles: [{ id: BLOODLINE_PROFILE_ID, name: 'Bloodline 1 Profile', profileTypeName: 'Profile' }],
              rules: [{ id: BLOODLINE_RULE_ID, name: 'Bloodline Rule' }]
            }]
          }]
        }]
      }]
    };
  }

  test('sammelt Profil und Regel einer verschachtelt gewählten Aufwertung ein', () => {
    const selection = {
      selectionEntryId: BASE_UNIT_ID,
      selections: [{ selectionEntryId: BLOODLINE_UPGRADE_ID }]
    };

    const result = collectUnitProfilesAndRules(createSystem(), selection, CATALOGUE_ID);

    expect(result.profiles.map(profile => profile.id)).toEqual(
      expect.arrayContaining([BASE_PROFILE_ID, BLOODLINE_PROFILE_ID])
    );
    expect(result.profiles).toHaveLength(2);
    expect(result.rules.map(rule => rule.id)).toEqual([BLOODLINE_RULE_ID]);
  });
});

describe('collectUnitProfilesAndRules — optionale Aufwertungen gegen Pflichtmodelle', () => {
  // Ein optionales Upgrade (max 1) liefert sein Profil erst, wenn es gewählt wurde.
  // Ein Pflichtmodell (min 1) gehört dagegen immer zur Einheit und zählt sofort mit.
  const CATALOGUE_ID = 'cat-opt-mand';
  const SHAMAN_ID = 'unit-shaman';
  const BOAR_UPGRADE_ID = 'upgrade-boar';
  const SHAMAN_PROFILE_ID = 'prof-shaman';
  const BOAR_PROFILE_ID = 'prof-boar';
  const BODYGUARD_PROFILE_ID = 'prof-bodyguard';

  function createSystem() {
    return {
      id: 'sys-opt-mand',
      catalogues: [{
        id: CATALOGUE_ID,
        sharedSelectionEntries: [{
          id: SHAMAN_ID,
          name: 'Savage Orc Great Shaman',
          profiles: [{ id: SHAMAN_PROFILE_ID, name: 'Shaman Profile', profileTypeName: 'Profile' }],
          selectionEntries: [
            {
              id: BOAR_UPGRADE_ID,
              name: 'Boar',
              type: 'upgrade',
              constraints: [{ type: 'max', value: 1 }],
              profiles: [{ id: BOAR_PROFILE_ID, name: 'Boar Profile', profileTypeName: 'Profile' }]
            },
            {
              id: 'model-bodyguard',
              name: 'Bodyguard',
              type: 'model',
              constraints: [{ type: 'min', value: 1 }],
              profiles: [{ id: BODYGUARD_PROFILE_ID, name: 'Bodyguard Profile', profileTypeName: 'Profile' }]
            }
          ]
        }]
      }]
    };
  }

  const collectProfileIds = childSelections => collectUnitProfilesAndRules(
    createSystem(),
    { selectionEntryId: SHAMAN_ID, selections: childSelections },
    CATALOGUE_ID
  ).profiles.map(profile => profile.id);

  test('ohne gewählte Aufwertung fehlt deren Profil, das Pflichtmodell ist dennoch dabei', () => {
    const profileIds = collectProfileIds([]);

    expect(profileIds).toContain(SHAMAN_PROFILE_ID);
    expect(profileIds).toContain(BODYGUARD_PROFILE_ID);
    expect(profileIds).not.toContain(BOAR_PROFILE_ID);
  });

  test('mit gewählter Aufwertung erscheint deren Profil', () => {
    const profileIds = collectProfileIds([{ selectionEntryId: BOAR_UPGRADE_ID }]);

    expect(profileIds).toContain(BOAR_PROFILE_ID);
  });
});

describe('collectUnitProfilesAndRules — dynamisch veränderte Charakteristika', () => {
  test('wendet einen über den Kategorienamen bedingten Profilmodifier an', () => {
    const BLOOD_DRAGON_CATEGORY_ID = 'cat-bloodline-dragon';
    const CATALOGUE_ID = 'cat-dynamic-mod';
    const WEAPON_SKILL_CHARACTERISTIC_ID = 'f95b-da01-0578-3bdc';
    const BASE_WEAPON_SKILL = '7';
    const WEAPON_SKILL_BONUS = 2;
    const PROFILE_NAME = 'Vampire Lord Base';

    const system = {
      id: 'sys-dynamic-mod',
      categoryEntries: [{ id: BLOOD_DRAGON_CATEGORY_ID, name: 'Blood Dragon' }],
      catalogues: [{
        id: CATALOGUE_ID,
        sharedSelectionEntries: [{
          id: 'unit-vampire',
          name: 'Vampire Lord',
          type: 'model',
          categoryLinks: [{ id: 'link-dragon', targetId: BLOOD_DRAGON_CATEGORY_ID }],
          infoLinks: [{
            id: 'link-lord-profile',
            name: 'Vampire Lord Profile',
            targetId: 'prof-vampire',
            type: 'profile',
            modifiers: [{
              type: 'increment',
              field: WEAPON_SKILL_CHARACTERISTIC_ID,
              value: String(WEAPON_SKILL_BONUS),
              conditions: [{
                field: 'selections',
                scope: BLOOD_DRAGON_CATEGORY_ID,
                value: '0.0',
                childId: 'model',
                type: 'instanceOf'
              }]
            }]
          }]
        }],
        sharedProfiles: [{
          id: 'prof-vampire',
          name: PROFILE_NAME,
          profileTypeId: 'char-profile',
          typeName: 'Profile',
          characteristics: [
            { id: WEAPON_SKILL_CHARACTERISTIC_ID, name: 'WS', value: BASE_WEAPON_SKILL },
            { id: '6b9f-c8fe-8998-27e3', name: 'A', value: '4' }
          ]
        }]
      }]
    };

    const roster = {
      catalogueId: CATALOGUE_ID,
      costLimit: 2000,
      costLimitType: 'pts',
      forces: [{
        id: 'force-1',
        catalogueId: CATALOGUE_ID,
        selections: [{ id: 'sel-vampire', selectionEntryId: 'unit-vampire', number: 1, selections: [] }]
      }]
    };

    const result = collectUnitProfilesAndRules(system, roster.forces[0].selections[0], CATALOGUE_ID, roster);

    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0].name).toBe(PROFILE_NAME);

    const weaponSkill = result.profiles[0].characteristics.find(characteristic => characteristic.name === 'WS');
    expect(weaponSkill.value).toBe(String(Number(BASE_WEAPON_SKILL) + WEAPON_SKILL_BONUS));
    expect(weaponSkill.originalValue).toBe(BASE_WEAPON_SKILL);
    expect(weaponSkill.modificationBreakdown).toHaveLength(1);
    expect(weaponSkill.modificationBreakdown[0]).toContain(`+${WEAPON_SKILL_BONUS} von ${PROFILE_NAME} (Blood Dragon)`);
  });

  test('wiederholt einen Charakteristik-Modifier je vollem Vielfachen der Modellzahl', () => {
    const CATALOGUE_ID = 'cat-repeat-mod';
    const MODEL_ENTRY_ID = 'model-boy';
    const ATTACKS_CHARACTERISTIC_ID = 'char-a';
    const BASE_ATTACKS = '1';
    const BONUS_PER_BLOCK = 1;
    const MODELS_PER_BLOCK = 5;
    const MODEL_COUNT = 12;

    const system = {
      id: 'sys-repeat-mod',
      catalogues: [{
        id: CATALOGUE_ID,
        sharedSelectionEntries: [{
          id: 'unit-boyz',
          name: 'Boyz',
          selectionEntries: [
            {
              id: MODEL_ENTRY_ID,
              name: 'Boy',
              type: 'model',
              profiles: [{
                id: 'prof-boy',
                name: 'Boy',
                typeName: 'Profile',
                characteristics: [{ id: ATTACKS_CHARACTERISTIC_ID, name: 'A', value: BASE_ATTACKS }]
              }]
            },
            {
              id: 'upgrade-boss',
              name: 'Boss',
              type: 'upgrade',
              modifiers: [{
                type: 'increment',
                field: ATTACKS_CHARACTERISTIC_ID,
                value: String(BONUS_PER_BLOCK),
                repeat: { scope: 'parent', childId: MODEL_ENTRY_ID, value: MODELS_PER_BLOCK, repeats: 1 }
              }]
            }
          ]
        }]
      }]
    };

    const roster = {
      catalogueId: CATALOGUE_ID,
      forces: [{
        id: 'force-1',
        catalogueId: CATALOGUE_ID,
        selections: [{
          id: 'sel-boyz',
          selectionEntryId: 'unit-boyz',
          number: 1,
          selections: [
            { id: 'sel-boy', selectionEntryId: MODEL_ENTRY_ID, number: MODEL_COUNT },
            { id: 'sel-boss', selectionEntryId: 'upgrade-boss', number: 1 }
          ]
        }]
      }]
    };

    const result = collectUnitProfilesAndRules(system, roster.forces[0].selections[0], CATALOGUE_ID, roster);
    const boyProfile = result.profiles.find(profile => profile.name === 'Boy');
    const attacks = boyProfile.characteristics.find(characteristic => characteristic.name === 'A');

    const expectedBonus = Math.floor(MODEL_COUNT / MODELS_PER_BLOCK) * BONUS_PER_BLOCK;
    expect(attacks.value).toBe(String(Number(BASE_ATTACKS) + expectedBonus));
  });
});

describe('collectUnitProfilesAndRules — Profilauflösung über den Namen', () => {
  // Fällt die ID-Auflösung aus, greift der Name als Rückfallebene — inklusive
  // Pluralform („Short Bows" findet „Short Bow").
  test('findet ein geteiltes Profil über den Namen der Auswahl', () => {
    const PROFILE_NAME = 'Short Bow';
    const RANGE = '24"';

    const system = {
      id: 'sys-test',
      sharedProfiles: [{
        id: 'p-shortbow',
        name: PROFILE_NAME,
        profileTypeName: 'Weapon',
        characteristics: [
          { name: 'Range', value: RANGE },
          { name: 'Strength', value: '3' }
        ]
      }],
      catalogues: []
    };

    const selection = {
      id: 'sel-bows',
      selectionEntryId: 'entry-bows',
      name: 'Short Bows',
      selections: []
    };

    const result = collectUnitProfilesAndRules(system, selection, 'cat-test');
    const shortBowProfile = result.profiles.find(profile => profile.name === PROFILE_NAME);

    expect(shortBowProfile).toBeDefined();
    expect(shortBowProfile.characteristics.find(characteristic => characteristic.name === 'Range').value).toBe(RANGE);
  });
});
