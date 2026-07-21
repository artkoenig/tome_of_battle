import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePwaLifecycle from './usePwaLifecycle';

const BEFORE_INSTALL_PROMPT_EVENT = 'beforeinstallprompt';
const APP_INSTALLED_EVENT = 'appinstalled';
const PWA_UPDATE_AVAILABLE_EVENT = 'pwa-update-available';

/**
 * Minimal fake of the `beforeinstallprompt` event: records whether the browser
 * default was suppressed and which install outcome the user chose.
 */
function createInstallPromptEvent(outcome = 'accepted') {
  const event = new Event(BEFORE_INSTALL_PROMPT_EVENT);
  event.preventDefault = vi.fn();
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

const dispatch = (event) => act(() => { window.dispatchEvent(event); });

describe('usePwaLifecycle', () => {
  let consoleLogSpy;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('starts with no installability and no pending update', () => {
    const { result } = renderHook(() => usePwaLifecycle());

    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isUpdateAvailable).toBe(false);
    expect(result.current.updateRelease).toBeNull();
  });

  it('becomes installable and suppresses the browser default prompt', () => {
    const { result } = renderHook(() => usePwaLifecycle());

    const event = createInstallPromptEvent();
    dispatch(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.isInstallable).toBe(true);
  });

  it('shows the deferred prompt and clears installability once answered', async () => {
    const { result } = renderHook(() => usePwaLifecycle());

    const event = createInstallPromptEvent('accepted');
    dispatch(event);

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(event.prompt).toHaveBeenCalled();
    expect(result.current.isInstallable).toBe(false);
  });

  it('ignores an install request while no prompt is deferred', async () => {
    const { result } = renderHook(() => usePwaLifecycle());

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(result.current.isInstallable).toBe(false);
  });

  it('clears installability after the app has been installed', () => {
    const { result } = renderHook(() => usePwaLifecycle());

    dispatch(createInstallPromptEvent());
    expect(result.current.isInstallable).toBe(true);

    dispatch(new Event(APP_INSTALLED_EVENT));
    expect(result.current.isInstallable).toBe(false);
  });

  it('reports an available update together with its release information', () => {
    const { result } = renderHook(() => usePwaLifecycle());

    const release = { version: 'v1.2.0', changes: ['Neues Feature A'] };
    dispatch(new CustomEvent(PWA_UPDATE_AVAILABLE_EVENT, {
      detail: { worker: { postMessage: vi.fn() }, release },
    }));

    expect(result.current.isUpdateAvailable).toBe(true);
    expect(result.current.updateRelease).toEqual(release);
  });

  it('accepts the legacy event shape carrying the worker directly', () => {
    const { result } = renderHook(() => usePwaLifecycle());
    const worker = { postMessage: vi.fn() };

    dispatch(new CustomEvent(PWA_UPDATE_AVAILABLE_EVENT, { detail: worker }));

    expect(result.current.isUpdateAvailable).toBe(true);
    expect(result.current.updateRelease).toBeNull();

    act(() => { result.current.applyUpdate(); });
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('tells the waiting worker to activate when the update is applied', () => {
    const { result } = renderHook(() => usePwaLifecycle());
    const worker = { postMessage: vi.fn() };

    dispatch(new CustomEvent(PWA_UPDATE_AVAILABLE_EVENT, { detail: { worker } }));
    act(() => { result.current.applyUpdate(); });

    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('does nothing when an update is applied without a waiting worker', () => {
    const { result } = renderHook(() => usePwaLifecycle());

    expect(() => act(() => { result.current.applyUpdate(); })).not.toThrow();
  });

  it('removes its window listeners on unmount', () => {
    const { result, unmount } = renderHook(() => usePwaLifecycle());
    unmount();

    window.dispatchEvent(createInstallPromptEvent());

    expect(result.current.isInstallable).toBe(false);
  });
});
