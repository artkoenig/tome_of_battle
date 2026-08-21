import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * ViewModel des Regelindex-Dialogs (ADR-0038).
 *
 * Ein fremdstämmiger Iframe feuert `onError` nicht zuverlässig, deshalb sichert
 * eine Zeitschranke den Ladevorgang ab: meldet 6th.whfb.app innerhalb dieser
 * Spanne kein `onLoad` (offline, Einbettung blockiert, langsames Netz), zeigt
 * der Dialog einen Fehler statt eines endlosen Spinners.
 */
const LOAD_TIMEOUT_MS = 15000;

/**
 * @param {{ isOpen: boolean, onClose: () => void }} args
 */
export function useRulesIndexDialog({ isOpen, onClose }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const timeoutRef = useRef(null);

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startLoadTimeout = useCallback(() => {
    clearLoadTimeout();
    timeoutRef.current = setTimeout(() => setLoadError(true), LOAD_TIMEOUT_MS);
  }, [clearLoadTimeout]);

  useEffect(() => {
    if (isOpen) {
      setIframeLoaded(false);
      setLoadError(false);
      document.body.style.overflow = 'hidden';
      startLoadTimeout();
    } else {
      document.body.style.overflow = '';
      setIframeLoaded(false);
      setLoadError(false);
      clearLoadTimeout();
    }
    return () => {
      document.body.style.overflow = '';
      clearLoadTimeout();
    };
  }, [isOpen, startLoadTimeout, clearLoadTimeout]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return {
    iframeLoaded,
    loadError,
    reloadKey,
    handleIframeLoad: useCallback(() => {
      clearLoadTimeout();
      setLoadError(false);
      setIframeLoaded(true);
    }, [clearLoadTimeout]),
    handleIframeError: useCallback(() => {
      clearLoadTimeout();
      setLoadError(true);
    }, [clearLoadTimeout]),
    retry: useCallback(() => {
      setIframeLoaded(false);
      setLoadError(false);
      setReloadKey(key => key + 1);
      startLoadTimeout();
    }, [startLoadTimeout]),
  };
}
