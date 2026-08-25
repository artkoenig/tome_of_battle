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
// Ohne Provider ist der Wert `null`; der Typ muss trotzdem den Vertrag nennen,
// den die beiden Consumer-Hooks erwarten — deshalb hier die Behauptung am Literal.
const RosterCommandsContext = createContext(
  /** @type {Record<string, Function>|null} */ (null)
);
const RosterReportContext = createContext(
  /** @type {{ report: object, roster: object, system: object, activeCatalogue: object }|null} */ (null)
);

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
 * Stellt Bericht und Roster bereit. Das Bündel wird memoisiert, damit ein Render
 * ohne Bearbeitung keinen neuen Kontextwert erzeugt.
 *
 * Neben Bericht und Roster trägt der Kontext den **Datensatz**: das geparste
 * System und den aktiven Katalog. Beide sind keine Anzeigefrage (die beantwortet
 * weiterhin allein der Bericht, ADR-0034), sondern der Rahmen, in dem ein
 * ViewModel Detailtexte auflöst und die Katalogstruktur einer Options-Gruppe
 * liest. Der aktive Katalog wird hier **abgeleitet** (`roster.catalogueId`),
 * damit ihn keine Komponente mehr als Prop führen muss; ein Aufrufer, der ihn
 * selbst führt, reicht ihn statt dessen durch.
 * @param {{ report: Object, roster: Object|null, system?: Object|null,
 *   activeCatalogue?: Object|null, children: React.ReactNode }} props
 */
export function RosterReportProvider({ report, roster, system = null, activeCatalogue, children }) {
  const value = useMemo(() => ({
    report,
    roster,
    system,
    activeCatalogue: activeCatalogue
      ?? system?.catalogues?.find(c => c.id === roster?.catalogueId)
      ?? null,
  }), [report, roster, system, activeCatalogue]);
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
 * Bericht, Roster und Datensatz des umgebenden Editors.
 * @returns {{ report: Object, roster: Object|null, system: Object|null, activeCatalogue: Object|null }}
 */
export function useRosterReport() {
  const value = useContext(RosterReportContext);
  if (!value) {
    throw new Error('useRosterReport must be used within a RosterReportProvider');
  }
  return value;
}
