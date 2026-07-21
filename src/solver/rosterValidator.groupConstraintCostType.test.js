import { describe, test, expect } from 'vitest';
import { validateRoster } from './validator.js';
import { POINTS, CASTING_DICE, COST_TYPE_NAME } from './__fixtures__/grimdarkSystem.js';

/**
 * Eine Kostenlimit-Constraint auf einer Auswahlgruppe muss die Kostenart
 * summieren, die sie selbst in `con.field` nennt — nicht die, nach der das
 * Roster gebaut wird (ADR-0003 §3a).
 *
 * Der Aufbau trennt beide Kostenarten deshalb bewusst weit: die Gruppe liegt
 * bei den Zauberwürfeln unter ihrer Grenze und bei den Punkten weit darüber.
 * Würde über `roster.costLimitType` summiert, kippte jede Erwartung hier ins
 * Gegenteil.
 */

const CATALOGUE_ID = 'cat-arcane';
const FORCE_ENTRY_ID = 'force-arcane';
const HQ_CATEGORY_ID = 'cat-hq';
const WIZARD_ENTRY_ID = 'unit-wizard';
const POWER_STONE_ENTRY_ID = 'item-power-stone';
const CASTING_POOL_GROUP_ID = 'group-casting-pool';
const CASTING_POOL_GROUP_NAME = 'Casting Pool';

const ROSTER_POINTS_LIMIT = 2000;
const WIZARD_POINTS = 100;
/** Eigene Würfel des Magiers — Bezugsgröße der Prozent-Constraints. */
const WIZARD_CASTING_DICE = 6;
const POWER_STONE_POINTS = 40;
const POWER_STONE_CASTING_DICE = 2;

/** Absolute Würfelgrenze der Gruppe. */
const CASTING_DICE_GROUP_MAX = 5;
/** Prozentgrenze, unter der die Gruppe bleibt. */
const PERMISSIVE_PERCENT = 50;
/** Prozentgrenze, die die Gruppe überschreitet. */
const STRICT_PERCENT = 30;

const VIOLATION = {
  groupPointsMax: 'group-points-max',
  groupPercentMax: 'group-percent-max'
};

const CASTING_DICE_LABEL = COST_TYPE_NAME.castingDice.trim();

const castingDiceMaxConstraint = () => ({
  id: 'con-casting-pool-max',
  type: 'max',
  value: CASTING_DICE_GROUP_MAX,
  field: CASTING_DICE,
  scope: 'parent'
});

const castingDicePercentConstraint = percent => ({
  id: 'con-casting-pool-percent',
  type: 'max',
  percentValue: true,
  value: percent,
  field: CASTING_DICE,
  scope: 'roster'
});

function createArcaneSystem(groupConstraint) {
  return {
    id: 'sys-arcane-cost-types',
    name: 'Arcane Cost Types',
    costTypes: [
      { id: POINTS, name: COST_TYPE_NAME.points, defaultCostLimit: ROSTER_POINTS_LIMIT },
      { id: CASTING_DICE, name: COST_TYPE_NAME.castingDice }
    ],
    categoryEntries: [{ id: HQ_CATEGORY_ID, name: 'HQ' }],
    forceEntries: [{
      id: FORCE_ENTRY_ID,
      name: 'Arcane Force',
      categoryLinks: [{ id: 'cl-hq', targetId: HQ_CATEGORY_ID, name: 'HQ' }]
    }],
    catalogues: [{
      id: CATALOGUE_ID,
      name: 'Arcane Catalogue',
      selectionEntries: [{
        id: WIZARD_ENTRY_ID,
        name: 'Wizard',
        type: 'unit',
        costs: [
          { typeId: POINTS, value: WIZARD_POINTS },
          { typeId: CASTING_DICE, value: WIZARD_CASTING_DICE }
        ],
        categoryLinks: [{ targetId: HQ_CATEGORY_ID }],
        selectionEntryGroups: [{
          id: CASTING_POOL_GROUP_ID,
          name: CASTING_POOL_GROUP_NAME,
          constraints: [groupConstraint],
          selectionEntries: [{
            id: POWER_STONE_ENTRY_ID,
            name: 'Power Stone',
            costs: [
              { typeId: POINTS, value: POWER_STONE_POINTS },
              { typeId: CASTING_DICE, value: POWER_STONE_CASTING_DICE }
            ]
          }]
        }]
      }]
    }]
  };
}

const powerStoneSelection = index => ({
  id: `sel-power-stone-${index}`,
  selectionEntryId: POWER_STONE_ENTRY_ID,
  name: 'Power Stone',
  number: 1,
  costs: [
    { typeId: POINTS, value: POWER_STONE_POINTS },
    { typeId: CASTING_DICE, value: POWER_STONE_CASTING_DICE }
  ]
});

