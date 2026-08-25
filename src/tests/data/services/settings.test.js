import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DATA_EVENT, subscribeToDataChanges } from '../../../shared/events/dataEvents';
import { WHFB6_LINKING_DEFAULT, loadWhfb6LinkingEnabled, saveWhfb6LinkingEnabled } from '../../../domain/services/settings';
import * as database from '../../../data/db/database';

vi.mock('../../../data/db/database', () => ({
  WHFB6_LINKING_DEFAULT: true,
  getWhfb6LinkingEnabled: vi.fn(),
  setWhfb6LinkingEnabled: vi.fn(),
}));

describe('settings', () => {
  const unsubscribers = [];

  const listenTo = () => {
    const events = [];
    unsubscribers.push(subscribeToDataChanges(event => events.push(event)));
    return events;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    database.setWhfb6LinkingEnabled.mockResolvedValue(undefined);
  });

  afterEach(() => {
    while (unsubscribers.length > 0) unsubscribers.pop()();
  });

  it('publishes the default of the stored setting', () => {
    expect(WHFB6_LINKING_DEFAULT).toBe(true);
  });

  it('reads the stored value', async () => {
    database.getWhfb6LinkingEnabled.mockResolvedValue(false);
    await expect(loadWhfb6LinkingEnabled()).resolves.toBe(false);
  });

  it('persists a value and announces the change', async () => {
    const events = listenTo();

    await expect(saveWhfb6LinkingEnabled(false)).resolves.toBe(false);

    expect(database.setWhfb6LinkingEnabled).toHaveBeenCalledWith(false);
    expect(events).toEqual([{ type: DATA_EVENT.SETTINGS_CHANGED, whfb6LinkingEnabled: false }]);
  });

  it('announces nothing when persisting fails', async () => {
    const events = listenTo();
    database.setWhfb6LinkingEnabled.mockRejectedValue(new Error('blocked'));

    await expect(saveWhfb6LinkingEnabled(false)).rejects.toThrow('blocked');
    expect(events).toEqual([]);
  });
});
