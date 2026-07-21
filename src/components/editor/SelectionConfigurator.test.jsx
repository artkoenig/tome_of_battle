import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SelectionConfigurator from './SelectionConfigurator';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: (props) => <span data-testid="icon-info" {...props} />,
  BookOpen: (props) => <span data-testid="icon-book" {...props} />,
}));

// Standalone options resolve their link through RuleChipIcon, which uses the real
// useRuleUrl hook. Mocking the mapping lookup and the linking setting lets the
// configurator be exercised with linking on and off.
const mockGetRuleUrl = vi.fn().mockReturnValue(null);
vi.mock('../../data/rulesLookup', () => ({
  getRuleUrl: (name) => mockGetRuleUrl(name),
}));

const mockUseSettings = vi.fn();
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

// Mock child components
vi.mock('./BottomSheet', () => ({
  default: ({ isOpen, children, title, onClose }) => isOpen ? (
    <div data-testid="bottom-sheet">
      <h4>{title}</h4>
      {children}
      <button onClick={onClose}>Close</button>
    </div>
  ) : null
}));

// Render each option group as an identifiable stub so the grouping (which key merges
// items) is observable without pulling in OptionGroup's full dependency surface.
vi.mock('./OptionGroup', () => ({
  default: ({ group }) => (
    <div data-testid="option-group" data-group-id={group.id}>{group.name}</div>
  )
}));

// Mock validators
const mockResolveEntry = vi.fn();
const mockFindEntryInSystem = vi.fn();
const mockGetSelectionTotalCost = vi.fn();
const mockComputeRosterCounts = vi.fn();

const mockGetUnitOptions = vi.fn();

// Die Komponente spricht den Solver ausschließlich über die Fassade an, daher
// wird auch nur die Fassade gemockt. Reine Funktionen ohne eigene
// Abhängigkeiten — das Prädikat „eigenständige Untereinheit", die
// System-Eigenheiten und die Schlüsselwortlisten — reicht der Mock in ihrer
// echten Umsetzung durch, statt sie zu stubben.
vi.mock('../../solver/validator', async () => ({
  // Reine Baum-Primitive: die echte Implementierung durchreichen statt sie im Mock
  // nachzubauen — ihre Rekursion ist in rosterTree.test.js eigens abgedeckt.
  findForceContainingSelection: (await vi.importActual('../../solver/rosterTree')).findForceContainingSelection,
  countSelections: (await vi.importActual('../../solver/rosterTree')).countSelections,
  // Reine Ableitung aus Roster und System — die echte Bezeichnung der Kostenart durchreichen.
  resolveCostLimitLabel: (await vi.importActual('../../solver/rosterCounter')).resolveCostLimitLabel,
  resolveEntry: (...args) => mockResolveEntry(...args),
  findEntryInSystem: (...args) => mockFindEntryInSystem(...args),
  getSelectionTotalCost: (...args) => mockGetSelectionTotalCost(...args),
  computeRosterCounts: (...args) => mockComputeRosterCounts(...args),
  getModifiedConstraintValue: (con) => con.value || 1,
  calculateRosterCosts: () => ({ pts: 0 }),
  getOptionDisplayCost: () => 10,
  isIndependentSubUnit: (await vi.importActual('../../solver/subUnit')).isIndependentSubUnit,
  getUnitOptions: (...args) => mockGetUnitOptions(...args),
  isUniqueOptionTakenElsewhere: () => false,
  isOptionRosterUnique: () => false,
  isQuirkGeneralEntryId: (await vi.importActual('../../solver/systemQuirks')).isQuirkGeneralEntryId,
  ...(await vi.importActual('../../solver/constants')),
}));

