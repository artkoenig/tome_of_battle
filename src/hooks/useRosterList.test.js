import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useRosterList from './useRosterList';
import { saveRoster, deleteRoster } from '../db/database';
import {
  exportRosterToXml,
  importRosterFromXml,
  compressXmlToRosz,
  decompressRoszToXml,
  MissingSystemError,
} from '../utils/rosterSerialization';
import { syncRosterSelectionsWithSystem, reconcileImportedSelectionIds } from '../solver/validator';

vi.mock('../db/database', () => ({
  saveRoster: vi.fn().mockResolvedValue(null),
  deleteRoster: vi.fn().mockResolvedValue(null),
}));

const { MissingSystemErrorMock } = vi.hoisted(() => {
  class MissingSystemErrorMock extends Error {}
  return { MissingSystemErrorMock };
});

vi.mock('../utils/rosterSerialization', () => ({
  MissingSystemError: MissingSystemErrorMock,
  exportRosterToXml: vi.fn(() => '<xml/>'),
  importRosterFromXml: vi.fn(),
  compressXmlToRosz: vi.fn(() => Promise.resolve(new Blob())),
  decompressRoszToXml: vi.fn(() => Promise.resolve('<xml/>')),
}));

vi.mock('../solver/validator', () => ({
  syncRosterSelectionsWithSystem: vi.fn((roster) => roster),
  reconcileImportedSelectionIds: vi.fn((roster) => roster),
}));

const system = { id: 'sys-1', name: 'Sys', costTypes: [{ id: 'pts' }], forceEntries: [{ id: 'force-a' }] };
const roster = { id: 'roster-1', name: 'Alte Liste', systemId: 'sys-1' };

function setup(overrides = {}) {
  const deps = {
    systems: [system],
    rosters: [roster],
    setRosters: vi.fn(),
    reloadData: vi.fn(),
    navigate: vi.fn(),
    showToast: vi.fn(),
    ...overrides,
  };
  const view = renderHook((props) => useRosterList(props), { initialProps: deps });
  return { deps, ...view };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRosterList — Anlegen', () => {
  const form = { name: 'Neu', systemId: 'sys-1', catId: 'cat-1', forceEntryId: 'force-a', limit: '1000' };

  it('speichert, veröffentlicht optimistisch, lädt neu und öffnet den Editor', async () => {
    const { result, deps } = setup();

    await act(async () => {
      await result.current.createRoster(form);
    });

    expect(saveRoster).toHaveBeenCalledTimes(1);
    expect(deps.setRosters).toHaveBeenCalled();
    expect(deps.reloadData).toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalledWith('builder', expect.any(String));
    expect(result.current.isNewRosterModalOpen).toBe(false);
  });

  it('bricht mit Fehler-Toast ab, wenn Pflichtfelder fehlen', async () => {
    const { result, deps } = setup();

    await act(async () => {
      await result.current.createRoster({ name: '', systemId: 'sys-1', catId: 'cat-1' });
    });

    expect(deps.showToast).toHaveBeenCalledWith('Bitte fülle alle Felder aus.', 'error');
    expect(saveRoster).not.toHaveBeenCalled();
  });

  it('meldet einen Fehlschlag beim Speichern', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    saveRoster.mockRejectedValueOnce(new Error('DB voll'));
    const { result, deps } = setup();

    await act(async () => {
      await result.current.createRoster(form);
    });

    expect(deps.showToast).toHaveBeenCalledWith('Fehler beim Erstellen der Liste.', 'error');
    consoleErrorSpy.mockRestore();
  });
});

