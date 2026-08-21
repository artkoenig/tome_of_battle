import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useRosterSidebar } from './useRosterSidebar';
import { createRosterProviderWrapper, createEmptyRosterReport } from '../../../shared/test-utils/rosterProviders';

/**
 * ViewModel-Tests der Seitenleiste (Issue 0164): Punktstand, Status,
 * Extra-Ressourcen und die Armeeanforderungen des **ersten** Kontingents — samt
 * der Regel, dass sein Slot-Pfad aus `pathByForceId` kommt und nicht aus dem
 * Eingabe-Index.
 */

const SYSTEM = { costTypes: [{ id: 'pts', name: 'Pkt.' }, { id: 'cd', name: 'Bannwürfel' }] };

const anchor = (over = {}) => ({
  anchorKind: 'categoryAnchor',
  isIndependentSubUnit: false,
  primaryCategoryId: null,
  defId: 'cat-core',
  name: 'Kern',
  isHidden: false,
  current: 0,
  effectiveMin: null,
  effectiveMax: null,
  isMandatoryUnmet: false,
  ...over,
});

const renderSidebar = ({
  capabilities = new Map(), violations = [], costTotals = { pts: 0 },
  costTypes = SYSTEM.costTypes, forces = [{ id: 'f1' }], pathByForceId = new Map([['f1', '0']]),
} = {}) => renderHook(() => useRosterSidebar(), {
  wrapper: createRosterProviderWrapper({
    report: createEmptyRosterReport({
      capabilities, violations, costTotals, pathByForceId,
      description: { costTypes },
    }),
    roster: { costLimitType: 'pts', costLimit: 2000, forces },
    system: SYSTEM,
  }),
});

describe('useRosterSidebar', () => {
  it('nennt Punktstand, Punktgrenze und Kostenart-Namen', () => {
    const { result } = renderSidebar({ costTotals: { pts: 1234 } });

    expect(result.current).toMatchObject({ totalCosts: 1234, costLimit: 2000, costTypeLabel: 'Pkt.' });
  });

  it('nur blockierende Verletzungen machen die Liste ungültig', () => {
    const advisory = renderSidebar({ violations: [{ severity: 'warning' }, { severity: 'info' }] });
    expect(advisory.result.current).toMatchObject({ isValid: true, blockingErrorCount: 0 });
    expect(advisory.result.current.violations).toHaveLength(2);

    const blocking = renderSidebar({ violations: [{ severity: 'error' }, { severity: 'warning' }] });
    expect(blocking.result.current).toMatchObject({ isValid: false, blockingErrorCount: 1 });
  });

  it('Extra-Ressourcen sind die Nicht-Limit-Kostenarten mit Summe ≠ 0', () => {
    const { result } = renderSidebar({ costTotals: { pts: 100, cd: 3 } });

    expect(result.current.extraResources).toEqual([{ id: 'cd', name: 'Bannwürfel', total: 3 }]);
  });

  it('je sichtbarem Kategorie-Anker des ersten Kontingents eine Anforderung', () => {
    const { result } = renderSidebar({
      capabilities: new Map([
        ['0/0', anchor({ name: 'Kern', current: 2, effectiveMin: 1, effectiveMax: 3 })],
        ['0/1', anchor({ name: 'Versteckt', isHidden: true })],
        ['0/2', { anchorKind: 'offerAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Keine Kategorie' }],
      ]),
    });

    expect(result.current.requirements).toEqual([
      { key: '0/0', name: 'Kern', count: 2, min: 1, max: 3, hasErrors: false },
    ]);
  });

  it('eine offene Pflicht und eine Überschreitung markieren die Anforderung als fehlerhaft', () => {
    const unmet = renderSidebar({
      capabilities: new Map([['0/0', anchor({ isMandatoryUnmet: true })]]),
    });
    expect(unmet.result.current.requirements[0].hasErrors).toBe(true);

    const over = renderSidebar({
      capabilities: new Map([['0/0', anchor({ current: 4, effectiveMax: 3 })]]),
    });
    expect(over.result.current.requirements[0].hasErrors).toBe(true);
  });

  it('der Pfad kommt aus pathByForceId, nie aus dem Eingabe-Index', () => {
    // Das erste Kontingent löst nicht auf, das zweite liegt im Bericht unter "0".
    const { result } = renderSidebar({
      forces: [{ id: 'f-verschwunden' }, { id: 'f2' }],
      pathByForceId: new Map([['f2', '0']]),
      capabilities: new Map([['0/0', anchor({ name: 'Selten' })]]),
    });

    expect(result.current.requirements).toEqual([]);
  });

  it('ein Roster ohne Kontingente zeigt keine Anforderung und reißt nicht', () => {
    const { result } = renderSidebar({ forces: [], pathByForceId: new Map() });

    expect(result.current.requirements).toEqual([]);
  });
});
