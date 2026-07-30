import { describe, test, expect } from 'vitest';
import { isOptionRosterUnique } from './optionsCollector.js';
import { ConstraintKind, ModifierKind } from '../parser/schema/battlescribeSchema.generated.js';

// isOptionRosterUnique liest die Roster-/Force-Max-Obergrenze als EFFEKTIVEN Wert:
// ein (unbedingter) Modifier auf diese Constraint verändert das Ergebnis, statt dass
// stur der rohe Katalogwert `=== 1` entscheidet (ADR-0003, schema-förmige Fixtures).
const ENTRY_MAX_ID = 'con-entry-roster-max';
const CATEGORY_MAX_ID = 'con-category-roster-max';

const rosterMax = (id, value) => ({ id, type: ConstraintKind.MAX, scope: 'roster', value });
const setMax = (id, valueObject) => ({ type: ModifierKind.SET, field: id, valueObject });

const system = () => ({ categoryEntries: [] });

describe('isOptionRosterUnique — effektive Roster-/Force-Obergrenze', () => {
  test('roher Max=1 auf dem Eintrag ⇒ einzigartig', () => {
    const res = { id: 'e1', constraints: [rosterMax(ENTRY_MAX_ID, 1)] };
    expect(isOptionRosterUnique(res, system())).toBe(true);
  });

  test('ein Modifier, der die Roster-Max von 1 auf 2 hebt, hebt die Einzigartigkeit auf', () => {
    const res = {
      id: 'e1',
      constraints: [rosterMax(ENTRY_MAX_ID, 1)],
      modifiers: [setMax(ENTRY_MAX_ID, 2)]
    };
    expect(isOptionRosterUnique(res, system())).toBe(false);
  });

  test('ein Modifier, der die Max effektiv auf 1 setzt, begründet Einzigartigkeit', () => {
    const res = {
      id: 'e1',
      constraints: [rosterMax(ENTRY_MAX_ID, 3)],
      modifiers: [setMax(ENTRY_MAX_ID, 1)]
    };
    expect(isOptionRosterUnique(res, system())).toBe(true);
  });

  test('Einzigartigkeit über eine effektive Kategorie-Obergrenze von 1', () => {
    const categoryId = 'cat-magic-standard';
    const res = { id: 'e1', constraints: [], categoryLinks: [{ targetId: categoryId }] };
    const sys = {
      categoryEntries: [{ id: categoryId, constraints: [rosterMax(CATEGORY_MAX_ID, 1)] }]
    };
    expect(isOptionRosterUnique(res, sys)).toBe(true);
  });

  test('keine passende Obergrenze ⇒ nicht einzigartig', () => {
    const res = { id: 'e1', constraints: [rosterMax(ENTRY_MAX_ID, 5)], categoryLinks: [] };
    expect(isOptionRosterUnique(res, system())).toBe(false);
  });
});
