import { describe, it, expect } from 'vitest';

import {
  forceCategoriesOf,
  offerDefIdsOf,
  offerIdentifiesSlot,
  childOffersOf,
  childOfferCountOf,
} from '../../../../contexts/armylist/acl';

/**
 * Issue 0191 — die Übersetzungsschicht des Listen-Kontexts. Sie ist die einzige
 * Stelle, die Katalog-Vokabular liest; hier steht, was sie daraus macht.
 */

const SYSTEM = {
  forceEntries: [{
    id: 'fe-army',
    name: 'Armee',
    categoryLinks: [
      { id: 'cl-core', targetId: 'cat-core', name: 'Kern (umbenannt)' },
      { id: 'cl-heroes', targetId: 'cat-heroes', name: 'Helden' },
    ],
  }],
  categoryEntries: [{ id: 'cat-core', name: 'Kerneinheiten' }],
};

describe('forceCategoriesOf', () => {
  it('macht aus einem Kategorie-Verweis eine Kategorie mit Ziel-Id', () => {
    const categories = forceCategoriesOf(SYSTEM, 'fe-army');
    expect(categories.map(category => category.id)).toEqual(['cat-core', 'cat-heroes']);
  });

  it('nimmt den Namen aus der Definition, ersatzweise vom Verweis', () => {
    const [core, heroes] = forceCategoriesOf(SYSTEM, 'fe-army');
    expect(core.name).toBe('Kerneinheiten');
    expect(heroes.name).toBe('Helden');
  });

  it('führt beide Anker-Ids mit, Kategorie zuerst', () => {
    const [core] = forceCategoriesOf(SYSTEM, 'fe-army');
    expect(core.anchorIds).toEqual(['cat-core', 'cl-core']);
  });

  it('ist leer, wenn das System das Kontingent nicht kennt', () => {
    expect(forceCategoriesOf(SYSTEM, 'fe-fremd')).toEqual([]);
    expect(forceCategoriesOf(null, 'fe-army')).toEqual([]);
  });
});

describe('offerDefIdsOf / offerIdentifiesSlot', () => {
  it('kennt ein Angebot unter eigener Id und Ziel-Id', () => {
    expect(offerDefIdsOf({ id: 'el-1', targetId: 'se-1' })).toEqual(['el-1', 'se-1']);
    expect(offerDefIdsOf({ id: 'se-1' })).toEqual(['se-1']);
    expect(offerDefIdsOf(null)).toEqual([]);
  });

  it('trifft einen Slot über defId, targetDefId oder das Ziel des Verweises', () => {
    expect(offerIdentifiesSlot({ id: 'se-1' }, { defId: 'se-1' })).toBe(true);
    expect(offerIdentifiesSlot({ id: 'se-1' }, { defId: 'el-1', targetDefId: 'se-1' })).toBe(true);
    expect(offerIdentifiesSlot({ id: 'el-1', targetId: 'se-1' },
      { defId: 'el-9', targetDefId: 'se-1' })).toBe(true);
    expect(offerIdentifiesSlot({ id: 'se-2' }, { defId: 'se-1' })).toBe(false);
    expect(offerIdentifiesSlot(null, { defId: 'se-1' })).toBe(false);
  });
});

describe('childOffersOf / childOfferCountOf', () => {
  it('zählt Unter-Einträge, Verweise und Gruppen gleich', () => {
    const entry = {
      selectionEntries: [{ id: 'a' }],
      entryLinks: [{ id: 'b' }, { id: 'c' }],
      selectionEntryGroups: [{ id: 'g' }],
    };
    expect(childOfferCountOf(entry)).toBe(4);
    expect(childOfferCountOf({})).toBe(0);
    expect(childOfferCountOf(null)).toBe(0);
  });

  it('gibt die Unter-Angebote als Liste heraus', () => {
    expect(childOffersOf({ selectionEntries: [{ id: 'a' }] })).toEqual([{ id: 'a' }]);
    expect(childOffersOf(null)).toEqual([]);
  });
});
