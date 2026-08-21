import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * Issue 0165, AC1, AC3 and AC5 — the import shell's ViewModel.
 *
 * Two things are pinned here beyond the plain state: the screen no longer holds
 * its own system list (it takes the app's, so a finished import is visible
 * everywhere at once), and the two absorbed display modules
 * (`importer/importMessages.js`, `importer/revisionDisplay.js`) live on as
 * exports of this ViewModel.
 *
 * The catalog index and the import completion are the network/DB seams and are
 * mocked; the message and revision derivations are production code.
 */
const loadAvailableSystemsFromSources = vi.fn();
const completeSystemImport = vi.fn();
const deleteSystem = vi.fn();

vi.mock('../../data/db/catalogSourceIndex', () => ({
  loadAvailableSystemsFromSources: (...args) => loadAvailableSystemsFromSources(...args),
}));
vi.mock('../../data/db/systemImport', () => ({
  completeSystemImport: (...args) => completeSystemImport(...args),
  SYSTEM_IMPORT_STATUS: { COMPLETED: 'completed', MISSING_LIBRARY_DEPENDENCIES: 'missing-library-dependencies' },
}));
vi.mock('../../data/db/database', () => ({
  deleteSystem: (...args) => deleteSystem(...args),
}));

const {
  useImporter,
  buildRevisionDisplay,
  revisionLabelClassName,
  buildImportSuccessMessage,
  buildFailedCatalogueMessage,
  buildMissingLibraryDependencyMessage,
  REVISION_TONE,
} = await import('./useImporter');

const INDEX_SYSTEM = {
  id: 'sys1',
  name: 'Warhammer',
  rawBaseUrl: 'https://example.invalid/raw',
  gst: { fileName: 'wh.gst', revision: 5 },
  catalogues: [
    { id: 'cat1', name: 'Bretonnia', fileName: 'bret.cat', revision: 3 },
    { id: 'cat2', name: 'Empire', fileName: 'emp.cat', revision: 2 },
  ],
};

const renderImporter = (props = {}) => renderHook(() => useImporter(props));

beforeEach(() => {
  loadAvailableSystemsFromSources.mockReset();
  completeSystemImport.mockReset();
  deleteSystem.mockReset();
  loadAvailableSystemsFromSources.mockResolvedValue({ systems: [INDEX_SYSTEM], anyIndexReachable: true });
});

