import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { REVISION_TONE } from '../../../ui/viewmodels/importerRevisionDisplay';

/**
 * Issue 0165, AC1, AC3 and AC5 — the import shell's ViewModel.
 *
 * Beyond the plain state this pins that the screen no longer holds its own
 * system list: it takes the app's, so a finished import is visible everywhere
 * at once.
 *
 * Since Issue 0176 the display derivations sit next to the hook and are pinned
 * there (`importerMessages`, `importerRevisionDisplay`, `importerBundle`,
 * `systemArchiveExport`); what is left here is the flow.
 *
 * The catalog index and the import completion are the network/DB seams and are
 * mocked; the derivations they feed are production code.
 */
const loadAvailableSystemsFromSources = vi.fn();
const completeSystemImport = vi.fn();
const deleteSystem = vi.fn();

vi.mock('../../../platform/persistence/catalogSourceIndex', () => ({
  loadAvailableSystemsFromSources: (...args) => loadAvailableSystemsFromSources(...args),
}));
vi.mock('../../../platform/persistence/systemImport', () => ({
  completeSystemImport: (...args) => completeSystemImport(...args),
  SYSTEM_IMPORT_STATUS: { COMPLETED: 'completed', MISSING_LIBRARY_DEPENDENCIES: 'missing-library-dependencies' },
}));
vi.mock('../../../platform/persistence/database', () => ({
  deleteSystem: (...args) => deleteSystem(...args),
}));

const { useImporter } = await import('../../../ui/viewmodels/useImporter');

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
