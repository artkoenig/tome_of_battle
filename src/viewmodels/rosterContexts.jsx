import React, { createContext, useContext, useMemo } from 'react';

/**
 * Die zwei Kontexte aus ADR-0038, getrennt nach Änderungsfrequenz.
 *
 * | Kontext | Inhalt | Identität |
 * |---|---|---|
 * | `RosterCommandsContext` | die Kommandos aus `useRosterState` | stabil, ändert sich nie |
 * | `RosterReportContext` | `{ report, roster }` | ändert sich je Bearbeitung |
 *
 * Die Trennung ist der Grund, warum ein Kontext hier vertretbar ist: ein
 * Verbraucher, der nur ein Kommando auslöst (Knöpfe, Menüs), hängt am stabilen
 * Kontext und rendert bei einer Roster-Bearbeitung nicht neu. Beide Kontexte
 * sind `null`, solange kein Provider darüber hängt — die Hooks behandeln das
 * als Programmierfehler und werfen, statt still `undefined` zu liefern.
 */
const RosterCommandsContext = createContext(null);
const RosterReportContext = createContext(null);

/**
 * Stellt die Kommandos bereit. Der Wert wird unverändert durchgereicht: seine
 * Identitätsstabilität ist die von `useRosterState().commands` und darf hier
 * nicht durch ein neu gebautes Bündel zerstört werden.
 * @param {{ commands: Object, children: React.ReactNode }} props
 */
export function RosterCommandsProvider({ commands, children }) {
  return (
    <RosterCommandsContext.Provider value={commands}>
      {children}
    </RosterCommandsContext.Provider>
  );
}

/**
 * Stellt Bericht und Roster bereit. Das Paar wird memoisiert, damit ein Render
 * ohne Bearbeitung keinen neuen Kontextwert erzeugt.
 * @param {{ report: Object, roster: Object|null, children: React.ReactNode }} props
 */
export function RosterReportProvider({ report, roster, children }) {
  const value = useMemo(() => ({ report, roster }), [report, roster]);
  return (
    <RosterReportContext.Provider value={value}>
      {children}
    </RosterReportContext.Provider>
  );
}

/**
 * Die Kommandos des umgebenden Editors.
 * @returns {Object}
 */
export function useRosterCommands() {
  const commands = useContext(RosterCommandsContext);
  if (!commands) {
    throw new Error('useRosterCommands must be used within a RosterCommandsProvider');
  }
  return commands;
}

/**
 * Bericht und Roster des umgebenden Editors.
 * @returns {{ report: Object, roster: Object|null }}
 */
export function useRosterReport() {
  const value = useContext(RosterReportContext);
  if (!value) {
    throw new Error('useRosterReport must be used within a RosterReportProvider');
  }
  return value;
}
