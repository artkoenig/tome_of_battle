import React from 'react';
import { render } from '@testing-library/react';

import {
  RosterCommandsProvider,
  RosterReportProvider,
} from '../viewmodels/rosterContexts';

/**
 * Test-Wrapper für die zwei Roster-Kontexte (ADR-0038, Issue 0162).
 *
 * Zwei Provider im Baum sind zwei Fehlerquellen mehr für einen Test, der eine
 * Komponente isoliert rendert; dieser Wrapper bestückt beide mit einem leeren,
 * aber vollständigen Bericht, sodass ein Test nur noch die Felder angeben muss,
 * um die es ihm geht.
 */

/** Ein Bericht in der Form, die der Editor erwartet — durchweg leer. */
export function createEmptyRosterReport(overrides = {}) {
  return {
    violations: [],
    capabilities: new Map(),
    description: null,
    costTotals: {},
    pathBySelectionId: new Map(),
    pathByForceId: new Map(),
    diagnostics: [],
    unresolvedSelections: [],
    ...overrides,
  };
}

/** Die Kommandos in der Form von `useRosterState().commands` — durchweg Nichtstuer. */
export function createNoopRosterCommands(overrides = {}) {
  const noop = () => {};
  return {
    addUnit: noop,
    removeUnit: noop,
    copyUnit: noop,
    subSelectionOperations: {
      addInstance: noop,
      removeInstance: noop,
      increaseCount: noop,
      decreaseCount: noop,
    },
    updateRosterName: noop,
    save: async () => {},
    undo: noop,
    redo: noop,
    ...overrides,
  };
}

/**
 * Beide Provider um `children`, mit Vorgabewerten für alles, was der Test nicht
 * selbst setzt.
 * @param {{ report?: Object, roster?: Object|null, commands?: Object, children: React.ReactNode }} props
 */
export function RosterProviders({ report, roster = null, system = null, activeCatalogue = null, commands, children }) {
  return (
    <RosterCommandsProvider commands={commands ?? createNoopRosterCommands()}>
      <RosterReportProvider report={report ?? createEmptyRosterReport()} roster={roster} system={system} activeCatalogue={activeCatalogue}>
        {children}
      </RosterReportProvider>
    </RosterCommandsProvider>
  );
}

/**
 * Ein `wrapper` für `renderHook`: beide Provider um den getesteten Hook.
 * @param {{ report?: Object, roster?: Object|null, system?: Object|null, commands?: Object }} [options]
 * @returns {(props: { children: React.ReactNode }) => React.ReactElement}
 */
export function createRosterProviderWrapper({ report, roster = null, system = null, activeCatalogue = null, commands } = {}) {
  return function Wrapper({ children }) {
    return (
      <RosterProviders report={report} roster={roster} system={system} activeCatalogue={activeCatalogue} commands={commands}>
        {children}
      </RosterProviders>
    );
  };
}

/**
 * `render` aus `@testing-library/react`, mit beiden Providern darum.
 * @param {React.ReactElement} ui
 * @param {{ report?: Object, roster?: Object|null, commands?: Object }} [options]
 */
export function renderWithRosterProviders(ui, { report, roster = null, system = null, activeCatalogue = null, commands, ...renderOptions } = {}) {
  return render(ui, {
    wrapper: ({ children }) => (
      <RosterProviders report={report} roster={roster} system={system} activeCatalogue={activeCatalogue} commands={commands}>
        {children}
      </RosterProviders>
    ),
    ...renderOptions,
  });
}
