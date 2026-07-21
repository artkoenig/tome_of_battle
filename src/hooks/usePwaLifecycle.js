import { useEffect, useState } from 'react';

/** Browser-Event, das die Installationsaufforderung der PWA bereitstellt. */
const BEFORE_INSTALL_PROMPT_EVENT = 'beforeinstallprompt';

/** Browser-Event, das nach erfolgreicher Installation ausgelöst wird. */
const APP_INSTALLED_EVENT = 'appinstalled';

/** Eigenes Event, mit dem die Service-Worker-Registrierung ein Update meldet. */
const PWA_UPDATE_AVAILABLE_EVENT = 'pwa-update-available';

/** Nachricht, die den wartenden Service Worker sofort aktiv werden lässt. */
const SKIP_WAITING_MESSAGE = { type: 'SKIP_WAITING' };

/**
 * Kapselt den Lebenszyklus der Progressive Web App: Installierbarkeit,
 * aufgeschobene Installationsaufforderung, verfügbares Update, wartender
 * Service Worker und die zugehörige Release-Information.
 *
 * Der Hook ist unabhängig von der Wurzelkomponente testbar; nach außen gibt er
 * nur den anzuzeigenden Zustand und die beiden auslösbaren Aktionen frei.
 *
 * @returns {{
 *   isInstallable: boolean,
 *   promptInstall: () => Promise<void>,
 *   isUpdateAvailable: boolean,
 *   updateRelease: object|null,
 *   applyUpdate: () => void
 * }}
 */
export default function usePwaLifecycle() {
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [updateRelease, setUpdateRelease] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
      setIsInstallable(true);
    };
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredInstallPrompt(null);
    };
    const handleUpdateAvailable = (event) => {
      const detail = event.detail || {};
      // detail may be the plain worker (legacy shape) or { worker, release }.
      setWaitingWorker(detail.worker || detail);
      setUpdateRelease(detail.release || null);
      setIsUpdateAvailable(true);
    };

    window.addEventListener(BEFORE_INSTALL_PROMPT_EVENT, handleBeforeInstallPrompt);
    window.addEventListener(APP_INSTALLED_EVENT, handleAppInstalled);
    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);

    return () => {
      window.removeEventListener(BEFORE_INSTALL_PROMPT_EVENT, handleBeforeInstallPrompt);
      window.removeEventListener(APP_INSTALLED_EVENT, handleAppInstalled);
      window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredInstallPrompt(null);
    setIsInstallable(false);
  };

  const applyUpdate = () => {
    if (!waitingWorker) return;
    waitingWorker.postMessage(SKIP_WAITING_MESSAGE);
  };

  return { isInstallable, promptInstall, isUpdateAvailable, updateRelease, applyUpdate };
}
