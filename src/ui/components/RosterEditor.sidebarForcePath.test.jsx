/**
 * Issue 0121, Pruefrunde 4, Befund A (Kriterien 3 und 5) — der Editor gibt der
 * Seitenleiste den Pfad des Kontingents, das sie meint.
 *
 * Die „Armeeanforderungen" der Seitenleiste zeigen das **erste** Kontingent des
 * Rosters. Unter welchem Pfad der Bericht dessen Slots fuehrt, weiss nur die
 * Zuordnung `pathByForceId` — der rohe Eingabe-Index stimmt nur, solange jede
 * Kontingent-Definition aufloest. Loest die erste nicht auf, liegt unter `"0"`
 * das **zweite** Kontingent.
 *
 * Sollverhalten an diesem Rand:
 * 1. Zwei aufloesbare Kontingente → die Seitenleiste bekommt `"0"` und zeigt die
 *    Kategorien des ERSTEN Kontingents (unveraendert zu heute).
 * 2. Erstes Kontingent unaufloesbar → sie zeigt **nicht** die Kategorien des
 *    zweiten, sondern gar keine; die Stuetze traegt keinen Pfad.
 * 3. Ein einziges, aufloesbares Kontingent → `"0"`, unveraendert
 *    (Regressionsschutz).
 *
 * **Vertrag (im Auftrag festgelegt, nicht hier erfunden):** die Stuetze heisst
 * `forcePath`; `null` heisst „der Bericht fuehrt fuer dieses Kontingent keine
 * Slots"; `RosterEditor` bildet sie aus `pathByForceId` und dem **ersten**
 * Kontingent des Rosters.
 *
 * Beobachtet wird beides: der Wert, der bei der Seitenleiste ankommt (die
 * Seitenleiste laeuft dabei ECHT weiter — der Mock reicht nur durch und
 * protokolliert), und was daraufhin im Dokument steht. „Kein Pfad" wird
 * tolerant geprueft (`null` **oder** `undefined`), wie in
 * `RosterEditor.forcePath.test.jsx`: die Kriterien legen nur fest, dass es kein
 * Pfad eines **anderen** Kontingents sein darf.
 *
 * Harness- und Fixture-Muster: `RosterEditor.forcePath.test.jsx` (echter
 * Evaluator-Pfad ueber `system.rawXmls`, Kind-Komponenten stummgeschaltet) —
 * diese Datei bleibt unberuehrt.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RosterEditor from './RosterEditor';

vi.mock('lucide-react', () => ({
  Play: () => <span data-testid="icon-play" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Download: () => <span data-testid="icon-download" />,
  Undo2: () => <span data-testid="icon-undo" />,
  Redo2: () => <span data-testid="icon-redo" />,
  Check: () => <span data-testid="icon-check" />,
  ShieldAlert: () => <span data-testid="icon-shield-alert" />,
  AlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  Info: () => <span data-testid="icon-info" />,
}));

const mockUseSettings = vi.fn(() => ({ whfb6LinkingEnabled: false }));
vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

vi.mock('../../data/db/database', () => ({
  saveRoster: vi.fn(),
}));

// Der Editor-Hauptbereich ist hier nicht unter Test.
vi.mock('./editor/ForceEditorSection', () => ({
  default: ({ force }) => <div data-testid={`force-section-${force.id}`} />,
}));
vi.mock('./RulesIndexDialog', () => ({
  default: () => null,
}));

// Die Seitenleiste laeuft ECHT — der Mock protokolliert nur, was bei ihr
// ankommt, und reicht unveraendert an die wirkliche Komponente durch. So haengt
// die Beobachtung nicht an einer Attrappe, und das Dokument zeigt, was der
// Nutzer saehe.
const receivedSidebarProps = [];
vi.mock('./editor/RosterSidebar', async (importOriginal) => {
  const actual = await importOriginal();
  const Real = actual.default;
  return {
    default: (props) => {
      receivedSidebarProps.push(props);
      return <Real {...props} />;
    },
  };
});

// ── Synthetischer Datensatz: zwei Kontingente mit je EIGENER Kategorie ───────

const GAME_SYSTEM_ID = 'gs-main';
const COST_TYPE_ID = 'cost-pts';
const CORE_CATEGORY_ID = 'cat-core';
const RARE_CATEGORY_ID = 'cat-rare';
const FIRST_FORCE_DEF_ID = 'force-main';
const SECOND_FORCE_DEF_ID = 'force-second';
const WARRIOR_ID = 'entry-warrior';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes>
      <costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/>
    </costTypes>
    <categoryEntries>
      <categoryEntry id="${CORE_CATEGORY_ID}" name="Core" hidden="false"/>
      <categoryEntry id="${RARE_CATEGORY_ID}" name="Rare" hidden="false"/>
    </categoryEntries>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FIRST_FORCE_DEF_ID}" name="Main Force" hidden="false">
        <categoryLinks>
          <categoryLink id="cl-core" name="Core" targetId="${CORE_CATEGORY_ID}" primary="false" hidden="false">
            <constraints>
              <constraint type="max" value="3" field="selections" scope="force" shared="true" id="c-core-max" percentValue="false" includeChildSelections="false" includeChildForces="false"/>
            </constraints>
          </categoryLink>
        </categoryLinks>
      </forceEntry>
      <forceEntry id="${SECOND_FORCE_DEF_ID}" name="Second Force" hidden="false">
        <categoryLinks>
          <categoryLink id="cl-rare" name="Rare" targetId="${RARE_CATEGORY_ID}" primary="false" hidden="false"/>
        </categoryLinks>
      </forceEntry>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <costs>
          <cost name="pts" typeId="${COST_TYPE_ID}" value="10"/>
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

function force(id, forceEntryId) {
  return { id, forceEntryId, catalogueId: 'cat-main', selections: [] };
}

function appRoster(forces) {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit: 1000,
    costLimitType: COST_TYPE_ID,
    forces,
  };
}

const renderEditor = (roster) =>
  render(
    <RosterEditor
      system={appSystem()}
      roster={roster}
      onBack={vi.fn()}
      onPlay={vi.fn()}
      onExportRoster={vi.fn()}
      onReportError={vi.fn()}
    />
  );

/**
 * Seit Issue 0164 fuehrt die Seitenleiste den Pfad nicht mehr als Stuetze: ihr
 * ViewModel liest ihn selbst aus `pathByForceId`. Beobachtbar ist er daher nur
 * noch an dem, was er bewirkt — den Anforderungszeilen.
 */
