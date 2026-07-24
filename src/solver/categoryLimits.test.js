import { describe, it, expect } from 'vitest';
import {
  getCategoryDisplayLimits,
  getInheritedCategoryMaxConstraint,
  QUIRK_INHERITED_MAX_ID
} from './categoryLimits.js';

// Anker aus dem deklarativen Quirk-Datensatz (systemQuirks.js): im WHFB6-System
// erbt „Heroes" einen fehlenden max von „Characters". Diese IDs sind gegen echte
// Katalogdaten verifiziert (siehe systemQuirks.test.js) und werden hier nur
// verwendet, um die *Anwendung* des Quirks in der Anzeige zu prüfen.
const WHFB6_SYSTEM_ID = '6d8e-38d9-3c69-febf';
const HEROES_CATEGORY_ID = 'c16b-f319-2c62-2c12';
const CHARACTERS_CATEGORY_ID = '7a1c-d611-c2dc-def1';
const NON_QUIRK_SYSTEM_ID = 'ffff-ffff-ffff-ffff';

const CORE_CATEGORY_ID = 'cat-core';
const NO_MODIFIER_CONTEXT = {};

const maxConstraint = (value) => ({ id: 'con-max', type: 'max', value, field: 'selections' });
const minConstraint = (value) => ({ id: 'con-min', type: 'min', value, field: 'selections' });

const categoryLink = (targetId, constraints = []) => ({ id: `cl-${targetId}`, targetId, name: targetId, constraints });

// Ein Kontingent, in dem der Characters-Link ein Maximum trägt und der Heroes-Link keins —
// die strukturelle Voraussetzung des Vererbungs-Quirks.
const forceDefWithCharactersMax = (charactersMax) => ({
  id: 'fe-main',
  categoryLinks: [
    categoryLink(CHARACTERS_CATEGORY_ID, [maxConstraint(charactersMax)]),
    categoryLink(HEROES_CATEGORY_ID, [])
  ]
});

const quirkSystem = { id: WHFB6_SYSTEM_ID };
const nonQuirkSystem = { id: NON_QUIRK_SYSTEM_ID };

describe('getCategoryDisplayLimits – eigene Grenzen', () => {
  it('liest das effektive Maximum aus dem eigenen max-Constraint', () => {
    const link = categoryLink(CORE_CATEGORY_ID, [maxConstraint(3)]);

    const limits = getCategoryDisplayLimits(link, { system: quirkSystem, forceDef: null, displayContext: NO_MODIFIER_CONTEXT });

    expect(limits.maxValue).toBe(3);
    expect(limits.maxConstraint).toBe(link.constraints[0]);
  });

  it('liest das effektive Minimum aus dem eigenen min-Constraint', () => {
    const link = categoryLink(CORE_CATEGORY_ID, [minConstraint(2)]);

    const limits = getCategoryDisplayLimits(link, { system: quirkSystem, forceDef: null, displayContext: NO_MODIFIER_CONTEXT });

    expect(limits.minValue).toBe(2);
    expect(limits.minConstraint).toBe(link.constraints[0]);
  });

  it('behandelt ein fehlendes Minimum als 0 und ein fehlendes Maximum als unbegrenzt', () => {
    const link = categoryLink(CORE_CATEGORY_ID, []);

    const limits = getCategoryDisplayLimits(link, { system: nonQuirkSystem, forceDef: null, displayContext: NO_MODIFIER_CONTEXT });

    expect(limits.minValue).toBe(0);
    expect(limits.maxValue).toBe(Infinity);
    expect(limits.minConstraint).toBeNull();
    expect(limits.maxConstraint).toBeNull();
  });

  it('deutet einen negativen (BattleScribe: -1) max-Wert als unbegrenzt', () => {
    const link = categoryLink(CORE_CATEGORY_ID, [maxConstraint(-1)]);

    const limits = getCategoryDisplayLimits(link, { system: quirkSystem, forceDef: null, displayContext: NO_MODIFIER_CONTEXT });

    expect(limits.maxValue).toBe(Infinity);
  });

  it('normalisiert ein negatives Minimum auf 0', () => {
    const link = categoryLink(CORE_CATEGORY_ID, [minConstraint(-5)]);

    const limits = getCategoryDisplayLimits(link, { system: quirkSystem, forceDef: null, displayContext: NO_MODIFIER_CONTEXT });

    expect(limits.minValue).toBe(0);
  });
});

