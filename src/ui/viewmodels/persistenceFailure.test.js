import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  PERSISTENCE_FAILURE_MESSAGE_KEY,
  createPersistenceFailureReporter,
} from './persistenceFailure';
import { t } from '../i18n/i18nStore';

describe('createPersistenceFailureReporter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands the translated message to the error channel and logs the cause', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reportError = vi.fn();
    const cause = new Error('QuotaExceededError');
    const expectedMessage = t(PERSISTENCE_FAILURE_MESSAGE_KEY.roster);

    createPersistenceFailureReporter(PERSISTENCE_FAILURE_MESSAGE_KEY.roster, reportError)(cause);

    expect(reportError).toHaveBeenCalledWith(expectedMessage);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expectedMessage, cause);
  });

  it('still logs when no error channel is wired up', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      createPersistenceFailureReporter(PERSISTENCE_FAILURE_MESSAGE_KEY.gameState)(new Error('boom'))
    ).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
