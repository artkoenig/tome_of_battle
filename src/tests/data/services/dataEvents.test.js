import { describe, it, expect, vi, afterEach } from 'vitest';
import { DATA_EVENT, emitDataChange, subscribeToDataChanges } from '../../../data/services/dataEvents';

describe('dataEvents', () => {
  const unsubscribers = [];
  const subscribe = (listener) => {
    const unsubscribe = subscribeToDataChanges(listener);
    unsubscribers.push(unsubscribe);
    return unsubscribe;
  };

  afterEach(() => {
    while (unsubscribers.length > 0) unsubscribers.pop()();
    vi.restoreAllMocks();
  });

  it('delivers an event to every subscriber, in subscription order', () => {
    const calls = [];
    subscribe(() => calls.push('first'));
    subscribe(() => calls.push('second'));

    emitDataChange({ type: DATA_EVENT.ROSTER_SAVED });

    expect(calls).toEqual(['first', 'second']);
  });

  it('hands the whole event through', () => {
    const listener = vi.fn();
    subscribe(listener);

    emitDataChange({ type: DATA_EVENT.ROSTER_SAVED, roster: { id: 'r1' } });

    expect(listener).toHaveBeenCalledWith({ type: DATA_EVENT.ROSTER_SAVED, roster: { id: 'r1' } });
  });

  it('stops delivering after unsubscribing', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    unsubscribe();
    emitDataChange({ type: DATA_EVENT.ROSTER_DELETED, rosterId: 'r1' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the remaining subscribers when one throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const survivor = vi.fn();
    subscribe(() => { throw new Error('broken consumer'); });
    subscribe(survivor);

    expect(() => emitDataChange({ type: DATA_EVENT.SETTINGS_CHANGED })).not.toThrow();
    expect(survivor).toHaveBeenCalledTimes(1);
  });

  it('tolerates a subscriber that unsubscribes while being notified', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(() => unsubscribe());
    subscribe(listener);

    expect(() => emitDataChange({ type: DATA_EVENT.SYSTEM_IMPORTED })).not.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
