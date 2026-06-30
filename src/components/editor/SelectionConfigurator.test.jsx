import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SelectionConfigurator from './SelectionConfigurator';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: () => <span data-testid="icon-info" />,
}));

// Mock Debug Context
vi.mock('../../hooks/DebugContext', () => ({
  useDebugMode: () => ({ showDebugIds: false })
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

// Mock validators
const mockResolveEntry = vi.fn();
const mockFindEntryInSystem = vi.fn();
const mockGetSelectionTotalCost = vi.fn();
const mockComputeRosterCounts = vi.fn();

vi.mock('../../solver/validator', () => ({
  resolveEntry: (...args) => mockResolveEntry(...args),
  findEntryInSystem: (...args) => mockFindEntryInSystem(...args),
  getSelectionTotalCost: (...args) => mockGetSelectionTotalCost(...args),
  computeRosterCounts: (...args) => mockComputeRosterCounts(...args),
  getModifiedConstraintValue: (con) => con.value || 1,
  calculateRosterCosts: () => ({ pts: 0 }),
  getOptionDisplayCost: () => 10,
}));

// Mock optionsCollector
const mockGetUnitOptions = vi.fn();
vi.mock('../../solver/optionsCollector', () => ({
  getUnitOptions: (...args) => mockGetUnitOptions(...args),
  isUniqueOptionTakenElsewhere: () => false,
}));

describe('SelectionConfigurator Component', () => {
  const mockUpdateSubSelection = vi.fn();
  const mockSystem = { id: 'sys-1' };
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
        updateSubSelection={mockUpdateSubSelection}
        costTypeLabel="Pkt."
        activeCatalogue={mockCatalogue}
      />
    );

    expect(screen.getByText('Optionen & Ausrüstung konfigurieren')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Minus' })).toBeNull();
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
        updateSubSelection={mockUpdateSubSelection}
        costTypeLabel="Pkt."
        activeCatalogue={mockCatalogue}
      />
    );

    expect(screen.getByText('Frag Grenades')).toBeDefined();
    expect(screen.getByText(/\+\s*10\s*Pkt\./)).toBeDefined(); // based on getOptionDisplayCost mock returning 10
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
        updateSubSelection={mockUpdateSubSelection}
        costTypeLabel="Pkt."
        activeCatalogue={mockCatalogue}
      />
    );

    // Should display current count
    expect(screen.getByText('1')).toBeDefined();

    // Click increment
    const plusBtn = screen.getByTestId('icon-plus').closest('button');
    fireEvent.click(plusBtn);
    expect(mockUpdateSubSelection).toHaveBeenCalledWith('sel-1', mockOption, 'increment', 1);

    // Click decrement
    const minusBtn = screen.getByTestId('icon-minus').closest('button');
    fireEvent.click(minusBtn);
    expect(mockUpdateSubSelection).toHaveBeenCalledWith('sel-1', mockOption, 'decrement', 1);
  });
});
