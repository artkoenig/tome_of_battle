import { describe, it, expect } from 'vitest';
import { resolveListRuleGroup } from './listRules.js';

/**
 * Issue 0153 — "A shared honour reachable only from a hero is auto-added to
 * the army", criterion 4: a roster saved before the fix keeps its wrongly
 * added `Pure of Heart` selection, since the mandatory auto-add only ever ran
 * on a fresh roster. Criterion 4 asks whether the mandatory-lock the checklist
 * builds today (`resolveListRuleGroup`/`buildListRuleStates`) would hold that
 * stray selection in place — locking its checkbox because it looks mandatory —
 * even though the catalogue never offered it at that place.
 *
 * These tests drive `resolveListRuleGroup` against the REAL (unmocked)
 * `catalogResolver.js`/`entryVisibility.js`, following the pattern of
 * `listRules.mandatoryPredicate.test.js`: this file must never mock those two
 * modules, unlike `listRules.test.js`/`listRules.mandatoryState.test.js`,
 * whose mocked collector would decide the outcome instead of the production
 * code.
 *
 * Fixture: "Pure of Heart" (`d0ce-b0c4-fcc1-6cac`), shape-for-shape out of
 * `High Elves (6th definitive edition).cat` — it lives only in
 * `sharedSelectionEntries`, `type="upgrade"`, no own sub-options, no
 * `categoryLinks` of its own, and its own `min=1 scope="roster"
 * includeChildSelections="true" includeChildForces="true"` alongside `max=1
 * scope="roster"`/`max=1 scope="parent"`. It is offered through exactly one
 * place: the shared group "Honours" (`45a3-3e65-6c49-5cc0`), which the
 * character `selectionEntry` "Hero" pulls in by an `entryLink` of type
 * `selectionEntryGroup`. The force is a roster saved before the fix: it
 * already carries a selection of `Pure of Heart` directly (the shape the old,
 * now-removed sweep produced), alongside a genuine root-declared mandatory
 * list rule that the checklist is meant to lock.
 */
describe('resolveListRuleGroup — a shared-only stray selection is not held by the mandatory lock (Issue 0153)', () => {
  const CATALOGUE_ID = 'cat-high-elves';
  const RULES_CATEGORY_ID = 'cat-special-rules';

  const pureOfHeart = {
    id: 'd0ce-b0c4-fcc1-6cac',
    name: 'Pure of Heart',
    type: 'upgrade',
    hidden: false,
    costs: [],
    constraints: [
      { id: 'c-max-roster', type: 'max', value: 1, scope: 'roster' },
      { id: 'c-max-parent', type: 'max', value: 1, scope: 'parent' },
      {
        id: 'c-min-roster', type: 'min', value: 1, scope: 'roster',
        includeChildSelections: true, includeChildForces: true,
      },
    ],
  };

  const honoursGroup = {
    id: '45a3-3e65-6c49-5cc0',
    name: 'Honours',
    entryLinks: [{ id: 'link-pure-of-heart', targetId: pureOfHeart.id, type: 'selectionEntry' }],
  };

  const hero = {
    id: 'char-hero',
    name: 'Hero',
    type: 'unit',
    hidden: false,
    entryLinks: [{ id: 'link-honours', targetId: honoursGroup.id, type: 'selectionEntryGroup' }],
  };

  // The genuine root-declared mandatory list rule the checklist is meant to
  // lock, for comparison: an unrelated `upgrade` entry with its own min>=1
  // scoped to force and a categoryLink into the rules category.
  const rootRule = {
    id: 'root-mandatory-rule',
    name: 'Some Root Rule',
    type: 'upgrade',
    hidden: false,
    costs: [],
    constraints: [{ id: 'c-min-force', type: 'min', value: 1, scope: 'force' }],
    categoryLinks: [{ id: 'cl-root-rule', targetId: RULES_CATEGORY_ID, primary: true }],
  };

  const catalogue = {
    id: CATALOGUE_ID,
    selectionEntries: [hero, rootRule],
    sharedSelectionEntries: [pureOfHeart],
    sharedSelectionEntryGroups: [honoursGroup],
  };

  const system = {
    id: 'sys-shared-honour',
    catalogues: [catalogue],
  };

  // A roster saved before the fix: the root rule is present as intended, and
  // Pure of Heart is present too — wrongly, at force level, with no category
  // of its own (the "Sonstiges" shape a stray shared-only selection ends up
  // in; `findPresentSelection` scans every one of the force's selections
  // regardless of `category`).
  const force = {
    id: 'force-1',
    catalogueId: CATALOGUE_ID,
    selections: [
      { id: 'sel-rule', selectionEntryId: rootRule.id, category: RULES_CATEGORY_ID },
      { id: 'sel-honour', selectionEntryId: pureOfHeart.id, category: null },
    ],
  };

  const roster = { id: 'roster-1', catalogueId: CATALOGUE_ID, forces: [force] };

  it('does not build a checklist row for the stray Pure of Heart selection at all', () => {
    const { states } = resolveListRuleGroup(system, catalogue, RULES_CATEGORY_ID, { roster, force });
    expect(states.find((s) => s.resolvedId === pureOfHeart.id)).toBeUndefined();
  });

  it('positive control: the genuine root-declared rule IS held by the lock — mandatory and checked', () => {
    const { states } = resolveListRuleGroup(system, catalogue, RULES_CATEGORY_ID, { roster, force });
    const rootRuleState = states.find((s) => s.resolvedId === rootRule.id);
    expect(rootRuleState).toMatchObject({ mandatory: true, checked: true });
  });
});
