import { useState, useEffect } from 'react';
import { VIEWS } from '../constants/views';

/** Der Ausgangspunkt der Verlaufs-Navigation: das Heerlager ohne offenes Roster. */
const INITIAL_HISTORY_STATE = Object.freeze({ view: VIEWS.ROSTERS, rosterId: null });

/**
 * Kapselt die Ansichts-Navigation samt Browser-Verlauf: den `view`-Zustand, die
 * einzige Auswahl-Quelle (`selectedRosterId`) und die `navigate`-Funktion, die
 * als einzige Stelle Zustand **und** History gleichzeitig schreibt.
 *
 * **Kein Router-Paket** (ADR-0005 §5): Navigation bleibt schlichter App-Zustand;
 * sie wird lediglich aus der Wurzelkomponente in einen Hook verlagert. Der Hook
 * spiegelt jede Navigation über `pushState`/`replaceState` in den Verlauf und
 * stellt Ansicht und Auswahl bei der Zurück-Taste (`popstate`) wieder her.
 *
 * @returns {{
 *   view: string,
 *   selectedRosterId: string|null,
 *   navigate: (nextView: string, rosterId?: string|null) => void,
 * }}
 */
export default function useAppNavigation() {
  const [view, setView] = useState(VIEWS.ROSTERS);
  // Einzige Quelle der Wahrheit für die Auswahl: die ID. Roster und System
  // werden daraus abgeleitet, damit eine Änderung an der Liste (etwa ein
  // Umbenennen) sofort in der geöffneten Ansicht sichtbar wird.
  const [selectedRosterId, setSelectedRosterId] = useState(null);

  // Seed a base history entry so the first back-navigation has a defined target.
  useEffect(() => {
    window.history.replaceState(INITIAL_HISTORY_STATE, '');
  }, []);

  // Support the browser/hardware back button: restore the view (and the selected
  // roster) that was active at that point in history, instead of leaving the app.
  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state || INITIAL_HISTORY_STATE;
      setSelectedRosterId(state.rosterId || null);
      setView(state.view || VIEWS.ROSTERS);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigates to a view and pushes a history entry, so the browser back button
  // returns to whatever view/roster was active before this call.
  const navigate = (nextView, rosterId = null) => {
    const isSameEntry = nextView === view && rosterId === selectedRosterId;
    const historyState = { view: nextView, rosterId };

    if (isSameEntry) {
      window.history.replaceState(historyState, '');
    } else {
      window.history.pushState(historyState, '');
    }

    setView(nextView);
    setSelectedRosterId(rosterId);
  };

  return { view, selectedRosterId, navigate };
}
