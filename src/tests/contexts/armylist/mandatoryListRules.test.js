import { describe, it, expect } from 'vitest';

import { applyMandatoryListRules } from '../../../contexts/armylist/application/mandatoryListRules.js';

/**
 * Issue 0189 — "an unambiguous mandatory list rule is added automatically" is a
 * rule of the model, not a habit of the editor. Every case here therefore runs
 * without React: a hand-built slot side stands in for the report, a two-entry
 * catalogue for the system, and the detection
 * (`findMissingMandatoryListRules`) is the real one — only the decision "and
 * therefore add it" is the subject.
 */

const SYSTEM = {
  id: 'sys',
  catalogues: [{
    id: 'cat',
    selectionEntries: [
      { id: 'rule-1', name: 'The Laws of Undeath', type: 'upgrade' },
      { id: 'rule-2', name: 'Campaign rules', type: 'upgrade' },
    ],
  }],
};

/** A slot of the report, with the three fields every capability must declare. */
function capability(defId, overrides = {}) {
  return {
    defId,
    name: defId,
    anchorKind: 'mandatoryPhantom',
    isMandatoryListRule: true,
    isHidden: false,
    isIndependentSubUnit: false,
    primaryCategoryId: 'cat-rules',
    raiseMembers: [],
    ...overrides,
  };
}

/**
 * The report's slot side: a root-level path carries no separator, a force's own
 * offer hangs one level below its force path — the same shape
 * `findMissingMandatoryListRules` reads in production.
 */
function slotsOf(entries) {
  return {
    capabilities: new Map(entries),
    pathOfForce: forceId => `root/${forceId}`,
  };
}

function rosterOf(forces) {
  return { id: 'r1', catalogueId: 'cat', forces };
}

const ONE_FORCE = () => rosterOf([{ id: 'f1', catalogueId: 'cat', selections: [] }]);
const TWO_FORCES = () => rosterOf([
  { id: 'f1', catalogueId: 'cat', selections: [] },
  { id: 'f2', catalogueId: 'cat', selections: [] },
]);

const apply = (roster, slots, overrides = {}) =>
  applyMandatoryListRules(roster, { system: SYSTEM, slots, isFreshRoster: true, ...overrides });

const entryIdsOf = (roster, forceIndex = 0) =>
  roster.forces[forceIndex].selections.map(selection => selection.selectionEntryId);

describe('applyMandatoryListRules', () => {
  it('adds the missing mandatory rule to a fresh roster', () => {
    const roster = ONE_FORCE();
    const next = apply(roster, slotsOf([['rule-1', capability('rule-1')]]));

    expect(entryIdsOf(next)).toEqual(['rule-1']);
    expect(next.forces[0].selections[0].name).toBe('The Laws of Undeath');
    // The roster it was given stays untouched — roster in, roster out.
    expect(roster.forces[0].selections).toEqual([]);
  });

  it('adds a rule the report offers below the force itself', () => {
    const next = apply(ONE_FORCE(), slotsOf([
      ['root/f1/rule-1', capability('rule-1', { anchorKind: 'offerAnchor' })],
    ]));

    expect(entryIdsOf(next)).toEqual(['rule-1']);
  });

  it('adds every independently eligible rule in one pass', () => {
    const next = apply(ONE_FORCE(), slotsOf([
      ['rule-1', capability('rule-1')],
      ['rule-2', capability('rule-2')],
    ]));

    expect(entryIdsOf(next).sort()).toEqual(['rule-1', 'rule-2']);
  });

  it('leaves an existing roster untouched — the fresh-roster gate is an argument', () => {
    const roster = ONE_FORCE();
    const slots = slotsOf([['rule-1', capability('rule-1')]]);

    expect(apply(roster, slots, { isFreshRoster: false })).toBe(roster);
    expect(applyMandatoryListRules(roster, { system: SYSTEM, slots })).toBe(roster);
  });

  it('writes nothing without a system or without a report', () => {
    const roster = ONE_FORCE();
    const slots = slotsOf([['rule-1', capability('rule-1')]]);

    expect(apply(roster, slots, { system: null })).toBe(roster);
    expect(apply(roster, null)).toBe(roster);
  });

  it('hands back the same roster when no rule is missing', () => {
    const roster = ONE_FORCE();

    expect(apply(roster, slotsOf([]))).toBe(roster);
  });

  it('never adds a hidden rule', () => {
    const roster = ONE_FORCE();

    expect(apply(roster, slotsOf([['rule-1', capability('rule-1', { isHidden: true })]]))).toBe(roster);
  });

  it('never adds a slot that is not a mandatory list rule', () => {
    const roster = ONE_FORCE();
    const slots = slotsOf([['rule-1', capability('rule-1', { isMandatoryListRule: false })]]);

    expect(apply(roster, slots)).toBe(roster);
  });

  it('skips a rule the force already carries', () => {
    const roster = rosterOf([{
      id: 'f1',
      catalogueId: 'cat',
      selections: [{ id: 's1', selectionEntryId: 'rule-1', name: 'The Laws of Undeath', selections: [] }],
    }]);

    expect(apply(roster, slotsOf([['rule-1', capability('rule-1')]]))).toBe(roster);
  });

  it('does not add a rule twice: the next report shows it as occupied', () => {
    const first = apply(ONE_FORCE(), slotsOf([['rule-1', capability('rule-1')]]));
    expect(entryIdsOf(first)).toEqual(['rule-1']);

    // Second pass, as the app runs it: the added rule now occupies its slot.
    const second = apply(first, slotsOf([
      ['root/f1/rule-1', capability('rule-1', { anchorKind: 'occupied' })],
      ['rule-1', capability('rule-1')],
    ]));

    expect(second).toBe(first);
    expect(entryIdsOf(second)).toEqual(['rule-1']);
  });

  it('claims an army-wide rule once across the forces of one pass', () => {
    const next = apply(TWO_FORCES(), slotsOf([['rule-1', capability('rule-1')]]));

    expect(entryIdsOf(next, 0)).toEqual(['rule-1']);
    expect(entryIdsOf(next, 1)).toEqual([]);
  });

  it('ignores a rule the catalogue no longer knows', () => {
    const roster = ONE_FORCE();

    expect(apply(roster, slotsOf([['gone', capability('gone')]]))).toBe(roster);
  });
});
