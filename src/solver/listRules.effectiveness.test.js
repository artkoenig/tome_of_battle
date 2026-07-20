import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { validateRoster, hasBlockingViolations } from './validator.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';

// Seam C: prove the *downstream effect* of a list rule's presence at the solver
// edge. A bare switch list rule ("Allow special characters?") gates another entry
// via Battlescribe conditions: its PRESENCE lifts the roster-wide max of the
// gated entry from 0 to 1 (unlock); its ABSENCE leaves the entry capped at 0
// (lock). Since a list rule is now a plain selection (checkbox on ⇔ present), this
// is exactly what checking/unchecking the box does. Uses the real, verbatim
// Bretonnia extract (The Green Knight + "Allow special characters?").

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const FIXTURE_DIR = './src/solver/__fixtures__/whfb6-lexicanum';
const parsedCatalogue = parseCatalogueXML(readFileSync(`${FIXTURE_DIR}/special-characters-hint.cat.xml`, 'utf-8'));

const POINTS_COST_TYPE_ID = 'pts';
const CATALOGUE_ID = parsedCatalogue.id;
const FORCE_ENTRY_ID = 'force-bretonnia';
const ENTRY_MAX_VIOLATION = 'entry-max';

// IDs data-driven from the real extract (ADR 0003), never re-typed.
const entryIdByName = (name) => parsedCatalogue.sharedSelectionEntries.find((e) => e.name === name)?.id;
const GREEN_KNIGHT_ID = entryIdByName('The Green Knight');
const ALLOW_SPECIALS_TOGGLE_ID = entryIdByName('Allow special characters?');

const system = {
  id: parsedCatalogue.gameSystemId,
  costTypes: [{ id: POINTS_COST_TYPE_ID, name: 'Points' }],
  categoryEntries: [],
  forceEntries: [{ id: FORCE_ENTRY_ID, name: 'Bretonnian Army', categoryLinks: [] }],
  catalogues: [parsedCatalogue],
};

const selection = (entryId, name) => ({ id: `${entryId}-sel`, selectionEntryId: entryId, name, number: 1 });

const buildRoster = (selections) => ({
  name: 'Test Roster',
  costLimit: 2000,
  costLimitType: POINTS_COST_TYPE_ID,
  catalogueId: CATALOGUE_ID,
  forces: [{ id: 'f1', forceEntryId: FORCE_ENTRY_ID, catalogueId: CATALOGUE_ID, selections }],
});

const entryMaxErrors = (errors) => errors.filter((e) => e.type === ENTRY_MAX_VIOLATION);

describe('Listenregel-Präsenz schaltet gesperrte Einträge frei (Seam C)', () => {
  it('sperrt den Eintrag, solange die Listenregel ABWESEND ist (Ankreuzfeld aus)', () => {
    // Only the gated entry, no toggle: its real max=0 stays in force → over the limit.
    const errors = validateRoster(buildRoster([selection(GREEN_KNIGHT_ID, 'The Green Knight')]), system);

    expect(entryMaxErrors(errors).length).toBeGreaterThanOrEqual(1);
    expect(entryMaxErrors(errors).every((e) => e.severity === 'error')).toBe(true);
    expect(hasBlockingViolations(errors)).toBe(true);
  });

  it('schaltet den Eintrag frei, sobald die Listenregel PRÄSENT ist (Ankreuzfeld an)', () => {
    // Adding the toggle selection (checkbox on) lifts the gated entry's max 0 → 1.
    const errors = validateRoster(
      buildRoster([
        selection(GREEN_KNIGHT_ID, 'The Green Knight'),
        selection(ALLOW_SPECIALS_TOGGLE_ID, 'Allow special characters?'),
      ]),
      system,
    );

    expect(entryMaxErrors(errors)).toHaveLength(0);
    expect(hasBlockingViolations(errors)).toBe(false);
  });
});
