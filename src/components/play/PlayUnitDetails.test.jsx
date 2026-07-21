import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayUnitDetails from './PlayUnitDetails';
import { getSelectionTotalCost } from '../../solver/validator';

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  ReceiptText: (props) => <span data-testid="icon-receipt-text" {...props} />,
}));

const mockGroupProfilesByType = vi.fn(() => []);

// Die Komponente spricht den Solver ausschließlich über die Fassade an, daher
// wird auch nur die Fassade gemockt.
vi.mock('../../solver/validator', async () => ({
  // Reine Ableitung aus Roster und System — die echte Implementierung durchreichen,
  // damit der Test die tatsächlich verwendete Kostenart-id sieht.
  resolveCostLimitTypeId: (await vi.importActual('../../solver/rosterCounter')).resolveCostLimitTypeId,
  resolveCostLimitLabel: (await vi.importActual('../../solver/rosterCounter')).resolveCostLimitLabel,
  findEntryInSystem: vi.fn(() => null),
  resolveEntry: vi.fn(() => null),
  collectUnitProfilesAndRules: vi.fn(() => ({ profiles: [], rules: [] })),
  getSelectionTotalCost: vi.fn(() => 100),
  // Name resolution is covered by the solver's own unit tests; here it returns the
  // selection's raw name unchanged (no-name-modifier case).
  getEffectiveSelectionName: vi.fn((selection) => selection?.name ?? ''),
  groupProfilesByType: (...args) => mockGroupProfilesByType(...args),
  MODEL_COUNT_PROFILE_TYPES: [],
}));

vi.mock('../editor/UnitChips', () => ({
  UnitUpgradesChips: () => <div data-testid="unit-upgrades-chips">Upgrades</div>,
  UnitRulesChips: () => <div data-testid="unit-rules-chips">Rules</div>,
}));

function createDefaultProps(overrides = {}) {
  return {
    selection: {
      id: 'sel-1',
      name: 'Test Unit',
      number: 1,
      entryLinkId: 'entry-1',
      selections: [],
    },
    system: { catalogues: [] },
    roster: {
      catalogueId: 'cat-1',
      costLimitType: 'pts',
    },
    getUnitCurrentWounds: vi.fn((_selectionId, totalMaxWounds) => totalMaxWounds),
    handleAdjustWound: vi.fn(),
    handleMouseEnter: vi.fn(),
    handleMouseLeave: vi.fn(),
    setSaveSummaryData: vi.fn(),
    setSaveSummaryOpen: vi.fn(),
    onShowRule: vi.fn(),
    ...overrides,
  };
}

