import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DATA_EVENT, subscribeToDataChanges } from '../../../data/services/dataEvents';
import { loadRosters, loadRoster, saveRoster, deleteRoster } from '../../../data/services/rosterStore';
import * as database from '../../../data/db/database';

vi.mock('../../../data/db/database', () => ({
  getAllRosters: vi.fn(),
  getRoster: vi.fn(),
  saveRoster: vi.fn(),
  deleteRoster: vi.fn(),
}));

describe('rosterStore', () => {
  const ROSTER = { id: 'r1', name: 'Bretonnia' };
  const unsubscribers = [];

  const listenTo = () => {
    const events = [];
    unsubscribers.push(subscribeToDataChanges(event => events.push(event)));
    return events;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    database.saveRoster.mockResolvedValue(undefined);
    database.deleteRoster.mockResolvedValue(undefined);
  });

  afterEach(() => {
    while (unsubscribers.length > 0) unsubscribers.pop()();
  });

  it('reads all rosters through the database', async () => {
    database.getAllRosters.mockResolvedValue([ROSTER]);
    await expect(loadRosters()).resolves.toEqual([ROSTER]);
  });

  it('reads one roster through the database', async () => {
    database.getRoster.mockResolvedValue(ROSTER);
    await expect(loadRoster('r1')).resolves.toEqual(ROSTER);
    expect(database.getRoster).toHaveBeenCalledWith('r1');
  });

  it('persists a roster and returns the saved state', async () => {
    await expect(saveRoster(ROSTER)).resolves.toBe(ROSTER);
    expect(database.saveRoster).toHaveBeenCalledWith(ROSTER);
  });

  // AC4: ein Verbraucher, der nur abonniert, sieht das gespeicherte Roster.
  it('announces a saved roster to a consumer that only subscribes', async () => {
    const events = listenTo();

    await saveRoster(ROSTER);

    expect(events).toEqual([{ type: DATA_EVENT.ROSTER_SAVED, roster: ROSTER }]);
  });

  it('announces a deleted roster by id', async () => {
    const events = listenTo();

    await deleteRoster('r1');

    expect(database.deleteRoster).toHaveBeenCalledWith('r1');
    expect(events).toEqual([{ type: DATA_EVENT.ROSTER_DELETED, rosterId: 'r1' }]);
  });

  it('announces nothing when persisting fails', async () => {
    const events = listenTo();
    database.saveRoster.mockRejectedValue(new Error('quota exceeded'));

    await expect(saveRoster(ROSTER)).rejects.toThrow('quota exceeded');
    expect(events).toEqual([]);
  });

  it('announces nothing when deleting fails', async () => {
    const events = listenTo();
    database.deleteRoster.mockRejectedValue(new Error('blocked'));

    await expect(deleteRoster('r1')).rejects.toThrow('blocked');
    expect(events).toEqual([]);
  });
});
