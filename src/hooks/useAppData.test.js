import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useAppData from './useAppData';
import { getAllSystems, getAllRosters } from '../db/database';
import { runSystemMigrations } from '../db/migrations';
import { VIEWS } from '../constants/views';

vi.mock('../db/database', () => ({
  getAllSystems: vi.fn(),
  getAllRosters: vi.fn(),
}));

vi.mock('../db/migrations', () => ({
  runSystemMigrations: vi.fn(),
}));

vi.mock('../db/catalogUpdate', () => ({
  fetchCatalogText: vi.fn(),
}));

const system = { id: 'sys-1', name: 'Sys 1' };
const roster = { id: 'roster-1', name: 'Liste 1', systemId: 'sys-1' };

function renderAppData() {
  const showToast = vi.fn();
  const navigate = vi.fn();
  const view = renderHook(() => useAppData({ showToast, navigate }));
  return { showToast, navigate, ...view };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAllSystems.mockResolvedValue([system]);
  getAllRosters.mockResolvedValue([roster]);
  runSystemMigrations.mockResolvedValue({ systems: [system], failures: [] });
});

describe('useAppData — initiales Laden', () => {
  it('liest Systeme und Roster beim Mounten aus der DB', async () => {
    const { result } = renderAppData();

    await waitFor(() => expect(result.current.isDataLoaded).toBe(true));
    expect(result.current.systems).toEqual([system]);
    expect(result.current.rosters).toEqual([roster]);
  });

  it('aktualisiert den Katalog im Hintergrund und veröffentlicht die frischen Systeme', async () => {
    const refreshed = { id: 'sys-1', name: 'Sys 1 (neu)' };
    runSystemMigrations.mockResolvedValue({ systems: [refreshed], failures: [] });

    const { result } = renderAppData();

    await waitFor(() => expect(result.current.systems).toEqual([refreshed]));
  });

  it('meldet Systeme, die sich nicht aktualisieren ließen, per Toast', async () => {
    runSystemMigrations.mockResolvedValue({ systems: [system], failures: [{ id: 'sys-1', name: 'Sys 1' }] });

    const { result, showToast } = renderAppData();

    await waitFor(() => expect(result.current.isDataLoaded).toBe(true));
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Konnte folgende Systeme nicht aktualisieren'),
      'error'
    );
  });

  it('meldet einen Lesefehler und beendet trotzdem den Ladezustand', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getAllSystems.mockRejectedValue(new Error('IndexedDB weg'));

    const { result, showToast } = renderAppData();

    await waitFor(() => expect(result.current.isDataLoaded).toBe(true));
    expect(showToast).toHaveBeenCalledWith(
      'Die gespeicherten Spielsysteme und Listen konnten nicht geladen werden.',
      'error'
    );
    consoleErrorSpy.mockRestore();
  });
});

describe('useAppData — frisch importiertes System', () => {
  it('lädt lokal neu, wechselt ins Heerlager und stößt den Refresh an', async () => {
    const { result, navigate } = renderAppData();
    await waitFor(() => expect(result.current.isDataLoaded).toBe(true));
    navigate.mockClear();

    await act(async () => {
      await result.current.handleSystemImported();
    });

    expect(navigate).toHaveBeenCalledWith(VIEWS.ROSTERS);
    expect(getAllSystems).toHaveBeenCalled();
  });
});

describe('useAppData — Neuladen', () => {
  it('stellt setRosters zum optimistischen Veröffentlichen bereit', async () => {
    const { result } = renderAppData();
    await waitFor(() => expect(result.current.isDataLoaded).toBe(true));

    const nextRoster = { id: 'roster-2', name: 'Liste 2', systemId: 'sys-1' };
    act(() => result.current.setRosters(prev => [...prev, nextRoster]));

    expect(result.current.rosters).toContainEqual(nextRoster);
  });

  it('lädt bei loadAllData erneut aus der DB', async () => {
    const { result } = renderAppData();
    await waitFor(() => expect(result.current.isDataLoaded).toBe(true));
    getAllRosters.mockClear();

    await act(async () => {
      await result.current.loadAllData();
    });

    expect(getAllRosters).toHaveBeenCalled();
  });
});
