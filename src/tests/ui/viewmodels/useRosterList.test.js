import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useRosterList from '../../../ui/viewmodels/useRosterList';
import { saveRoster, deleteRoster } from '../../../platform/persistence/database';
import {
  exportRosterToXml,
  importRosterFromXml,
  MissingSystemError,
} from '../../../contexts/armylist/model/rosterSerialization';
import { readRosterText, buildRosterFile } from '../../../contexts/armylist/application/rosterTransfer';
import { RosterFileError } from '../../../contexts/armylist/model/rosterFileError.js';
import { syncRosterSelectionsWithSystem, reconcileImportedSelectionIds } from '../../../contexts/armylist/model';
import { evaluateAppRoster } from '../../../contexts/ruleengine/acl/evaluationCache';

vi.mock('../../../platform/persistence/database', () => ({
  saveRoster: vi.fn().mockResolvedValue(null),
  deleteRoster: vi.fn().mockResolvedValue(null),
}));

// Die Fehlerklassen bleiben echt: sie tragen die `messageKey`/`messageParams`
// der Fachlogik, und nur so prüft der Toast-Text wirklich, dass die Oberfläche
// sie übersetzt statt den Schlüssel durchzureichen.
vi.mock('../../../contexts/armylist/model/rosterSerialization', async (importOriginal) => ({
  ...await importOriginal(),
  exportRosterToXml: vi.fn(() => '<xml/>'),
  importRosterFromXml: vi.fn(),
}));

vi.mock('../../../contexts/armylist/application/rosterTransfer', async (importOriginal) => ({
  ...await importOriginal(),
  readRosterText: vi.fn(() => Promise.resolve('<xml/>')),
  buildRosterFile: vi.fn(() => Promise.resolve({ blob: new Blob(), fileName: 'r.rosz' })),
}));

// Der Export wertet nicht mehr selbst aus (Issue 0174, ADR-0039): der Bericht
// wird hier, in der UI-Schicht, geholt und hereingereicht.
vi.mock('../../../contexts/ruleengine/acl/evaluationCache', () => ({
  evaluateAppRoster: vi.fn(() => ({ costTotals: { pts: 0 }, slots: {} })),
}));

vi.mock('../../../contexts/armylist/model', () => ({
  syncRosterSelectionsWithSystem: vi.fn((roster) => roster),
  reconcileImportedSelectionIds: vi.fn((roster) => roster),
}));

const report = { costTotals: { pts: 0 }, slots: {} };
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

  it('formuliert ein fehlendes Spielsystem als übersetzten Text, nicht als Schlüssel', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    importRosterFromXml.mockImplementationOnce(() => {
      throw new MissingSystemError('System X', 'sys-x');
    });
    const { result, deps } = setup();

    await act(async () => {
      await result.current.importRoster(new Blob());
    });

    expect(deps.showToast).toHaveBeenCalledWith(
      'Das Spielsystem "System X" (ID: sys-x) fehlt. Bitte importiere es zuerst.',
      'error',
    );
    consoleErrorSpy.mockRestore();
  });

  it('formuliert ein ungültiges Wurzelelement als übersetzten Text', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    importRosterFromXml.mockImplementationOnce(() => {
      throw new RosterFileError('serialization.invalidFormat');
    });
    const { result, deps } = setup();

    await act(async () => {
      await result.current.importRoster(new Blob());
    });

    expect(deps.showToast).toHaveBeenCalledWith(
      'Fehler beim Importieren: Ungültiges Dateiformat: Das Wurzelelement muss <roster> sein.',
      'error',
    );
    consoleErrorSpy.mockRestore();
  });

  it('formuliert ein beschädigtes Archiv als übersetzten Text mit technischer Ergänzung', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    readRosterText.mockRejectedValueOnce(
      new RosterFileError('serialization.damagedArchive', null, 'zip: end of central directory not found'),
    );
    const { result, deps } = setup();

    await act(async () => {
      await result.current.importRoster(new Blob());
    });

    expect(deps.showToast).toHaveBeenCalledWith(
      'Fehler beim Importieren: Die Datei ist ein beschädigtes ZIP-Archiv und konnte nicht entpackt werden. (zip: end of central directory not found)',
      'error',
    );
    consoleErrorSpy.mockRestore();
  });

  it('meldet ein ungültiges Dateiformat generisch', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    readRosterText.mockRejectedValueOnce(new Error('kaputt'));
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

  it('formuliert einen Fehler des Datei-Austauschs als übersetzten Text', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    buildRosterFile.mockRejectedValueOnce(
      new RosterFileError('serialization.damagedArchive', null, 'zip: write failed'),
    );
    const { result, deps } = setup();

    await act(async () => {
      await result.current.exportRoster(roster);
    });

    expect(deps.showToast).toHaveBeenCalledWith(
      'Fehler beim Exportieren: Die Datei ist ein beschädigtes ZIP-Archiv und konnte nicht entpackt werden. (zip: write failed)',
      'error',
    );
    consoleErrorSpy.mockRestore();
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

    expect(evaluateAppRoster).toHaveBeenCalledWith(system, roster);
    expect(exportRosterToXml).toHaveBeenCalledWith(roster, system, report);
    expect(buildRosterFile).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
