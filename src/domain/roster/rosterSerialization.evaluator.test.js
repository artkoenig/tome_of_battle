/**
 * Issue 0121, Task 7 — rosterSerialization: der Text-Export
 * (`exportRosterToXml(roster, system)`, Signatur bleibt) speist die
 * Selektionsnamen aus den Slot-`name`s des Evaluator-Berichts und die Kosten
 * aus dem Bericht (intern via `evaluateAppRoster`) — KEIN
 * `getEffectiveName`/`getEffectiveSelectionName`, KEIN
 * `getSelectionTotalCost`/`getSelectionOwnCosts`/`calculateRosterCosts` aus
 * dem Solver mehr (test-first; die neue Implementierung existiert noch nicht).
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert): Spy UND Observable ──────────
 * Die Solver-Namens-/Kostenquellen sind GIFT-Stubs (POISON-NAME / 999999) und
 * Spies: laeuft der Export noch ueber den Solver, stehen die Giftwerte im
 * XML-Text und die Spy-Asserts schlagen an. Der Datensatz traegt einen
 * unbedingten `set`-Namens-Modifikator, sodass der effektive Berichtsname
 * („Warrior Prime") vom rohen Selektionsnamen des Rosters („Warrior (stale)")
 * abweicht — der Name im Export ist damit eindeutig einer Quelle zuordenbar.
 * Erwartete Werte per Wegwerf-Skript gegen die ECHTE Fassade verifiziert
 * (Slot-Name „Warrior Prime"; totalCosts/costTotals 2 × 10 = 20 pts); jeder
 * Test prueft seine Vorbedingung per Guard-Assert gegen den echten Bericht.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Der Solver ist mit Issue 0121 geloescht; der fruehere Gift-Stub auf seine
// Fassade hat damit keinen Gegenstand mehr — dass die Anzeige aus dem Bericht
// kommt, ist jetzt strukturell garantiert.

import { exportRosterToXml } from './rosterSerialization.js';
import { prepareDataset, evaluate } from '../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../evaluation/rosterAdapter.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Synthetischer Datensatz ─────────────────────────────────────────────────
//
// Warrior (10 pts) mit unbedingtem Namens-Modifikator `set` → effektiver Name
// „Warrior Prime". Roster: Warrior ×2 unter dem rohen (veralteten) Namen
// „Warrior (stale)" → Bericht: Slot-Name „Warrior Prime", Kosten 20 pts.

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const WARRIOR_ID = 'entry-warrior';
const COST_TYPE_ID = 'cost-pts';
const EFFECTIVE_NAME = 'Warrior Prime';
const STALE_NAME = 'Warrior (stale)';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes>
      <costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/>
    </costTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <modifiers>
          <modifier type="set" value="${EFFECTIVE_NAME}" field="name"/>
        </modifiers>
        <costs>
          <cost name="pts" typeId="${COST_TYPE_ID}" value="10"/>
        </costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/**
 * App-System mit rohen XMLs (Quelle des Berichts) UND den geparsten
 * Strukturfeldern, die der Export fuer Katalog-/Kostenartnamen liest.
 */
function appSystem() {
  return {
    id: 'system-uuid',
    name: 'Test System',
    costTypes: [{ id: COST_TYPE_ID, name: 'pts' }],
    catalogues: [{ id: 'cat-main', name: 'Main Catalogue' }],
    rawXmls: {
      gst: [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
      cat: [{ name: 'main.cat', content: CATALOGUE_XML }],
    },
  };
}

function appRoster() {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit: 1000,
    costLimitType: COST_TYPE_ID,
    forces: [
      {
        id: 'force-uuid-1',
        forceEntryId: FORCE_DEF_ID,
        catalogueId: 'cat-main',
        selections: [
          {
            id: 'sel-warrior',
            name: STALE_NAME,
            entryLinkId: null,
            selectionEntryId: WARRIOR_ID,
            number: 2,
            category: null,
            selections: [],
          },
        ],
      },
    ],
  };
}

/** Auswertung ueber die ECHTE Fassade — die einzige Quelle der Erwartungen. */
function reportOf() {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(appRoster());
  const report = evaluate(prepared, evalRoster);
  return { report, pathBySelectionId };
}

describe('exportRosterToXml: Namen und Kosten aus dem Evaluator-Bericht (Issue 0121, Task 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('die Signatur bleibt: (roster, system) → synchroner XML-Text', () => {
    const xml = exportRosterToXml(appRoster(), appSystem());

    expect(typeof xml).toBe('string');
    expect(xml).toContain('<roster ');
  });

  it('der Selektionsname im Export ist der effektive Slot-Name des Berichts, nicht der rohe oder der Solver-Name', () => {
    const { report, pathBySelectionId } = reportOf();
    // Guard gegen den echten Bericht: der Slot traegt den modifizierten Namen.
    const capability = report.capabilities.get(pathBySelectionId.get('sel-warrior'));
    expect(capability.name).toBe(EFFECTIVE_NAME);

    const xml = exportRosterToXml(appRoster(), appSystem());

    expect(xml).toContain(`name="${EFFECTIVE_NAME}"`);
    expect(xml).not.toContain('POISON-NAME');
    expect(xml).not.toContain(STALE_NAME);
  });

  it('die Kosten im Export kommen aus dem Bericht: Selektions- und Summenblock nennen 20 pts, nie den Giftwert', () => {
    const { report, pathBySelectionId } = reportOf();
    // Guards gegen den echten Bericht: roster-weite Summe und Slot-Kosten = 20.
    expect(report.costTotals).toEqual({ [COST_TYPE_ID]: 20 });
    const capability = report.capabilities.get(pathBySelectionId.get('sel-warrior'));
    expect(capability.totalCosts).toMatchObject({ [COST_TYPE_ID]: 20 });

    const xml = exportRosterToXml(appRoster(), appSystem());

    // Beide Kostenstellen — der Roster-Summenblock und die <cost> der
    // Selektion — tragen den Berichtswert 20.
    const costMatches = xml.match(new RegExp(`typeId="${COST_TYPE_ID}" value="20"`, 'g')) ?? [];
    expect(costMatches.length).toBeGreaterThanOrEqual(2);
    expect(xml).not.toContain('999999');
  });

  it('das eingestellte Kostenlimit des Rosters bleibt im costLimits-Block (1000)', () => {
    const xml = exportRosterToXml(appRoster(), appSystem());

    expect(xml).toContain(`typeId="${COST_TYPE_ID}" value="1000"`);
  });

  // Der frühere Gift-Stub-Test steht hier nicht mehr: Der Solver ist mit
  // Issue 0121 gelöscht, seine Funktionen können gar nicht mehr gerufen
  // werden. Eine Assertion darauf könnte nicht fehlschlagen und würde
  // Sicherheit vortäuschen. Dass die Anzeige aus dem Bericht kommt, prüfen
  // die Fälle darüber an ihren Werten.
});