describe('useImporter', () => {
  it('preselects the first system of the index with all its catalogues', async () => {
    const { result } = renderImporter();

    await waitFor(() => expect(result.current.bundle.hasIndex).toBe(true));
    expect(result.current.selectedBundleSysId).toBe('sys1');
    expect(result.current.bundle.selectedCount).toBe(2);
    expect(result.current.bundle.allChecked).toBe(true);
    expect(result.current.bundle.catalogues.every(c => c.isSelected)).toBe(true);
  });

  it('reads the installed systems from the list it is handed, never from the database', async () => {
    const stored = { id: 'sys1', name: 'Warhammer', catalogues: [{ id: 'cat1', revision: 1 }], gst: { revision: 4 } };
    const { result, rerender } = renderHook(
      ({ systems }) => useImporter({ systems }),
      { initialProps: { systems: [] } }
    );

    await waitFor(() => expect(result.current.bundle.hasIndex).toBe(true));
    // Nothing installed yet: the available revision reads as new.
    expect(result.current.bundle.revisionDisplay.tone).toBe(REVISION_TONE.SUBTLE);

    // The app publishes a fresh list — the screen follows it without reloading.
    rerender({ systems: [stored] });
    expect(result.current.systems).toEqual([stored]);
    expect(result.current.bundle.revisionDisplay.tone).toBe(REVISION_TONE.ACCENT);
    expect(result.current.bundle.catalogues[0].revisionDisplay.tone).toBe(REVISION_TONE.ACCENT);
  });

  it('lets the app reload the one list after a completed import', async () => {
    completeSystemImport.mockResolvedValue({
      status: 'completed',
      system: { name: 'Warhammer', catalogues: [{ id: 'cat1' }, { id: 'cat2' }] },
      failedCatalogues: [],
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '<xml/>' });
    const onSystemImported = vi.fn();

    const { result } = renderImporter({ onSystemImported });
    await waitFor(() => expect(result.current.bundle.hasIndex).toBe(true));

    await act(async () => { await result.current.importSelectedBundle(); });

    expect(completeSystemImport).toHaveBeenCalledTimes(1);
    expect(onSystemImported).toHaveBeenCalledTimes(1);
    expect(result.current.successMsg).toContain('Warhammer');
    expect(result.current.loading).toBe(false);
  });

  it('carries a catalogue failure into the app-wide channel and its own banner', async () => {
    completeSystemImport.mockResolvedValue({
      status: 'completed',
      system: { name: 'Warhammer', catalogues: [{ id: 'cat1' }] },
      failedCatalogues: [{ fileName: 'emp.cat', message: 'kaputt' }],
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '<xml/>' });
    const onReportError = vi.fn();

    const { result } = renderImporter({ onReportError });
    await waitFor(() => expect(result.current.bundle.hasIndex).toBe(true));
    await act(async () => { await result.current.importSelectedBundle(); });

    expect(result.current.error).toContain('emp.cat');
    expect(onReportError).toHaveBeenCalledWith(result.current.error);
  });

  it('rejects an upload that is not a zip archive without touching the import', async () => {
    const { result } = renderImporter();
    await waitFor(() => expect(result.current.bundle.hasIndex).toBe(true));

    await act(async () => {
      await result.current.pickUploadFile({ target: { files: [new File(['x'], 'army.ros')] } });
    });

    expect(completeSystemImport).not.toHaveBeenCalled();
    expect(result.current.error).toBeTruthy();
  });

  it('asks before deleting a system and reloads the one list afterwards', async () => {
    deleteSystem.mockResolvedValue(undefined);
    const onSystemImported = vi.fn();
    const stored = { id: 'sys1', name: 'Warhammer', catalogues: [] };

    const { result } = renderImporter({ systems: [stored], onSystemImported });
    await waitFor(() => expect(result.current.bundle.hasIndex).toBe(true));

    act(() => result.current.requestDelete('sys1'));
    expect(result.current.systemToDelete).toBe(stored);

    await act(async () => { await result.current.confirmDelete(); });
    expect(deleteSystem).toHaveBeenCalledWith('sys1');
    expect(result.current.systemToDelete).toBeNull();
    expect(onSystemImported).toHaveBeenCalledTimes(1);
  });

  it('reports an unreachable catalog index', async () => {
    loadAvailableSystemsFromSources.mockResolvedValue({ systems: [], anyIndexReachable: false });
    const { result } = renderImporter();

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.bundle.hasIndex).toBe(false);
  });
});

describe('die aufgegangenen Anzeige-Ableitungen', () => {
  it('builds the revision display of ADR 0014 for every state', () => {
    expect(buildRevisionDisplay(undefined, null)).toBeNull();
    expect(buildRevisionDisplay(5, null).text).toContain('Rev 5');
    expect(buildRevisionDisplay(5, null).tone).toBe(REVISION_TONE.SUBTLE);
    expect(buildRevisionDisplay(5, { revision: 5 }).tone).toBe(REVISION_TONE.SUBTLE);
    expect(buildRevisionDisplay(5, { revision: 4 }).tone).toBe(REVISION_TONE.ACCENT);
    expect(buildRevisionDisplay(5, { revision: 6 }).tone).toBe(REVISION_TONE.NEUTRAL);
    expect(revisionLabelClassName(REVISION_TONE.ACCENT)).toBe('bundle-revision-label text-gold');
    expect(revisionLabelClassName(REVISION_TONE.NEUTRAL)).toBe('bundle-revision-label');
  });

  it('names the failed catalogues and reports an incomplete import as incomplete', () => {
    const failures = [{ fileName: 'emp.cat', message: 'kaputt' }];
    expect(buildFailedCatalogueMessage(failures)).toContain('emp.cat');
    expect(buildFailedCatalogueMessage(failures)).toContain('kaputt');

    const system = { name: 'Warhammer', catalogues: [{ id: 'cat1' }] };
    expect(buildImportSuccessMessage(system, [])).toContain('Warhammer');
    expect(buildImportSuccessMessage(system, failures)).not.toBe(buildImportSuccessMessage(system, []));
  });

  it('names every missing library together with what depends on it', () => {
    const message = buildMissingLibraryDependencyMessage([
      { id: 'lib', name: 'Bibliothek', requiredBy: ['Bretonnia', 'Empire'] },
      { id: 'lib2', name: 'Zweite', requiredBy: [] },
    ]);
    expect(message).toContain('Bibliothek');
    expect(message).toContain('Bretonnia');
    expect(message).toContain('Empire');
    expect(message).toContain('Zweite');
  });
});
