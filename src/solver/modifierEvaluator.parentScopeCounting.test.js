import { describe, test, expect } from 'vitest';
import { evaluateCondition, getModifiedConstraintValue } from './validator.js';

// BattleScribe kennt zwei parent-gescopte Zählungen: die einer Condition und die
// eines Modifier-`repeat`. Beide teilen sich eine Umsetzung
// (`createTargetSelectionMatcher`); sie unterscheiden sich ausschließlich in zwei
// bewusst gesetzten Optionen. Diese Tests halten genau diese Divergenz fest —
// vorher lagen zwei auseinandergedriftete Kopien vor, von denen nur eine die
// Kategorie-Zugehörigkeit prüfte.
describe('Parent-gescopte Zählung — Condition und repeat im Vergleich', () => {
  const CATALOGUE_ID = 'cat-parent-scope';
  const ELITE_CATEGORY_ID = 'category-elite';
  const GUARD_ENTRY_ID = 'entry-guard';
  const SELECTIONS_FIELD = 'selections';
  const CONSTRAINT_ID = 'con-max';
  const BASE_VALUE = 0;
  const INCREMENT = 1;

  // Ein Trupp-Eintrag vom Typ `unit`, der über einen categoryLink zur
  // Elite-Kategorie gehört — beide Unterscheidungsmerkmale in einem Eintrag.
  const system = {
    id: 'sys-parent-scope',
    catalogues: [{
      id: CATALOGUE_ID,
      sharedSelectionEntries: [{
        id: GUARD_ENTRY_ID,
        name: 'Guard',
        type: 'unit',
        categoryLinks: [{ id: 'cl-elite', targetId: ELITE_CATEGORY_ID }]
      }]
    }]
  };

  const parentWithOneGuard = {
    id: 'sel-squad',
    selections: [{ id: 'sel-guard', selectionEntryId: GUARD_ENTRY_ID, number: 1 }]
  };

  const ctx = {
    system,
    parentCatalogueId: CATALOGUE_ID,
    roster: { catalogueId: CATALOGUE_ID, forces: [] },
    selection: parentWithOneGuard
  };

  /** True, wenn die Condition mindestens eine Auswahl im Parent-Scope zählt. */
  const conditionCountsTarget = (childId) => evaluateCondition({
    type: 'atLeast', field: SELECTIONS_FIELD, scope: 'parent', childId, value: 1
  }, ctx);

  /** True, wenn das repeat mindestens einmal ausgelöst hat. */
  const repeatCountsTarget = (childId) => {
    const value = getModifiedConstraintValue(
      { id: CONSTRAINT_ID, value: BASE_VALUE },
      [{
        field: CONSTRAINT_ID, type: 'increment', valueObject: INCREMENT,
        repeat: { scope: 'parent', childId, value: 1, repeats: 1 }
      }],
      ctx
    );
    return value > BASE_VALUE;
  };

  describe('Kategorie-Zugehörigkeit (matchCategoryMembership)', () => {
    test('die Condition zählt eine Auswahl, die nur über ihre Kategorie passt', () => {
      expect(conditionCountsTarget(ELITE_CATEGORY_ID)).toBe(true);
    });

    test('das repeat zählt sie bewusst NICHT — es verlangt die Eintrags-ID', () => {
      expect(repeatCountsTarget(ELITE_CATEGORY_ID)).toBe(false);
    });
  });

  describe('„model" deckt auch unit-Einträge ab (matchUnitsAsModels)', () => {
    test('die Condition zählt einen unit-Eintrag unter dem Schlüsselwort „model"', () => {
      expect(conditionCountsTarget('model')).toBe(true);
    });

    test('das repeat zählt ihn bewusst NICHT — „model" meint dort nur model', () => {
      expect(repeatCountsTarget('model')).toBe(false);
    });
  });

  test('beide zählen dieselbe Auswahl über ihre Eintrags-ID', () => {
    expect(conditionCountsTarget(GUARD_ENTRY_ID)).toBe(true);
    expect(repeatCountsTarget(GUARD_ENTRY_ID)).toBe(true);
  });
});
