import { describe, it, expect } from 'vitest';
import { validateRoster } from './validator.js';

// Issue 62: a root catalogue entry with a roster-scoped `min` constraint (BattleScribe's
// encoding for a mandatory army-wide choice counted across *all* contingents together —
// e.g. the Ogre Kingdoms "Bulls" unit) must be validated even while it is entirely absent
// from the roster. Unlike the force-scoped variant it is reported once per roster and
// carries no forceId. Only the "absent army-wide" case is flagged here; a present-but-too-low
// count stays with the per-entry check to avoid double reporting.

const POINTS = 'pts';
const CATALOGUE_ID = 'cat-ogre';
const FORCE_ENTRY_ID = 'fe-standard';
const CORE_CATEGORY = 'core';
const HEROES_CATEGORY = 'heroes';
const BULLS_ID = 'entry-bulls';
const HIDDEN_UNIT_ID = 'entry-hidden-legion';
const TYRANT_ID = 'entry-tyrant';
const IRONGUTS_ID = 'entry-ironguts';
const BULLS_MIN_CONSTRAINT_ID = 'con-bulls-min';
const IRONGUTS_MIN_CONSTRAINT_ID = 'con-ironguts-min';

const ROSTER_SELECTOR_MIN = 'roster-selector-min';

const rosterScopedMin = (id, value) => ({
  id, type: 'min', value, scope: 'roster', field: 'selections'
});

// Conditional modifier that raises the Bulls minimum while a Tyrant is in the roster.
// It exists solely to prove the violation carries its `causes` field (ADR 0027): the
// namable selection (Tyrant) whose active modifier changed the constraint value.
const bullsMinRaisedByTyrant = () => ({
  type: 'increment',
  field: BULLS_MIN_CONSTRAINT_ID,
  valueObject: 1,
  conditions: [{ type: 'atLeast', value: 1, field: 'selections', childId: TYRANT_ID }]
});

// A second mandatory roster selector whose minimum is 0 by default and is raised to 1 only
// while the Heroes *category* holds at least one model. The gate reads a per-force category
// tally (forceCategoryCounts), so it exposes contingent-iteration-order dependence when the
// Heroes unit sits in a different contingent than the one iterated first.
const irongutsMinRaisedByHeroesCategory = () => ({
  type: 'increment',
  field: IRONGUTS_MIN_CONSTRAINT_ID,
  valueObject: 1,
  conditions: [{ type: 'atLeast', value: 1, field: HEROES_CATEGORY }]
});

const categoryGatedSelector = () => ({
  id: IRONGUTS_ID, name: 'Ironguts', type: 'unit', hidden: false,
  categoryLinks: [{ targetId: CORE_CATEGORY, primary: true }],
  constraints: [rosterScopedMin(IRONGUTS_MIN_CONSTRAINT_ID, 0)],
  modifiers: [irongutsMinRaisedByHeroesCategory()]
});

const buildSystem = ({ bullsModifiers = [], includeCategoryGatedSelector = false } = {}) => ({
  id: 'sys-ogre',
  costTypes: [{ id: POINTS, name: 'Points' }],
  categoryEntries: [
    { id: CORE_CATEGORY, name: 'Core' },
    { id: HEROES_CATEGORY, name: 'Heroes' }
  ],
  forceEntries: [{
    id: FORCE_ENTRY_ID, name: 'Standard',
    categoryLinks: [
      { id: 'cl-core', name: 'Core', targetId: CORE_CATEGORY },
      { id: 'cl-heroes', name: 'Heroes', targetId: HEROES_CATEGORY }
    ]
  }],
  catalogues: [{
    id: CATALOGUE_ID, name: 'Ogre Kingdoms',
    selectionEntries: [
      {
        id: BULLS_ID, name: 'Bulls', type: 'unit', hidden: false,
        categoryLinks: [{ targetId: CORE_CATEGORY, primary: true }],
        constraints: [rosterScopedMin(BULLS_MIN_CONSTRAINT_ID, 1)],
        modifiers: bullsModifiers
      },
      {
        // A hidden mandatory unit (only offered in a special army variant): its roster
        // minimum must not fire for a standard army that cannot take it.
        id: HIDDEN_UNIT_ID, name: 'Hidden Legion', type: 'unit', hidden: true,
        categoryLinks: [{ targetId: CORE_CATEGORY, primary: true }],
        constraints: [rosterScopedMin('con-hidden-min', 1)]
      },
      {
        id: TYRANT_ID, name: 'Tyrant', type: 'unit', hidden: false,
        categoryLinks: [{ targetId: HEROES_CATEGORY, primary: true }]
      },
      ...(includeCategoryGatedSelector ? [categoryGatedSelector()] : [])
    ]
  }]
});

