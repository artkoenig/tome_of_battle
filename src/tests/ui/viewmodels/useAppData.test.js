import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useAppData from '../../../ui/viewmodels/useAppData';
import { getAllSystems, getAllRosters } from '../../../platform/persistence/database';
import { runSystemMigrations, runGameStateMigration } from '../../../platform/persistence/migrations';
import { VIEWS } from '../../../ui/constants/views';
import { DATA_EVENT, emitDataChange } from '../../../shared/events/dataEvents';

vi.mock('../../../platform/persistence/database', () => ({
  getAllSystems: vi.fn(),
  getAllRosters: vi.fn(),
}));

vi.mock('../../../platform/persistence/migrations', () => ({
  runSystemMigrations: vi.fn(),
  // Der Startlauf hebt seit Issue 0190 den alten `gameState` in den
  // `games`-Store, bevor er die Listen liest.
  runGameStateMigration: vi.fn(),
}));

vi.mock('../../../platform/persistence/catalogUpdate', () => ({
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
  runGameStateMigration.mockResolvedValue({ movedGames: 0, cleanedRosters: 0 });
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

  // Issue 0168: der Wiedereintritt ist ein eigener Aufruf und liest nur lokal —
  // keine Start-Migration, kein Katalog-Abgleich, kein Neu-Parse.
  it('lädt bei reloadData erneut aus der DB, ohne die Start-Migration zu wiederholen', async () => {
    const { result } = renderAppData();
    await waitFor(() => expect(result.current.isDataLoaded).toBe(true));
    getAllRosters.mockClear();
    runSystemMigrations.mockClear();

    await act(async () => {
      await result.current.reloadData();
    });

    expect(getAllRosters).toHaveBeenCalled();
    expect(runSystemMigrations).not.toHaveBeenCalled();
  });
});

// Issue 0167 / ADR-0037: `useAppData` ist die eine Stelle, an der der
// Änderungs-Kanal der Datenschicht verdrahtet ist. Was über eine `application`-Schicht
// geschrieben wurde, steht danach in der Liste — ohne Navigationswechsel und
// ohne zweites Lesen aus der DB.
describe('useAppData — Änderungs-Kanal der Datenschicht', () => {
  it('übernimmt ein gespeichertes Roster ohne Navigationswechsel', async () => {
    const { result, navigate } = renderAppData();
    await waitFor(() => expect(result.current.isDataLoaded).toBe(true));
    getAllRosters.mockClear();
    const renamed = { ...roster, name: 'Umbenannt' };

    act(() => {
      emitDataChange({ type: DATA_EVENT.ROSTER_SAVED, roster: renamed });
    });

    expect(result.current.rosters).toEqual([renamed]);
    expect(getAllRosters).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('nimmt ein Roster auf, das die Liste noch nicht kennt', async () => {
    const { result } = renderAppData();
    await waitFor(() => expect(result.current.isDataLoaded).toBe(true));
    const added = { id: 'roster-2', name: 'Liste 2', systemId: 'sys-1' };

    act(() => {
      emitDataChange({ type: DATA_EVENT.ROSTER_SAVED, roster: added });
    });

    expect(result.current.rosters).toEqual([roster, added]);
  });

  it('entfernt ein gelöschtes Roster aus der Liste', async () => {
    const { result } = renderAppData();
    await waitFor(() => expect(result.current.isDataLoaded).toBe(true));

    act(() => {
      emitDataChange({ type: DATA_EVENT.ROSTER_DELETED, rosterId: roster.id });
    });

    expect(result.current.rosters).toEqual([]);
  });

  it('meldet sich beim Abräumen wieder ab', async () => {
    const { result, unmount } = renderAppData();
    await waitFor(() => expect(result.current.isDataLoaded).toBe(true));

    unmount();

    expect(() => emitDataChange({ type: DATA_EVENT.ROSTER_DELETED, rosterId: roster.id }))
      .not.toThrow();
    expect(result.current.rosters).toEqual([roster]);
  });
});