function sidebarRendered() {
  expect(receivedSidebarProps.length, 'Seitenleiste gerendert').toBeGreaterThan(0);
}

/** Die gerenderten Anforderungszeilen der Seitenleiste. */
function requirementRows() {
  return [...document.querySelectorAll('.sidebar-requirement-row')].map(
    (row) => row.textContent.replace(/\s+/g, ' ').trim()
  );
}

describe('RosterEditor: die Seitenleiste bekommt den Pfad des ERSTEN Kontingents (Issue 0121, Befund A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    receivedSidebarProps.length = 0;
  });

  it('zwei aufloesbare Kontingente: die Anforderungen sind die des ERSTEN', () => {
    renderEditor(appRoster([
      force('force-uuid-a', FIRST_FORCE_DEF_ID),
      force('force-uuid-b', SECOND_FORCE_DEF_ID),
    ]));

    sidebarRendered();
    expect(requirementRows()).toEqual(['Core:0 / Max: 3']);
  });

  it('zwei aufloesbare Kontingente: die Anforderungen zeigen „Core" des ersten, nicht „Rare" des zweiten', () => {
    renderEditor(appRoster([
      force('force-uuid-a', FIRST_FORCE_DEF_ID),
      force('force-uuid-b', SECOND_FORCE_DEF_ID),
    ]));

    expect(screen.getByText('Core:')).toBeTruthy();
    expect(screen.queryByText('Rare:')).toBeNull();
  });

  it('erstes Kontingent unaufloesbar: die Anforderungen zeigen NICHT die Kategorien des zweiten', () => {
    renderEditor(appRoster([
      force('force-uuid-gone', 'force-vanished'),
      force('force-uuid-b', SECOND_FORCE_DEF_ID),
    ]));

    expect(screen.queryByText('Rare:')).toBeNull();
  });

  it('erstes Kontingent unaufloesbar: gar keine Anforderungszeile — der Bericht fuehrt fuer dieses Kontingent keine Slots', () => {
    renderEditor(appRoster([
      force('force-uuid-gone', 'force-vanished'),
      force('force-uuid-b', SECOND_FORCE_DEF_ID),
    ]));

    expect(requirementRows()).toEqual([]);
  });

  it('erstes Kontingent unaufloesbar: die Seitenleiste steht da, zeigt aber keine fremde Anforderung', () => {
    renderEditor(appRoster([
      force('force-uuid-gone', 'force-vanished'),
      force('force-uuid-b', SECOND_FORCE_DEF_ID),
    ]));

    sidebarRendered();
    expect(requirementRows()).toEqual([]);
  });

  it('ein einziges, aufloesbares Kontingent: "0" und seine Kategorien (Regressionsschutz)', () => {
    renderEditor(appRoster([force('force-uuid-a', FIRST_FORCE_DEF_ID)]));

    sidebarRendered();
    expect(requirementRows()).toEqual(['Core:0 / Max: 3']);
  });

  it('Rand: das ZWEITE Kontingent ist unaufloesbar — das erste behaelt seine Kategorien', () => {
    renderEditor(appRoster([
      force('force-uuid-a', FIRST_FORCE_DEF_ID),
      force('force-uuid-gone', 'force-vanished'),
    ]));

    sidebarRendered();
    expect(screen.getByText('Core:')).toBeTruthy();
  });

  it('Rand: ein einziges, unaufloesbares Kontingent — keine Anforderungen, kein Pfad', () => {
    renderEditor(appRoster([force('force-uuid-gone', 'force-vanished')]));

    sidebarRendered();
    expect(requirementRows()).toEqual([]);
  });

  it('Rand: Roster ohne Kontingente — keine Anforderungen, kein Pfad, kein Fehler', () => {
    renderEditor(appRoster([]));

    sidebarRendered();
    expect(requirementRows()).toEqual([]);
  });
});
