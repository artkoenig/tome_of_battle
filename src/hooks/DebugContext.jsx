import React, { createContext, useContext, useState } from 'react';

const DebugContext = createContext();

export function DebugProvider({ children }) {
  const [showDebugIds, setShowDebugIds] = useState(() => {
    return localStorage.getItem('tomeOfBattle_showDebugIds') === 'true';
  });

  const toggleShowDebugIds = () => {
    setShowDebugIds(prev => {
      const next = !prev;
      localStorage.setItem('tomeOfBattle_showDebugIds', String(next));
      return next;
    });
  };

  return (
    <DebugContext.Provider value={{ showDebugIds, toggleShowDebugIds }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebugMode() {
  const context = useContext(DebugContext);
  if (context === undefined) {
    return { showDebugIds: false, toggleShowDebugIds: () => {} };
  }
  return context;
}
