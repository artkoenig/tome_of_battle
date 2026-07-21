import { describe, test, expect } from 'vitest';
import { evaluateCondition } from './validator.js';

// Ein Auswertungskontext benennt den Katalog, gegen den seine Eintragsverweise
// aufgelöst werden, je nach Rolle unterschiedlich: `parentCatalogueId` in
// Bedingungskontexten, `currentCatalogueId` in Kostenkontexten; das Roster trägt
// seinen eigenen Katalog als äußersten Rückfall. `resolveContextCatalogueId` ist
// die einzige Stelle, die diese Rangfolge herleitet.
//
// Diese Tests halten die Rangfolge an einer echten Aufrufstelle fest, nicht nur
// am Helfer selbst: zuvor hatten mehrere Stellen sie inline nachgebaut und dabei
// `currentCatalogueId` ausgelassen, sodass ein Kostenkontext gegen den
// Roster-Katalog auflöste statt gegen den aktuellen.
describe('Katalog-Rangfolge eines Auswertungskontexts', () => {
  const CATALOGUE_WITH_ELITE = 'cat-elite';
  const CATALOGUE_WITHOUT_ELITE = 'cat-plain';
  const ELITE_CATEGORY_ID = 'category-elite';
  const GUARD_ENTRY_ID = 'entry-guard';

  // Beide Kataloge kennen denselben Eintrag unter derselben Id — nur einer
  // ordnet ihn der Elite-Kategorie zu. Welcher Katalog gilt, wird damit am
  // Ergebnis sichtbar.
  const system = {
    id: 'sys-catalogue-context',
    catalogues: [
      {
        id: CATALOGUE_WITH_ELITE,
        sharedSelectionEntries: [{
          id: GUARD_ENTRY_ID,
          name: 'Guard',
          type: 'unit',
          categoryLinks: [{ id: 'cl-elite', targetId: ELITE_CATEGORY_ID }]
        }]
      },
      {
        id: CATALOGUE_WITHOUT_ELITE,
        sharedSelectionEntries: [{
          id: GUARD_ENTRY_ID,
          name: 'Guard',
          type: 'unit',
          categoryLinks: []
        }]
      }
    ]
  };

  const parentWithOneGuard = {
    id: 'sel-squad',
    selections: [{ id: 'sel-guard', selectionEntryId: GUARD_ENTRY_ID, number: 1 }]
  };

  /** True, wenn im Parent-Scope mindestens ein Elite-Mitglied gezählt wird. */
  const countsAnEliteMember = (ctx) => evaluateCondition({
    type: 'atLeast',
    field: 'selections',
    scope: 'parent',
    childId: ELITE_CATEGORY_ID,
    value: 1
  }, { ...ctx, system, selection: parentWithOneGuard });

  test('ein Kostenkontext löst gegen currentCatalogueId auf, nicht gegen den Roster-Katalog', () => {
    expect(countsAnEliteMember({
      currentCatalogueId: CATALOGUE_WITH_ELITE,
      roster: { catalogueId: CATALOGUE_WITHOUT_ELITE, forces: [] }
    })).toBe(true);
  });

  test('parentCatalogueId hat Vorrang vor currentCatalogueId', () => {
    expect(countsAnEliteMember({
      parentCatalogueId: CATALOGUE_WITH_ELITE,
      currentCatalogueId: CATALOGUE_WITHOUT_ELITE,
      roster: { catalogueId: CATALOGUE_WITHOUT_ELITE, forces: [] }
    })).toBe(true);
  });

  test('nennt der Kontext keinen Katalog, gilt der des Rosters', () => {
    expect(countsAnEliteMember({
      roster: { catalogueId: CATALOGUE_WITH_ELITE, forces: [] }
    })).toBe(true);
  });
});
