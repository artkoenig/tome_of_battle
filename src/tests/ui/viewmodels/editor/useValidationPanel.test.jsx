import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useValidationPanel } from '../../../../ui/viewmodels/editor/useValidationPanel';
import { createRosterProviderWrapper, createEmptyRosterReport } from '../../../../tests/test-utils/rosterProviders';

/**
 * ViewModel-Tests des Lagerberichts (Issue 0164): was blockiert, was nur
 * hinweist, was als Datensatz-Befund danebensteht und welche Ressourcen-Summen
 * darunter erscheinen.
 */

const COST_TYPES = [{ id: 'pts', name: 'Pkt.' }, { id: 'cd', name: 'Bannwürfel' }];

const renderPanel = ({ violations = [], unresolvedSelections = [], costTotals = {} } = {}) =>
  renderHook(() => useValidationPanel(), {
    wrapper: createRosterProviderWrapper({
      report: createEmptyRosterReport({
        violations, unresolvedSelections, costTotals,
        description: { costTypes: COST_TYPES },
      }),
      roster: { costLimitType: 'pts' },
    }),
  });

describe('useValidationPanel', () => {
  it('eine Liste ohne Befund ist gültig', () => {
    const { result } = renderPanel();

    expect(result.current).toMatchObject({ isRosterValid: true, blockingCount: 0 });
  });

  it('trennt blockierende Verletzungen von den Hinweisen des Katalogautors', () => {
    const error = { severity: 'error', id: 'v1' };
    const warning = { severity: 'warning', id: 'v2' };
    const info = { severity: 'info', id: 'v3' };
    const { result } = renderPanel({ violations: [error, warning, info] });

    expect(result.current.blockingViolations).toEqual([error]);
    expect(result.current.advisoryViolations).toEqual([warning, info]);
    expect(result.current).toMatchObject({ blockingCount: 1, isRosterValid: false });
  });

  it('Hinweise allein blockieren die Liste nicht', () => {
    const { result } = renderPanel({ violations: [{ severity: 'warning' }] });

    expect(result.current).toMatchObject({ isRosterValid: true, blockingCount: 0 });
  });

  it('eine unaufgelöste Auswahl macht die Liste ungültig, ohne eine Verletzung zu sein', () => {
    const { result } = renderPanel({
      unresolvedSelections: [{ defId: 'e-weg', name: 'Verschollen' }],
    });

    expect(result.current.isRosterValid).toBe(false);
    expect(result.current.blockingCount).toBe(0);
    expect(result.current.unresolvedSelections).toEqual([{ defId: 'e-weg', name: 'Verschollen' }]);
  });

  it('Extra-Ressourcen sind die Nicht-Limit-Kostenarten mit Summe ≠ 0', () => {
    const { result } = renderPanel({ costTotals: { pts: 500, cd: 2 } });

    expect(result.current.extraResources).toEqual([{ id: 'cd', name: 'Bannwürfel', total: 2 }]);
  });
});
