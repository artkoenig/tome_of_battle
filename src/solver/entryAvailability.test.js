import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, test, expect } from 'vitest';
import {
  getEntryAddAvailability,
  isBlockingAvailabilityViolation,
  VIOLATION_BLOCKS_ADD_AVAILABILITY,
  classifyBlocksAddAvailability
} from './validator.js';
import { parseCatalogueXML } from '../parser/xmlParser.js';
import { formatValidationError } from '../i18n/formatValidationError.js';
import { t } from '../i18n/i18nStore.js';

// JSDOM stellt DOMParser für den Node-Testlauf bereit (wie in den übrigen Solver-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// `getEntryAddAvailability` liefert strukturierte Verstöße (ADR 0026); der Aushebe-Dialog
// übersetzt sie zur Anzeige. Der Testlauf pinnt Deutsch (i18nTestSetup), sodass die
// deutschen Grund-Texte greifen.
const renderReasons = reasons =>
  reasons.map(reason => formatValidationError(reason, t));

const POINTS = 'pts';

// ── Generische, schema-förmige Fixtures (nicht armeespezifisch, ADR-0003) ──────────
// Muster wie constraintSemantics.test.js: der neue Verfügbarkeits-Seam wird end-to-end
// durch getEntryAddAvailability (→ validateRoster) geführt.

function makeSystem({ selectionEntries = [], forceEntries } = {}) {
  return {
    id: 'sys',
    costTypes: [{ id: POINTS, name: 'Points' }],
    categoryEntries: [],
    forceEntries: forceEntries || [{ id: 'fe-army', name: 'Army', categoryLinks: [] }],
    catalogues: [{ id: 'cat', selectionEntries }]
  };
}

function makeForce(selections) {
  return { id: 'f1', forceEntryId: 'fe-army', catalogueId: 'cat', selections };
}

function makeRoster(costLimit, selections) {
  return { id: 'r', catalogueId: 'cat', costLimit, costLimitType: POINTS, forces: [makeForce(selections)] };
}

function selection(id, entryId, number = 1) {
  return { id, name: entryId, selectionEntryId: entryId, entryLinkId: null, number, selections: [] };
}

// getEntryAddAvailability für den Kandidaten `entry` gegen das aktuelle Roster.
function availabilityOf(entry, roster, system, categoryId) {
  return getEntryAddAvailability({ entry, categoryId, force: roster.forces[0], roster, system });
}

describe('isBlockingAvailabilityViolation — liest das Validator-Flag (ADR-0022)', () => {
  test('sperrt, wenn blocksAddAvailability true und severity error', () => {
    expect(isBlockingAvailabilityViolation({ type: 'entry-max', severity: 'error', blocksAddAvailability: true })).toBe(true);
    expect(isBlockingAvailabilityViolation({ type: 'modifier-error', severity: 'error', blocksAddAvailability: true })).toBe(true);
  });

  test('der Typ-Suffix `-max` allein sperrt NICHT mehr — nur das explizite Flag zählt', () => {
    expect(isBlockingAvailabilityViolation({ type: 'entry-max', severity: 'error' })).toBe(false);
    expect(isBlockingAvailabilityViolation({ type: 'entry-max', severity: 'error', blocksAddAvailability: false })).toBe(false);
  });

  test('sperrt NICHT bei severity warning/info, selbst mit gesetztem Flag', () => {
    expect(isBlockingAvailabilityViolation({ type: 'entry-max', severity: 'warning', blocksAddAvailability: true })).toBe(false);
    expect(isBlockingAvailabilityViolation({ type: 'modifier-error', severity: 'info', blocksAddAvailability: true })).toBe(false);
  });
});