const buildRoster = (forces) => ({
  name: 'Roster', costLimit: 2000, costLimitType: POINTS, catalogueId: CATALOGUE_ID, forces
});

const force = (id, selections) => ({
  id, forceEntryId: FORCE_ENTRY_ID, catalogueId: CATALOGUE_ID, selections
});

const bullsSelection = () => ({
  id: 's-bulls', selectionEntryId: BULLS_ID, number: 1, category: CORE_CATEGORY, selections: []
});

const tyrantSelection = () => ({
  id: 's-tyrant', selectionEntryId: TYRANT_ID, number: 1, category: HEROES_CATEGORY, selections: []
});

const rosterSelectorErrors = errors => errors.filter(e => e.type === ROSTER_SELECTOR_MIN);
const bullsErrors = errors =>
  rosterSelectorErrors(errors).filter(e => e.messageParams.entryName === 'Bulls');

describe('mandatory roster-scoped selector validation (Issue 62)', () => {
  it('reproduction: the mandatory roster selector is flagged when absent army-wide', () => {
    const errors = validateRoster(buildRoster([force('f1', [])]), buildSystem());

    expect(bullsErrors(errors)).toHaveLength(1);
    const bullsError = bullsErrors(errors)[0];
    expect(bullsError.severity).toBe('error');
    expect(bullsError.messageKey).toBe('validation.rosterSelectorMin');
    // Reported for the whole roster, not for a single contingent.
    expect(bullsError.forceId).toBeUndefined();
  });

  it('clears the error once at least one instance of the mandatory selector is present', () => {
    const errors = validateRoster(buildRoster([force('f1', [bullsSelection()])]), buildSystem());

    expect(bullsErrors(errors)).toHaveLength(0);
  });

  it('never flags a hidden mandatory selector for a standard army', () => {
    const errors = validateRoster(buildRoster([force('f1', [])]), buildSystem());

    expect(rosterSelectorErrors(errors).some(e => e.messageParams.entryName === 'Hidden Legion')).toBe(false);
  });

  it('reports the missing selector exactly once for a roster with several contingents', () => {
    const roster = buildRoster([force('f1', []), force('f2', [])]);

    const errors = validateRoster(roster, buildSystem());

    expect(bullsErrors(errors)).toHaveLength(1);
  });

  it('counts the selector army-wide: one instance in any contingent satisfies it', () => {
    const roster = buildRoster([force('f1', []), force('f2', [bullsSelection()])]);

    const errors = validateRoster(roster, buildSystem());

    expect(bullsErrors(errors)).toHaveLength(0);
  });

  it('evaluates a category-gated roster minimum army-wide, independent of contingent order', () => {
    const system = buildSystem({ includeCategoryGatedSelector: true });
    // Characterisation test for the army-wide semantics: the Heroes-category unit (Tyrant)
    // sits in the SECOND contingent, the first is empty and iterated first. Ironguts' minimum
    // is 0 until the Heroes category is populated, then 1; its own count is 0 army-wide, so the
    // requirement must fire. The check evaluates the min against a roster-wide, force-independent
    // context, so the result does not depend on which contingent is iterated first.
    const roster = buildRoster([force('f1', []), force('f2', [tyrantSelection()])]);

    const errors = validateRoster(roster, system);

    const irongutsErrors = rosterSelectorErrors(errors)
      .filter(e => e.messageParams.entryName === 'Ironguts');
    expect(irongutsErrors).toHaveLength(1);
  });

  it('carries its causes field when a conditional modifier raised the minimum (ADR 0027)', () => {
    const system = buildSystem({ bullsModifiers: [bullsMinRaisedByTyrant()] });
    // Tyrant present raises the Bulls minimum; Bulls itself is still absent → violation
    // whose cause is the Tyrant selection that lifted the constraint.
    const errors = validateRoster(buildRoster([force('f1', [tyrantSelection()])]), system);

    const bullsError = bullsErrors(errors)[0];
    expect(bullsError).toBeDefined();
    expect(bullsError.causes).toBeDefined();
    expect(bullsError.causes.some(cause => cause.entryId === TYRANT_ID && cause.name === 'Tyrant')).toBe(true);
  });
});
