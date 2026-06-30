import { useState, useEffect, useRef } from 'react';
import '../types.js';

/**
 * Hook to manage game play state, wound trackers, CP and VP.
 * @param {import('../types.js').Roster} initialRoster
 * @param {Function} setRoster
 * @param {Function} saveRosterCallback
 */
export default function usePlayState(initialRoster, setRoster, saveRosterCallback) {
  const [gameState, setGameState] = useState(() => {
    return initialRoster.gameState || {
      round: 1,
      vp: 0,
      cp: 0,
      wounds: {} // selectionId -> array of current wounds per model or single int
    };
  });

  const isInitialMount = useRef(true);

  // Save game state whenever it changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const saveState = async () => {
      // Need to use functional update pattern for setRoster to avoid stale closures if roster changes
      setRoster(prevRoster => {
        const updatedRoster = { ...prevRoster, gameState };
        if (saveRosterCallback) {
          saveRosterCallback(updatedRoster).catch(e => console.error("Failed to save game state:", e));
        }
        return updatedRoster;
      });
    };
    saveState();
  }, [gameState, setRoster, saveRosterCallback]);

  // VP, CP, and Round tracker
  const adjustTracker = (field, delta) => {
    setGameState(prev => ({
      ...prev,
      [field]: Math.max(0, prev[field] + delta)
    }));
  };

  const getUnitCurrentWounds = (selectionId, totalMaxWounds) => {
    const val = gameState.wounds[selectionId];
    if (val === undefined) {
      return totalMaxWounds;
    }
    if (Array.isArray(val)) {
      return val.reduce((sum, w) => sum + w, 0);
    }
    return val;
  };

  const handleAdjustWound = (selectionId, delta, totalMaxWounds) => {
    setGameState(prev => {
      const woundsMap = { ...prev.wounds };
      const current = prev.wounds[selectionId];
      let currentVal = totalMaxWounds;
      
      if (current !== undefined) {
        if (Array.isArray(current)) {
          currentVal = current.reduce((sum, w) => sum + w, 0);
        } else {
          currentVal = current;
        }
      }
      
      const newVal = Math.max(0, Math.min(totalMaxWounds, currentVal + delta));
      woundsMap[selectionId] = newVal;

      return {
        ...prev,
        wounds: woundsMap
      };
    });
  };

  return {
    gameState,
    adjustTracker,
    getUnitCurrentWounds,
    handleAdjustWound
  };
}