describe('Sperr-Klassifikation des Validators — Driftschutz (ADR-0022)', () => {
  const BLOCKING = [
    'entry-max', 'category-max', 'group-count-max', 'group-points-max',
    'entry-percent-max', 'group-percent-max', 'modifier-error'
  ];
  const NON_BLOCKING = [
    'roster-limit', 'force-roster-limit', 'force-selector-min', 'roster-selector-min',
    'category-min', 'entry-min', 'entry-percent-min', 'group-count-min', 'group-points-min',
    'group-percent-min', 'unresolved-entry', 'modifier-warning', 'modifier-info'
  ];

  test('Obergrenzen-/Autoren-error-Typen sind als sperrend klassifiziert', () => {
    BLOCKING.forEach(type => expect(VIOLATION_BLOCKS_ADD_AVAILABILITY[type]).toBe(true));
  });

  test('Budget-/„zu-wenig"-/unresolved-Typen sind als nicht sperrend klassifiziert', () => {
    NON_BLOCKING.forEach(type => expect(VIOLATION_BLOCKS_ADD_AVAILABILITY[type]).toBe(false));
  });

  test('jeder klassifizierte Typ trägt ein boolesches Flag', () => {
    Object.values(VIOLATION_BLOCKS_ADD_AVAILABILITY).forEach(value => expect(typeof value).toBe('boolean'));
  });

  test('ein unklassifizierter Typ wirft — kein stilles Durchrutschen eines neuen Verstoßes', () => {
    expect(() => classifyBlocksAddAvailability('brandneuer-max')).toThrow();
  });

  test('die Klassifikation deckt genau die erwarteten Typen ab (Neuzugang fällt auf)', () => {
    expect(new Set(Object.keys(VIOLATION_BLOCKS_ADD_AVAILABILITY)))
      .toEqual(new Set([...BLOCKING, ...NON_BLOCKING]));
  });
});

describe('Autoren-error-Tor (Reproduktion Bretonnia „Allow special characters?")', () => {
  // Echter Verbatim-Auszug: „The Green Knight" trägt einen field="error"-Modifier plus
  // ein per Schalter gehobenes roster-weites max=0 — dasselbe Muster wie der Emperor
  // Fire Dragon (experimentelle Regeln).
  const FIXTURE_DIR = './src/solver/__fixtures__/whfb6-lexicanum';
  const parsed = parseCatalogueXML(readFileSync(`${FIXTURE_DIR}/special-characters-hint.cat.xml`, 'utf-8'));
  const entryByName = name => parsed.sharedSelectionEntries.find(e => e.name === name);
  const greenKnight = entryByName('The Green Knight');
  const toggle = entryByName('Allow special characters?');
  const VERBATIM_REASON = 'Please enable "Allow special characters?"';
  const SPECIAL_CHARACTERS_CATEGORY = '0644-bfcd-32c2-21dc';

  const buildSystem = () => ({
    id: parsed.gameSystemId,
    costTypes: [{ id: POINTS, name: 'Points' }],
    categoryEntries: [],
    forceEntries: [{ id: 'force-bretonnia', name: 'Bretonnian Army', categoryLinks: [] }],
    catalogues: [parsed]
  });

  const buildRoster = selections => ({
    name: 'Test', costLimit: 2000, costLimitType: POINTS, catalogueId: parsed.id,
    forces: [{ id: 'f1', forceEntryId: 'force-bretonnia', catalogueId: parsed.id, selections }]
  });

  it('ist bei inaktiver Regel nicht verfügbar und nennt den wortgetreuen Grund', () => {
    const roster = buildRoster([]);
    const { available, reasons } = availabilityOf(greenKnight, roster, buildSystem(), SPECIAL_CHARACTERS_CATEGORY);

    expect(available).toBe(false);
    expect(renderReasons(reasons)).toContain(VERBATIM_REASON);
  });

  it('ist verfügbar, sobald die freischaltende Regel aktiv ist', () => {
    const roster = buildRoster([selection('sel-toggle', toggle.id)]);
    const { available, reasons } = availabilityOf(greenKnight, roster, buildSystem(), SPECIAL_CHARACTERS_CATEGORY);

    expect(available).toBe(true);
    expect(reasons).toHaveLength(0);
  });

  it('zeigt bei doppelter Sperre (mechanisch + Autoren-error) NUR den Autoren-Grund', () => {
    // Der Green Knight ist bei inaktiver Regel „Gürtel-und-Hosenträger"-gegatet: das
    // roster-weite max=0 (mechanisch) UND der Autoren-`modifier-error` sperren
    // gleichzeitig. Die Grund-Anzeige darf nur den verständlichen Autoren-Text
    // führen, nicht die redundante mechanische Meldung.
    const roster = buildRoster([]);
    const { available, reasons } = availabilityOf(greenKnight, roster, buildSystem(), SPECIAL_CHARACTERS_CATEGORY);

    expect(available).toBe(false);
    expect(renderReasons(reasons)).toEqual([VERBATIM_REASON]);
    expect(renderReasons(reasons).some(reason => reason.includes('aktuell'))).toBe(false);
  });
});

