import { describe, it, expect, vi, beforeEach } from 'vitest';
import { completeSystemImport, SYSTEM_IMPORT_STATUS } from './systemImport';
import { processImportedData } from '../parser/xmlParser';
import { deleteSystem, saveSystem } from './database';
import { catalogueDirectoryFromIndex, catalogueDirectoryFromLinks } from '../parser/libraryDependencies';

vi.mock('../parser/xmlParser', () => ({
  processImportedData: vi.fn(),
}));

vi.mock('./database', () => ({
  deleteSystem: vi.fn(),
  saveSystem: vi.fn(),
}));

const gstFiles = [{ name: 'rules.gst', content: '<gameSystem />' }];
const catFiles = [{ name: 'faction.cat', content: '<catalogue />' }];

const noWarnings = vi.fn().mockResolvedValue([]);

/** Lets the parser mock report a parse result in its real shape. */
function mockParseResult(system, failedCatalogues = []) {
  processImportedData.mockReturnValue({ system, failedCatalogues });
}

describe('completeSystemImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteSystem.mockResolvedValue(undefined);
    saveSystem.mockResolvedValue(undefined);
    noWarnings.mockResolvedValue([]);
  });

  it('parses, attaches the raw XMLs and replaces the stored system', async () => {
    mockParseResult({ id: 'sys-1', name: 'System One', catalogues: [] });

    const result = await completeSystemImport({
      gstFiles,
      catFiles,
      catalogueDirectory: catalogueDirectoryFromLinks(),
      collectWarnings: noWarnings,
    });

    expect(result.status).toBe(SYSTEM_IMPORT_STATUS.IMPORTED);
    expect(result.system.rawXmls).toEqual({ gst: gstFiles, cat: catFiles });
    expect(deleteSystem).toHaveBeenCalledWith('sys-1');
    expect(saveSystem).toHaveBeenCalledWith(expect.objectContaining({ id: 'sys-1' }));
  });

  it('reports the catalogues that failed to parse alongside the stored system', async () => {
    const failedCatalogues = [{ fileName: 'broken.cat', message: 'Unexpected end of input' }];
    mockParseResult({ id: 'sys-1', name: 'System One', catalogues: [] }, failedCatalogues);

    const result = await completeSystemImport({
      gstFiles,
      catFiles,
      catalogueDirectory: catalogueDirectoryFromLinks(),
      collectWarnings: noWarnings,
    });

    expect(result.status).toBe(SYSTEM_IMPORT_STATUS.IMPORTED);
    expect(result.failedCatalogues).toEqual(failedCatalogues);
  });

  it('logs schema advisories to the console and imports anyway', async () => {
    mockParseResult({ id: 'sys-1', name: 'System One', catalogues: [] });
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const collectWarnings = vi.fn().mockResolvedValue([{ message: 'Schema violation in faction.cat' }]);

    const result = await completeSystemImport({
      gstFiles,
      catFiles,
      catalogueDirectory: catalogueDirectoryFromLinks(),
      collectWarnings,
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['Schema violation in faction.cat'])
    );
    expect(result.status).toBe(SYSTEM_IMPORT_STATUS.IMPORTED);
    expect(saveSystem).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it('aborts without writing anything when a library dependency is missing', async () => {
    mockParseResult({
      id: 'sys-1',
      name: 'System One',
      catalogues: [
        { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'merc', name: 'Mercenaries' }] },
      ],
    });

    const result = await completeSystemImport({
      gstFiles,
      catFiles,
      catalogueDirectory: catalogueDirectoryFromIndex([
        { id: 'dogs', name: 'Dogs of War' },
        { id: 'merc', name: 'Mercenaries' },
      ]),
      collectWarnings: noWarnings,
    });

    expect(result.status).toBe(SYSTEM_IMPORT_STATUS.MISSING_LIBRARY_DEPENDENCIES);
    expect(result.missingDependencies).toEqual([
      { id: 'merc', name: 'Mercenaries', requiredBy: ['Dogs of War'] },
    ]);
    expect(deleteSystem).not.toHaveBeenCalled();
    expect(saveSystem).not.toHaveBeenCalled();
  });

  it('propagates a persistence failure so the caller can phrase it', async () => {
    mockParseResult({ id: 'sys-1', name: 'System One', catalogues: [] });
    saveSystem.mockRejectedValue(new Error('DB voll'));

    await expect(
      completeSystemImport({
        gstFiles,
        catFiles,
        catalogueDirectory: catalogueDirectoryFromLinks(),
        collectWarnings: noWarnings,
      })
    ).rejects.toThrow('DB voll');
  });
});
