/**
 * Issue 0121, Task 7 — die Punkteanzeige des Editors (RosterEditorTopBar)
 * kommt aus den `costTotals` des Evaluator-Berichts (Ist-Stand) plus dem
 * Roster-Limit — nicht mehr aus `calculateRosterCosts` des Solvers
 * (test-first; die neue Implementierung existiert noch nicht).
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ──────────────────────────────
 * `calculateRosterCosts` und `getExtraResourceTotals` sind als GIFT-Stubs
 * gemockt (999999 bzw. POISON-Ressource): speist der Editor seine Anzeige noch
 * aus dem Solver, erscheint der Giftwert statt des Berichtswerts. Der
 * Evaluator-Pfad laeuft ECHT (system.rawXmls); die Erwartung 20 pts (Warrior
 * ×2 × 10) wurde per Wegwerf-Skript gegen die echte Fassade verifiziert.
 *
 * Struktur-Helfer (findForceEntryById, childSelectionsOf, rosterSync) bleiben
 * in diesem Task ausdruecklich Solver-basiert und werden hier nicht geprueft;
 * `syncRosterSelectionsWithSystem` ist als Identitaet gestubbt, damit der
 * Abgleich am synthetischen System nicht dazwischenfunkt.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import RosterEditor from '../../../ui/components/RosterEditor';

vi.mock('lucide-react', () => ({
  Play: () => <span data-testid="icon-play" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Download: () => <span data-testid="icon-download" />,
  Undo2: () => <span data-testid="icon-undo" />,
  Redo2: () => <span data-testid="icon-redo" />,
}));

const mockUseSettings = vi.fn(() => ({ whfb6LinkingEnabled: false }));
vi.mock('../../../ui/viewmodels/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

vi.mock('../../../platform/persistence/database', () => ({
  saveRoster: vi.fn(),
}));

// Kind-Komponenten stummgeschaltet: unter Test steht allein die Punkteanzeige
// der Kopfleiste; der Editor-Hauptbereich und die Sidebar sind eigene Baustellen.
vi.mock('../../../ui/components/editor/ForceEditorSection', () => ({
  default: () => <div data-testid="force-editor-section" />,
}));
vi.mock('../../../ui/components/editor/RosterSidebar', () => ({
  default: () => <div data-testid="roster-sidebar" />,
}));
vi.mock('../../../ui/components/RulesIndexDialog', () => ({
  default: () => null,
}));

// Der Solver ist mit Issue 0121 geloescht; der fruehere Gift-Stub auf seine
// Fassade hat damit keinen Gegenstand mehr — dass die Anzeige aus dem Bericht
// kommt, ist jetzt strukturell garantiert.

// ── Synthetischer Datensatz (rawXmls-Muster wie rosterReportOf.test.js) ───────

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const WARRIOR_ID = 'entry-warrior';
const COST_TYPE_ID = 'cost-pts';
const WARRIOR_POINTS = 10;

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
        <costs>
          <cost name="pts" typeId="${COST_TYPE_ID}" value="${WARRIOR_POINTS}"/>
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

/** App-Roster: Warrior ×2 → Bericht: costTotals[pts] = 20; Limit 1000. */
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

const renderEditor = () =>
  render(
    <RosterEditor
      system={appSystem()}
      roster={appRoster()}
      onBack={vi.fn()}
      onPlay={vi.fn()}
      onExportRoster={vi.fn()}
      onReportError={vi.fn()}
    />
  );

describe('RosterEditor: Punkteanzeige aus costTotals + Roster-Limit (Issue 0121, Task 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('die Punkteanzeige der Kopfleiste zeigt Ist aus costTotals (20) und das Roster-Limit (1000)', () => {
    const { container } = renderEditor();

    const points = container.querySelector('.points-display');
    expect(points, 'Punkteanzeige der Kopfleiste').not.toBeNull();
    expect(points.textContent.replace(/\s+/g, ' ').trim()).toBe('20 / 1000');
  });

  it('der Solver-Giftwert erscheint nirgends: die Anzeige haengt nicht mehr an calculateRosterCosts', () => {
    const { container } = renderEditor();

    expect(container.textContent).not.toContain('999999');
    expect(container.textContent).not.toContain('POISON-RES');
  });
});
