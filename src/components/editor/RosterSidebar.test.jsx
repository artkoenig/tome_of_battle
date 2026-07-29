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

/** Eine Autoren-Meldung in der Berichtsform der Evaluator-Fassade (Text-Pass-through). */
function authorMessage(text, severity) {
  return {
    origin: 'authorMessage',
    severity,
    anchor: { defId: 'entry-1', name: 'Special Character', path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
    text,
  };
}

function renderSidebar({ system, roster, costs = { pts: 0 }, violations = [] }) {
  return render(
    <RosterSidebar
      roster={roster}
      system={system}
      costs={costs}
      violations={violations}
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

describe('RosterSidebar category max inheritance (system-bound quirk)', () => {
  // Verifizierte Anker des WHFB6-Vererbungs-Quirks (siehe systemQuirks.test.js):
  // Heroes erbt einen fehlenden max von Characters — aber nur in diesem System.
  const WHFB6_SYSTEM_ID = '6d8e-38d9-3c69-febf';
  const HEROES_CATEGORY_ID = 'c16b-f319-2c62-2c12';
  const CHARACTERS_CATEGORY_ID = '7a1c-d611-c2dc-def1';

  function makeQuirkSystem(systemId) {
    return {
      id: systemId,
      costTypes: [{ id: 'pts', name: 'Points' }],
      categoryEntries: [
        { id: HEROES_CATEGORY_ID, name: 'Heroes' },
        { id: CHARACTERS_CATEGORY_ID, name: 'Characters' },
      ],
      forceEntries: [
        {
          id: FORCE_ENTRY_ID,
          name: 'Main Force',
          categoryLinks: [
            {
              id: 'cl-characters',
              targetId: CHARACTERS_CATEGORY_ID,
              name: 'Characters',
              constraints: [{ id: 'c-max', type: 'max', value: 3, field: 'selections', scope: 'force' }],
            },
            { id: 'cl-heroes', targetId: HEROES_CATEGORY_ID, name: 'Heroes', constraints: [] },
          ],
        },
      ],
      catalogues: [],
    };
  }

  const heroesRowText = () =>
    screen.getByText('Heroes:').closest('.sidebar-requirement-row').textContent;

  it('lets the Heroes row inherit the Characters maximum in the quirk system', () => {
    renderSidebar({ system: makeQuirkSystem(WHFB6_SYSTEM_ID), roster: makeRoster() });

    expect(heroesRowText()).toMatch(/Max: 3/);
  });

  it('does not apply the inheritance for a system the quirk is not declared for', () => {
    renderSidebar({ system: makeQuirkSystem('aaaa-bbbb-cccc-dddd'), roster: makeRoster() });

    expect(heroesRowText()).not.toMatch(/Max/);
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

describe('RosterSidebar structured validation messages', () => {
  it('renders a derived evaluator violation as translated text (formatViolation)', () => {
    renderSidebar({
      system: makeSystem(),
      roster: makeRoster(),
      violations: [{
        origin: 'derivedLimit',
        severity: 'error',
        anchor: { defId: 'def-1', name: 'Musician', path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
        limitId: 'lim-1',
        limit: {
          kind: 'max',
          measure: 'selectionCount',
          costTypeId: null,
          isPercent: false,
          scope: { kind: 'parent', targetId: null, flags: { shared: true, includeChildSelections: false, includeChildForces: false } },
        },
        actual: 2,
        bound: 1,
        delta: -1,
        derivation: { base: 1, steps: [] },
      }],
    });

    // validation.evaluator.selectionCount.max.local_one mit name=Musician
    expect(
      screen.getByText('„Musician" darf höchstens einmal gewählt werden.')
    ).toBeTruthy();
  });
});

describe('RosterSidebar validation severity', () => {
  it('renders an error entry with the danger icon and no severity modifier class', () => {
    renderSidebar({
      system: makeSystem(),
      roster: makeRoster(),
      violations: [authorMessage('Zu viele Helden gewählt.', 'error')],
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
      violations: [authorMessage('Bitte "Allow special characters?" aktivieren.', 'warning')],
    });

    expect(screen.getByTestId('icon-alert-triangle')).toBeTruthy();
    expect(screen.getByText(/aktivieren/).closest('.validation-error-item').className).toMatch(/--warning/);
    expect(screen.getByText('Gültig')).toBeTruthy();
  });

  it('renders an info entry with its own icon/class and does not mark the roster invalid', () => {
    renderSidebar({
      system: makeSystem(),
      roster: makeRoster(),
      violations: [authorMessage('Hinweis zur Aufstellung.', 'info')],
    });

    expect(screen.getByTestId('icon-info')).toBeTruthy();
    expect(screen.getByText('Hinweis zur Aufstellung.').closest('.validation-error-item').className).toMatch(/--info/);
    expect(screen.getByText('Gültig')).toBeTruthy();
  });

  it('mixes severities: only the error contributes to the blocking count, all three render', () => {
    renderSidebar({
      system: makeSystem(),
      roster: makeRoster(),
      violations: [
        authorMessage('Echter Verstoß.', 'error'),
        authorMessage('Nur eine Warnung.', 'warning'),
        authorMessage('Nur ein Hinweis.', 'info'),
      ],
    });

    expect(screen.getByText('Fehlerhaft (1)')).toBeTruthy();
    expect(screen.getByText('Echter Verstoß.')).toBeTruthy();
    expect(screen.getByText('Nur eine Warnung.')).toBeTruthy();
    expect(screen.getByText('Nur ein Hinweis.')).toBeTruthy();
  });
});