describe('SelectionConfigurator Component', () => {
  const mockSubSelectionOperations = createSubSelectionOperationsMock();
  // Reale Kataloge deklarieren ihre Kostenarten; der Anzeigename wird
  // unveraendert uebernommen (hier `pts`, nicht uebersetzt).
  const mockSystem = { id: 'sys-1', costTypes: [{ id: 'pts', name: 'pts' }] };
  const mockRoster = {
    costLimitType: 'pts',
    forces: [{ id: 'force-1', selections: [] }]
  };
  const mockCatalogue = { id: 'cat-1' };

  const mockSelection = {
    id: 'sel-1',
    name: 'Tactical Squad',
    entryLinkId: 'el-1',
    selections: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuleUrl.mockReturnValue(null);
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true });
    mockComputeRosterCounts.mockReturnValue({
      selectionCounts: {},
      categoryCounts: { 'force-1': {} }
    });
  });

  it('renders nothing or "Keine Optionen" if options list is empty', () => {
    mockGetUnitOptions.mockReturnValue([]);
    
    render(
      <SelectionConfigurator
        selection={mockSelection}
        system={mockSystem}
        roster={mockRoster}
        subSelectionOperations={mockSubSelectionOperations}
        activeCatalogue={mockCatalogue}
      />
    );

    expect(screen.getByText('Optionen & Ausrüstung konfigurieren')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Minus' })).toBeNull();
  });

  it('hides the "Optionen & Ausrüstung konfigurieren" header for a list rule', () => {
    mockGetUnitOptions.mockReturnValue([]);

    render(
      <SelectionConfigurator
        selection={mockSelection}
        system={mockSystem}
        roster={mockRoster}
        subSelectionOperations={mockSubSelectionOperations}
        activeCatalogue={mockCatalogue}
        isListRule
      />
    );

    expect(screen.queryByText('Optionen & Ausrüstung konfigurieren')).toBeNull();
  });

  it('renders standalone selectable options correctly', () => {
    const mockOption = { id: 'opt-1', name: 'Frag Grenades', costs: [{ typeId: 'pts', value: 5 }] };
    mockGetUnitOptions.mockReturnValue([
      { option: mockOption, parentDefId: 'sel-1', groupName: null }
    ]);
    mockFindEntryInSystem.mockReturnValue(mockOption);
    mockResolveEntry.mockReturnValue(mockOption);

    render(
      <SelectionConfigurator
        selection={mockSelection}
        system={mockSystem}
        roster={mockRoster}
        subSelectionOperations={mockSubSelectionOperations}
        activeCatalogue={mockCatalogue}
      />
    );

    expect(screen.getByText('Frag Grenades')).toBeDefined();
    expect(screen.getByText(/\+\s*10\s*pts/)).toBeDefined(); // based on getOptionDisplayCost mock returning 10
  });

  it('handles increment and decrement actions for standalone options', () => {
    const mockOption = { id: 'opt-1', name: 'Frag Grenades', costs: [{ typeId: 'pts', value: 5 }] };
    mockGetUnitOptions.mockReturnValue([
      { option: mockOption, parentDefId: 'sel-1', groupName: null }
    ]);
    mockFindEntryInSystem.mockReturnValue(mockOption);
    mockResolveEntry.mockReturnValue(mockOption);

    // Render with selection already containing 1 grenade
    const selectionWithGrenade = {
      ...mockSelection,
      selections: [{ id: 'sub-1', entryLinkId: 'opt-1', number: 1, selections: [] }]
    };

    render(
      <SelectionConfigurator
        selection={selectionWithGrenade}
        system={mockSystem}
        roster={mockRoster}
        subSelectionOperations={mockSubSelectionOperations}
        activeCatalogue={mockCatalogue}
      />
    );

    // Should display current count
    expect(screen.getByText('1')).toBeDefined();

    // Click increment
    const plusBtn = screen.getByTestId('icon-plus').closest('button');
    fireEvent.click(plusBtn);
    expect(mockSubSelectionOperations.increaseCount).toHaveBeenCalledTimes(1);
    expect(mockSubSelectionOperations.increaseCount).toHaveBeenCalledWith('sel-1', mockOption);

    mockSubSelectionOperations.increaseCount.mockClear();

    // Click decrement
    const minusBtn = screen.getByTestId('icon-minus').closest('button');
    fireEvent.click(minusBtn);
    expect(mockSubSelectionOperations.decreaseCount).toHaveBeenCalledTimes(1);
    expect(mockSubSelectionOperations.decreaseCount).toHaveBeenCalledWith('sel-1', mockOption);
  });

  it('honors the whfb6 linking setting for standalone mapped options', () => {
    // A mapped standalone magic item that also carries catalogue info (publicationRef),
    // so the link-vs-fallback switch is observable: link when enabled, Info when disabled.
    const mappedOption = { id: 'opt-blade', name: 'Blade of Realities', publicationRef: 'p. 42' };
    mockGetUnitOptions.mockReturnValue([
      { option: mappedOption, parentDefId: 'sel-1', groupName: null }
    ]);
    mockFindEntryInSystem.mockReturnValue(mappedOption);
    mockResolveEntry.mockReturnValue(mappedOption);
    mockGetRuleUrl.mockImplementation((name) =>
      name === 'Blade of Realities' ? 'https://6th.whfb.app/magic-item/blade-of-realities' : null
    );

    const renderConfigurator = () =>
      render(
        <SelectionConfigurator
          selection={mockSelection}
          system={mockSystem}
          roster={mockRoster}
          subSelectionOperations={mockSubSelectionOperations}
          activeCatalogue={mockCatalogue}
        />
      );

    // Linking enabled -> the BookOpen link is shown and the Info is not offered.
    const { unmount } = renderConfigurator();
    expect(screen.getByTestId('icon-book')).toBeTruthy();
    expect(screen.queryByTestId('icon-info')).toBeNull();
    unmount();

    // Linking disabled -> falls back to the catalogue Info, no link.
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: false });
    renderConfigurator();
    expect(screen.queryByTestId('icon-book')).toBeNull();
    expect(screen.getByTestId('icon-info')).toBeTruthy();
  });

  it('keeps identically-named groups separate by grouping on the group id (Issue 17/07)', () => {
    // Two distinct groups that happen to share the display name "Vampiric Powers" must
    // render as two groups, not collapse into one merged group (which used to drop the
    // second group's items/modifiers).
    const optionA = { id: 'power-a', name: 'Blademaster' };
    const optionB = { id: 'power-b', name: 'Red Fury' };
    mockGetUnitOptions.mockReturnValue([
      { option: optionA, parentDefId: 'sel-1', groupName: 'Vampiric Powers', groupId: 'vp-group-a' },
      { option: optionB, parentDefId: 'sel-1', groupName: 'Vampiric Powers', groupId: 'vp-group-b' }
    ]);
    mockResolveEntry.mockImplementation(opt => opt);
    mockFindEntryInSystem.mockImplementation(opt => opt);

    render(
      <SelectionConfigurator
        selection={mockSelection}
        system={mockSystem}
        roster={mockRoster}
        subSelectionOperations={mockSubSelectionOperations}
        activeCatalogue={mockCatalogue}
      />
    );

    const renderedGroups = screen.getAllByTestId('option-group');
    expect(renderedGroups).toHaveLength(2);
    expect(renderedGroups.map(g => g.getAttribute('data-group-id')).sort()).toEqual(['vp-group-a', 'vp-group-b']);
  });
});
