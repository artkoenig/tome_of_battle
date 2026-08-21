/**
 * Issue 0121, Task 18 (Kriterien 3 und 5) — der Editor sucht die Slots eines
 * Kontingents unter dem Pfad, unter dem der **Bericht** sie fuehrt.
 *
 * `RosterEditor` gibt jeder `ForceEditorSection` heute den rohen Eingabe-Index
 * (`forcePath={String(forceIndex)}`). Loest ein Kontingent nicht auf, haengt die
 * Engine es nicht in den Baum — jedes **folgende** Kontingent liegt dann unter
 * einem um eins kleineren Pfad, und die Sektion greift ins Leere: keine
 * Aushebe-Kandidaten, keine Kategorie-Grenzen, stillschweigend.
 *
 * Sollverhalten, beobachtet an der Stuetze, die die Sektion bekommt:
 * 1. Bei einem unaufloesbaren Kontingent an erster Stelle bekommt das zweite den
 *    Pfad, unter dem der Bericht es fuehrt (`"0"`).
 * 2. Ein Kontingent, das selbst nicht aufloest, bekommt **keinen** Pfad — es
 *    zeigt dann keine fremden Angebote, sondern gar keine.
 * 3. Ohne unaufloesbares Kontingent aendert sich nichts: `"0"`, `"1"`, …
 *
 * Der Pfad kommt aus der Zuordnung `pathByForceId` (`Map<force.id, slotPfad>`,
 * Vertrag aus Task 18), nicht aus dem Schleifenindex. Beobachtet wird hier nur
 * das Ergebnis: welcher Pfad bei der Sektion ankommt.
 *
 * „Kein Pfad" wird bewusst tolerant geprueft (`null` **oder** `undefined`) — die
 * Kriterien legen nur fest, dass es kein Pfad **eines anderen** Kontingents sein
 * darf.
 *
 * Harness- und Fixture-Muster: `RosterEditor.evaluator.test.jsx` (echter
 * Evaluator-Pfad ueber `system.rawXmls`, Kind-Komponenten stummgeschaltet).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import RosterEditor from './RosterEditor';

vi.mock('lucide-react', () => ({
  Play: () => <span data-testid="icon-play" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Download: () => <span data-testid="icon-download" />,
  Undo2: () => <span data-testid="icon-undo" />,
  Redo2: () => <span data-testid="icon-redo" />,
}));

const mockUseSettings = vi.fn(() => ({ whfb6LinkingEnabled: false }));
vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

vi.mock('../../data/db/database', () => ({
  saveRoster: vi.fn(),
}));

/**
 * Die Sektionen sind hier reine Beobachter: sie melden, welchen `forcePath` sie
 * zu welchem Kontingent bekommen haben.
 */
const receivedForcePaths = [];
vi.mock('./editor/ForceEditorSection', () => ({
  default: ({ force, forcePath }) => {
    receivedForcePaths.push({ forceId: force.id, forcePath });
    return <div data-testid={`force-section-${force.id}`} />;
  },
}));
vi.mock('./editor/RosterSidebar', () => ({
  default: () => <div data-testid="roster-sidebar" />,
}));
vi.mock('./RulesIndexDialog', () => ({
  default: () => null,
}));

// ── Synthetischer Datensatz (rawXmls-Muster wie RosterEditor.evaluator.test.jsx) ──

const GAME_SYSTEM_ID = 'gs-main';
const FIRST_FORCE_DEF_ID = 'force-main';
const SECOND_FORCE_DEF_ID = 'force-second';
const WARRIOR_ID = 'entry-warrior';
const COST_TYPE_ID = 'cost-pts';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes>
      <costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/>
    </costTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FIRST_FORCE_DEF_ID}" name="Main Force"/>
      <forceEntry id="${SECOND_FORCE_DEF_ID}" name="Second Force"/>
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
  return {
    id,
    forceEntryId,
    catalogueId: 'cat-main',
    selections: [{
      id: `sel-warrior-${id}`,
      name: 'Warrior',
      entryLinkId: null,
      selectionEntryId: WARRIOR_ID,
      number: 1,
      category: null,
      selections: [],
    }],
  };
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

/** Der zuletzt an die Sektion dieses Kontingents gereichte Pfad. */
function forcePathOf(forceId) {
  const seen = receivedForcePaths.filter((entry) => entry.forceId === forceId);
  expect(seen.length, `Sektion fuer ${forceId} gerendert`).toBeGreaterThan(0);
  return seen[seen.length - 1].forcePath;
}

describe('RosterEditor: der Pfad eines Kontingents kommt aus dem Bericht (Issue 0121, Task 18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    receivedForcePaths.length = 0;
  });

  it('ohne unaufloesbares Kontingent bleibt es bei "0", "1" (Regressionsschutz)', () => {
    renderEditor(appRoster([
      force('force-uuid-a', FIRST_FORCE_DEF_ID),
      force('force-uuid-b', SECOND_FORCE_DEF_ID),
    ]));

    expect(forcePathOf('force-uuid-a')).toBe('0');
    expect(forcePathOf('force-uuid-b')).toBe('1');
  });

  it('unaufloesbares erstes Kontingent: das zweite bekommt "0" — den Pfad, unter dem der Bericht seine Slots fuehrt', () => {
    renderEditor(appRoster([
      force('force-uuid-gone', 'force-vanished'),
      force('force-uuid-b', SECOND_FORCE_DEF_ID),
    ]));

    expect(forcePathOf('force-uuid-b')).toBe('0');
  });

  it('das unaufloesbare Kontingent selbst bekommt KEINEN Pfad (kein fremder, kein eigener)', () => {
    renderEditor(appRoster([
      force('force-uuid-gone', 'force-vanished'),
      force('force-uuid-b', SECOND_FORCE_DEF_ID),
    ]));

    expect(forcePathOf('force-uuid-gone') ?? null).toBeNull();
  });

  it('Rand: LETZTES Kontingent unaufloesbar — es bekommt keinen Pfad, das erste behaelt "0"', () => {
    renderEditor(appRoster([
      force('force-uuid-a', FIRST_FORCE_DEF_ID),
      force('force-uuid-gone', 'force-vanished'),
    ]));

    expect(forcePathOf('force-uuid-a')).toBe('0');
    expect(forcePathOf('force-uuid-gone') ?? null).toBeNull();
  });

  it('Rand: NUR ein unaufloesbares Kontingent — es bekommt keinen Pfad, nicht "0"', () => {
    renderEditor(appRoster([force('force-uuid-gone', 'force-vanished')]));

    expect(forcePathOf('force-uuid-gone') ?? null).toBeNull();
  });
});
