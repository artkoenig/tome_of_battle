import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluateCondition } from './modifierEvaluator.js';
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
