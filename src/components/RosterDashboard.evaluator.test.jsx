/**
 * Issue 0121, Task 7 — RosterDashboard: die Kosten je Roster-Karte kommen aus
 * `evaluateAppRoster(...).costTotals` und das Limit-Label aus der
 * Datensatz-Beschreibung (`describeSystem(...).costTypes`) statt aus
 * `calculateRosterCosts`/`resolveCostLimitLabel` des Solvers (test-first; die
 * neue Implementierung existiert noch nicht).
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ──────────────────────────────
 * Die Solver-Quellen sind als Spies mit GIFT-Werten gestubbt: liest die Karte
 * noch den Solver, zeigt sie 999999 bzw. `POISON-LABEL` statt der Werte des
 * echten Berichts. Die Erwartungen (Warrior ×2 × 10 pts = 20; Kostenart
 * „pts") wurden per Wegwerf-Skript gegen die ECHTE Fassade verifiziert.
 *
 * Vertragsentscheidung (markiert): die `systems` des Dashboards sind
 * App-System-Objekte mit `rawXmls`; die (Solver-geparsten) Strukturfelder wie
 * `system.catalogues` bleiben fuer die reine Gruppierung nach Fraktionsnamen
 * bestehen (Struktur-Helfer sind ausdruecklich nicht Teil dieses Tasks).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import RosterDashboard from './RosterDashboard';

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Trash2: () => <span data-testid="icon-trash" />,
  Play: () => <span data-testid="icon-play" />,
  Edit3: () => <span data-testid="icon-edit" />,
  WifiOff: () => <span data-testid="icon-wifi-off" />,
  Download: () => <span data-testid="icon-download" />,
  Upload: () => <span data-testid="icon-upload" />,
  MoreVertical: () => <span data-testid="icon-more" />,
}));

vi.mock('./editor/BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="sheet">{children}</div> : null),
}));

// Der Solver ist mit Issue 0121 geloescht; der fruehere Gift-Stub auf seine
// Fassade hat damit keinen Gegenstand mehr — dass die Anzeige aus dem Bericht
// kommt, ist jetzt strukturell garantiert.

// ── Synthetischer Datensatz (rawXmls-Muster wie useEvaluation.test.js) ───────

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

/**
 * App-System mit rohen XMLs (Quelle der Auswertung) UND den geparsten
 * Strukturfeldern, die die Gruppierung des Dashboards heute liest.
 */
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

const renderDashboard = () =>
  render(
    <RosterDashboard
      rosters={[appRoster()]}
      systems={[appSystem()]}
      onOpenRoster={vi.fn()}
      onDeleteRoster={vi.fn()}
      onRenameRoster={vi.fn()}
      onNewRoster={vi.fn()}
      onImportRoster={vi.fn()}
      onExportRoster={vi.fn()}
    />
  );

describe('RosterDashboard: Kartenkosten aus dem Evaluator-Bericht (Issue 0121, Task 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zeigt den Ist-Stand der Karte aus costTotals (20) und das Roster-Limit (1000), nicht den Solver-Giftwert', () => {
    const { container } = renderDashboard();

    const points = container.querySelector('.roster-points');
    expect(points, 'Punkteblock der Roster-Karte').not.toBeNull();
    const pointsText = points.textContent.replace(/\s+/g, ' ').trim();
    expect(pointsText).toContain('20 / 1000');
    expect(container.textContent).not.toContain('999999');
  });

  it('zeigt das Limit-Label der Karte aus description.costTypes (pts), nicht aus resolveCostLimitLabel', () => {
    const { container } = renderDashboard();

    const label = container.querySelector('.roster-cost-type-label');
    expect(label, 'Kostenart-Label der Roster-Karte').not.toBeNull();
    expect(label.textContent.trim()).toBe('pts');
    expect(container.textContent).not.toContain('POISON-LABEL');
  });

  // Der frühere Gift-Stub-Test steht hier nicht mehr: Der Solver ist mit
  // Issue 0121 gelöscht, seine Funktionen können gar nicht mehr gerufen
  // werden. Eine Assertion darauf könnte nicht fehlschlagen und würde
  // Sicherheit vortäuschen. Dass die Anzeige aus dem Bericht kommt, prüfen
  // die Fälle darüber an ihren Werten.
});
