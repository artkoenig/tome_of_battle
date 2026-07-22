import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { validateRoster } from './validator.js';
import { parseGameSystemXML, parseCatalogueXML } from '../parser/xmlParser.js';

// JSDOM stellt DOMParser für den Node-Testlauf bereit (wie in den übrigen Solver-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// Echte, verbatim übernommene Auszüge des neuen Lexicanum-Datensatzes (ADR-0017).
// Die Characters-categoryEntry trägt einen force-weiten max-Constraint (base 3,
// punkteskaliert über Modifier), die Heroes-categoryEntry trägt max="-1" (unbegrenzt).
const FIXTURE_DIR = './src/solver/__fixtures__/whfb6-lexicanum';
const readFixture = fileName => readFileSync(`${FIXTURE_DIR}/${fileName}`, 'utf-8');

const parsedGameSystem = parseGameSystemXML(readFixture('quirk-anchors.gst.xml'));
const parsedRedHostCatalogue = parseCatalogueXML(readFixture('characters-max-force.cat.xml'));

const CATEGORY_NAME_CHARACTERS = 'Characters';
const CATEGORY_NAME_HEROES = 'Heroes';
const CATEGORY_MAX_ERROR = 'category-max';
const POINTS_COST_TYPE_ID = 'pts';

// IDs datengetrieben aus den echten Auszügen lesen, statt sie zu wiederholen (ADR-0003).
const categoryIdByName = name =>
  parsedGameSystem.categoryEntries.find(categoryEntry => categoryEntry.name === name)?.id;
const CHARACTERS_CATEGORY_ID = categoryIdByName(CATEGORY_NAME_CHARACTERS);
const HEROES_CATEGORY_ID = categoryIdByName(CATEGORY_NAME_HEROES);
const RED_HOST_FORCE_ID = parsedRedHostCatalogue.forceEntries[0].id;

const TEST_CATALOGUE_ID = 'cat-lexicanum-test';
const CHARACTER_UNIT_ID = 'unit-character';
const HERO_ONLY_UNIT_ID = 'unit-hero-only';

// Zwei synthetische Kontingente, die auf die echten categoryEntries verweisen, ohne
// selbst force-weite Constraints an ihren categoryLinks zu tragen — genau die
// Konstellation, in der die Grenze im neuen Datensatz nur an der categoryEntry hängt.
const PLAIN_FORCE_ID = 'force-plain';
const HEROES_ONLY_FORCE_ID = 'force-heroes-only';

const plainForce = {
  id: PLAIN_FORCE_ID,
  name: 'Standard Host',
  categoryLinks: [
    { id: 'cl-characters', name: CATEGORY_NAME_CHARACTERS, targetId: CHARACTERS_CATEGORY_ID },
    { id: 'cl-heroes', name: CATEGORY_NAME_HEROES, targetId: HEROES_CATEGORY_ID }
  ]
};

const heroesOnlyForce = {
  id: HEROES_ONLY_FORCE_ID,
  name: 'Heroes Only Host',
  categoryLinks: [
    { id: 'cl-heroes-only', name: CATEGORY_NAME_HEROES, targetId: HEROES_CATEGORY_ID }
  ]
};

const characterUnit = {
  id: CHARACTER_UNIT_ID,
  name: 'Saurus Character',
  categoryLinks: [{ targetId: CHARACTERS_CATEGORY_ID }]
};

const heroOnlyUnit = {
  id: HERO_ONLY_UNIT_ID,
  name: 'Skink Hero',
  categoryLinks: [{ targetId: HEROES_CATEGORY_ID }]
};

const buildSystem = (categoryEntries = parsedGameSystem.categoryEntries) => ({
  id: parsedGameSystem.id,
  costTypes: [{ id: POINTS_COST_TYPE_ID, name: 'Points' }],
  categoryEntries,
  forceEntries: [plainForce, heroesOnlyForce, ...parsedRedHostCatalogue.forceEntries],
  catalogues: [
    {
      id: TEST_CATALOGUE_ID,
      name: 'Test Catalogue',
      selectionEntries: [characterUnit, heroOnlyUnit]
    }
  ]
});

const buildRoster = ({ forceEntryId, costLimit, selections }) => ({
  name: 'Test Roster',
  costLimit,
  costLimitType: POINTS_COST_TYPE_ID,
  catalogueId: TEST_CATALOGUE_ID,
  forces: [{ id: 'f1', forceEntryId, catalogueId: TEST_CATALOGUE_ID, selections }]
});