describe('PlayUnitDetails collapsible profiles', () => {
  beforeEach(() => {
    mockGroupProfilesByType.mockReturnValue([]);
  });

  it('renders the unit name', () => {
    render(<PlayUnitDetails {...createDefaultProps()} />);
    expect(screen.getByText('Test Unit')).toBeTruthy();
  });

  function renderWithProfiles(props = {}) {
    mockGroupProfilesByType.mockReturnValue([
      {
        typeName: 'Model',
        isModel: true,
        profiles: [
          {
            id: 'prof-1',
            name: 'Test Model',
            characteristics: [
              { name: 'M', value: '4' },
              { name: 'WS', value: '3' },
            ],
          },
        ],
      },
    ]);
    return render(<PlayUnitDetails {...createDefaultProps(props)} />);
  }

  it('renders the toggle button when profiles exist', () => {
    renderWithProfiles();
    expect(screen.getByTestId('icon-receipt-text')).toBeTruthy();
  });

  it('does not render the toggle button when no profiles exist', () => {
    mockGroupProfilesByType.mockReturnValue([]);
    render(<PlayUnitDetails {...createDefaultProps()} />);
    expect(screen.queryByTestId('icon-receipt-text')).toBeNull();
  });

  it('starts with profiles collapsed (play-unit-profiles without is-open)', () => {
    renderWithProfiles();
    const profilesContainer = document.querySelector('.play-unit-profiles');
    expect(profilesContainer).toBeTruthy();
    expect(profilesContainer.classList.contains('is-open')).toBe(false);
  });

  it('shows profiles after clicking the toggle button', () => {
    renderWithProfiles();
    const toggle = document.querySelector('.unit-card-details-toggle');
    fireEvent.click(toggle);
    const profilesContainer = document.querySelector('.play-unit-profiles');
    expect(profilesContainer.classList.contains('is-open')).toBe(true);
  });

  it('hides profiles after two clicks on the toggle button', () => {
    renderWithProfiles();
    const toggle = document.querySelector('.unit-card-details-toggle');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    const profilesContainer = document.querySelector('.play-unit-profiles');
    expect(profilesContainer.classList.contains('is-open')).toBe(false);
  });

  it('always shows upgrade badges regardless of collapse state', () => {
    mockGroupProfilesByType.mockReturnValue([]);
    const { unmount } = render(<PlayUnitDetails {...createDefaultProps()} />);
    expect(screen.getByTestId('unit-upgrades-chips')).toBeTruthy();
    expect(screen.getByTestId('unit-rules-chips')).toBeTruthy();
    unmount();
  });

  it('shows upgrade badges when collapsed and when expanded', () => {
    renderWithProfiles();
    expect(screen.getByTestId('unit-upgrades-chips')).toBeTruthy();
    expect(screen.getByTestId('unit-rules-chips')).toBeTruthy();
    const toggle = document.querySelector('.unit-card-details-toggle');
    fireEvent.click(toggle);
    expect(screen.getByTestId('unit-upgrades-chips')).toBeTruthy();
    expect(screen.getByTestId('unit-rules-chips')).toBeTruthy();
  });

  it('renders aria-expanded attribute on the toggle button', () => {
    renderWithProfiles();
    const toggle = document.querySelector('.unit-card-details-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders profile tables when is-open', () => {
    renderWithProfiles();
    const toggle = document.querySelector('.unit-card-details-toggle');
    fireEvent.click(toggle);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  // Regression (Issue 19, A1): the cost display must call getSelectionTotalCost with
  // the EvaluationContext object (system/roster/currentCatalogueId) so modifier-aware
  // costs stay active. The earlier positional call form put `system` into the context
  // slot and dropped roster/catalogueId, silently disabling modifier-aware costs.
  it('calls getSelectionTotalCost with an EvaluationContext object, not positional args', () => {
    getSelectionTotalCost.mockClear();
    const props = createDefaultProps();
    render(<PlayUnitDetails {...props} />);

    expect(getSelectionTotalCost).toHaveBeenCalled();
    const [selectionArg, costTypeArg, parentCountArg, contextArg] =
      getSelectionTotalCost.mock.calls[0];
    expect(selectionArg).toBe(props.selection);
    expect(costTypeArg).toBe('pts');
    expect(parentCountArg).toBe(1);
    expect(contextArg).toEqual({
      system: props.system,
      roster: props.roster,
      currentCatalogueId: props.roster.catalogueId,
    });
    // Guard against the old 6-positional-argument regression.
    expect(getSelectionTotalCost.mock.calls[0]).toHaveLength(4);
  });
});

// Issue 42/01: Die aus Regeltext geratene AS/WS-Anzeige ist ersatzlos entfallen;
// an ihrer Stelle im Kartenkopf steht der Wundenzähler.
describe('PlayUnitDetails Kartenkopf ohne AS/WS-Badges', () => {
  beforeEach(() => {
    mockGroupProfilesByType.mockReturnValue([]);
  });

  it('rendert keine Rüstungs- und Rettungswurf-Badges mehr', () => {
    render(<PlayUnitDetails {...createDefaultProps()} />);

    expect(screen.queryByText(/^AS:/)).toBeNull();
    expect(screen.queryByText(/^WS:/)).toBeNull();
    expect(document.querySelector('.play-unit-save-badge')).toBeNull();
    expect(document.querySelector('.play-unit-badges')).toBeNull();
  });

  it('zeigt den Wundenzähler im Kartenkopf und meldet Änderungen nach oben', () => {
    const props = createDefaultProps({
      // Zwei von drei Lebenspunkten übrig, damit beide Schaltflächen bedienbar sind.
      getUnitCurrentWounds: vi.fn(() => 2),
    });
    render(<PlayUnitDetails {...props} />);

    const header = document.querySelector('.play-unit-header .flex-between');
    const woundControls = header.querySelector('.play-unit-header-controls');
    // Der Zähler ist das erste Element der Kopfzeile — die Position der Badges.
    expect(header.firstElementChild).toBe(woundControls);
    expect(woundControls.textContent).toContain('2 / 1');

    const [decrement, increment] = woundControls.querySelectorAll('.qty-btn');
    fireEvent.click(decrement);
    expect(props.handleAdjustWound).toHaveBeenCalledWith('sel-1', -1, 1);
    fireEvent.click(increment);
    expect(props.handleAdjustWound).toHaveBeenCalledWith('sel-1', 1, 1);
  });

  it('liest den Wundenstand über die Hook-Funktion statt ihn selbst zu berechnen', () => {
    const props = createDefaultProps();
    render(<PlayUnitDetails {...props} />);

    expect(props.getUnitCurrentWounds).toHaveBeenCalledWith('sel-1', 1);
  });
});
