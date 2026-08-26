import { useState, useEffect, useRef } from 'react';
import {
  PERSISTENCE_FAILURE_MESSAGE_KEY,
  createPersistenceFailureReporter,
} from './persistenceFailure';
import {
  loadGame,
  saveGame,
  createGameFor,
  currentWoundsOf,
  withAdjustedWound,
  withAdjustedTracker,
} from '../../contexts/play';
import '../../shared/rostermodel/types.js';

/**
 * Der Wundenzustand des Spielmodus (Issue 0190).
 *
 * Die Partie ist seit dem Kontextschnitt ein eigenes Aggregat: der Hook liest
 * und schreibt sie ueber die Fassade des Kontexts `play`, nicht mehr ueber das
 * Roster. Damit schreibt eine Wunde weder den Listendatensatz neu noch landet
 * sie in der Undo-Historie der Liste — `setRoster` und `saveRosterCallback`
 * sind hier deshalb ersatzlos entfallen.
 *
 * @param {import('../../shared/rostermodel/types.js').Roster} roster die Liste, zu der
 *   gespielt wird. Sie liefert die `rosterId` und die Auswahlen, gegen die
 *   verwaiste Wundeneintraege beim Schreiben wegfallen.
 * @param {(message: string) => void} [reportError] app-wide error channel; a failed
 *   game save reaches the user through it instead of ending in the console.
 */
export default function usePlayState(roster, reportError) {
  const rosterId = roster?.id;
  const [game, setGame] = useState(() => createGameFor(rosterId));

  const reportErrorRef = useRef(reportError);
  reportErrorRef.current = reportError;

  // Die Liste als Ref: sie geht nur in den **Schreibvorgang** ein (verwaiste
  // Eintraege), darf ihn aber nicht ausloesen — sonst schriebe jede
  // Neuberechnung des Rosters eine Partie.
  const rosterRef = useRef(roster);
  rosterRef.current = roster;

  // Erst ein Zug des Spielers macht die Partie schreibenswert. Ohne diese Marke
  // wuerde schon das Betreten des Spielmodus einen Datensatz erzeugen und der
  // gerade geladene Stand sofort wieder zurueckgeschrieben. Sie faellt mit dem
  // Schreiben zurueck.
  const hasUnsavedMove = useRef(false);

  // Ob ueberhaupt schon gezogen wurde. Diese Marke faellt nicht zurueck, denn
  // sie beantwortet eine andere Frage: der Lesevorgang laeuft asynchron, und ein
  // Zug waehrend des Lesens darf vom nachtraeglich eintreffenden Stand nicht
  // ueberschrieben werden — auch dann nicht, wenn er zwischenzeitlich schon
  // gespeichert wurde.
  const hasPlayed = useRef(false);

  const reportFailure = () =>
    createPersistenceFailureReporter(
      PERSISTENCE_FAILURE_MESSAGE_KEY.gameState,
      reportErrorRef.current
    );

  // Die laufende Partie dieser Liste, falls es eine gibt. Bis sie da ist, zeigt
  // der Bildschirm die frische — sie ist der Zustand einer Partie, die noch
  // nicht begonnen hat.
  useEffect(() => {
    if (!rosterId) return undefined;
    // Eine andere Liste ist eine andere Partie: die Zugmarke gilt fuer die
    // vorige und darf den Stand der neuen nicht abweisen.
    hasPlayed.current = false;
    let isCurrent = true;
    loadGame(rosterId)
      .then((loaded) => {
        if (isCurrent && !hasPlayed.current) setGame(loaded);
      })
      .catch(reportFailure());
    return () => {
      isCurrent = false;
    };
  }, [rosterId]);

  useEffect(() => {
    if (!hasUnsavedMove.current) return;
    hasUnsavedMove.current = false;
    saveGame(game, rosterRef.current).catch(reportFailure());
  }, [game]);

  const adjustTracker = (field, delta) => {
    hasPlayed.current = true;
    hasUnsavedMove.current = true;
    setGame(prev => withAdjustedTracker(prev, field, delta));
  };

  const getUnitCurrentWounds = (selectionId, totalMaxWounds) =>
    currentWoundsOf(game, selectionId, totalMaxWounds);

  const handleAdjustWound = (selectionId, delta, totalMaxWounds) => {
    hasPlayed.current = true;
    hasUnsavedMove.current = true;
    setGame(prev => withAdjustedWound(prev, selectionId, delta, totalMaxWounds));
  };

  return {
    game,
    adjustTracker,
    getUnitCurrentWounds,
    handleAdjustWound
  };
}