describe('Kategorie-Obergrenze der Force (vom alten Einzel-max-Check verfehlt)', () => {
  const LORDS_CATEGORY = 'cat-lords';
  const lord = {
    id: 'lord', name: 'Lord', type: 'unit', costs: [{ typeId: POINTS, value: 100 }],
    categoryLinks: [{ targetId: LORDS_CATEGORY, primary: true }]
  };
  const system = makeSystem({
    selectionEntries: [lord],
    forceEntries: [{
      id: 'fe-army', name: 'Army',
      categoryLinks: [{ targetId: LORDS_CATEGORY, name: 'Lords', constraints: [{ id: 'lords-max', type: 'max', value: 1, field: 'selections' }] }]
    }]
  });

  it('sperrt den Kandidaten, sobald die Kategorie-Obergrenze erreicht ist', () => {
    const roster = makeRoster(2000, [{ ...selection('s-lord-1', 'lord'), category: LORDS_CATEGORY }]);
    const { available } = availabilityOf(lord, roster, system, LORDS_CATEGORY);
    expect(available).toBe(false);
  });

  it('nennt die mechanische Obergrenze in verständlichem Ton, wenn kein Autoren-error vorliegt (Fallback)', () => {
    // Reiner mechanischer Verstoß (category-max, kein `modifier-error`): die
    // Priorisierung greift nicht, der mechanische Grund bleibt sichtbar — im
    // verständlichen Ton (Issue 58), ohne den früheren „(aktuell: N)"-Zusatz.
    const roster = makeRoster(2000, [{ ...selection('s-lord-1', 'lord'), category: LORDS_CATEGORY }]);
    const { reasons } = availabilityOf(lord, roster, system, LORDS_CATEGORY);
    const rendered = renderReasons(reasons);
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.some(reason => reason.includes('höchstens'))).toBe(true);
    expect(rendered.some(reason => reason.includes('aktuell'))).toBe(false);
    // Numerus-korrekt (Issue 58): eine Grenze von 1 nennt „Auswahl", nicht „Auswahlen".
    expect(rendered).toContain('Die Armee darf höchstens eine Auswahl aus „Lords" treffen.');
  });

  it('lässt den Kandidaten zu, solange die Kategorie unter der Grenze liegt', () => {
    const roster = makeRoster(2000, []);
    const { available } = availabilityOf(lord, roster, system, LORDS_CATEGORY);
    expect(available).toBe(true);
  });
});

describe('Nicht-roster/force-scoped max (self-scoped) — vom alten Einzel-max-Check verfehlt', () => {
  // Der alte Dialog-Check betrachtete nur genau ein max mit scope roster/force/undefined.
  // Ein self-scoped max (scope == eigene Entry-Id) blieb unsichtbar und wurde erst nach
  // dem Ausheben als Fehler gemeldet.
  const hero = {
    id: 'hero', name: 'Hero', type: 'unit', costs: [{ typeId: POINTS, value: 50 }],
    constraints: [{ id: 'c-self-max', type: 'max', value: 1, field: 'selections', scope: 'hero' }]
  };
  const system = makeSystem({ selectionEntries: [hero] });

  it('sperrt den zweiten Kandidaten trotz self-scoped max', () => {
    const roster = makeRoster(2000, [selection('s-hero-1', 'hero')]);
    const { available } = availabilityOf(hero, roster, system);
    expect(available).toBe(false);
  });
});

describe('Prozent-max (vom alten Einzel-max-Check verfehlt)', () => {
  const lord = {
    id: 'lord', name: 'Lord', type: 'unit', costs: [{ typeId: POINTS, value: 300 }],
    constraints: [{ id: 'c-lord-pct', type: 'max', value: 25, field: POINTS, scope: 'roster', percentValue: true }]
  };
  const system = makeSystem({ selectionEntries: [lord] });

  it('sperrt den Kandidaten, der das Prozent-Limit überschreitet', () => {
    // 300 Pkt > 25% von 1000 = 250.
    const roster = makeRoster(1000, []);
    const { available } = availabilityOf(lord, roster, system);
    expect(available).toBe(false);
  });

  it('lässt den Kandidaten zu, solange er im Prozent-Budget bleibt', () => {
    // 300 Pkt <= 25% von 2000 = 500.
    const roster = makeRoster(2000, []);
    const { available } = availabilityOf(lord, roster, system);
    expect(available).toBe(true);
  });
});

