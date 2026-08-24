import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeToDataChanges } from '../../../domain/services/dataEvents';
import {
  buildRawFileUrl,
  deriveRevisionState,
  fetchCatalogText,
  REVISION_STATE,
  refreshSystems,
} from '../../../domain/services/catalogRevisions';
import * as catalogUpdate from '../../../data/db/catalogUpdate';
import * as migrations from '../../../data/db/migrations';

vi.mock('../../../data/db/catalogUpdate', () => ({
  fetchCatalogText: vi.fn(),
  buildRawFileUrl: vi.fn(),
  deriveRevisionState: vi.fn(),
  REVISION_STATE: Object.freeze({ NEW: 'new', CURRENT: 'current', OUTDATED: 'outdated', AHEAD: 'ahead' }),
}));
vi.mock('../../../data/db/migrations', () => ({ runSystemMigrations: vi.fn() }));

describe('catalogRevisions', () => {
  const unsubscribers = [];

  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    while (unsubscribers.length > 0) unsubscribers.pop()();
  });

  it('passes the revision arithmetic through unchanged', () => {
    catalogUpdate.buildRawFileUrl.mockReturnValue('https://example.test/a.cat');
    catalogUpdate.deriveRevisionState.mockReturnValue(REVISION_STATE.OUTDATED);

    expect(buildRawFileUrl('https://example.test/', 'a.cat')).toBe('https://example.test/a.cat');
    expect(deriveRevisionState(3, { revision: 2 })).toBe(REVISION_STATE.OUTDATED);
    expect(catalogUpdate.deriveRevisionState).toHaveBeenCalledWith(3, { revision: 2 });
  });

  it('refreshes the stored systems with the catalog fetch of the data layer', async () => {
    const refreshed = { systems: [{ id: 's1' }], failures: [], unrecoverable: [] };
    migrations.runSystemMigrations.mockResolvedValue(refreshed);

    await expect(refreshSystems([{ id: 's1' }])).resolves.toBe(refreshed);
    expect(migrations.runSystemMigrations).toHaveBeenCalledWith([{ id: 's1' }], fetchCatalogText);
  });

  // Der Abgleich frischt einen Cache auf und aendert den Bestand des Nutzers
  // nicht — er gehoert deshalb nicht auf den Aenderungs-Kanal.
  it('announces nothing: the refresh is a read', async () => {
    const events = [];
    unsubscribers.push(subscribeToDataChanges(event => events.push(event)));
    migrations.runSystemMigrations.mockResolvedValue({ systems: [], failures: [], unrecoverable: [] });

    await refreshSystems([]);

    expect(events).toEqual([]);
  });
});
