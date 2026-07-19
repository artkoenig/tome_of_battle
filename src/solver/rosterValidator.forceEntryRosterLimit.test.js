import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { validateRoster } from './validator.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';

// JSDOM stellt DOMParser für den Node-Testlauf bereit (wie in den übrigen Solver-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// Verbatim-Auszug der beiden Vampire-Counts-Sonderheere aus dem echten
// Definitive-Edition-Datensatz (ADR-0017). Ihre forceEntry-eigene
// `limit::<costTypeId>`-Constraint (Basis 0) wird per eigengegatetem Modifier auf
// 2000 angehoben — „wer dieses Sonderheer wählt, muss ≥2000 Punkte bauen".
const FIXTURE_DIR = './src/solver/__fixtures__/whfb6-lexicanum';
const parsedCatalogue = parseCatalogueXML(
  readFileSync(`${FIXTURE_DIR}/vampire-coast-force-limit.cat.xml`, 'utf-8')
);

// pts-costType-Id des Katalogs; zugleich die `costLimitType`-Id eines Punkte-Rosters.
const POINTS_COST_TYPE_ID = 'ecfa-8486-4f6c-c249';
const REQUIRED_LIMIT = 2000;
const FORCE_ROSTER_LIMIT_ERROR = 'force-roster-limit';
const TEST_CATALOGUE_ID = 'cat-vc-test';

// Ein schlichtes Kontingent ohne forceEntry-eigene Punktelimit-Constraint — die
// Kontrollgruppe für „keine Regression bei normalen Heerlagern".
const PLAIN_FORCE_ID = 'force-plain';
const plainForce = { id: PLAIN_FORCE_ID, name: 'Standard Host', categoryLinks: [] };

// IDs datengetrieben aus dem echten Auszug lesen, statt sie zu wiederholen (ADR-0003).
const forceIdByName = name => parsedCatalogue.forceEntries.find(fe => fe.name === name)?.id;
const LICHEMASTER_FORCE_ID = forceIdByName('Army of the Lichemaster (WD#309-UK)');
const VAMPIRE_COAST_FORCE_ID = forceIdByName('Vampire Coast (WD#306-UK)');

const buildSystem = () => ({
  id: parsedCatalogue.gameSystemId,
  costTypes: [{ id: POINTS_COST_TYPE_ID, name: 'pts' }],
  categoryEntries: [],
  forceEntries: [plainForce, ...parsedCatalogue.forceEntries],
  catalogues: [{ id: TEST_CATALOGUE_ID, name: 'Test Catalogue', selectionEntries: [] }]
});

const buildRoster = ({ forceEntryId, costLimit }) => ({
  name: 'Test Roster',
  costLimit,
  costLimitType: POINTS_COST_TYPE_ID,
  catalogueId: TEST_CATALOGUE_ID,
  forces: [{ id: 'f1', forceEntryId, catalogueId: TEST_CATALOGUE_ID, selections: [] }]
});

const rosterLimitErrors = errors => errors.filter(error => error.type === FORCE_ROSTER_LIMIT_ERROR);

describe('Fixture-Integrität', () => {
  it('liefert die beiden realen Sonderheer-forceEntries samt limit::-Constraint und set-Modifier', () => {
    expect(LICHEMASTER_FORCE_ID).toBe('f37a-a93e-fa22-61a8');
    expect(VAMPIRE_COAST_FORCE_ID).toBe('bf46-ee85-7c10-ba98');

    const coast = parsedCatalogue.forceEntries.find(fe => fe.id === VAMPIRE_COAST_FORCE_ID);
    const limitConstraint = coast.constraints.find(con =>
      con.scope === 'roster' && con.field.startsWith('limit::')
    );
    expect(limitConstraint).toBeTruthy();
    expect(limitConstraint.type).toBe('min');
    expect(limitConstraint.value).toBe(0);

    // Der Modifier hebt exakt diese Constraint (per id) auf 2000 an, gegatet auf die
    // eigene forceEntry-Id.
    const raiseModifier = coast.modifiers.find(mod => mod.field === limitConstraint.id);
    expect(raiseModifier.type).toBe('set');
    expect(raiseModifier.value).toBe(String(REQUIRED_LIMIT));
    expect(raiseModifier.conditions.some(con => con.childId === VAMPIRE_COAST_FORCE_ID)).toBe(true);
  });
});

describe('forceEntry-eigenes Punktelimit – Vampire-Counts-Sonderheere', () => {
  it('meldet einen Fehler, wenn „Army of the Lichemaster" unter 2000 Punkten gebaut wird (Reproduktion, AC1)', () => {
    const roster = buildRoster({ forceEntryId: LICHEMASTER_FORCE_ID, costLimit: 1500 });

    const errors = validateRoster(roster, buildSystem());
    const limitErrors = rosterLimitErrors(errors);

    expect(limitErrors).toHaveLength(1);
    expect(limitErrors[0].forceId).toBe(LICHEMASTER_FORCE_ID);
    expect(limitErrors[0].message).toContain(String(REQUIRED_LIMIT));
    expect(limitErrors[0].severity).toBe('error');
  });

  it('meldet den Fehler auch für „Vampire Coast" unter 2000 Punkten (AC1)', () => {
    const roster = buildRoster({ forceEntryId: VAMPIRE_COAST_FORCE_ID, costLimit: 1999 });

    expect(rosterLimitErrors(validateRoster(roster, buildSystem()))).toHaveLength(1);
  });

  it('lässt den Fehler ab genau 2000 Punkten verschwinden (AC2)', () => {
    const roster = buildRoster({ forceEntryId: VAMPIRE_COAST_FORCE_ID, costLimit: REQUIRED_LIMIT });

    expect(rosterLimitErrors(validateRoster(roster, buildSystem()))).toHaveLength(0);
  });

  it('meldet keinen Fehler oberhalb von 2000 Punkten (AC2)', () => {
    const roster = buildRoster({ forceEntryId: LICHEMASTER_FORCE_ID, costLimit: 3000 });

    expect(rosterLimitErrors(validateRoster(roster, buildSystem()))).toHaveLength(0);
  });

  it('lässt ein normales Kontingent ohne forceEntry-Punktelimit unverändert (AC3, keine Regression)', () => {
    const roster = buildRoster({ forceEntryId: PLAIN_FORCE_ID, costLimit: 500 });

    expect(rosterLimitErrors(validateRoster(roster, buildSystem()))).toHaveLength(0);
  });
});
