/**
 * Issue 0121, Task 7 — PlayMode-Kopf: die armee-weiten Extra-Ressourcen
 * (Ersatz fuer `getExtraResourceTotals`) kommen aus
 * `costTotals × description.costTypes` des Evaluators — alle
 * Nicht-Limit-Kostenarten mit Summe ≠ 0 — statt aus
 * `getExtraResourceTotals(system, roster, calculateRosterCosts(...))` des
 * Solvers (test-first; die neue Implementierung existiert noch nicht).
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ──────────────────────────────
 * `getExtraResourceTotals` und `calculateRosterCosts` sind als GIFT-Stubs
 * gemockt (POISON-Ressource 777 bzw. 999999): liest der Kopf noch den Solver,
 * erscheint die Gift-Ressource statt der Berichts-Werte. Der Evaluator-Pfad
 * laeuft ECHT (system.rawXmls); die Erwartungen (Casting Dice 2 × 3 = 6;
 * Dispel Dice deklariert ohne Vorkommen = 0; Secret Resource hidden = 14)
 * wurden per Wegwerf-Skript gegen die echte Fassade verifiziert.
 *
 * ── Vertragsentscheidungen (markiert) ────────────────────────────────────────
 * - Angezeigt werden alle NICHT-Limit-Kostenarten mit Summe ≠ 0 (Vorgabe des
 *   Tasks); die Limit-Kostenart selbst und Kostenarten mit Summe 0 erscheinen
 *   nicht.
 * - Eine als `hidden` deklarierte Kostenart bleibt AUSGESCHLOSSEN — das ist
 *   die bestehende Anzeige-Observable (gepinnt in
 *   `src/parser/xmlParser.staticAttributes.test.js`: „a hidden cost type is
 *   excluded from the displayed extra resources"), aus den Tests gelesen,
 *   nicht aus dem Solver-Quelltext. `description.costTypes` traegt `isHidden`.
 * - Die Anzeige-Observable bleibt `{Summe} {Klartext-Name}` im Badge der
 *   Ressourcen-Leiste (bestehendes Markup `.play-resource-bar`).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import PlayMode from './PlayMode';

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Swords: () => <span data-testid="icon-swords" />,
  BookOpen: () => <span data-testid="icon-book" />,
}));

const mockUseSettings = vi.fn(() => ({ whfb6LinkingEnabled: false }));
vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

vi.mock('../db/database', () => ({
  saveRoster: vi.fn(() => Promise.resolve()),
}));

vi.mock('./editor/BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="sheet">{children}</div> : null),
}));

// Die Einheitenkarten sind eine eigene Baustelle (PlayUnitDetails-Tests);
// hier zaehlt allein der Kopf mit der Ressourcen-Leiste.
vi.mock('./play/PlayUnitDetails', () => ({
  default: () => <div data-testid="play-unit-details" />,
}));

vi.mock('./RulesIndexDialog', () => ({
  default: () => null,
}));

const calculateRosterCostsSpy = vi.fn(() => ({ [COST_TYPE_PTS]: 999999 }));
const getExtraResourceTotalsSpy = vi.fn(() => [{ id: 'poison', name: 'POISON-RES', total: 777 }]);

vi.mock('../solver/validator', async (importOriginal) => ({
  ...(await importOriginal()),
  calculateRosterCosts: (...args) => calculateRosterCostsSpy(...args),
  getExtraResourceTotals: (...args) => getExtraResourceTotalsSpy(...args),
  // Nicht unter Test (Sortierung/Listenregeln): benigne Stubs, damit die
  // Solver-Aufloesung am synthetischen System nicht dazwischenfunkt.
  getSelectionTotalCost: () => 0,
  isListRuleSelection: () => false,
}));

// ── Synthetischer Datensatz ─────────────────────────────────────────────────
//
// Vier Kostenarten: pts (Limit-Kostenart), Casting Dice (3 je Warrior),
// Dispel Dice (deklariert, ohne Vorkommen) und Secret Resource
// (hidden="true", 7 je Warrior). Warrior ×2 →
// costTotals: pts 20, Casting Dice 6, Dispel Dice 0, Secret Resource 14.

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const WARRIOR_ID = 'entry-warrior';
const COST_TYPE_PTS = 'cost-pts';
const COST_TYPE_DICE = 'cost-dice';
const COST_TYPE_DISPEL = 'cost-dispel';
const COST_TYPE_SECRET = 'cost-secret';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes>
      <costType id="${COST_TYPE_PTS}" name="pts" defaultCostLimit="-1"/>
      <costType id="${COST_TYPE_DICE}" name="Casting Dice" defaultCostLimit="-1"/>
      <costType id="${COST_TYPE_DISPEL}" name="Dispel Dice" defaultCostLimit="-1"/>
      <costType id="${COST_TYPE_SECRET}" name="Secret Resource" defaultCostLimit="-1" hidden="true"/>
    </costTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <costs>
          <cost name="pts" typeId="${COST_TYPE_PTS}" value="10"/>
          <cost name="Casting Dice" typeId="${COST_TYPE_DICE}" value="3"/>
          <cost name="Secret Resource" typeId="${COST_TYPE_SECRET}" value="7"/>
        </costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

function appSystem() {
  return {
    id: 'system-uuid',
    name: 'Test System',
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
    costLimitType: COST_TYPE_PTS,
    forces: [
      {
        id: 'force-uuid-1',
        forceEntryId: FORCE_DEF_ID,
        catalogueId: 'cat-main',
        selections: [
          {
            id: 'sel-warrior',
            name: 'Warrior',
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

const renderPlayMode = () =>
  render(
    <PlayMode
      system={appSystem()}
      roster={appRoster()}
      onBack={vi.fn()}
      onReportError={vi.fn()}
    />
  );

const resourceBarText = (container) => {
  const bar = container.querySelector('.play-resource-bar');
  return bar === null ? '' : bar.textContent.replace(/\s+/g, ' ').trim();
};

describe('PlayMode: Extra-Ressourcen des Kopfes aus costTotals × description.costTypes (Issue 0121, Task 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zeigt eine Nicht-Limit-Kostenart mit Summe ≠ 0 als Ressourcen-Badge (6 Casting Dice)', () => {
    const { container } = renderPlayMode();

    expect(resourceBarText(container)).toContain('6 Casting Dice');
  });

  it('zeigt den Solver-Giftwert nicht: die Leiste haengt nicht mehr an getExtraResourceTotals/calculateRosterCosts', () => {
    const { container } = renderPlayMode();

    expect(container.textContent).not.toContain('POISON-RES');
    expect(container.textContent).not.toContain('777');
    expect(container.textContent).not.toContain('999999');
  });

  it('die Limit-Kostenart selbst erscheint nicht als Ressource (kein pts-Badge)', () => {
    const { container } = renderPlayMode();

    expect(resourceBarText(container)).not.toContain('pts');
  });

  it('Rand: eine deklarierte Kostenart ohne Vorkommen (Summe 0) erscheint nicht', () => {
    const { container } = renderPlayMode();

    expect(resourceBarText(container)).not.toContain('Dispel Dice');
  });

  it('Vertragsentscheidung: eine hidden-Kostenart bleibt ausgeschlossen (bestehende Observable), auch mit Summe ≠ 0', () => {
    const { container } = renderPlayMode();

    expect(resourceBarText(container)).not.toContain('Secret Resource');
  });
});
