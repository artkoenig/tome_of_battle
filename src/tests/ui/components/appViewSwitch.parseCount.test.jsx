/**
 * Issue 0168, AC3 — ein Ansichtswechsel parst keine Kataloge.
 *
 * Vorher hing an jedem Navigationsklick `loadAllData()`: erneutes Lesen aus der
 * IndexedDB, Start-Migration und Katalog-Abgleich. Die Migration parste dabei
 * jedes gespeicherte System neu — Megabyte an XML pro Klick — und lieferte ein
 * neues System-Objekt, womit auch der identitaetsbasierte Auswertungs-Cache
 * verfiel.
 *
 * Diese Datei misst das an der einzigen Stelle, an der es sich zeigt: der Zaehler
 * des echten Parsers ueber einen Wechsel Heerlager → Importer → Heerlager.
 * Startlauf und Wiedereintritt sind seither getrennte Aufrufe; die Navigation
 * ruft keinen von beiden.
 *
 * `src/platform/persistence/migrations.js` laeuft hier **echt** — nur die IndexedDB und die
 * Bildschirme sind Attrappen.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { JSDOM } from 'jsdom';

vi.mock('../../../platform/persistence/database', () => ({
  getAllSystems: vi.fn().mockResolvedValue([]),
  getAllRosters: vi.fn().mockResolvedValue([]),
  saveSystem: vi.fn().mockResolvedValue(null),
  saveRoster: vi.fn().mockResolvedValue(null),
  deleteRoster: vi.fn().mockResolvedValue(null),
  getWhfb6LinkingEnabled: vi.fn().mockResolvedValue(true),
  setWhfb6LinkingEnabled: vi.fn().mockResolvedValue(undefined),
  WHFB6_LINKING_DEFAULT: true,
  getDashboardFilter: vi.fn().mockResolvedValue({ systemIds: [], factionIds: [] }),
  setDashboardFilter: vi.fn().mockResolvedValue(undefined),
  DASHBOARD_FILTER_DEFAULT: { systemIds: [], factionIds: [] },
}));

// Der echte Parser, aber zaehlbar — der Zaehler ist hier Vertragsgegenstand.
vi.mock('../../../platform/battlescribe/xmlParser', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, processImportedData: vi.fn(actual.processImportedData) };
});

vi.mock('../../../ui/components/Importer', () => ({
  default: () => <div data-testid="importer-mock">Importer Mock</div>,
}));
vi.mock('../../../ui/components/RosterEditor', () => ({ default: () => <div data-testid="editor-mock" /> }));
vi.mock('../../../ui/components/PlayMode', () => ({ default: () => <div data-testid="playmode-mock" /> }));
vi.mock('../../../ui/components/editor/NewRosterModal', () => ({ default: () => <div data-testid="new-roster-modal-mock" /> }));
vi.mock('../../../ui/components/RosterDashboard', () => ({
  default: () => <div data-testid="dashboard-mock">RosterDashboard Mock</div>,
}));

import App from '../../../ui/App';
import { getAllSystems } from '../../../platform/persistence/database';
import { processImportedData } from '../../../platform/battlescribe/xmlParser';
import { PARSER_VERSION } from '../../../platform/battlescribe/parserVersion';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="sys-local" name="Stored System">
    <categoryEntries>
      <categoryEntry id="cat-hq" name="HQ"/>
    </categoryEntries>
  </gameSystem>`;

/**
 * Ein gespeichertes System. Seine Id gehoert keiner konfigurierten Katalogquelle,
 * also fasst die Migration kein Netz an und faellt auf den lokalen Zweig zurueck —
 * genau den, der frueher immer neu parste.
 */
function storedSystem(extra = {}) {
  return {
    id: 'sys-local',
    name: 'Stored System',
    rawXmls: { gst: [{ name: 'sys.gst', content: GAME_SYSTEM_XML }], cat: [] },
    ...extra,
  };
}

/** Heerlager → Importer → Heerlager, jeweils auf der Desktop-Navigation. */
async function switchViewsBackAndForth() {
  await act(async () => { fireEvent.click(screen.getAllByTestId('nav-importer')[0]); });
  await waitFor(() => expect(screen.queryByTestId('importer-mock')).not.toBeNull());
  await act(async () => { fireEvent.click(screen.getAllByTestId('nav-rosters')[0]); });
  await waitFor(() => expect(screen.queryByTestId('dashboard-mock')).not.toBeNull());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Issue 0168: ein Ansichtswechsel parst keine Kataloge', () => {
  it('zaehlt null Parse-Aufrufe ueber einen Ansichtswechsel', async () => {
    getAllSystems.mockResolvedValue([storedSystem({ parserVersion: PARSER_VERSION })]);

    render(<App />);
    await waitFor(() => expect(screen.queryByTestId('dashboard-mock')).not.toBeNull());
    // Der Startlauf selbst parst nichts: das gespeicherte System traegt den
    // aktuellen Parser-Stand.
    await waitFor(() => expect(getAllSystems).toHaveBeenCalledTimes(1));
    expect(processImportedData).not.toHaveBeenCalled();

    await switchViewsBackAndForth();

    expect(processImportedData).not.toHaveBeenCalled();
    // Und auch kein erneutes Lesen aus der Datenbank — der Startlauf haengt nicht
    // mehr an der Navigation.
    expect(getAllSystems).toHaveBeenCalledTimes(1);
  });

  it('parst einen Bestand ohne Marker einmal beim Start und danach nicht mehr', async () => {
    getAllSystems.mockResolvedValue([storedSystem()]);

    render(<App />);
    await waitFor(() => expect(screen.queryByTestId('dashboard-mock')).not.toBeNull());
    await waitFor(() => expect(processImportedData).toHaveBeenCalledTimes(1));

    await switchViewsBackAndForth();

    expect(processImportedData).toHaveBeenCalledTimes(1);
  });
});
