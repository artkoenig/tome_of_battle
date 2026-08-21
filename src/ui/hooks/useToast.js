import { useState, useRef } from 'react';

/** Anzeigedauer einer Toast-Benachrichtigung in Millisekunden. */
const TOAST_DURATION_MS = 3000;

/**
 * Kapselt den Toast-Zustand samt Auto-Ausblende-Timer und den zentralen
 * Fehlerkanal der Anwendung. **Bewusst lokaler State, kein React-Context**
 * (ADR-0010): der Hook liefert den aktuellen Toast und die Aktionen; die
 * Wurzelkomponente rendert das Toast-Element und reicht die Aktionen an die
 * Kinder durch.
 *
 * @returns {{
 *   toast: {message: string, type: string}|null,
 *   showToast: (message: string, type?: string) => void,
 *   reportError: (message: string) => void,
 * }}
 */
export default function useToast() {
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, TOAST_DURATION_MS);
  };

  // Der zentrale Fehlerkanal der Anwendung (ADR 0010): Ansichten und Hooks, die selbst
  // keine Oberfläche für Fehler besitzen — Autosave, Spielstand, Import —, reichen ihre
  // Meldung hierher, statt sie in der Konsole enden zu lassen.
  const reportError = (message) => showToast(message, 'error');

  return { toast, showToast, reportError };
}
