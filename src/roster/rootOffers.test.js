import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { processImportedData } from '../parser/xmlParser.js';
import { collectRootOfferEntries } from './rootOffers.js';
import { collectPrimaryCategoryEntries } from './entryVisibility.js';
import { findMissingMandatoryListRuleSelections } from './listRules.js';
import { getUnitOptions } from './optionsCollector.js';
import { prepareDataset, evaluate } from '../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../evaluation/rosterAdapter.js';

const jsdomObj = new JSDOM();
globalThis.DOMParser = jsdomObj.window.DOMParser;
globalThis.XMLSerializer = jsdomObj.window.XMLSerializer;

/**
 * Issue 0153 — die geteilte Bibliothek eines Katalogs ist kein Wurzelangebot.
 *
 * AC1 an echten Hochelfen-Daten: „Pure of Heart" trägt `min 1 scope="roster"`
 * und ist vom Typ `upgrade`, erfüllt also die Form einer Pflicht-Listenregel —
 * es steht aber allein in `sharedSelectionEntries` und wird nur vom `entryLink`
 * der Honours-Gruppe eines Helden eingebunden. Das Kontingent darf es deshalb
 * nicht von sich aus in die Armeeliste setzen.
 *
 * AC3 an einem Minimalkatalog: der Unterschied, auf den es ankommt, ist der
 * **Wurzelverweis** — ein geteilter Eintrag ohne ihn ist unsichtbar, derselbe
 * Eintrag mit einem Wurzel-`entryLink` erscheint.
 */

const DEFINITIVE_DIR = 'src/evaluator/__fixtures__/whfb6-definitive';

const PURE_OF_HEART_ID = 'd0ce-b0c4-fcc1-6cac';
const HONOURS_LINK_ID = '30b5-bd1a-60e2-2354';
const ARCHMAGE_ID = 'ccb4-f506-89b3-d1d8';

describe('Wurzelangebote vs. geteilte Bibliothek — Hochelfen (Issue 0153, AC1)', () => {
  const GAME_SYSTEM_XML = readFileSync(
    `${DEFINITIVE_DIR}/Warhammer Fantasy Battles (6th definitive edition).gst`, 'utf-8');
  const HIGH_ELVES_XML = readFileSync(
    `${DEFINITIVE_DIR}/High Elves (6th definitive edition).cat`, 'utf-8');
  const MERCENARIES_XML = readFileSync(
    `${DEFINITIVE_DIR}/Mercenaries (6th definitive edition).cat`, 'utf-8');

  const { system } = processImportedData(
    [{ name: 'whfb6-de.gst', content: GAME_SYSTEM_XML }],
    [
      { name: 'High Elves.cat', content: HIGH_ELVES_XML },
      { name: 'Mercenaries.cat', content: MERCENARIES_XML }
    ]
  );
  const prepared = prepareDataset({
    gameSystem: GAME_SYSTEM_XML,
    catalogues: [HIGH_ELVES_XML, MERCENARIES_XML]
  });

  const highElves = system.catalogues.find(c => c.name?.startsWith('High Elves'));

  const ARCHMAGE_FORCE_ENTRY_ID = 'c236-0d80-eff8-3cf9';
  const PURE_OF_HEART_ROSTER_MIN_ID = '82ef-69c7-f459-5e20';

  const archmageSelection = (children = []) => ({
    id: 'sel-archmage',
    selectionEntryId: ARCHMAGE_ID,
    name: 'Archmage',
    number: 1,
    selections: children
  });

  /** Die gemeldeten Verletzungen, die die Mindestgrenze von „Pure of Heart" nennen. */
  function evaluateHighElves(selections) {
    const roster = {
      id: 'roster-1',
      name: 'Test',
      systemId: 'system-1',
      catalogueId: highElves.id,
      costLimit: 2000,
      costLimitType: 'ecfa-8486-4f6c-c249',
      forces: [{
        id: 'force-1',
        forceEntryId: ARCHMAGE_FORCE_ENTRY_ID,
        catalogueId: highElves.id,
        selections
      }]
    };
    const report = evaluate(prepared, toEvaluatorRoster(roster).evalRoster);
    return (report.violations || []).filter(
      v => JSON.stringify(v).includes(PURE_OF_HEART_ROSTER_MIN_ID)
    );
  }

  it('kennt „Pure of Heart" als geteilten Eintrag ohne Wurzelverweis — die Vorbedingung des Falls', () => {
    const shared = (highElves.sharedSelectionEntries || []).find(e => e.id === PURE_OF_HEART_ID);
    expect(shared).toBeDefined();
    expect(shared.type).toBe('upgrade');
    expect(shared.constraints.some(c => c.type === 'min' && c.scope === 'roster' && Number(c.value) >= 1))
      .toBe(true);

    // Kein Eintrag und kein Link auf der Katalogwurzel bindet ihn ein.
    expect(collectRootOfferEntries(highElves).some(
      e => e.id === PURE_OF_HEART_ID || e.targetId === PURE_OF_HEART_ID
    )).toBe(false);
  });

  it('setzt „Pure of Heart" nicht von sich aus in ein leeres Kontingent', () => {
    const force = { id: 'force-1', catalogueId: highElves.id, selections: [] };

    const missing = findMissingMandatoryListRuleSelections(system, highElves, force);

    expect(missing.map(m => m.resolved.id)).not.toContain(PURE_OF_HEART_ID);
    expect(missing.map(m => m.resolved.name)).not.toContain('Pure of Heart');
  });

  it('bietet „Pure of Heart" weiterhin am Helden an — über die Honours-Gruppe des Archmage', () => {
    const archmage = {
      id: 'sel-archmage',
      selectionEntryId: ARCHMAGE_ID,
      name: 'Archmage',
      number: 1,
      selections: []
    };

    const options = getUnitOptions(system, highElves.id, archmage);
    const honour = options.find(o => o.option?.name === 'Pure of Heart');

    expect(honour).toBeDefined();
    expect(honour.option.id).toBe(HONOURS_LINK_ID);
    expect(honour.option.targetId).toBe(PURE_OF_HEART_ID);
    expect(honour.groupName).toBe('Honours');
  });

  /**
   * Befund aus Issue 0153, ausdrücklich als **Lücke** gepinnt, nicht als
   * Wunschverhalten: die roster-weite Mindestgrenze von „Pure of Heart"
   * (`82ef-69c7-f459-5e20`, `min 1 scope="roster"`) meldet die Reinraum-Engine
   * in **keinem** der beiden Roster — weder ohne noch mit der Auswahl am
   * Helden. Ein Eintrag, der im Roster nicht vorkommt, bringt seine Grenze
   * nicht in die Auswertung ein.
   *
   * Damit steht fest: das automatische Einsetzen war nie die Durchsetzung
   * dieser Regel, und ihr Wegfall nimmt der Liste keine Prüfung, die sie
   * vorher hatte. Der Test schlägt an, sobald die Engine die Grenze doch
   * auswertet — dann gehört diese Erwartung umgedreht.
   */
  it('meldet die roster-weite Mindestgrenze heute in keinem der beiden Roster (dokumentierte Lücke)', () => {
    const withoutHonour = evaluateHighElves([archmageSelection()]);
    const withHonour = evaluateHighElves([archmageSelection([{
      id: 'sel-honour',
      entryLinkId: HONOURS_LINK_ID,
      selectionEntryId: PURE_OF_HEART_ID,
      name: 'Pure of Heart',
      number: 1,
      selections: []
    }])]);

    expect(withoutHonour).toEqual([]);
    expect(withHonour).toEqual([]);
  });
});

