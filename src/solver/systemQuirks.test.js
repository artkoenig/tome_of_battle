import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import {
  getSystemQuirks,
  getInheritedCategoryMaxSource,
  isQuirkGeneralEntryId
} from './systemQuirks.js';

// Die Quirk-Funktionen kodieren IDs des neuen Lexicanum-Datensatzes fest. Statt
// diese IDs im Test zu wiederholen, werden sie aus echten Katalogauszügen
// gelesen (siehe __fixtures__/whfb6-lexicanum/README.md). Driftet eine
// hartkodierte ID vom realen Katalog ab, schlägt der Test fehl.
const FIXTURE_DIR = './src/solver/__fixtures__/whfb6-lexicanum';
const HEROES_CATEGORY_NAME = 'Heroes';
const CHARACTERS_CATEGORY_NAME = 'Characters';
const GENERAL_ENTRY_NAME = 'General';
const MAX_CONSTRAINT_TYPE = 'max';

const parser = new JSDOM().window.DOMParser;
const parseXml = fileName =>
  new parser().parseFromString(readFileSync(`${FIXTURE_DIR}/${fileName}`, 'utf-8'), 'application/xml');

const gameSystemDoc = parseXml('quirk-anchors.gst.xml');
const forceDoc = parseXml('characters-max-force.cat.xml');

const findCategoryIdByName = name =>
  Array.from(gameSystemDoc.querySelectorAll('categoryEntry')).find(el => el.getAttribute('name') === name)?.getAttribute('id');

const findSelectionEntryIdByName = name =>
  Array.from(gameSystemDoc.querySelectorAll('selectionEntry')).find(el => el.getAttribute('name') === name)?.getAttribute('id');

// Aus echten Katalogdaten der neuen gameSystemId extrahierte Anker.
const newSystem = { id: gameSystemDoc.querySelector('gameSystem').getAttribute('id') };
const realHeroesCategoryId = findCategoryIdByName(HEROES_CATEGORY_NAME);
const realCharactersCategoryId = findCategoryIdByName(CHARACTERS_CATEGORY_NAME);
const realGeneralEntryId = findSelectionEntryIdByName(GENERAL_ENTRY_NAME);

const UNKNOWN_SYSTEM = { id: 'ffff-ffff-ffff-ffff' };
const UNKNOWN_ID = 'aaaa-bbbb-cccc-dddd';

describe('systemQuirks – Fixture-Integrität', () => {
  it('liefert alle Anker-IDs aus den echten Katalogauszügen', () => {
    expect(newSystem.id).toBe('0d13-7737-ea86-4662');
    expect(realHeroesCategoryId).toBeTruthy();
    expect(realCharactersCategoryId).toBeTruthy();
    expect(realGeneralEntryId).toBeTruthy();
  });
});

describe('getSystemQuirks', () => {
  it('liefert für die neue Lexicanum-gameSystemId einen befüllten Eintrag', () => {
    const quirks = getSystemQuirks(newSystem);
    expect(quirks.inheritedCategoryMax).not.toEqual({});
    expect(quirks.generalEntryIds.length).toBeGreaterThan(0);
  });

  it('liefert für die alte Ergofarg-gameSystemId denselben Eintrag (Regression)', () => {
    const oldSystem = { id: '6d8e-38d9-3c69-febf' };
    expect(getSystemQuirks(oldSystem)).toEqual(getSystemQuirks(newSystem));
  });

  it('fällt für unbekannte Systeme auf leere Quirks zurück', () => {
    const quirks = getSystemQuirks(UNKNOWN_SYSTEM);
    expect(quirks.inheritedCategoryMax).toEqual({});
    expect(quirks.generalEntryIds).toEqual([]);
  });

  it('fällt für ein fehlendes System auf leere Quirks zurück', () => {
    expect(getSystemQuirks(undefined).generalEntryIds).toEqual([]);
    expect(getSystemQuirks(null).generalEntryIds).toEqual([]);
  });
});

describe('getInheritedCategoryMaxSource – neuer Datensatz', () => {
  it('lässt Heroes den max-Constraint von Characters erben', () => {
    expect(getInheritedCategoryMaxSource(newSystem, realHeroesCategoryId)).toBe(realCharactersCategoryId);
  });

  it('lässt Characters selbst nichts erben', () => {
    expect(getInheritedCategoryMaxSource(newSystem, realCharactersCategoryId)).toBeNull();
  });

  it('liefert null für eine nicht referenzierte Kategorie', () => {
    expect(getInheritedCategoryMaxSource(newSystem, UNKNOWN_ID)).toBeNull();
  });

  it('liefert null für ein unbekanntes System', () => {
    expect(getInheritedCategoryMaxSource(UNKNOWN_SYSTEM, realHeroesCategoryId)).toBeNull();
  });

  it('spiegelt die strukturelle Voraussetzung im echten Kontingent wider', () => {
    // Voraussetzung des Quirks im neuen Datensatz: Characters-Link trägt einen
    // force-weiten max, Heroes-Link trägt keinen eigenen max.
    const linksFor = categoryId =>
      Array.from(forceDoc.querySelectorAll('forceEntry > categoryLinks > categoryLink'))
        .filter(el => el.getAttribute('targetId') === categoryId);
    const hasOwnMax = link => Array.from(link.querySelectorAll('constraint')).some(c => c.getAttribute('type') === MAX_CONSTRAINT_TYPE);

    const charactersLinks = linksFor(realCharactersCategoryId);
    const heroesLinks = linksFor(realHeroesCategoryId);

    expect(charactersLinks.some(hasOwnMax)).toBe(true);
    expect(heroesLinks.some(hasOwnMax)).toBe(false);
  });
});

describe('isQuirkGeneralEntryId – neuer Datensatz', () => {
  it('erkennt den General-Eintrag der neuen gameSystemId', () => {
    expect(isQuirkGeneralEntryId(newSystem, realGeneralEntryId)).toBe(true);
  });

  it('verneint einen beliebigen anderen Eintrag', () => {
    expect(isQuirkGeneralEntryId(newSystem, UNKNOWN_ID)).toBe(false);
  });

  it('verneint für ein unbekanntes System auch den echten General-Eintrag', () => {
    expect(isQuirkGeneralEntryId(UNKNOWN_SYSTEM, realGeneralEntryId)).toBe(false);
  });
});
