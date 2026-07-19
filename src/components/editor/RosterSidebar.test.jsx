import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RosterSidebar from './RosterSidebar';

// RosterSidebar renders real solver output (no solver mocks), so these tests
// verify that the display layer actually surfaces two constructs from the
// XSD-conformance work: percentValue category constraints (slice 05) and
// hidden cost types (slice 03).
vi.mock('lucide-react', () => ({
  Check: (props) => <span data-testid="icon-check" {...props} />,
  ShieldAlert: (props) => <span data-testid="icon-shield-alert" {...props} />,
  AlertTriangle: (props) => <span data-testid="icon-alert-triangle" {...props} />,
  Info: (props) => <span data-testid="icon-info" {...props} />,
}));

const CATEGORY_ID = 'cat-core';
const FORCE_ENTRY_ID = 'fe-main';

function makeSystem(overrides = {}) {
  return {
    id: 'sys',
    costTypes: [{ id: 'pts', name: 'Points' }],
    categoryEntries: [{ id: CATEGORY_ID, name: 'Core' }],
    forceEntries: [
      {
        id: FORCE_ENTRY_ID,
        name: 'Main Force',
        categoryLinks: [
          {
            id: 'cl-core',
            targetId: CATEGORY_ID,
            name: 'Core',
            constraints: [],
          },
        ],
      },
    ],
    catalogues: [],
    ...overrides,
  };
}

function makeRoster() {
  return {
    id: 'roster-1',
    catalogueId: 'cat',
    costLimitType: 'pts',
    costLimit: 1000,
    forces: [
      {
        id: 'force-1',
        forceEntryId: FORCE_ENTRY_ID,
        catalogueId: 'cat',
        selections: [],
      },
    ],
  };
}

function renderSidebar({ system, roster, costs = { pts: 0 }, validationErrors = [] }) {
  return render(
    <RosterSidebar
      roster={roster}
      system={system}
      costs={costs}
      validationErrors={validationErrors}
      costTypeLabel="Pkt."
    />
  );
}

describe('RosterSidebar percentValue category constraints', () => {
  it('marks a percentValue category maximum with a percent sign', () => {
    const system = makeSystem();
    system.forceEntries[0].categoryLinks[0].constraints = [
      { id: 'con-max', type: 'max', value: 25, field: 'selections', scope: 'force', percentValue: true },
    ];

    renderSidebar({ system, roster: makeRoster() });

    expect(screen.getByText(/Max: 25 %/)).toBeTruthy();
  });

  it('renders an absolute category maximum without a percent sign', () => {
    const system = makeSystem();
    system.forceEntries[0].categoryLinks[0].constraints = [
      { id: 'con-max', type: 'max', value: 3, field: 'selections', scope: 'force', percentValue: false },
    ];

    renderSidebar({ system, roster: makeRoster() });

    expect(screen.getByText(/Max: 3(?! %)/)).toBeTruthy();
    expect(screen.queryByText(/Max: 3 %/)).toBeNull();
  });
});

describe('RosterSidebar hidden cost types', () => {
  it('lists a non-hidden extra resource with a nonzero total', () => {
    const system = makeSystem({
      costTypes: [
        { id: 'pts', name: 'Points' },
        { id: 'cd', name: 'Casting Dice', hidden: false },
      ],
    });

    renderSidebar({ system, roster: makeRoster(), costs: { pts: 0, cd: 4 } });

    expect(screen.getByText('Casting Dice:')).toBeTruthy();
  });

  it('never surfaces a hidden cost type, even with a nonzero total', () => {
    const system = makeSystem({
      costTypes: [
        { id: 'pts', name: 'Points' },
        { id: 'internal', name: 'Internal Budget', hidden: true },
      ],
    });

    renderSidebar({ system, roster: makeRoster(), costs: { pts: 0, internal: 9 } });

    expect(screen.queryByText('Internal Budget:')).toBeNull();
  });
});

describe('RosterSidebar validation severity', () => {
  it('renders an error entry with the danger icon and no severity modifier class', () => {
    renderSidebar({
      system: makeSystem(),
      roster: makeRoster(),
      validationErrors: [{ message: 'Zu viele Helden gewählt.', severity: 'error' }],
    });

    expect(screen.getByTestId('icon-shield-alert')).toBeTruthy();
    expect(screen.getByText('Zu viele Helden gewählt.').closest('.validation-error-item').className)
      .not.toMatch(/--warning|--info/);
    expect(screen.getByText(/Fehlerhaft/)).toBeTruthy();
  });

  it('renders a warning entry with its own icon/class and does not mark the roster invalid', () => {
    renderSidebar({
      system: makeSystem(),
      roster: makeRoster(),
      validationErrors: [{ message: 'Bitte "Allow special characters?" aktivieren.', severity: 'warning' }],
    });

    expect(screen.getByTestId('icon-alert-triangle')).toBeTruthy();
    expect(screen.getByText(/aktivieren/).closest('.validation-error-item').className).toMatch(/--warning/);
    expect(screen.getByText('Gültig')).toBeTruthy();
  });

  it('renders an info entry with its own icon/class and does not mark the roster invalid', () => {
    renderSidebar({
      system: makeSystem(),
      roster: makeRoster(),
      validationErrors: [{ message: 'Hinweis zur Aufstellung.', severity: 'info' }],
    });

    expect(screen.getByTestId('icon-info')).toBeTruthy();
    expect(screen.getByText('Hinweis zur Aufstellung.').closest('.validation-error-item').className).toMatch(/--info/);
    expect(screen.getByText('Gültig')).toBeTruthy();
  });

  it('mixes severities: only the error contributes to the blocking count, all three render', () => {
    renderSidebar({
      system: makeSystem(),
      roster: makeRoster(),
      validationErrors: [
        { message: 'Echter Verstoß.', severity: 'error' },
        { message: 'Nur eine Warnung.', severity: 'warning' },
        { message: 'Nur ein Hinweis.', severity: 'info' },
      ],
    });

    expect(screen.getByText('Fehlerhaft (1)')).toBeTruthy();
    expect(screen.getByText('Echter Verstoß.')).toBeTruthy();
    expect(screen.getByText('Nur eine Warnung.')).toBeTruthy();
    expect(screen.getByText('Nur ein Hinweis.')).toBeTruthy();
  });
});
