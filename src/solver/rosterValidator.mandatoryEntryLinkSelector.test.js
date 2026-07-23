import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { validateRoster } from './validator.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';

// JSDOM stellt DOMParser für den Node-Testlauf bereit (wie in den übrigen Solver-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// Issue 62 (Definitive-Edition-Ausbau): Der armeeweite Pflichtselektor „mindestens eine
// Ogerbullen-Einheit" ist in der Definitive Edition nicht als Wurzel-`selectionEntry`,
// sondern als Wurzel-`entryLink` codiert. Die Pflicht steckt in einer force-scoped
// `min`-Constraint AM LINK (Basis 0), die ein Link-Modifier der Gruppe „Standard"
// (gegatet auf `notInstanceOf` Ironskin Tribe) auf 1 anhebt. Der Kollektor muss diesen
// Link wie einen Pflicht-selectionEntry behandeln, sonst bleibt die Pflicht unerzwungen.
const FIXTURE_DIR = './src/solver/__fixtures__/whfb6-lexicanum';
const parsedCatalogue = parseCatalogueXML(
  readFileSync(`${FIXTURE_DIR}/ogre-bulls-mandatory-entrylink.cat.xml`, 'utf-8')
);

const POINTS = 'pts';
const FORCE_SELECTOR_MIN = 'force-selector-min';
const OGRE_BULLS_NAME = 'Ogre Bulls';

// IDs datengetrieben aus dem echten Auszug lesen, statt sie zu wiederholen (ADR-0003).
const BULLS_ENTRY_LINK_ID = 'd82e-111e-89b9-2be1';
const STANDARD_FORCE_ID = '729f-9246-5cd3-5044';
const IRONSKIN_FORCE_ID = '8711-ed16-2a44-7251';
const BULLS_TARGET_ID = '7754-8b3d-df99-d2d5';
const BULLS_LINK_MIN_CONSTRAINT_ID = '32ed-26da-3f27-5c04';

const buildSystem = () => ({
  id: parsedCatalogue.gameSystemId,
  costTypes: [{ id: POINTS, name: 'pts' }],
  categoryEntries: parsedCatalogue.categoryEntries,
  forceEntries: parsedCatalogue.forceEntries,
  catalogues: [parsedCatalogue]
});

const buildRoster = (forceEntryId, selections) => ({
  name: 'Test Roster',
  costLimit: 2000,
  costLimitType: POINTS,
  catalogueId: parsedCatalogue.id,
  forces: [{ id: 'f1', forceEntryId, catalogueId: parsedCatalogue.id, selections }]
});

// Eine im Roster liegende Ogerbullen-Einheit, referenziert über die reale Link-Id.
const bullsSelection = () => ({
  id: 's-bulls', entryLinkId: BULLS_ENTRY_LINK_ID, number: 1, selections: []
});

const selectorErrors = errors => errors.filter(e => e.type === FORCE_SELECTOR_MIN);
const bullsErrors = errors =>
  selectorErrors(errors).filter(e => e.messageParams.entryName === OGRE_BULLS_NAME);

describe('Fixture-Integrität (echter Ogre-Bulls-Wurzel-entryLink)', () => {
  it('trägt die force-scoped min-Constraint am Link und den anhebenden Standard-Modifier', () => {
    const link = parsedCatalogue.entryLinks.find(el => el.id === BULLS_ENTRY_LINK_ID);
    expect(link).toBeTruthy();
    expect(link.targetId).toBe(BULLS_TARGET_ID);

    const minConstraint = link.constraints.find(
      con => con.type === 'min' && con.scope === 'force' && con.id === BULLS_LINK_MIN_CONSTRAINT_ID
    );
    expect(minConstraint).toBeTruthy();
    expect(minConstraint.value).toBe(0);

    // Der „Standard"-Modifier hebt exakt diese Constraint (per id) auf 1 an, gegatet auf
    // `notInstanceOf` Ironskin Tribe.
    const standardGroup = link.modifierGroups.find(g =>
      g.conditions?.some(c => c.type === 'notInstanceOf' && c.childId === IRONSKIN_FORCE_ID)
    );
    expect(standardGroup).toBeTruthy();
    const raiseModifier = standardGroup.modifiers.find(m => m.field === BULLS_LINK_MIN_CONSTRAINT_ID);
    expect(raiseModifier.type).toBe('set');
    expect(raiseModifier.value).toBe('1');
  });
});

describe('armeeweiter Pflicht-entryLink (Ogre Bulls, Definitive Edition, Issue 62)', () => {
  it('Reproduktion: meldet einen blockierenden Verstoß, wenn eine Standard-Armee keine Ogerbullen führt (AC1)', () => {
    const errors = validateRoster(buildRoster(STANDARD_FORCE_ID, []), buildSystem());

    const errs = bullsErrors(errors);
    expect(errs).toHaveLength(1);
    expect(errs[0].severity).toBe('error');
    // Force-scoped: der Verstoß trägt die Force-Id (nicht roster-weit).
    expect(errs[0].forceId).toBe('f1');
    expect(errs[0].messageParams.count).toBe(1);
  });

  it('löscht den Verstoß, sobald eine Ogerbullen-Einheit im Roster liegt (AC5)', () => {
    const errors = validateRoster(buildRoster(STANDARD_FORCE_ID, [bullsSelection()]), buildSystem());

    expect(bullsErrors(errors)).toHaveLength(0);
  });

  it('meldet keinen Verstoß für eine Ironskin-Tribe-Armee: der Link-min bleibt 0 (AC2)', () => {
    const errors = validateRoster(buildRoster(IRONSKIN_FORCE_ID, []), buildSystem());

    expect(bullsErrors(errors)).toHaveLength(0);
  });

  it('erzeugt genau einen Verstoß, nie ein Doppel-Melden (AC4)', () => {
    const errors = validateRoster(buildRoster(STANDARD_FORCE_ID, []), buildSystem());

    expect(bullsErrors(errors)).toHaveLength(1);
  });
});