const unitSelections = (unitId, count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${unitId}-${index}`,
    selectionEntryId: unitId,
    name: unitId,
    number: 1
  }));

const charactersMaxErrors = errors =>
  errors.filter(error => error.type === CATEGORY_MAX_ERROR && error.categoryId === CHARACTERS_CATEGORY_ID);
const heroesMaxErrors = errors =>
  errors.filter(error => error.type === CATEGORY_MAX_ERROR && error.categoryId === HEROES_CATEGORY_ID);

describe('Fixture-Integrität', () => {
  it('liefert die realen categoryEntry- und Force-IDs aus den echten Auszügen', () => {
    expect(parsedGameSystem.id).toBe('0d13-7737-ea86-4662');
    expect(CHARACTERS_CATEGORY_ID).toBeTruthy();
    expect(HEROES_CATEGORY_ID).toBeTruthy();
    expect(RED_HOST_FORCE_ID).toBeTruthy();

    const charactersEntry = parsedGameSystem.categoryEntries.find(c => c.id === CHARACTERS_CATEGORY_ID);
    const heroesEntry = parsedGameSystem.categoryEntries.find(c => c.id === HEROES_CATEGORY_ID);
    // Voraussetzung des Tests: der max-Constraint hängt am categoryEntry mit force-Scope.
    expect(charactersEntry.constraints.some(con => con.type === 'max' && con.scope === 'force')).toBe(true);
    expect(heroesEntry.constraints.some(con => con.type === 'max' && con.scope === 'force' && con.value === -1)).toBe(true);
  });
});

describe('Force-Kategorielimit aus categoryEntry (scope="force") – neuer Datensatz', () => {
  it('erkennt die Überschreitung des nur an der categoryEntry deklarierten Limits (Reproduktion)', () => {
    // 4 Charactere bei 1000 Pkt. überschreiten das reale categoryEntry-Limit (base 3).
    const roster = buildRoster({
      forceEntryId: PLAIN_FORCE_ID,
      costLimit: 1000,
      selections: unitSelections(CHARACTER_UNIT_ID, 4)
    });

    const errors = validateRoster(roster, buildSystem());

    expect(charactersMaxErrors(errors)).toHaveLength(1);
  });

  it('belegt die Lücke: ohne die categoryEntry-Constraint bleibt dieselbe Überzahl unerkannt', () => {
    // System-Variante, deren Characters-categoryEntry keinen force-Constraint mehr trägt —
    // exakt das, was die frühere, rein categoryLink-basierte Auswertung "sah".
    const categoryEntriesWithoutCharacterLimit = parsedGameSystem.categoryEntries.map(categoryEntry =>
      categoryEntry.id === CHARACTERS_CATEGORY_ID
        ? { ...categoryEntry, constraints: [], modifiers: [] }
        : categoryEntry
    );
    const roster = buildRoster({
      forceEntryId: PLAIN_FORCE_ID,
      costLimit: 1000,
      selections: unitSelections(CHARACTER_UNIT_ID, 4)
    });

    const errors = validateRoster(roster, buildSystem(categoryEntriesWithoutCharacterLimit));

    expect(charactersMaxErrors(errors)).toHaveLength(0);
  });

  it('meldet keinen Fehler, solange das categoryEntry-Limit eingehalten wird', () => {
    const roster = buildRoster({
      forceEntryId: PLAIN_FORCE_ID,
      costLimit: 1000,
      selections: unitSelections(CHARACTER_UNIT_ID, 3)
    });

    const errors = validateRoster(roster, buildSystem());

    expect(charactersMaxErrors(errors)).toHaveLength(0);
  });

  it('berücksichtigt die punkteskalierenden Modifier auf der categoryEntry (Limit steigt auf 4 bei 2000 Pkt.)', () => {
    const withinLiftedLimit = buildRoster({
      forceEntryId: PLAIN_FORCE_ID,
      costLimit: 2000,
      selections: unitSelections(CHARACTER_UNIT_ID, 4)
    });
    const aboveLiftedLimit = buildRoster({
      forceEntryId: PLAIN_FORCE_ID,
      costLimit: 2000,
      selections: unitSelections(CHARACTER_UNIT_ID, 5)
    });

    expect(charactersMaxErrors(validateRoster(withinLiftedLimit, buildSystem()))).toHaveLength(0);
    expect(charactersMaxErrors(validateRoster(aboveLiftedLimit, buildSystem()))).toHaveLength(1);
  });
});

describe('max="-1" auf einer categoryEntry (unbegrenzt) – AC3', () => {
  it('erzeugt keinen Fehler, egal wie viele Auswahlen die Kategorie enthält', () => {
    const roster = buildRoster({
      forceEntryId: HEROES_ONLY_FORCE_ID,
      costLimit: 1000,
      selections: unitSelections(HERO_ONLY_UNIT_ID, 8)
    });

    const errors = validateRoster(roster, buildSystem());

    expect(heroesMaxErrors(errors)).toHaveLength(0);
  });
});

describe('categoryLink-Constraint bleibt wirksam – echter Red-Host-Force (AC5)', () => {
  it('erkennt die Überschreitung des force-weiten max-Constraints am Characters-categoryLink', () => {
    // Der reale Red-Host-Force trägt am Characters-categoryLink einen eigenen max=2
    // (bei 1000 Pkt. nicht angehoben). 3 Charactere überschreiten ihn.
    const roster = buildRoster({
      forceEntryId: RED_HOST_FORCE_ID,
      costLimit: 1000,
      selections: unitSelections(CHARACTER_UNIT_ID, 3)
    });

    const errors = validateRoster(roster, buildSystem());
    const characterErrors = charactersMaxErrors(errors);

    expect(characterErrors.length).toBeGreaterThanOrEqual(1);
    // Der strengere categoryLink-Wert (2) greift, nicht erst der categoryEntry-Wert (3).
    // Strukturierte Meldung (ADR 0026): die Grenze steckt im `count`-Parameter.
    expect(characterErrors.some(error => error.messageParams?.count === 2)).toBe(true);
  });
});
