import { describe, test, expect } from 'vitest';
import { getModifiedConstraintValue, getEffectiveName } from './validator.js';

// BattleScribe wendet Modifier in Dokumentreihenfolge an — in der Reihenfolge, in
// der sie im Katalog stehen. Kein Modifier-Typ wird vorgezogen: schreibt ein Katalog
// "erhöhen um 2", dann "setze auf 5", ist 5 gemeint; in umgekehrter Reihenfolge 7.
describe('Modifier wirken in Dokumentreihenfolge', () => {
  const CONSTRAINT_ID = 'con-max';
  const BASE_VALUE = 1;
  const INCREMENT_AMOUNT = 2;
  const SET_AMOUNT = 5;

  const constraint = () => ({ id: CONSTRAINT_ID, value: BASE_VALUE });
  const incrementModifier = { field: CONSTRAINT_ID, type: 'increment', valueObject: INCREMENT_AMOUNT };
  const setModifier = { field: CONSTRAINT_ID, type: 'set', valueObject: SET_AMOUNT };

  test('"erhöhen, dann setzen" liefert den gesetzten Wert', () => {
    const value = getModifiedConstraintValue(constraint(), [incrementModifier, setModifier]);

    expect(value).toBe(SET_AMOUNT);
  });

  test('"setzen, dann erhöhen" erhöht den gesetzten Wert', () => {
    const value = getModifiedConstraintValue(constraint(), [setModifier, incrementModifier]);

    expect(value).toBe(SET_AMOUNT + INCREMENT_AMOUNT);
  });

  test('multiplizieren nach setzen skaliert den gesetzten Wert', () => {
    const MULTIPLY_FACTOR = 3;
    const multiplyModifier = { field: CONSTRAINT_ID, type: 'multiply', valueObject: MULTIPLY_FACTOR };

    const value = getModifiedConstraintValue(constraint(), [setModifier, multiplyModifier]);

    expect(value).toBe(SET_AMOUNT * MULTIPLY_FACTOR);
  });

  test('nur Modifier mit erfüllten Bedingungen wirken, die Reihenfolge bleibt erhalten', () => {
    const UNSELECTED_ENTRY_ID = 'entry-not-taken';
    const blockedSetModifier = {
      ...setModifier,
      conditions: [{ type: 'atLeast', value: 1, field: 'selections', childId: UNSELECTED_ENTRY_ID }]
    };

    const value = getModifiedConstraintValue(constraint(), [incrementModifier, blockedSetModifier], {
      selectionCounts: {}
    });

    expect(value).toBe(BASE_VALUE + INCREMENT_AMOUNT);
  });

  // Beschränkungswerte und Namen folgen derselben Reihenfolgeregel: beide wenden die
  // Modifier in Katalogreihenfolge an, ohne einen Typ vorzuziehen.
  test('die Namensauswertung folgt derselben Regel', () => {
    const BASE_NAME = 'Speerträger';
    const SET_NAME = 'Garde';
    const APPEND_SUFFIX = 'des Königs';
    const source = {
      name: BASE_NAME,
      modifiers: [
        { field: 'name', type: 'append', value: APPEND_SUFFIX, join: ' ' },
        { field: 'name', type: 'set', value: SET_NAME }
      ]
    };

    expect(getEffectiveName(source)).toBe(SET_NAME);
  });
});
