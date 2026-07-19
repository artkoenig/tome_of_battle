import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { validateRoster, hasBlockingViolations } from './validator.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';

// JSDOM stellt DOMParser für den Node-Testlauf bereit (wie in den übrigen Solver-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// Echter, verbatim übernommener Auszug des Lexicanum-Datensatzes (Bretonnia,
// „Allow special characters?"-Muster). Belegt den field="error"-Hinweistext-Modifier.
const FIXTURE_DIR = './src/solver/__fixtures__/whfb6-lexicanum';
const readFixture = fileName => readFileSync(`${FIXTURE_DIR}/${fileName}`, 'utf-8');
const parsedHintCatalogue = parseCatalogueXML(readFixture('special-characters-hint.cat.xml'));

const POINTS_COST_TYPE_ID = 'pts';
const TEST_CATALOGUE_ID = parsedHintCatalogue.id;

// IDs datengetrieben aus dem echten Auszug lesen, statt sie zu wiederholen (ADR-0003).
const entryIdByName = name =>
  parsedHintCatalogue.sharedSelectionEntries.find(entry => entry.name === name)?.id;
const GREEN_KNIGHT_ID = entryIdByName('The Green Knight');
const ALLOW_SPECIALS_TOGGLE_ID = entryIdByName('Allow special characters?');

const EXPECTED_HINT_MESSAGE = 'Please enable "Allow special characters?"';
const MODIFIER_ERROR_TYPE = 'modifier-error';
const MODIFIER_WARNING_TYPE = 'modifier-warning';
const MODIFIER_INFO_TYPE = 'modifier-info';

const FORCE_ENTRY_ID = 'force-bretonnia';

// Minimales Kontingent ohne eigene Kategorielimits — die Message-Modifier-Auswertung
// hängt nur an der Selection, nicht an den Force-categoryLinks.
const forceEntry = {
  id: FORCE_ENTRY_ID,
  name: 'Bretonnian Army',
  categoryLinks: []
};

// Erlaubt es einem Test, eine synthetische Nachricht mit beliebigem Schweregrad an einen
// Katalogeintrag zu heften — strukturell identisch zum echten add/field/value-Muster,
// nur mit variablem `field`. So lässt sich das warning/info-Verhalten prüfen, obwohl der
// reale Bretonnia-Auszug ausschließlich `error` verwendet.
const messageUnit = (id, severityField) => ({
  id,
  name: `Message Unit (${severityField})`,
  type: 'unit',
  modifiers: [{
    type: 'add',
    field: severityField,
    value: `Author hint via ${severityField}`,
    conditions: [{
      type: 'atLeast',
      value: 1,
      field: 'selections',
      scope: 'force',
      childId: ALLOW_SPECIALS_TOGGLE_ID,
      includeChildSelections: true
    }],
    conditionGroups: []
  }]
});

const WARNING_UNIT_ID = 'unit-warning';
const INFO_UNIT_ID = 'unit-info';

const buildSystem = (extraEntries = []) => ({
  id: parsedHintCatalogue.gameSystemId,
  costTypes: [{ id: POINTS_COST_TYPE_ID, name: 'Points' }],
  categoryEntries: [],
  forceEntries: [forceEntry],
  catalogues: [
    {
      ...parsedHintCatalogue,
      sharedSelectionEntries: [...parsedHintCatalogue.sharedSelectionEntries, ...extraEntries]
    }
  ]
});

const selection = (entryId, name) => ({
  id: `${entryId}-sel`,
  selectionEntryId: entryId,
  name,
  number: 1
});

const buildRoster = (selections) => ({
  name: 'Test Roster',
  costLimit: 2000,
  costLimitType: POINTS_COST_TYPE_ID,
  catalogueId: TEST_CATALOGUE_ID,
  forces: [{ id: 'f1', forceEntryId: FORCE_ENTRY_ID, catalogueId: TEST_CATALOGUE_ID, selections }]
});

const messagesOfType = (errors, type) => errors.filter(error => error.type === type);

describe('Fixture-Integrität', () => {
  it('liefert die realen Entry-IDs aus dem echten Bretonnia-Auszug', () => {
    expect(parsedHintCatalogue.gameSystemId).toBe('0d13-7737-ea86-4662');
    expect(GREEN_KNIGHT_ID).toBe('e9d1-eb9d-7c44-f777');
    expect(ALLOW_SPECIALS_TOGGLE_ID).toBe('8923-5946-7b10-8957');

    const greenKnight = parsedHintCatalogue.sharedSelectionEntries.find(e => e.id === GREEN_KNIGHT_ID);
    // Voraussetzung des Tests: der reale field="error"-Modifier hängt am Eintrag.
    expect(greenKnight.modifiers.some(m => m.field === 'error' && m.value === EXPECTED_HINT_MESSAGE)).toBe(true);
  });
});

