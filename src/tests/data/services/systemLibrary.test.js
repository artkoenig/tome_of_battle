import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DATA_EVENT, subscribeToDataChanges } from '../../../shared/events/dataEvents';
import {
  loadSystems,
  loadSystem,
  readSystemArchive,
  importSystem,
  deleteSystem,
  loadAvailableSystems,
  SYSTEM_IMPORT_STATUS,
} from '../../../domain/services/systemLibrary';
import * as database from '../../../data/db/database';
import * as systemImport from '../../../data/db/systemImport';
import * as catalogSourceIndex from '../../../data/db/catalogSourceIndex';
import * as catalogUpdate from '../../../data/db/catalogUpdate';
import * as zipExtractor from '../../../data/parser/zipExtractor';

vi.mock('../../../data/db/database', () => ({
  getAllSystems: vi.fn(),
  getSystem: vi.fn(),
  deleteSystem: vi.fn(),
}));
vi.mock('../../../data/db/systemImport', () => ({
  completeSystemImport: vi.fn(),
  SYSTEM_IMPORT_STATUS: Object.freeze({
    IMPORTED: 'imported',
    MISSING_LIBRARY_DEPENDENCIES: 'missing-library-dependencies',
  }),
}));
vi.mock('../../../data/db/catalogSourceIndex', () => ({ loadAvailableSystemsFromSources: vi.fn() }));
vi.mock('../../../data/db/catalogUpdate', () => ({ fetchCatalogText: vi.fn() }));
vi.mock('../../../data/parser/zipExtractor', () => ({ extractZipFiles: vi.fn() }));

describe('systemLibrary', () => {
  const SYSTEM = { id: 's1', name: 'WHFB 6' };
  const FILES = { gstFiles: [{ name: 'a.gst' }], catFiles: [{ name: 'b.cat' }] };
  const unsubscribers = [];

  const listenTo = () => {
    const events = [];
    unsubscribers.push(subscribeToDataChanges(event => events.push(event)));
    return events;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    database.deleteSystem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    while (unsubscribers.length > 0) unsubscribers.pop()();
  });

  it('reads the installed systems', async () => {
    database.getAllSystems.mockResolvedValue([SYSTEM]);
    await expect(loadSystems()).resolves.toEqual([SYSTEM]);
  });

  it('reads one installed system', async () => {
    database.getSystem.mockResolvedValue(SYSTEM);
    await expect(loadSystem('s1')).resolves.toEqual(SYSTEM);
    expect(database.getSystem).toHaveBeenCalledWith('s1');
  });

  it('unpacks an archive without storing anything', async () => {
    const events = listenTo();
    zipExtractor.extractZipFiles.mockResolvedValue(FILES);

    await expect(readSystemArchive({ name: 'bundle.zip' })).resolves.toEqual(FILES);
    expect(events).toEqual([]);
  });

  it('hands the import result through and announces an imported system', async () => {
    const events = listenTo();
    const result = { status: SYSTEM_IMPORT_STATUS.IMPORTED, system: SYSTEM, failedCatalogues: [] };
    systemImport.completeSystemImport.mockResolvedValue(result);

    await expect(importSystem({ ...FILES, catalogueDirectory: {} })).resolves.toBe(result);
    expect(events).toEqual([{ type: DATA_EVENT.SYSTEM_IMPORTED, system: SYSTEM }]);
  });

  it('announces nothing when the import stops on missing library dependencies', async () => {
    const events = listenTo();
    systemImport.completeSystemImport.mockResolvedValue({
      status: SYSTEM_IMPORT_STATUS.MISSING_LIBRARY_DEPENDENCIES,
      missingDependencies: [{ id: 'lib', name: 'Library', requiredBy: [] }],
    });

    await importSystem({ ...FILES, catalogueDirectory: {} });

    expect(events).toEqual([]);
  });

  it('announces a deleted system by id', async () => {
    const events = listenTo();

    await deleteSystem('s1');

    expect(database.deleteSystem).toHaveBeenCalledWith('s1');
    expect(events).toEqual([{ type: DATA_EVENT.SYSTEM_DELETED, systemId: 's1' }]);
  });

  it('announces nothing when deleting fails', async () => {
    const events = listenTo();
    database.deleteSystem.mockRejectedValue(new Error('blocked'));

    await expect(deleteSystem('s1')).rejects.toThrow('blocked');
    expect(events).toEqual([]);
  });

  it('loads the remote index with the catalog fetch of the data layer', async () => {
    catalogSourceIndex.loadAvailableSystemsFromSources.mockResolvedValue({
      systems: [SYSTEM],
      anyIndexReachable: true,
    });

    await expect(loadAvailableSystems()).resolves.toEqual({ systems: [SYSTEM], anyIndexReachable: true });
    expect(catalogSourceIndex.loadAvailableSystemsFromSources)
      .toHaveBeenCalledWith(catalogUpdate.fetchCatalogText);
  });
});
