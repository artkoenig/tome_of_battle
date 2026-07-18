import { describe, it, expect } from 'vitest';
import { validateRoster } from './validator.js';

// Issue 17/07, criterion 3: a root catalogue entry with a force-scoped `min` constraint
// (BattleScribe's encoding for a mandatory army-wide choice, e.g. the Vampire Counts
// bloodline) must be validated even while it is entirely absent from the roster.

const POINTS = 'pts';
const CATALOGUE_ID = 'cat-1';
const FORCE_ENTRY_ID = 'fe-1';
const SPECIAL_RULES_CATEGORY = 'special-rules';
const BLOODLINES_ID = 'bloodlines';
const HIDDEN_SELECTOR_ID = 'sylvania';
const FORCE_SELECTOR_MIN = 'force-selector-min';

const system = {
  id: 'sys-1',
  costTypes: [{ id: POINTS, name: 'Points' }],
  categoryEntries: [{ id: SPECIAL_RULES_CATEGORY, name: 'Special list rules' }],
  forceEntries: [{
    id: FORCE_ENTRY_ID, name: 'Standard',
    categoryLinks: [{ id: 'cl', name: 'Special list rules', targetId: SPECIAL_RULES_CATEGORY }]
  }],
  catalogues: [{
    id: CATALOGUE_ID, name: 'Test Catalogue',
    selectionEntries: [
      {
        id: BLOODLINES_ID, name: 'Bloodlines', type: 'upgrade', hidden: false,
        categoryLinks: [{ targetId: SPECIAL_RULES_CATEGORY, primary: true }],
        constraints: [{ type: 'min', value: 1, scope: 'force', field: 'selections', id: 'c-bl' }]
      },
      {
        // Hidden mandatory selector: only offered in a special army variant, so its
        // force minimum must not fire for a standard army.
        id: HIDDEN_SELECTOR_ID, name: 'Army of Sylvania', type: 'upgrade', hidden: true,
        categoryLinks: [{ targetId: SPECIAL_RULES_CATEGORY, primary: true }],
        constraints: [{ type: 'min', value: 1, scope: 'force', field: 'selections', id: 'c-sy' }]
      }
    ]
  }]
};

const buildRoster = selections => ({
  name: 'Roster', costLimit: 2000, costLimitType: POINTS, catalogueId: CATALOGUE_ID,
  forces: [{ id: 'f1', forceEntryId: FORCE_ENTRY_ID, catalogueId: CATALOGUE_ID, selections }]
});

const bloodlinesSelection = () => ({
  id: 's-bl', selectionEntryId: BLOODLINES_ID, number: 1, category: SPECIAL_RULES_CATEGORY, selections: []
});

const forceSelectorErrors = errors => errors.filter(e => e.type === FORCE_SELECTOR_MIN);

describe('mandatory force-scoped selector validation (Issue 17/07)', () => {
  it('flags the mandatory selector when it is absent from the roster', () => {
    const errors = validateRoster(buildRoster([]), system);
    const bloodlineError = forceSelectorErrors(errors).find(e => e.message.includes('Bloodlines'));
    expect(bloodlineError).toBeDefined();
    expect(bloodlineError.forceId).toBe('f1');
  });

  it('clears the error once the mandatory selector is present', () => {
    const errors = validateRoster(buildRoster([bloodlinesSelection()]), system);
    expect(forceSelectorErrors(errors).some(e => e.message.includes('Bloodlines'))).toBe(false);
  });

  it('never flags a hidden mandatory selector for a standard army', () => {
    const errors = validateRoster(buildRoster([]), system);
    expect(forceSelectorErrors(errors).some(e => e.message.includes('Sylvania'))).toBe(false);
  });
});
