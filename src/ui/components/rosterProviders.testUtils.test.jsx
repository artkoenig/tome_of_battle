import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';

import {
  renderWithRosterProviders,
  createEmptyRosterReport,
  createNoopRosterCommands,
} from '../../shared/test-utils/rosterProviders';
import { useRosterCommands, useRosterReport } from '../viewmodels/rosterContexts';

/**
 * Issue 0162, AC4 — a component can still be rendered in isolation once the two
 * contexts of ADR-0038 exist: the wrapper in `src/shared/test-utils/rosterProviders.jsx`
 * seeds both, with a complete but empty report, so a test only states the fields
 * it actually cares about.
 */

function ReportProbe() {
  const { roster, report } = useRosterReport();
  const commands = useRosterCommands();
  return (
    <button type="button" data-testid="probe" onClick={() => commands.removeUnit('u1')}>
      {roster?.name ?? 'no roster'} / {report.violations.length} / {report.slots.capabilities.size}
    </button>
  );
}

describe('renderWithRosterProviders', () => {
  it('renders a context consumer with an empty report and no-op commands', () => {
    renderWithRosterProviders(<ReportProbe />);

    expect(screen.getByTestId('probe').textContent).toBe('no roster / 0 / 0');
  });

  it('seeds the report and the roster a test hands it', () => {
    const capabilities = new Map([['0', {
      anchorKind: 'occupied', defId: 'x', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null,
    }]]);
    renderWithRosterProviders(<ReportProbe />, {
      roster: { name: 'my list' },
      report: createEmptyRosterReport({ violations: [{ id: 'v1' }], capabilities }),
    });

    expect(screen.getByTestId('probe').textContent).toBe('my list / 1 / 1');
  });

  it('lets a test replace a single command and keep the rest', () => {
    const removeUnit = vi.fn();
    renderWithRosterProviders(<ReportProbe />, {
      commands: createNoopRosterCommands({ removeUnit }),
    });

    screen.getByTestId('probe').click();

    expect(removeUnit).toHaveBeenCalledWith('u1');
  });
});