describe('getCategoryDisplayLimits – system­gebundener Vererbungs-Quirk', () => {
  it('lässt Heroes ohne eigenen max den Characters-max erben – nur im Quirk-System', () => {
    const heroesLink = categoryLink(HEROES_CATEGORY_ID, []);
    const forceDef = forceDefWithCharactersMax(4);

    const limits = getCategoryDisplayLimits(heroesLink, { system: quirkSystem, forceDef, displayContext: NO_MODIFIER_CONTEXT });

    expect(limits.maxValue).toBe(4);
    expect(limits.maxConstraint?.id).toBe(QUIRK_INHERITED_MAX_ID);
  });

  it('erbt nicht in einem System, für das der Quirk nicht deklariert ist', () => {
    const heroesLink = categoryLink(HEROES_CATEGORY_ID, []);
    const forceDef = forceDefWithCharactersMax(4);

    const limits = getCategoryDisplayLimits(heroesLink, { system: nonQuirkSystem, forceDef, displayContext: NO_MODIFIER_CONTEXT });

    expect(limits.maxValue).toBe(Infinity);
    expect(limits.maxConstraint).toBeNull();
  });

  it('erbt nicht, wenn Heroes bereits einen eigenen max trägt', () => {
    const heroesLink = categoryLink(HEROES_CATEGORY_ID, [maxConstraint(1)]);
    const forceDef = forceDefWithCharactersMax(4);

    const limits = getCategoryDisplayLimits(heroesLink, { system: quirkSystem, forceDef, displayContext: NO_MODIFIER_CONTEXT });

    expect(limits.maxValue).toBe(1);
    expect(limits.maxConstraint?.id).toBe('con-max');
  });
});

describe('getInheritedCategoryMaxConstraint', () => {
  it('liefert den geerbten synthetischen max-Constraint samt Quell-Wert', () => {
    const forceDef = forceDefWithCharactersMax(4);

    const inherited = getInheritedCategoryMaxConstraint({
      system: quirkSystem, forceDef, targetCatId: HEROES_CATEGORY_ID, ownConstraints: []
    });

    expect(inherited?.constraint.id).toBe(QUIRK_INHERITED_MAX_ID);
    expect(inherited?.constraint.value).toBe(4);
    expect(inherited?.constraint.type).toBe('max');
  });

  it('liefert null, wenn die Kategorie bereits einen eigenen max trägt', () => {
    const forceDef = forceDefWithCharactersMax(4);

    const inherited = getInheritedCategoryMaxConstraint({
      system: quirkSystem, forceDef, targetCatId: HEROES_CATEGORY_ID, ownConstraints: [maxConstraint(1)]
    });

    expect(inherited).toBeNull();
  });

  it('liefert null für ein System ohne diesen Quirk', () => {
    const forceDef = forceDefWithCharactersMax(4);

    const inherited = getInheritedCategoryMaxConstraint({
      system: nonQuirkSystem, forceDef, targetCatId: HEROES_CATEGORY_ID, ownConstraints: []
    });

    expect(inherited).toBeNull();
  });

  it('liefert null, wenn die Quell-Kategorie im Kontingent keinen max trägt', () => {
    const forceDef = {
      id: 'fe-main',
      categoryLinks: [
        categoryLink(CHARACTERS_CATEGORY_ID, []),
        categoryLink(HEROES_CATEGORY_ID, [])
      ]
    };

    const inherited = getInheritedCategoryMaxConstraint({
      system: quirkSystem, forceDef, targetCatId: HEROES_CATEGORY_ID, ownConstraints: []
    });

    expect(inherited).toBeNull();
  });
});
