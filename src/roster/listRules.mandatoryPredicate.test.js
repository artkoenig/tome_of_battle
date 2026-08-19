import { describe, it, expect } from 'vitest';
import { isUnconditionalMandatoryListRule, findMissingMandatoryListRuleSelections } from './listRules.js';

/**
 * Issue 0138 — "Eindeutige Pflicht-Listenregeln (min≥1) werden nicht
 * automatisch gesetzt". These tests pin down Acceptance Criteria 1, 2, 3 and 7
 * for the two new pure predicates/sweeps described in the issue's Plan
 * (contracts 1 and 2):
 *
 *   isUnconditionalMandatoryListRule(resolved)
 *   findMissingMandatoryListRuleSelections(system, catalogue, force)
 *
 * `isUnconditionalMandatoryListRule` is exercised directly on plain resolved-entry
 * objects — no catalogue/system plumbing needed, real (unmocked)
 * `battlescribeConstants.js`/`modifierEvaluator.js` back it, exactly as the
 * contract specifies. `findMissingMandatoryListRuleSelections` is exercised
 * against small, hand-authored system/catalogue/force fixtures using the REAL
 * (unmocked) `catalogResolver.js`/`entryVisibility.js`, so this file must never
 * mock those two modules (see listRules.mandatoryState.test.js for the
 * `mandatory`-state-flag tests, which use the older mocked-collaborator style
 * already established in listRules.test.js and therefore live in a separate
 * file to avoid colliding vi.mock declarations).
 *
 * Fixture shapes are grounded in the real WHFB6 "Definitive Edition" data this
 * issue is about (src/evaluator/__fixtures__/whfb6-definitive/): "The Laws of
 * Undeath" (Vampire Counts (6th definitive edition).cat:11640-11652 — type
 * upgrade, min=1/max=1 scope=force, no costs, no children), "Bloodlines"
 * (ibid:5094-5195 — min=1 scope=force directly on itself, but also its own
 * `selectionEntryGroups` follow-on choice), and "General" (Warhammer Fantasy
 * Battles (6th definitive edition).gst:1191 — only max constraints, no min at
 * all, plus non-zero Casting/Dispel Dice costs).
 *
 * SUPERSEDED IN PART BY ISSUE 0140: Issue 0138's criterion 1 also demanded
 * cost-freeness across every cost type, and its criterion 2 excluded "ein
 * kostenpflichtiger Wurzeleintrag" for that reason. Issue 0140 criterion 1
 * removes that condition outright — costs no longer bear on the predicate at
 * all. The two cases that pinned the old cost rejection are restated below
 * against their unchanged fixtures; the Issue-0140 describe blocks at the end of
 * this file carry the full new coverage. Every other feature of the predicate is
 * untouched (Issue 0140 criterion 3).
 */