describe('useRosterList — Öffnen und Abspielen', () => {
  it('navigiert beim Öffnen zur Zielansicht', () => {
    const { result, deps } = setup();
    act(() => result.current.openRoster(roster, 'builder'));
    expect(deps.navigate).toHaveBeenCalledWith('builder', 'roster-1');
  });

  it('meldet ein fehlendes Spielsystem statt zu navigieren', () => {
    const { result, deps } = setup();
    act(() => result.current.openRoster({ id: 'r', systemId: 'weg' }));
    expect(deps.showToast).toHaveBeenCalledWith(expect.stringContaining('Spielsystem wurde gelöscht'), 'error');
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it('übernimmt den Editor-Stand in die Liste und wechselt in den Spielmodus', () => {
    const { result, deps } = setup();
    const edited = { ...roster, name: 'Im Editor geändert' };

    act(() => result.current.playRoster(edited));

    expect(deps.setRosters).toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalledWith('play', 'roster-1');
  });
});

describe('useRosterList — Löschen', () => {
  it('merkt sich das zu löschende Roster und stoppt die Event-Propagation', () => {
    const { result } = setup();
    const stopPropagation = vi.fn();

    act(() => result.current.requestRosterDeletion('roster-1', { stopPropagation }));

    expect(stopPropagation).toHaveBeenCalled();
    expect(result.current.rosterToDelete).toEqual(roster);
  });

  it('löscht nach Bestätigung und lädt neu', async () => {
    const { result, deps } = setup();
    act(() => result.current.requestRosterDeletion('roster-1', { stopPropagation() {} }));

    await act(async () => {
      await result.current.confirmRosterDeletion();
    });

    expect(deleteRoster).toHaveBeenCalledWith('roster-1');
    expect(deps.reloadData).toHaveBeenCalled();
    expect(result.current.rosterToDelete).toBeNull();
  });

  it('meldet einen Fehlschlag beim Löschen', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    deleteRoster.mockRejectedValueOnce(new Error('DB blockiert'));
    const { result, deps } = setup();
    act(() => result.current.requestRosterDeletion('roster-1', { stopPropagation() {} }));

    await act(async () => {
      await result.current.confirmRosterDeletion();
    });

    expect(deps.showToast).toHaveBeenCalledWith('Die Liste konnte nicht gelöscht werden.', 'error');
    consoleErrorSpy.mockRestore();
  });

  it('verwirft die Löschabsicht beim Abbrechen', () => {
    const { result } = setup();
    act(() => result.current.requestRosterDeletion('roster-1', { stopPropagation() {} }));
    act(() => result.current.cancelRosterDeletion());
    expect(result.current.rosterToDelete).toBeNull();
  });
});

describe('useRosterList — Umbenennen', () => {
  it('speichert den getrimmten neuen Namen und lädt neu', async () => {
    const { result, deps } = setup();

    await act(async () => {
      await result.current.renameRoster(roster, '  Neuer Name  ');
    });

    expect(saveRoster).toHaveBeenCalledWith({ ...roster, name: 'Neuer Name' });
    expect(deps.reloadData).toHaveBeenCalled();
  });

  it('tut nichts bei leerem oder unverändertem Namen', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.renameRoster(roster, '   ');
      await result.current.renameRoster(roster, 'Alte Liste');
    });

    expect(saveRoster).not.toHaveBeenCalled();
  });

  it('meldet einen Fehlschlag beim Umbenennen', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    saveRoster.mockRejectedValueOnce(new Error('DB voll'));
    const { result, deps } = setup();

    await act(async () => {
      await result.current.renameRoster(roster, 'Neuer Name');
    });

    expect(deps.showToast).toHaveBeenCalledWith('Die Liste konnte nicht umbenannt werden.', 'error');
    consoleErrorSpy.mockRestore();
  });
});

describe('useRosterList — Import', () => {
  it('richtet importierte Auswahlen aus und speichert', async () => {
    importRosterFromXml.mockReturnValue({ ...roster, name: 'Importiert' });
    const { result, deps } = setup();

    await act(async () => {
      await result.current.importRoster(new Blob());
    });

    expect(reconcileImportedSelectionIds).toHaveBeenCalled();
    expect(syncRosterSelectionsWithSystem).toHaveBeenCalled();
    expect(saveRoster).toHaveBeenCalled();
    expect(deps.showToast).toHaveBeenCalledWith('Erfolgreich importiert: Importiert');
    expect(deps.reloadData).toHaveBeenCalled();
  });

  it('meldet ein fehlendes Spielsystem über die MissingSystemError-Meldung', async () => {
    decompressRoszToXml.mockRejectedValueOnce(new MissingSystemError('System X fehlt'));
    const { result, deps } = setup();

    await act(async () => {
      await result.current.importRoster(new Blob());
    });

    expect(deps.showToast).toHaveBeenCalledWith('System X fehlt', 'error');
  });

  it('meldet ein ungültiges Dateiformat generisch', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    decompressRoszToXml.mockRejectedValueOnce(new Error('kaputt'));
    const { result, deps } = setup();

    await act(async () => {
      await result.current.importRoster(new Blob());
    });

    expect(deps.showToast).toHaveBeenCalledWith('Fehler beim Importieren: kaputt', 'error');
    consoleErrorSpy.mockRestore();
  });
});

describe('useRosterList — Export', () => {
  it('meldet ein fehlendes Spielsystem statt zu exportieren', async () => {
    const { result, deps } = setup();

    await act(async () => {
      await result.current.exportRoster({ id: 'r', name: 'X', systemId: 'weg' });
    });

    expect(deps.showToast).toHaveBeenCalledWith(expect.stringContaining('Der Export kann nicht durchgeführt werden.'), 'error');
    expect(exportRosterToXml).not.toHaveBeenCalled();
  });

  it('serialisiert und stößt den Download an', async () => {
    const createObjectURL = vi.fn(() => 'blob:url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { result } = setup();

    await act(async () => {
      await result.current.exportRoster(roster);
    });

    expect(exportRosterToXml).toHaveBeenCalledWith(roster, system);
    expect(compressXmlToRosz).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
