import { describe, test, expect } from 'vitest';
import { validateRoster } from './validator.js';
import {
  CATEGORY_ID,
  FORCE_LIMIT,
  SYSTEM_COST_LIMIT,
  UNIT_COST,
  createGrimdarkSystem,
  createValidRoster,
  createRoster,
  createCaptainSelection,
  createTacticalSquadSelection,
  createVampireSelection
} from './__fixtures__/grimdarkSystem.js';

const VIOLATION = {
  rosterLimit: 'roster-limit',
  categoryMin: 'category-min',
  categoryMax: 'category-max'
};

describe('validateRoster — Punktelimit des Rosters', () => {
  test('meldet keine Verletzung, solange die Gesamtkosten unter dem Limit bleiben', () => {
    const errors = validateRoster(createValidRoster(), createGrimdarkSystem());

    expect(errors).toEqual([]);
  });

  test('meldet roster-limit, sobald die Gesamtkosten das Limit überschreiten', () => {
    // Captain (100) + Tactical Squad (150) = 250 Punkte gegen ein Limit von 200.
    const tooSmallLimit = UNIT_COST.captain + UNIT_COST.tacticalSquad - 50;
    const roster = createValidRoster({ name: 'Blob Horde', costLimit: tooSmallLimit });

    const errors = validateRoster(roster, createGrimdarkSystem());

    expect(errors.some(error => error.type === VIOLATION.rosterLimit)).toBe(true);
  });
});

describe('validateRoster — Mindestbesetzung der Kontingent-Kategorien', () => {
  test('meldet category-min, wenn die geforderte HQ-Auswahl fehlt', () => {
    const roster = createRoster({
      name: 'No HQ Force',
      selections: [createTacticalSquadSelection()]
    });

    const errors = validateRoster(roster, createGrimdarkSystem());

    expect(errors.some(error => error.type === VIOLATION.categoryMin)).toBe(true);
  });
});

describe('validateRoster — Höchstzahl je Kontingent-Kategorie', () => {
  // Captain und Vampir zählen beide in „HQ" *und* in „Characters"; das
  // Characters-Limit von 1 greift also erst über die Mehrfachzugehörigkeit.
  const createTwoCharacterRoster = costLimit => createRoster({
    name: 'Characters Over Limit',
    costLimit,
    selections: [
      createCaptainSelection(),
      createVampireSelection(),
      createTacticalSquadSelection()
    ]
  });

  const findCharactersMaxError = errors => errors.find(
    error => error.type === VIOLATION.categoryMax && error.categoryId === CATEGORY_ID.characters
  );

  test('meldet category-max, wenn zwei Einheiten dieselbe Zweitkategorie belegen', () => {
    const aboveModifierThreshold = SYSTEM_COST_LIMIT + 500;

    const errors = validateRoster(createTwoCharacterRoster(aboveModifierThreshold), createGrimdarkSystem());

    expect(findCharactersMaxError(errors)).toBeDefined();
  });

  test('wendet den set-Modifier an, der das Characters-Limit unterhalb des Systemlimits anhebt', () => {
    const belowModifierThreshold = SYSTEM_COST_LIMIT - 500;
    expect(FORCE_LIMIT.charactersMaxBelowSystemLimit).toBeGreaterThan(FORCE_LIMIT.charactersMax);

    const errors = validateRoster(createTwoCharacterRoster(belowModifierThreshold), createGrimdarkSystem());

    expect(findCharactersMaxError(errors)).toBeUndefined();
  });
});

describe('validateRoster — System-Quirk: fehlendes Heroes-Limit', () => {
  // Der WHFB6-Datensatz definiert für „Heroes" kein eigenes max-Constraint; die
  // Quirk-Ergänzung leitet es aus dem Characters-Limit ab. Sie greift nur für
  // genau diese System-ID, weshalb der Test die echten Katalog-IDs verwendet.
  const WHFB6_SYSTEM_ID = '6d8e-38d9-3c69-febf';
  const WHFB6_CHARACTERS_CATEGORY_ID = '7a1c-d611-c2dc-def1';
  const WHFB6_HEROES_CATEGORY_ID = 'c16b-f319-2c62-2c12';
  const CHARACTERS_MAX = 3;
  const HERO_ENTRY_ID = 'hero-id';
  const QUIRK_CATALOGUE_ID = 'cat-og';
  const QUIRK_FORCE_ENTRY_ID = 'force-entry-1';

  function createWhfb6LikeSystem() {
    return {
      id: WHFB6_SYSTEM_ID,
      categoryEntries: [
        { id: WHFB6_CHARACTERS_CATEGORY_ID, name: 'Characters' },
        { id: WHFB6_HEROES_CATEGORY_ID, name: 'Heroes' }
      ],
      forceEntries: [
        {
          id: QUIRK_FORCE_ENTRY_ID,
          name: 'Standard',
          categoryLinks: [
            {
              targetId: WHFB6_CHARACTERS_CATEGORY_ID,
              name: 'Characters',
              constraints: [
                { id: 'char-max', type: 'max', value: CHARACTERS_MAX, field: 'selections', scope: 'parent' }
              ]
            },
            { targetId: WHFB6_HEROES_CATEGORY_ID, name: 'Heroes' }
          ]
        }
      ],
      catalogues: [
        {
          id: QUIRK_CATALOGUE_ID,
          selectionEntries: [
            {
              id: HERO_ENTRY_ID,
              name: 'Goblin Shaman',
              categoryLinks: [
                { targetId: WHFB6_CHARACTERS_CATEGORY_ID },
                { targetId: WHFB6_HEROES_CATEGORY_ID }
              ]
            }
          ]
        }
      ]
    };
  }

  function createHeroRoster(heroCount) {
    return {
      forces: [
        {
          id: 'force-1',
          forceEntryId: QUIRK_FORCE_ENTRY_ID,
          catalogueId: QUIRK_CATALOGUE_ID,
          selections: Array.from({ length: heroCount }, (_, index) => ({
            id: `sel-hero-${index + 1}`,
            selectionEntryId: HERO_ENTRY_ID,
            number: 1
          }))
        }
      ]
    };
  }

  test('meldet category-max für Heroes, obwohl der Datensatz dort kein Limit definiert', () => {
    const overLimit = CHARACTERS_MAX + 1;

    const errors = validateRoster(createHeroRoster(overLimit), createWhfb6LikeSystem());

    expect(errors.some(
      error => error.type === VIOLATION.categoryMax && error.categoryId === WHFB6_HEROES_CATEGORY_ID
    )).toBe(true);
  });

  test('meldet kein Heroes-Limit, solange die abgeleitete Höchstzahl eingehalten wird', () => {
    const errors = validateRoster(createHeroRoster(CHARACTERS_MAX), createWhfb6LikeSystem());

    expect(errors.some(
      error => error.type === VIOLATION.categoryMax && error.categoryId === WHFB6_HEROES_CATEGORY_ID
    )).toBe(false);
  });
});