describe('isUnconditionalMandatoryListRule', () => {
  const lawsOfUndeath = () => ({
    id: 'laws-of-undeath',
    name: 'The Laws of Undeath',
    type: 'upgrade',
    costs: [{ typeId: 'pts', value: 0 }],
    constraints: [
      { id: 'c-min', type: 'min', value: 1, scope: 'force' },
      { id: 'c-max', type: 'max', value: 1, scope: 'force' },
    ],
  });

  it('AC1: is true for a cost-free, container-free root entry with its own min>=1 constraint scoped to force', () => {
    expect(isUnconditionalMandatoryListRule(lawsOfUndeath())).toBe(true);
  });

  it('AC1: is also true when the min constraint is scoped to roster instead of force', () => {
    const entry = lawsOfUndeath();
    entry.constraints = [{ id: 'c-min', type: 'min', value: 1, scope: 'roster' }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('AC1 boundary: a min value greater than 1 still satisfies ">= 1"', () => {
    const entry = lawsOfUndeath();
    entry.constraints = [{ id: 'c-min', type: 'min', value: 2, scope: 'force' }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('AC1 boundary: min=0 (a real opt-in switch, e.g. "Allow experimental rules?") is not mandatory', () => {
    const entry = lawsOfUndeath();
    entry.constraints = [{ id: 'c-min', type: 'min', value: 0, scope: 'force' }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(false);
  });

  it('is false when the entry has no constraints at all', () => {
    const entry = lawsOfUndeath();
    entry.constraints = [];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(false);
  });

  it('is false when constraints is entirely absent', () => {
    const entry = lawsOfUndeath();
    delete entry.constraints;
    expect(isUnconditionalMandatoryListRule(entry)).toBe(false);
  });

  it('is false when there is no min constraint at all (only a max) — grounded in the real "General" entry', () => {
    // "General" (Warhammer Fantasy Battles (6th definitive edition).gst:1191)
    // carries only two max constraints (scope=force, scope=parent) and
    // non-zero Casting/Dispel Dice costs — it never had a min of its own.
    const general = {
      id: '1b7c-2c90-6d96-28c9',
      name: 'General',
      type: 'upgrade',
      costs: [
        { typeId: 'pts', value: 0 },
        { typeId: 'castingDice', value: 2 },
        { typeId: 'dispelDice', value: 2 },
      ],
      constraints: [
        { id: 'fc6d-21e4-3da5-17f9', type: 'max', value: 1, scope: 'force' },
        { id: 'a830-88fc-15ba-9584', type: 'max', value: 1, scope: 'parent' },
      ],
    };
    expect(isUnconditionalMandatoryListRule(general)).toBe(false);
  });

  it('AC1 scope requirement: a min constraint with no scope at all (instance-level) does not qualify', () => {
    const entry = lawsOfUndeath();
    entry.constraints = [{ id: 'c-min', type: 'min', value: 1 }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(false);
  });

  it('AC1 scope requirement: scope="parent" does not qualify — a container-relative limit, not an army-wide one', () => {
    const entry = lawsOfUndeath();
    entry.constraints = [{ id: 'c-min', type: 'min', value: 1, scope: 'parent' }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(false);
  });

  it('AC2: is false for an entry with its own follow-on choice (a selectionEntryGroup), even with min>=1 scope=force — grounded in "Bloodlines"', () => {
    // "Bloodlines" (Vampire Counts (6th definitive edition).cat:5094-5195)
    // carries min=1/scope=force directly on itself AND a "Vampiric Bloodline"
    // selectionEntryGroup demanding a further choice among five bloodlines.
    const bloodlines = {
      id: 'a56a-eb32-5a45-16fd',
      name: 'Bloodlines',
      type: 'upgrade',
      costs: [],
      constraints: [{ id: '4a0a-b107-e726-da32', type: 'min', value: 1, scope: 'force' }],
      selectionEntryGroups: [{ id: '5655-13ba-8980-bd1c', name: 'Vampiric Bloodline', selectionEntries: [] }],
    };
    expect(isUnconditionalMandatoryListRule(bloodlines)).toBe(false);
  });

  it('AC2: is false for an entry with its own child selectionEntries', () => {
    const entry = lawsOfUndeath();
    entry.selectionEntries = [{ id: 'child-1', name: 'Some sub-choice' }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(false);
  });

  it('AC2: is false for an entry with its own child entryLinks', () => {
    const entry = lawsOfUndeath();
    entry.entryLinks = [{ id: 'child-link-1', name: 'Some linked sub-choice' }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(false);
  });

  // The two cases below were written for Issue 0138's AC2 clause "ein
  // kostenpflichtiger Wurzeleintrag wird nicht automatisch gesetzt". Issue 0140
  // criterion 1 supersedes exactly that clause — cost-freeness is no longer part
  // of the predicate at all ("Die Kostenbedingung fällt ersatzlos weg") — so both
  // now pin the opposite outcome on their unchanged fixtures.
  it('Issue 0140 AC1: is true for a costed root entry that is container-free with min>=1 scope=force', () => {
    const entry = lawsOfUndeath();
    entry.costs = [{ typeId: 'pts', value: 120 }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('Issue 0140 AC1 cost boundary: exactly 0 in one cost type and non-zero in another is eligible too', () => {
    const entry = lawsOfUndeath();
    entry.costs = [{ typeId: 'pts', value: 0 }, { typeId: 'castingDice', value: 1 }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('is true when every declared cost type is exactly 0', () => {
    const entry = lawsOfUndeath();
    entry.costs = [{ typeId: 'pts', value: 0 }, { typeId: 'castingDice', value: 0 }, { typeId: 'dispelDice', value: 0 }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('is true when costs is an empty array', () => {
    const entry = lawsOfUndeath();
    entry.costs = [];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('is true when costs is entirely absent', () => {
    const entry = lawsOfUndeath();
    delete entry.costs;
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('honours an unconditional modifier that raises the effective min to 1 (contract: getModifiedConstraintValue over getEffectiveModifiers)', () => {
    const entry = lawsOfUndeath();
    entry.constraints = [{ id: 'c-min', type: 'min', value: 0, scope: 'force' }];
    entry.modifiers = [{ type: 'increment', field: 'c-min', value: 1 }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('honours an unconditional modifier that lowers the effective min back below 1', () => {
    const entry = lawsOfUndeath();
    entry.constraints = [{ id: 'c-min', type: 'min', value: 1, scope: 'force' }];
    entry.modifiers = [{ type: 'set', field: 'c-min', value: 0 }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(false);
  });
});

describe('findMissingMandatoryListRuleSelections', () => {
  const CATALOGUE_ID = 'cat-test';
  const RULES_CATEGORY_ID = 'cat-special-rules';

  const lawsOfUndeath = {
    id: 'laws-of-undeath',
    name: 'The Laws of Undeath',
    type: 'upgrade',
    hidden: false,
    costs: [],
    constraints: [
      { id: 'c-min-1', type: 'min', value: 1, scope: 'force' },
      { id: 'c-max-1', type: 'max', value: 1, scope: 'force' },
    ],
    categoryLinks: [{ id: 'cl-1', targetId: RULES_CATEGORY_ID, primary: true }],
  };

  // AC2 negative — grounded in "Bloodlines": min>=1 scope=force on itself, but
  // also its own follow-on choice (a selectionEntryGroup).
  const bloodlines = {
    id: 'bloodlines',
    name: 'Bloodlines',
    type: 'upgrade',
    hidden: false,
    costs: [],
    constraints: [{ id: 'c-min-2', type: 'min', value: 1, scope: 'force' }],
    categoryLinks: [{ id: 'cl-2', targetId: RULES_CATEGORY_ID, primary: true }],
    selectionEntryGroups: [{ id: 'grp-1', name: 'Vampiric Bloodline', selectionEntries: [] }],
  };

  // AC2 negative — a root entry with its own equipment sub-options (the
  // "Ogre Bulls"-style shape the issue calls out). Its `pts` cost is incidental
  // and, since Issue 0140 criterion 1, no longer a reason to exclude it: the
  // sub-options alone keep it out.
  const ogreBulls = {
    id: 'ogre-bulls-rule',
    name: 'Ogre Bulls',
    type: 'upgrade',
    hidden: false,
    costs: [{ typeId: 'pts', value: 120 }],
    constraints: [{ id: 'c-min-3', type: 'min', value: 1, scope: 'force' }],
    categoryLinks: [{ id: 'cl-3', targetId: RULES_CATEGORY_ID, primary: true }],
    selectionEntries: [{ id: 'ogre-bulls-champion', name: 'Bruiser' }],
  };

  // AC2 negative — grounded in the real "General": no own min constraint at all.
  const general = {
    id: 'general',
    name: 'General',
    type: 'upgrade',
    hidden: false,
    costs: [{ typeId: 'pts', value: 0 }, { typeId: 'castingDice', value: 2 }],
    constraints: [{ id: 'c-max-4', type: 'max', value: 1, scope: 'force' }],
    categoryLinks: [{ id: 'cl-4', targetId: 'cat-general', primary: false }],
  };

  const secondMandatoryRule = {
    id: 'campaign-rules',
    name: 'Campaign rules',
    type: 'upgrade',
    hidden: false,
    costs: [],
    constraints: [{ id: 'c-min-5', type: 'min', value: 1, scope: 'roster' }],
    categoryLinks: [{ id: 'cl-5', targetId: RULES_CATEGORY_ID, primary: true }],
  };

  const buildSystem = (entries) => ({
    id: 'sys-test',
    catalogues: [{ id: CATALOGUE_ID, selectionEntries: entries }],
  });

  const emptyForce = () => ({ id: 'f1', catalogueId: CATALOGUE_ID, selections: [] });

  it('AC1: finds a cost-free, container-free, min>=1/scope=force upgrade entry missing from an empty force', () => {
    const system = buildSystem([lawsOfUndeath]);
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing.map(m => m.resolved.id)).toEqual(['laws-of-undeath']);
  });

  it('reports the entry\'s own primary category alongside it', () => {
    const system = buildSystem([lawsOfUndeath]);
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing[0].categoryId).toBe(RULES_CATEGORY_ID);
  });

  it('AC2: excludes an entry with its own follow-on choice (selectionEntryGroup), e.g. Bloodlines', () => {
    const system = buildSystem([bloodlines]);
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing).toEqual([]);
  });

  it('AC2: excludes a root entry with equipment sub-options, e.g. Ogre Bulls', () => {
    const system = buildSystem([ogreBulls]);
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing).toEqual([]);
  });

  it('AC2: excludes an entry with no own min constraint (a multi-bearer category slot), e.g. General', () => {
    const system = buildSystem([general]);
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing).toEqual([]);
  });

  it('does not report an eligible entry the force already contains', () => {
    const system = buildSystem([lawsOfUndeath]);
    const force = { id: 'f1', catalogueId: CATALOGUE_ID, selections: [{ id: 'sel-1', selectionEntryId: 'laws-of-undeath' }] };
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], force);
    expect(missing).toEqual([]);
  });

  it('does not report an eligible entry that is currently hidden', () => {
    const hiddenLaws = { ...lawsOfUndeath, hidden: true };
    const system = buildSystem([hiddenLaws]);
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing).toEqual([]);
  });

  it('AC7: reports every independently eligible entry present at once', () => {
    const system = buildSystem([lawsOfUndeath, secondMandatoryRule]);
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing.map(m => m.resolved.id).sort()).toEqual(['campaign-rules', 'laws-of-undeath']);
  });

  it('AC7: still reports the remaining eligible entry once one of several has already been added', () => {
    const system = buildSystem([lawsOfUndeath, secondMandatoryRule]);
    const force = { id: 'f1', catalogueId: CATALOGUE_ID, selections: [{ id: 'sel-1', selectionEntryId: 'laws-of-undeath' }] };
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], force);
    expect(missing.map(m => m.resolved.id)).toEqual(['campaign-rules']);
  });

  describe('AC3: reactive re-computation as force.selections changes within the same session', () => {
    const TRIGGER_ID = 'general-von-carstein';

    // A hidden-by-default, otherwise criterion-1-eligible entry that becomes
    // visible once a specific other selection is present in the same force —
    // the "Army of Sylvania becomes visible+mandatory after a certain choice"
    // shape the issue describes for Criterion 3. (Verified against the real,
    // unmocked entryVisibility.js hidden-flag evaluator before authoring this
    // fixture: a `field: 'selections', type: 'atLeast', childId: <entry id>,
    // scope: 'force'` condition toggles correctly once the referenced
    // selection is present.)
    const reactiveRule = {
      id: 'army-of-sylvania-rule',
      name: 'Army of Sylvania',
      type: 'upgrade',
      hidden: true,
      costs: [],
      constraints: [{ id: 'c-min-6', type: 'min', value: 1, scope: 'force' }],
      categoryLinks: [{ id: 'cl-6', targetId: RULES_CATEGORY_ID, primary: true }],
      modifiers: [{
        type: 'set',
        field: 'hidden',
        value: 'false',
        conditions: [{ type: 'atLeast', field: 'selections', scope: 'force', childId: TRIGGER_ID, value: 1 }],
      }],
    };
    const trigger = { id: TRIGGER_ID, name: 'Von Carstein General', type: 'unit', hidden: false };

    it('is absent while the triggering selection has not been made yet', () => {
      const system = buildSystem([reactiveRule, trigger]);
      const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
      expect(missing.map(m => m.resolved.id)).not.toContain('army-of-sylvania-rule');
    });

    it('becomes missing (and thus reported) in the same session once the trigger selection is present', () => {
      const system = buildSystem([reactiveRule, trigger]);
      const force = {
        id: 'f1', catalogueId: CATALOGUE_ID,
        selections: [{ id: 'sel-trigger', selectionEntryId: TRIGGER_ID }],
      };
      const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], force);
      expect(missing.map(m => m.resolved.id)).toContain('army-of-sylvania-rule');
    });
  });
});

/**
 * Issue 0140 — "Eine Pflicht-Listenregel mit Kosten wird nicht automatisch
 * gesetzt". The cost-freeness requirement of Issue 0138's predicate is dropped:
 * a root `upgrade` entry with its own `min >= 1` in `scope="force"`/`"roster"`,
 * without sub-selections and not hidden, leaves the user no choice at all — the
 * army must carry it and pay whatever it costs (AC1). Every other feature of
 * the predicate keeps working exactly as before (AC3).
 *
 * Fixture shapes are grounded in the two real catalogue entries the issue names:
 *
 *  - ergofang `High Elf.cat`, entry `a4dc-9040-d98e-7bc1` ("Who Is the general?
 *    Nobody knows, roll the dice to see what it shows."): root `selectionEntry`,
 *    `type="upgrade"`, `hidden="false"`, no sub-selections, `min value=1
 *    scope="roster"` AND `max value=1 scope="roster"`, costs `pts=0`,
 *    `" Casting Dice"=2`, `" Dispel Dice"=2`, one `categoryLink` with
 *    `primary="false"`.
 *  - `Dwarfs (2001) (6th definitive edition).cat`, "Forces of Dwarfs' Army
 *    Rules": `min=1 scope="force"`, `hidden="false"`, no sub-selections,
 *    `2 Dispel Dice`.
 */
describe('isUnconditionalMandatoryListRule — costed mandatory list rules (Issue 0140)', () => {
  const PTS = 'cost-pts';
  const CASTING_DICE = 'cost-casting-dice';
  const DISPEL_DICE = 'cost-dispel-dice';

  /** The real ergofang High-Elf entry, shape-for-shape. */
  const whoIsTheGeneral = () => ({
    id: 'a4dc-9040-d98e-7bc1',
    name: 'Who Is the general? Nobody knows, roll the dice to see what it shows.',
    type: 'upgrade',
    hidden: false,
    costs: [
      { typeId: PTS, name: 'pts', value: 0 },
      { typeId: CASTING_DICE, name: 'Casting Dice', value: 2 },
      { typeId: DISPEL_DICE, name: 'Dispel Dice', value: 2 },
    ],
    constraints: [
      { id: 'c-min', type: 'min', value: 1, scope: 'roster' },
      { id: 'c-max', type: 'max', value: 1, scope: 'roster' },
    ],
    categoryLinks: [{ id: 'cl-general', targetId: 'cat-general', primary: false }],
  });

  it('AC1: the real High-Elf entry qualifies despite its 2 Casting Dice / 2 Dispel Dice', () => {
    expect(isUnconditionalMandatoryListRule(whoIsTheGeneral())).toBe(true);
  });

  it('AC1 boundary: a single non-zero cost type among otherwise-zero ones is no obstacle', () => {
    const entry = whoIsTheGeneral();
    entry.costs = [
      { typeId: PTS, value: 0 },
      { typeId: CASTING_DICE, value: 0 },
      { typeId: DISPEL_DICE, value: 2 },
    ];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('AC1 boundary: non-zero in EVERY declared cost type is no obstacle either', () => {
    const entry = whoIsTheGeneral();
    entry.costs = [
      { typeId: PTS, value: 75 },
      { typeId: CASTING_DICE, value: 2 },
      { typeId: DISPEL_DICE, value: 2 },
    ];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('AC1: a non-zero POINTS cost alone does not disqualify — no cost type is privileged', () => {
    const entry = whoIsTheGeneral();
    entry.costs = [{ typeId: PTS, value: 120 }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('AC1 boundary: a negative cost value is also "ungleich 0" and does not disqualify', () => {
    const entry = whoIsTheGeneral();
    entry.costs = [{ typeId: PTS, value: -25 }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('AC1 boundary: a fractional cost value does not disqualify', () => {
    const entry = whoIsTheGeneral();
    entry.costs = [{ typeId: CASTING_DICE, value: 0.5 }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  it('AC1: the scope="force" form with costs qualifies too — "Forces of Dwarfs\' Army Rules" (2 Dispel Dice)', () => {
    const forcesOfDwarfs = {
      id: 'forces-of-dwarfs-army-rules',
      name: "Forces of Dwarfs' Army Rules",
      type: 'upgrade',
      hidden: false,
      costs: [{ typeId: DISPEL_DICE, name: 'Dispel Dice', value: 2 }],
      constraints: [{ id: 'c-min', type: 'min', value: 1, scope: 'force' }],
    };
    expect(isUnconditionalMandatoryListRule(forcesOfDwarfs)).toBe(true);
  });

  it('AC1: a costed entry whose min is raised to 1 only by an unconditional modifier still qualifies', () => {
    const entry = whoIsTheGeneral();
    entry.constraints = [{ id: 'c-min', type: 'min', value: 0, scope: 'force' }];
    entry.modifiers = [{ type: 'increment', field: 'c-min', value: 1 }];
    expect(isUnconditionalMandatoryListRule(entry)).toBe(true);
  });

  // ── AC3: every other feature of the predicate keeps rejecting, costs or not ──
  // These guard against the removal of the cost condition being widened into a
  // removal of the remaining ones. They already hold today; the issue requires
  // that they keep holding.

  it('AC3: an entry with its own sub-selections stays ineligible, costed or not', () => {
    const costed = whoIsTheGeneral();
    costed.selectionEntries = [{ id: 'child-1', name: 'Some sub-choice' }];
    expect(isUnconditionalMandatoryListRule(costed)).toBe(false);

    const free = whoIsTheGeneral();
    free.costs = [];
    free.selectionEntryGroups = [{ id: 'grp-1', name: 'Some follow-on choice', selectionEntries: [] }];
    expect(isUnconditionalMandatoryListRule(free)).toBe(false);
  });

  it('AC3: an entry with its own child entryLinks stays ineligible, costed or not', () => {
    const costed = whoIsTheGeneral();
    costed.entryLinks = [{ id: 'child-link-1', name: 'Some linked sub-choice' }];
    expect(isUnconditionalMandatoryListRule(costed)).toBe(false);

    const free = whoIsTheGeneral();
    free.costs = [];
    free.entryLinks = [{ id: 'child-link-1', name: 'Some linked sub-choice' }];
    expect(isUnconditionalMandatoryListRule(free)).toBe(false);
  });

  it('AC3: an entry without any min constraint stays ineligible, costed or not', () => {
    const costed = whoIsTheGeneral();
    costed.constraints = [{ id: 'c-max', type: 'max', value: 1, scope: 'roster' }];
    expect(isUnconditionalMandatoryListRule(costed)).toBe(false);

    const free = whoIsTheGeneral();
    free.costs = [];
    free.constraints = [{ id: 'c-max', type: 'max', value: 1, scope: 'roster' }];
    expect(isUnconditionalMandatoryListRule(free)).toBe(false);
  });

  it('AC3: min >= 1 with no scope written at all stays ineligible, costed or not', () => {
    const costed = whoIsTheGeneral();
    costed.constraints = [{ id: 'c-min', type: 'min', value: 1 }];
    expect(isUnconditionalMandatoryListRule(costed)).toBe(false);

    const free = whoIsTheGeneral();
    free.costs = [];
    free.constraints = [{ id: 'c-min', type: 'min', value: 1 }];
    expect(isUnconditionalMandatoryListRule(free)).toBe(false);
  });

  it('AC3: min >= 1 with scope="parent" stays ineligible, costed or not', () => {
    const costed = whoIsTheGeneral();
    costed.constraints = [{ id: 'c-min', type: 'min', value: 1, scope: 'parent' }];
    expect(isUnconditionalMandatoryListRule(costed)).toBe(false);

    const free = whoIsTheGeneral();
    free.costs = [];
    free.constraints = [{ id: 'c-min', type: 'min', value: 1, scope: 'parent' }];
    expect(isUnconditionalMandatoryListRule(free)).toBe(false);
  });

  it('AC3: an effective min below 1 stays ineligible, costed or not', () => {
    const costed = whoIsTheGeneral();
    costed.constraints = [{ id: 'c-min', type: 'min', value: 0, scope: 'roster' }];
    expect(isUnconditionalMandatoryListRule(costed)).toBe(false);

    const lowered = whoIsTheGeneral();
    lowered.costs = [];
    lowered.constraints = [{ id: 'c-min', type: 'min', value: 1, scope: 'roster' }];
    lowered.modifiers = [{ type: 'set', field: 'c-min', value: 0 }];
    expect(isUnconditionalMandatoryListRule(lowered)).toBe(false);
  });
});

describe('findMissingMandatoryListRuleSelections — costed mandatory list rules (Issue 0140)', () => {
  const CATALOGUE_ID = 'cat-high-elf';
  const GENERAL_CATEGORY_ID = 'cat-general';
  const PTS = 'cost-pts';
  const CASTING_DICE = 'cost-casting-dice';
  const DISPEL_DICE = 'cost-dispel-dice';

  /**
   * The real ergofang High-Elf entry. Note the single `categoryLink` carries
   * `primary="false"` — the entry therefore has no primary category at all,
   * which the issue calls out explicitly as its own (separate) shortcoming.
   */
  const whoIsTheGeneral = {
    id: 'a4dc-9040-d98e-7bc1',
    name: 'Who Is the general? Nobody knows, roll the dice to see what it shows.',
    type: 'upgrade',
    hidden: false,
    costs: [
      { typeId: PTS, value: 0 },
      { typeId: CASTING_DICE, value: 2 },
      { typeId: DISPEL_DICE, value: 2 },
    ],
    constraints: [
      { id: 'c-min-heg', type: 'min', value: 1, scope: 'roster' },
      { id: 'c-max-heg', type: 'max', value: 1, scope: 'roster' },
    ],
    categoryLinks: [{ id: 'cl-general', targetId: GENERAL_CATEGORY_ID, primary: false }],
  };

  /** "Forces of Dwarfs' Army Rules": the scope="force" sibling case, 2 Dispel Dice. */
  const forcesOfDwarfs = {
    id: 'forces-of-dwarfs-army-rules',
    name: "Forces of Dwarfs' Army Rules",
    type: 'upgrade',
    hidden: false,
    costs: [{ typeId: DISPEL_DICE, value: 2 }],
    constraints: [{ id: 'c-min-dwarf', type: 'min', value: 1, scope: 'force' }],
    categoryLinks: [{ id: 'cl-rules', targetId: 'cat-special-rules', primary: true }],
  };

  // AC3 negatives — all deliberately COST-FREE, so nothing but the feature under
  // test can be the reason they stay out.
  const withSubChoice = {
    id: 'neg-sub-choice', name: 'Bloodlines', type: 'upgrade', hidden: false, costs: [],
    constraints: [{ id: 'c-min-n1', type: 'min', value: 1, scope: 'roster' }],
    selectionEntryGroups: [{ id: 'grp-1', name: 'Vampiric Bloodline', selectionEntries: [] }],
  };
  const withoutMin = {
    id: 'neg-no-min', name: 'General', type: 'upgrade', hidden: false, costs: [],
    constraints: [{ id: 'c-max-n2', type: 'max', value: 1, scope: 'roster' }],
  };
  const withUnwrittenScope = {
    id: 'neg-scope-missing', name: 'Instance-level minimum', type: 'upgrade', hidden: false, costs: [],
    constraints: [{ id: 'c-min-n3', type: 'min', value: 1 }],
  };
  const withParentScope = {
    id: 'neg-scope-parent', name: 'Container-relative minimum', type: 'upgrade', hidden: false, costs: [],
    constraints: [{ id: 'c-min-n4', type: 'min', value: 1, scope: 'parent' }],
  };
  const withMinBelowOne = {
    id: 'neg-min-zero', name: 'Allow experimental rules?', type: 'upgrade', hidden: false, costs: [],
    constraints: [{ id: 'c-min-n5', type: 'min', value: 0, scope: 'roster' }],
  };

  const INELIGIBLE = [withSubChoice, withoutMin, withUnwrittenScope, withParentScope, withMinBelowOne];

  const buildSystem = (entries) => ({
    id: 'sys-ergofang',
    catalogues: [{ id: CATALOGUE_ID, selectionEntries: entries }],
  });
  const emptyForce = () => ({ id: 'f1', catalogueId: CATALOGUE_ID, selections: [] });

  it('AC1: reports the costed High-Elf entry as missing from a fresh, empty force', () => {
    const system = buildSystem([whoIsTheGeneral]);
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing.map(m => m.resolved.id)).toEqual(['a4dc-9040-d98e-7bc1']);
  });

  it('AC1/AC3: reports exactly the costed mandatory entry and none of the ineligible ones', () => {
    const system = buildSystem([...INELIGIBLE, whoIsTheGeneral]);
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing.map(m => m.resolved.id)).toEqual(['a4dc-9040-d98e-7bc1']);
  });

  it('AC2 edge: reports it with categoryId null — its only categoryLink is primary="false"', () => {
    const system = buildSystem([whoIsTheGeneral]);
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing).toHaveLength(1);
    expect(missing[0].categoryId).toBeNull();
  });

  it('AC1: reports the costed scope="force" entry too — "Forces of Dwarfs\' Army Rules"', () => {
    const system = buildSystem([forcesOfDwarfs]);
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing.map(m => m.resolved.id)).toEqual(['forces-of-dwarfs-army-rules']);
  });

  it('reports each costed mandatory entry independently, and only the ones still absent', () => {
    const system = buildSystem([whoIsTheGeneral, forcesOfDwarfs]);
    const force = {
      id: 'f1', catalogueId: CATALOGUE_ID,
      selections: [{ id: 'sel-1', selectionEntryId: 'a4dc-9040-d98e-7bc1' }],
    };
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], force);
    expect(missing.map(m => m.resolved.id)).toEqual(['forces-of-dwarfs-army-rules']);
  });

  it('AC3: a hidden costed mandatory entry is still not reported', () => {
    const system = buildSystem([{ ...whoIsTheGeneral, hidden: true }]);
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing).toEqual([]);
  });

  it('AC3: none of the ineligible shapes is reported, even alone in the catalogue', () => {
    for (const entry of INELIGIBLE) {
      const system = buildSystem([entry]);
      const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
      expect(missing, `ineligible entry ${entry.id} must stay out`).toEqual([]);
    }
  });
});

/**
 * Issue 0153 — „Pure of Heart" wird der Armeeliste hinzugefügt, statt als
 * Helden-Option gewählt zu werden. `findMissingMandatoryListRuleSelections`
 * durchsuchte neben den echten Wurzel-Pools auch `sharedSelectionEntries`.
 * Geteilte Definitionen sind aber kein Wurzelbestand: sie sind nur über einen
 * Verweis erreichbar und erscheinen allein an dessen Stelle — §9.9 der
 * BSData-Doku kennt für die armeeweite Pflicht genau zwei Wurzelformen, den
 * `selectionEntry` und den `entryLink`.
 *
 * Fixture-Formen sind an den echten Katalogdaten belegt
 * (`High Elves (6th definitive edition).cat`):
 *
 *  - `d0ce-b0c4-fcc1-6cac` „Pure of Heart": geteilter `selectionEntry`,
 *    `type="upgrade"`, `hidden="false"`, ohne eigene Unterauswahlen,
 *    `min value="1" scope="roster"` (dazu `max=1` in `roster` und `parent`),
 *    alle Kosten 0, ohne `categoryLink`. Erreichbar allein über die geteilte
 *    Gruppe `45a3-3e65-6c49-5cc0` „Honours", die an vier Helden-Einträgen hängt.
 *  - `Errantry War` (Bretonnia) steht stellvertretend für die unveränderte
 *    Wurzelform: derselbe Merkmalssatz, aber im Pool `selectionEntries`.
 */
describe('findMissingMandatoryListRuleSelections — geteilte Definitionen sind kein Wurzelbestand (Issue 0153)', () => {
  const CATALOGUE_ID = 'cat-high-elves';
  const HONOURS_GROUP_ID = '45a3-3e65-6c49-5cc0';

  /** Der echte geteilte Eintrag, Form für Form. */
  const pureOfHeart = {
    id: 'd0ce-b0c4-fcc1-6cac',
    name: 'Pure of Heart',
    type: 'upgrade',
    hidden: false,
    costs: [{ typeId: 'cost-pts', value: 0 }],
    constraints: [
      { id: '4720-59d3-07c4-68b3', type: 'max', value: 1, scope: 'roster' },
      { id: '69ac-892d-a730-545d', type: 'max', value: 1, scope: 'parent' },
      { id: '82ef-69c7-f459-5e20', type: 'min', value: 1, scope: 'roster' },
    ],
  };

  /** Die geteilte Gruppe „Honours", über die die Ehre allein erreichbar ist. */
  const honoursGroup = {
    id: HONOURS_GROUP_ID,
    name: 'Honours',
    hidden: false,
    entryLinks: [
      { id: '30b5-bd1a-60e2-2354', name: 'Pure of Heart', targetId: pureOfHeart.id, type: 'selectionEntry' },
    ],
  };

  /** Ein Held im Wurzel-Pool, der die Gruppe per Verweis einbindet. */
  const heroWithHonours = {
    id: 'hero-prince',
    name: 'Prince',
    type: 'unit',
    hidden: false,
    costs: [{ typeId: 'cost-pts', value: 140 }],
    entryLinks: [
      { id: 'c7fa-d10c-2cea-bfa2', name: 'Honours', targetId: HONOURS_GROUP_ID, type: 'selectionEntryGroup' },
    ],
  };

  /** Die unveränderte Wurzelform derselben Merkmale — „Errantry War" (Bretonnia). */
  const errantryWar = {
    id: 'errantry-war',
    name: 'Errantry War',
    type: 'upgrade',
    hidden: false,
    costs: [],
    constraints: [{ id: 'c-min-errantry', type: 'min', value: 1, scope: 'force' }],
    categoryLinks: [{ id: 'cl-errantry', targetId: 'cat-special-rules', primary: true }],
  };

  const buildSystem = ({ selectionEntries = [], entryLinks = [], sharedSelectionEntries = [], sharedSelectionEntryGroups = [] }) => ({
    id: 'sys-whfb6-definitive',
    catalogues: [{ id: CATALOGUE_ID, selectionEntries, entryLinks, sharedSelectionEntries, sharedSelectionEntryGroups }],
  });
  const emptyForce = () => ({ id: 'f1', catalogueId: CATALOGUE_ID, selections: [] });

  it('AC1: meldet „Pure of Heart" nicht, obwohl es jedes übrige Merkmal der Pflicht-Listenregel trägt', () => {
    const system = buildSystem({
      selectionEntries: [heroWithHonours],
      sharedSelectionEntries: [pureOfHeart],
      sharedSelectionEntryGroups: [honoursGroup],
    });
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing).toEqual([]);
  });

  it('AC1: das Prädikat selbst urteilt unverändert — der Eintrag scheitert allein an seinem Pool, nicht an seiner Form', () => {
    expect(isUnconditionalMandatoryListRule(pureOfHeart)).toBe(true);
  });

  it('AC3: die Wurzelform derselben Merkmale wird weiterhin gemeldet — „Errantry War"', () => {
    const system = buildSystem({ selectionEntries: [errantryWar] });
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing.map(m => m.resolved.id)).toEqual(['errantry-war']);
  });

  it('AC1/AC3: liegt beides im selben Katalog, bleibt genau die Wurzelform übrig', () => {
    const system = buildSystem({
      selectionEntries: [heroWithHonours, errantryWar],
      sharedSelectionEntries: [pureOfHeart],
      sharedSelectionEntryGroups: [honoursGroup],
    });
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing.map(m => m.resolved.id)).toEqual(['errantry-war']);
  });

  it('AC3: die Wurzel-entryLink-Form auf dieselbe geteilte Definition wird sehr wohl gemeldet', () => {
    // Ein Katalog, der die Pflicht als Wurzel-`entryLink` kodiert (die zweite
    // Form aus §9.9), meint sie ernst — der Verweis steht in der Wurzel, nicht
    // unter einem Helden. Der Link trägt den Constraint selbst.
    const rootLink = {
      id: 'root-link-pure-of-heart',
      name: 'Pure of Heart',
      targetId: pureOfHeart.id,
      type: 'selectionEntry',
      hidden: false,
      constraints: [{ id: 'c-min-root-link', type: 'min', value: 1, scope: 'roster' }],
    };
    const system = buildSystem({ entryLinks: [rootLink], sharedSelectionEntries: [pureOfHeart] });
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing.map(m => m.resolved.id)).toEqual([pureOfHeart.id]);
  });
});
