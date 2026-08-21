import { useCallback, useReducer } from 'react';

const resolveNextState = (updater, currentState) =>
  typeof updater === 'function' ? updater(currentState) : updater;

function historyReducer(history, action) {
  switch (action.type) {
    case 'set': {
      const nextPresent = resolveNextState(action.updater, history.present);
      return {
        past: [...history.past, history.present],
        present: nextPresent,
        future: []
      };
    }
    case 'replace': {
      return {
        ...history,
        present: resolveNextState(action.updater, history.present)
      };
    }
    case 'undo': {
      if (history.past.length === 0) return history;
      const previous = history.past[history.past.length - 1];
      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future]
      };
    }
    case 'redo': {
      if (history.future.length === 0) return history;
      const [next, ...remainingFuture] = history.future;
      return {
        past: [...history.past, history.present],
        present: next,
        future: remainingFuture
      };
    }
    default:
      return history;
  }
}

/**
 * Verwaltet einen beliebigen State inklusive unbegrenzter Undo/Redo-Historie.
 * `setState` erzeugt einen Undo-Schritt und leert die Redo-Historie.
 * `replace` aktualisiert den State, ohne die Historie zu verändern.
 */
export function useUndoableState(initialState) {
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialState,
    future: []
  });

  const setState = useCallback((updater) => dispatch({ type: 'set', updater }), []);
  const replace = useCallback((updater) => dispatch({ type: 'replace', updater }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);

  return {
    state: history.present,
    setState,
    replace,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0
  };
}
