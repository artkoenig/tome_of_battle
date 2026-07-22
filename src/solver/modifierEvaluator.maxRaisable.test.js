import { describe, test, expect } from 'vitest';
import { canGroupMaxBeRaisedAboveSingleChoice } from './validator.js';
import { ConstraintKind, ModifierKind } from '../parser/schema/battlescribeSchema.generated.js';

// ── Schema-förmige Fixtures (nicht katalog-/einheitsspezifisch, ADR-0003) ──
// Nachgebildete Empire-Captain-Rüstungsgruppe: Gruppe `max=1` plus ein bedingter
// `increment`-Modifier auf genau diese Max-Constraint, gekoppelt an die Auswahl
// eines Geschwister-Schilds (real: modifier field=<max-id>, condition childId=Shield).
const GROUP_MAX_CONSTRAINT_ID = '3abf-ef75-7480-0e27';
const OTHER_CONSTRAINT_ID = 'points-cap-id';
const SHIELD_ID = 'shield-entry-id';
const REPEATABLE_ITEM_ID = 'dispel-scroll-id';

const groupMax = (value = 1, id = GROUP_MAX_CONSTRAINT_ID) => ({
  id, type: ConstraintKind.MAX, field: 'selections', scope: 'parent', value
});

const groupMin = (value = 1) => ({
  id: 'group-min-id', type: ConstraintKind.MIN, field: 'selections', scope: 'parent', value
});

const shieldPresentCondition = () => ({
  type: 'greaterThan', field: 'selections', scope: 'parent', childId: SHIELD_ID, value: 0
});

const modifierOnMax = ({ type, valueObject, id = GROUP_MAX_CONSTRAINT_ID, conditions = [], repeat = null }) => ({
  type, field: id, valueObject, conditions, repeat
});

const groupWith = (constraints, modifiers = [], modifierGroups = []) => ({
  id: 'armour-group', name: 'Armour', constraints, modifiers, modifierGroups
});

describe('canGroupMaxBeRaisedAboveSingleChoice — Max-hebbar-Erkennung', () => {
  test('true: Rüstung+Schild-Muster — bedingter increment auf die Gruppen-Max, an ein Schild gekoppelt', () => {
    const group = groupWith(
      [groupMax(1)],
      [modifierOnMax({ type: ModifierKind.INCREMENT, valueObject: 1, conditions: [shieldPresentCondition()] })]
    );
    expect(canGroupMaxBeRaisedAboveSingleChoice(group)).toBe(true);
  });

  test('true: die Bedingung wird bewusst ignoriert — hebbar auch wenn das Schild (noch) nicht gewählt ist', () => {
    // Genau der Teufelskreis-Fall: kein Kontext, in dem die Bedingung erfüllt wäre,
    // wird übergeben — die statische Erkennung greift trotzdem.
    const group = groupWith(
      [groupMax(1)],
      [modifierOnMax({ type: ModifierKind.INCREMENT, valueObject: 1, conditions: [shieldPresentCondition()] })]
    );
    expect(canGroupMaxBeRaisedAboveSingleChoice(group)).toBe(true);
  });

  test('true: `set`-Modifier mit Zielwert > 1', () => {
    const group = groupWith([groupMax(1)], [modifierOnMax({ type: ModifierKind.SET, valueObject: 2 })]);
    expect(canGroupMaxBeRaisedAboveSingleChoice(group)).toBe(true);
  });

  test('true: hebender Modifier steckt in einer modifierGroup (getEffectiveModifiers-Pfad)', () => {
    const group = groupWith(
      [groupMax(1)],
      [],
      [{ conditions: [shieldPresentCondition()], modifiers: [modifierOnMax({ type: ModifierKind.INCREMENT, valueObject: 1 })] }]
    );
    expect(canGroupMaxBeRaisedAboveSingleChoice(group)).toBe(true);
  });

  test('false: echte fixe `max=1`-Gruppe ohne hebenden Modifier', () => {
    const group = groupWith([groupMin(1), groupMax(1)], []);
    expect(canGroupMaxBeRaisedAboveSingleChoice(group)).toBe(false);
  });

  test('false: increment+<repeat>-Muster (Dispel Scroll, §9.7) wird sauber abgegrenzt', () => {
    // Mehrere gleiche Items: increment auf die Max-Constraint MIT <repeat> auf genau
    // diesen Eintrag — das bereits behandelte „repeatable item"-Signal, kein
    // „inhärent mehrfach"-Signal.
    const group = groupWith(
      [groupMax(1)],
      [modifierOnMax({
        type: ModifierKind.INCREMENT,
        valueObject: 1,
        repeat: { field: 'selections', scope: 'parent', childId: REPEATABLE_ITEM_ID, repeats: 1 },
        conditions: [{ type: 'greaterThan', field: 'selections', scope: 'parent', childId: REPEATABLE_ITEM_ID, value: 0 }]
      })]
    );
    expect(canGroupMaxBeRaisedAboveSingleChoice(group)).toBe(false);
  });

  test('false: `set`-Modifier auf genau 1 hebt nicht über die Einzelwahl', () => {
    const group = groupWith([groupMax(1)], [modifierOnMax({ type: ModifierKind.SET, valueObject: 1 })]);
    expect(canGroupMaxBeRaisedAboveSingleChoice(group)).toBe(false);
  });

  test('false: `decrement` senkt und hebt nicht', () => {
    const group = groupWith([groupMax(1)], [modifierOnMax({ type: ModifierKind.DECREMENT, valueObject: 1 })]);
    expect(canGroupMaxBeRaisedAboveSingleChoice(group)).toBe(false);
  });

  test('false: Modifier zielt auf eine andere Constraint-Id (nicht die Max-Constraint)', () => {
    const group = groupWith(
      [groupMax(1), { id: OTHER_CONSTRAINT_ID, type: ConstraintKind.MAX, field: 'limit::pts', scope: 'parent', value: 100 }],
      [modifierOnMax({ type: ModifierKind.INCREMENT, valueObject: 1, id: 'unrelated-id' })]
    );
    expect(canGroupMaxBeRaisedAboveSingleChoice(group)).toBe(false);
  });

  test('false: Gruppe ohne Max-Constraint', () => {
    const group = groupWith([groupMin(1)], [modifierOnMax({ type: ModifierKind.INCREMENT, valueObject: 1 })]);
    expect(canGroupMaxBeRaisedAboveSingleChoice(group)).toBe(false);
  });

  test('false: leere/fehlende Gruppe', () => {
    expect(canGroupMaxBeRaisedAboveSingleChoice(undefined)).toBe(false);
    expect(canGroupMaxBeRaisedAboveSingleChoice({})).toBe(false);
  });
});
