import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  PERSISTENCE_FAILURE_MESSAGE,
  createPersistenceFailureReporter,
} from './persistenceFailure';

describe('createPersistenceFailureReporter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands the message to the error channel and logs the cause', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reportError = vi.fn();
    const cause = new Error('QuotaExceededError');

    createPersistenceFailureReporter(PERSISTENCE_FAILURE_MESSAGE.roster, reportError)(cause);

    expect(reportError).toHaveBeenCalledWith(PERSISTENCE_FAILURE_MESSAGE.roster);
    expect(consoleErrorSpy).toHaveBeenCalledWith(PERSISTENCE_FAILURE_MESSAGE.roster, cause);
  });

  it('still logs when no error channel is wired up', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      createPersistenceFailureReporter(PERSISTENCE_FAILURE_MESSAGE.gameState)(new Error('boom'))
    ).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