/** Roster nach **Punkten** gebaut — die Gruppengrenze misst dennoch Zauberwürfel. */
function createWizardRoster(powerStoneCount) {
  return {
    name: 'Arcane Army',
    costLimit: ROSTER_POINTS_LIMIT,
    costLimitType: POINTS,
    catalogueId: CATALOGUE_ID,
    forces: [{
      id: 'f1',
      forceEntryId: FORCE_ENTRY_ID,
      catalogueId: CATALOGUE_ID,
      selections: [{
        id: 'sel-wizard',
        selectionEntryId: WIZARD_ENTRY_ID,
        name: 'Wizard',
        number: 1,
        category: HQ_CATEGORY_ID,
        costs: [
          { typeId: POINTS, value: WIZARD_POINTS },
          { typeId: CASTING_DICE, value: WIZARD_CASTING_DICE }
        ],
        selections: Array.from({ length: powerStoneCount }, (_, index) => powerStoneSelection(index))
      }]
    }]
  };
}

const groupCastingDiceOf = powerStoneCount => powerStoneCount * POWER_STONE_CASTING_DICE;
const groupPointsOf = powerStoneCount => powerStoneCount * POWER_STONE_POINTS;

describe('validateRoster — absolute Gruppengrenze auf einer anderen Kostenart', () => {
  const STONES_WITHIN_LIMIT = 2;
  const STONES_OVER_LIMIT = 3;

  test('vier Zauberwürfel bleiben unter der Fünf-Würfel-Grenze, obwohl die Punkte sie sprengen würden', () => {
    expect(groupCastingDiceOf(STONES_WITHIN_LIMIT)).toBeLessThanOrEqual(CASTING_DICE_GROUP_MAX);
    expect(groupPointsOf(STONES_WITHIN_LIMIT)).toBeGreaterThan(CASTING_DICE_GROUP_MAX);

    const errors = validateRoster(createWizardRoster(STONES_WITHIN_LIMIT), createArcaneSystem(castingDiceMaxConstraint()));

    expect(errors.some(error => error.type === VIOLATION.groupPointsMax)).toBe(false);
  });

  test('sechs Zauberwürfel überschreiten die Grenze und die Meldung nennt Würfel, nicht Punkte', () => {
    expect(groupCastingDiceOf(STONES_OVER_LIMIT)).toBeGreaterThan(CASTING_DICE_GROUP_MAX);

    const errors = validateRoster(createWizardRoster(STONES_OVER_LIMIT), createArcaneSystem(castingDiceMaxConstraint()));
    const violation = errors.find(error => error.type === VIOLATION.groupPointsMax);

    expect(violation).toBeDefined();
    expect(violation.message).toContain(`${groupCastingDiceOf(STONES_OVER_LIMIT)} ${CASTING_DICE_LABEL}`);
    expect(violation.message).not.toContain(COST_TYPE_NAME.points);
  });
});

describe('validateRoster — Prozent-Gruppengrenze auf einer anderen Kostenart', () => {
  const POWER_STONE_COUNT = 2;
  const rosterCastingDice = WIZARD_CASTING_DICE + groupCastingDiceOf(POWER_STONE_COUNT);
  const thresholdOf = percent => (percent / 100) * rosterCastingDice;

  test('die Gruppe bleibt unter der 50%-Grenze der roster-weiten Zauberwürfel', () => {
    expect(groupCastingDiceOf(POWER_STONE_COUNT)).toBeLessThanOrEqual(thresholdOf(PERMISSIVE_PERCENT));
    expect(groupPointsOf(POWER_STONE_COUNT)).toBeGreaterThan(thresholdOf(PERMISSIVE_PERCENT));

    const system = createArcaneSystem(castingDicePercentConstraint(PERMISSIVE_PERCENT));
    const errors = validateRoster(createWizardRoster(POWER_STONE_COUNT), system);

    expect(errors.some(error => error.type === VIOLATION.groupPercentMax)).toBe(false);
  });

  test('bei 30% meldet die Prozent-Variante die Würfelsumme, nicht die Punktsumme', () => {
    expect(groupCastingDiceOf(POWER_STONE_COUNT)).toBeGreaterThan(thresholdOf(STRICT_PERCENT));

    const system = createArcaneSystem(castingDicePercentConstraint(STRICT_PERCENT));
    const errors = validateRoster(createWizardRoster(POWER_STONE_COUNT), system);
    const violation = errors.find(error => error.type === VIOLATION.groupPercentMax);

    expect(violation).toBeDefined();
    expect(violation.message).toContain(`der ${CASTING_DICE_LABEL} ausmachen`);
    expect(violation.message).toContain(`ist aber ${groupCastingDiceOf(POWER_STONE_COUNT)}.`);
  });
});