describe('Budget-/Mindestgrößen-Zustände sperren NICHT (bleiben wählbar)', () => {
  it('über-Budget-Add bleibt verfügbar (roster-limit sperrt nicht)', () => {
    const bigUnit = { id: 'big', name: 'Big Unit', type: 'unit', costs: [{ typeId: POINTS, value: 600 }] };
    const system = makeSystem({ selectionEntries: [bigUnit] });
    // Baseline schon bei 600 von 1000; ein zweiter 600er sprengt das Budget.
    const roster = makeRoster(1000, [selection('s-big-1', 'big')]);

    const { available, reasons } = availabilityOf(bigUnit, roster, system);
    expect(available).toBe(true);
    expect(reasons).toHaveLength(0);
  });

  it('Mindestgrößen-Unterschreitung bleibt verfügbar (entry-min sperrt nicht)', () => {
    const regiment = {
      id: 'regiment', name: 'Regiment', type: 'unit', costs: [{ typeId: POINTS, value: 50 }],
      constraints: [{ id: 'c-min', type: 'min', value: 5, field: 'selections', scope: 'roster' }]
    };
    const system = makeSystem({ selectionEntries: [regiment] });
    const roster = makeRoster(2000, []);

    // Frisch ausgehoben mit number 1 < min 5 → entry-min, aber nicht sperrend.
    const { available } = availabilityOf(regiment, roster, system);
    expect(available).toBe(true);
  });
});

describe('Baseline-Diff über stabilen Schlüssel (bloße Count-Änderung sperrt nicht)', () => {
  it('sperrt nicht, wenn der Verstoß schon in der Baseline steckt', () => {
    // Kategorie ist bereits über der Grenze (2 > 1): der Verstoß existiert schon,
    // der Kandidat führt keinen NEUEN ein — Diff-Semantik der SSOT.
    const LORDS = 'cat-lords';
    const lord = {
      id: 'lord', name: 'Lord', type: 'unit', costs: [{ typeId: POINTS, value: 100 }],
      categoryLinks: [{ targetId: LORDS, primary: true }]
    };
    const system = makeSystem({
      selectionEntries: [lord],
      forceEntries: [{
        id: 'fe-army', name: 'Army',
        categoryLinks: [{ targetId: LORDS, name: 'Lords', constraints: [{ id: 'lords-max', type: 'max', value: 1, field: 'selections' }] }]
      }]
    });
    const roster = makeRoster(2000, [
      { ...selection('s-lord-1', 'lord'), category: LORDS },
      { ...selection('s-lord-2', 'lord'), category: LORDS }
    ]);

    const { available } = availabilityOf(lord, roster, system, LORDS);
    expect(available).toBe(true);
  });
});

describe('Pflicht-Kinder im hypothetischen Add (geteilte Selektions-Fabrik, ADR-0022)', () => {
  // Der Kandidat trägt eine Pflicht-Ausrüstungsgruppe (min>0), deren Default-Wahl 20 Pkt
  // kostet und das 10-Pkt-Limit derselben Gruppe sprengt. Nur wenn die Verfügbarkeit die
  // Pflicht-Kinder — wie das echte Ausheben — mitbevölkert, schlägt das Limit an. Vor dem
  // Fix (leere `selections`) wäre die Gruppe leer und der Kandidat fälschlich „verfügbar".
  const wargear = { id: 'runesword', name: 'Runesword', type: 'upgrade', costs: [{ typeId: POINTS, value: 20 }] };
  const champion = {
    id: 'champion', name: 'Champion', type: 'unit', costs: [{ typeId: POINTS, value: 50 }],
    selectionEntryGroups: [{
      id: 'g-wargear', name: 'Wargear',
      constraints: [
        { id: 'g-min', type: 'min', value: 1, field: 'selections', scope: 'parent' },
        { id: 'g-max-pts', type: 'max', value: 10, field: POINTS, scope: 'parent' }
      ],
      selectionEntries: [wargear]
    }]
  };
  const system = makeSystem({ selectionEntries: [champion, wargear] });

  it('sperrt, wenn ein Pflicht-Kind ein Limit sprengt', () => {
    const roster = makeRoster(2000, []);
    const { available, reasons } = availabilityOf(champion, roster, system);
    expect(available).toBe(false);
    expect(reasons.length).toBeGreaterThan(0);
  });
});
