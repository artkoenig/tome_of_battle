import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluateCondition } from './modifierEvaluator.js';
import { collectUnitProfilesAndRules } from './profileCollector.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';

// JSDOM stellt DOMParser für den Node-Testlauf bereit (wie in den übrigen Solver-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// --- IDs der Domäne (Selbst-Scope-Blutlinien-Muster) -----------------------------

const VAMPIRE_ENTRY_ID = 'unit-vampire';
const BLOODLINE_ENTRY_ID = 'bloodline-blood-dragon';
const BLOOD_DRAGON_CATEGORY_ID = 'category-blood-dragon';
const CATALOGUE_ID = 'cat-self-scope';

const CATEGORY_MODIFIER_FIELD = 'category';
const SELECTIONS_FIELD = 'selections';

// Ein Vampir-Eintrag, der die Blood-Dragon-Kategorie NICHT statisch trägt, sondern
// erst per category-add-Modifier erhält, sobald die Blutlinie gewählt ist — genau die
// dynamische Kategorie-Zuweisung des echten Lexicanum-Katalogs.
const systemWithDynamicBloodlineCategory = {
  id: 'sys-self-scope',
  catalogues: [
    {
      id: CATALOGUE_ID,
      sharedSelectionEntries: [
        {
          id: VAMPIRE_ENTRY_ID,
          name: 'Vampire',
          type: 'model',
          modifiers: [
            {
              type: 'add',
              field: CATEGORY_MODIFIER_FIELD,
              value: BLOOD_DRAGON_CATEGORY_ID,
              conditions: [
                {
                  type: 'atLeast',
                  field: SELECTIONS_FIELD,
                  scope: 'force',
                  childId: BLOODLINE_ENTRY_ID,
                  value: 1
                }
              ]
            }
          ]
        },
        { id: BLOODLINE_ENTRY_ID, name: 'Bloodline of Clan Blood Dragon', type: 'upgrade' }
      ]
    }
  ]
};

const selfScopeCondition = {
  type: 'instanceOf',
  field: SELECTIONS_FIELD,
  scope: VAMPIRE_ENTRY_ID, // scope == eigene Entry-ID → Selbst-Scope
  childId: BLOOD_DRAGON_CATEGORY_ID,
  value: 0,
  includeChildSelections: true
};

const vampireSelectionWithBloodline = {
  id: 'sel-vampire',
  selectionEntryId: VAMPIRE_ENTRY_ID,
  number: 1,
  selections: [{ id: 'sel-bloodline', selectionEntryId: BLOODLINE_ENTRY_ID, number: 1 }]
};

const makeCtx = (bloodlineSelected) => ({
  system: systemWithDynamicBloodlineCategory,
  parentCatalogueId: CATALOGUE_ID,
  selection: vampireSelectionWithBloodline,
  selectionCounts: bloodlineSelected ? { [BLOODLINE_ENTRY_ID]: 1 } : {}
});

describe('evaluateCondition — instanceOf self-scope', () => {
  it('matches when the entry gained the childId category via a modifier (bloodline chosen)', () => {
    expect(evaluateCondition(selfScopeCondition, makeCtx(true))).toBe(true);
  });

  it('does not match when the conditional category was never added (no bloodline)', () => {
    expect(evaluateCondition(selfScopeCondition, makeCtx(false))).toBe(false);
  });

  it('negates correctly for notInstanceOf', () => {
    const negated = { ...selfScopeCondition, type: 'notInstanceOf' };
    expect(evaluateCondition(negated, makeCtx(true))).toBe(false);
    expect(evaluateCondition(negated, makeCtx(false))).toBe(true);
  });

  it('leaves a genuine category-id scope untouched (falls back to category membership)', () => {
    // scope is a real category id the selection statically belongs to, not the entry's
    // own id — the self-scope branch must not intercept this legacy pattern.
    const systemWithStaticCategory = {
      id: 'sys-static',
      categoryEntries: [{ id: 'cat-bloodline', name: 'Bloodline' }],
      catalogues: [
        {
          id: 'cat-static',
          sharedSelectionEntries: [
            {
              id: 'unit-static',
              name: 'Static Vampire',
              type: 'model',
              categoryLinks: [{ id: 'cl', targetId: 'cat-bloodline' }]
            }
          ]
        }
      ]
    };
    const cond = {
      type: 'instanceOf',
      field: SELECTIONS_FIELD,
      scope: 'cat-bloodline',
      childId: 'model',
      value: 0
    };
    const ctx = {
      system: systemWithStaticCategory,
      parentCatalogueId: 'cat-static',
      selection: { id: 's', selectionEntryId: 'unit-static', number: 1 }
    };
    expect(evaluateCondition(cond, ctx)).toBe(true);
  });
});

// --- E2E gegen echten (verbatim reduzierten) Lexicanum-Katalog -------------------

const FIXTURE_DIR = './src/solver/__fixtures__/whfb6-lexicanum';
const readFixture = (fileName) => readFileSync(`${FIXTURE_DIR}/${fileName}`, 'utf-8');

const lexicanumVampireCatalogue = parseCatalogueXML(readFixture('vampire-selfscope-bloodline.cat.xml'));
const lexicanumSystem = { id: lexicanumVampireCatalogue.gameSystemId, catalogues: [lexicanumVampireCatalogue] };

const REAL_VAMPIRE_COUNT_ID = '6822-0110-a7c9-cbb0';
const REAL_BLOOD_DRAGON_BLOODLINE_ID = '9fd9-e05c-ffcb-2c4d';
const REAL_WS_CHARACTERISTIC_ID = 'f95b-da01-0578-3bdc';

const buildVampireRoster = (bloodlineSelected) => ({
  catalogueId: lexicanumVampireCatalogue.id,
  forces: [
    {
      id: 'force-1',
      catalogueId: lexicanumVampireCatalogue.id,
      selections: [
        {
          id: 'sel-vampire-count',
          selectionEntryId: REAL_VAMPIRE_COUNT_ID,
          number: 1,
          selections: bloodlineSelected
            ? [{ id: 'sel-bloodline', selectionEntryId: REAL_BLOOD_DRAGON_BLOODLINE_ID, number: 1, selections: [] }]
            : []
        }
      ]
    }
  ]
});

const collectWeaponSkill = (bloodlineSelected) => {
  const roster = buildVampireRoster(bloodlineSelected);
  const { profiles } = collectUnitProfilesAndRules(
    lexicanumSystem,
    roster.forces[0].selections[0],
    lexicanumVampireCatalogue.id,
    roster
  );
  for (const profile of profiles) {
    const weaponSkill = profile.characteristics?.find((c) => c.id === REAL_WS_CHARACTERISTIC_ID);
    if (weaponSkill) return weaponSkill;
  }
  return null;
};

describe('collectUnitProfilesAndRules — real Lexicanum Vampire Count bloodline modifier', () => {
  it('leaves Weapon Skill at its base value when no bloodline is chosen', () => {
    const weaponSkill = collectWeaponSkill(false);
    expect(weaponSkill).toBeTruthy();
    expect(weaponSkill.value).toBe('7');
    expect(weaponSkill.originalValue).toBeUndefined();
  });

  it('applies the Blood Dragon Weapon Skill +2 modifier when the bloodline is chosen', () => {
    const weaponSkill = collectWeaponSkill(true);
    expect(weaponSkill).toBeTruthy();
    expect(weaponSkill.originalValue).toBe('7');
    expect(weaponSkill.value).toBe('9');
  });
});