describe('field="error"-Hinweistext-Modifier (Reproduktion Bretonnia)', () => {
  it('meldet den Klartext-Hinweis als blockierenden Fehler, solange die Bedingung erfüllt ist (kein Schalter)', () => {
    const roster = buildRoster([selection(GREEN_KNIGHT_ID, 'The Green Knight')]);

    const errors = validateRoster(roster, buildSystem());
    const hintErrors = messagesOfType(errors, MODIFIER_ERROR_TYPE);

    expect(hintErrors).toHaveLength(1);
    expect(hintErrors[0].message).toBe(EXPECTED_HINT_MESSAGE);
    expect(hintErrors[0].severity).toBe('error');
    expect(hasBlockingViolations(errors)).toBe(true);
  });

  it('erzeugt keinen Hinweis-Eintrag, sobald die Bedingung nicht mehr erfüllt ist (Schalter gesetzt)', () => {
    const roster = buildRoster([
      selection(GREEN_KNIGHT_ID, 'The Green Knight'),
      selection(ALLOW_SPECIALS_TOGGLE_ID, 'Allow special characters?')
    ]);

    const errors = validateRoster(roster, buildSystem());

    expect(messagesOfType(errors, MODIFIER_ERROR_TYPE)).toHaveLength(0);
    // Der Schalter hebt zugleich das roster-weite max-Limit — die Liste ist regelkonform.
    expect(hasBlockingViolations(errors)).toBe(false);
  });
});

describe('field="warning"/"info"-Modifier erscheinen, blockieren aber nicht', () => {
  it('meldet einen warning-Hinweis in der Liste, ohne das Spielen zu blockieren', () => {
    const roster = buildRoster([
      selection(WARNING_UNIT_ID, 'Message Unit'),
      selection(ALLOW_SPECIALS_TOGGLE_ID, 'Allow special characters?')
    ]);

    const errors = validateRoster(roster, buildSystem([messageUnit(WARNING_UNIT_ID, 'warning')]));
    const warnings = messagesOfType(errors, MODIFIER_WARNING_TYPE);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe('warning');
    expect(hasBlockingViolations(errors)).toBe(false);
  });

  it('meldet einen info-Hinweis in der Liste, ohne das Spielen zu blockieren', () => {
    const roster = buildRoster([
      selection(INFO_UNIT_ID, 'Message Unit'),
      selection(ALLOW_SPECIALS_TOGGLE_ID, 'Allow special characters?')
    ]);

    const errors = validateRoster(roster, buildSystem([messageUnit(INFO_UNIT_ID, 'info')]));
    const infos = messagesOfType(errors, MODIFIER_INFO_TYPE);

    expect(infos).toHaveLength(1);
    expect(infos[0].severity).toBe('info');
    expect(hasBlockingViolations(errors)).toBe(false);
  });

  it('erzeugt keinen warning-Eintrag, wenn die Bedingung nicht erfüllt ist', () => {
    // Ohne den Schalter im Roster trifft die atLeast-Bedingung des Modifiers nicht zu.
    const roster = buildRoster([selection(WARNING_UNIT_ID, 'Message Unit')]);

    const errors = validateRoster(roster, buildSystem([messageUnit(WARNING_UNIT_ID, 'warning')]));

    expect(messagesOfType(errors, MODIFIER_WARNING_TYPE)).toHaveLength(0);
  });
});

describe('Bestehende Validierungseinträge behalten severity "error" (keine Regression)', () => {
  it('markiert einen klassischen Regelverstoß (roster-weites max-Limit überschritten) als blockierend', () => {
    // Green Knight ohne Schalter: das reale max=0-Limit (a108) bleibt ungehoben,
    // die Auswahl überschreitet es — ein bestehender entry-max-Verstoß.
    const roster = buildRoster([selection(GREEN_KNIGHT_ID, 'The Green Knight')]);

    const errors = validateRoster(roster, buildSystem());
    const limitErrors = messagesOfType(errors, 'entry-max');

    expect(limitErrors.length).toBeGreaterThanOrEqual(1);
    expect(limitErrors.every(error => error.severity === 'error')).toBe(true);
    expect(hasBlockingViolations(errors)).toBe(true);
  });
});