describe('Wurzelangebote vs. geteilte Bibliothek — der Wurzelverweis entscheidet (Issue 0153, AC3)', () => {
  const CAT_ID = 'cat-troops';

  const catalogue = {
    id: 'cat-1',
    name: 'Minimal',
    sharedSelectionEntries: [
      {
        id: 'shared-unlinked',
        name: 'Nur Bibliothek',
        type: 'unit',
        categoryLinks: [{ id: 'cl-1', targetId: CAT_ID, primary: true }],
        constraints: [],
        modifiers: []
      },
      {
        id: 'shared-linked',
        name: 'Über die Wurzel verlinkt',
        type: 'unit',
        categoryLinks: [{ id: 'cl-2', targetId: CAT_ID, primary: true }],
        constraints: [],
        modifiers: []
      }
    ],
    selectionEntries: [],
    entryLinks: [
      { id: 'root-link', name: 'Über die Wurzel verlinkt', type: 'selectionEntry', targetId: 'shared-linked' }
    ]
  };
  const system = { catalogues: [catalogue], categoryEntries: [{ id: CAT_ID, name: 'Truppen' }] };

  it('zählt nur `selectionEntries` und `entryLinks` der Wurzel zu den Angeboten', () => {
    expect(collectRootOfferEntries(catalogue).map(e => e.id)).toEqual(['root-link']);
  });

  it('bietet den geteilten Eintrag mit Wurzelverweis an, den ohne nicht', () => {
    const offered = collectPrimaryCategoryEntries(system, catalogue, CAT_ID, {
      force: { id: 'f', catalogueId: catalogue.id, selections: [] }
    });

    // Angeboten wird der Wurzel-Link auf den geteilten Eintrag — der geteilte
    // Eintrag ohne Wurzelverweis taucht überhaupt nicht auf.
    expect(offered.map(o => o.entry.id)).toEqual(['root-link']);
    expect(offered.some(o => o.entry.id === 'shared-unlinked')).toBe(false);
  });
});
