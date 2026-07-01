import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OptionGroupComponent from './OptionGroup';
import { resolveEntry, findEntryInSystem, getModifiedConstraintValue, computeRosterCounts, getOptionDisplayCost, getSelectionTotalCost } from '../../solver/validator';
import { isUniqueOptionTakenElsewhere } from '../../solver/optionsCollector';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: () => <span data-testid="icon-info" />,
}));

// Mock Debug Context
let mockShowDebugIds = false;
vi.mock('../../hooks/DebugContext', () => ({
  useDebugMode: () => ({ showDebugIds: mockShowDebugIds })
}));

// Mock Validator
const mockResolveEntry = vi.fn();
const mockFindEntryInSystem = vi.fn();
const mockGetModifiedConstraintValue = vi.fn();
const mockComputeRosterCounts = vi.fn();
const mockGetOptionDisplayCost = vi.fn();
const mockGetSelectionTotalCost = vi.fn();

vi.mock('../../solver/validator', () => ({
  resolveEntry: (...args) => mockResolveEntry(...args),
  findEntryInSystem: (...args) => mockFindEntryInSystem(...args),
  getModifiedConstraintValue: (...args) => mockGetModifiedConstraintValue(...args),
  computeRosterCounts: (...args) => mockComputeRosterCounts(...args),
  getOptionDisplayCost: (...args) => mockGetOptionDisplayCost(...args),
  getSelectionTotalCost: (...args) => mockGetSelectionTotalCost(...args),
}));

// Mock Options Collector
const mockIsUniqueOptionTakenElsewhere = vi.fn();
const mockIsOptionRosterUnique = vi.fn();
vi.mock('../../solver/optionsCollector', () => ({
  isUniqueOptionTakenElsewhere: (...args) => mockIsUniqueOptionTakenElsewhere(...args),
  isOptionRosterUnique: (...args) => mockIsOptionRosterUnique(...args)
}));

describe('OptionGroup Component', () => {
  const mockGroup = {
    id: 'grp-1',
    name: 'Magic Weapons',
    constraints: [
      { type: 'max', value: 1, scope: 'parent' }
    ],
    items: [
      { option: { id: 'opt-sword' }, groupConstraints: [{ type: 'max', value: 1 }] },
      { option: { id: 'opt-axe' }, groupConstraints: [{ type: 'max', value: 1 }] }
    ]
  };

  const mockSelection = {
    id: 'sel-unit',
    entryLinkId: 'unit-link-id',
    number: 1,
    selections: []
  };

  const mockSystem = {
    costTypes: [{ id: 'pts', name: 'Points' }]
  };

  const mockRoster = {
    costLimitType: 'pts',
    forces: []
  };

  const defaultProps = {
    group: mockGroup,
    selection: mockSelection,
    system: mockSystem,
    roster: mockRoster,
    getSubSelectionCount: vi.fn().mockReturnValue(0),
    updateSubSelection: vi.fn(),
    costTypeLabel: 'Pkt.',
    getOptionDescription: vi.fn().mockReturnValue('A magic weapon'),
    activeCatalogue: { id: 'cat-bretonnia' },
    setActiveInfo: vi.fn(),
    onHoverEnter: vi.fn(),
    onHoverMove: vi.fn(),
    onHoverLeave: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockShowDebugIds = false;
    
    mockFindEntryInSystem.mockReturnValue({ id: 'raw-entry' });
    mockResolveEntry.mockImplementation((sys, opt, catId) => {
      if (opt.id === 'opt-sword') {
        return { id: 'res-sword', name: 'Sword of Might', constraints: [] };
      }
      if (opt.id === 'opt-axe') {
        return { id: 'res-axe', name: 'Axe of Doom', constraints: [] };
      }
      return { id: 'unit-resolved', name: 'Knight', categoryLinks: [] };
    });

    mockComputeRosterCounts.mockReturnValue({ selectionCounts: {}, categoryCounts: {} });
    mockGetModifiedConstraintValue.mockImplementation((con) => con.value);
    mockGetOptionDisplayCost.mockImplementation((sys, opt) => {
      if (opt.id === 'opt-sword') return 20;
      if (opt.id === 'opt-axe') return 30;
      return 0;
    });
    mockIsUniqueOptionTakenElsewhere.mockReturnValue(false);
  });

  it('1. Render Header Details', () => {
    // Return that Sword of Might is selected
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => {
      if (id === 'res-sword') return 1;
      return 0;
    });

    render(<OptionGroupComponent {...defaultProps} />);

    expect(screen.getByText('Magic Weapons')).toBeDefined();
    expect(screen.getByText(/Max: 1/)).toBeDefined();
    expect(screen.getByText('Auswahl: Sword of Might')).toBeDefined();
  });

  it('2. Expansion Toggle', () => {
    const { container } = render(<OptionGroupComponent {...defaultProps} />);

    // Initially collapsed
    expect(screen.queryByTestId('icon-chevron-right')).toBeDefined();
    expect(screen.queryByText('Sword of Might')).toBeNull();

    // Click header to expand
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    expect(screen.queryByTestId('icon-chevron-down')).toBeDefined();
    expect(screen.getByText('Sword of Might')).toBeDefined();
    expect(screen.getByText('Axe of Doom')).toBeDefined();
  });

  it('3. Sort Option Items descending by cost', () => {
    render(<OptionGroupComponent {...defaultProps} />);
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    // Axe (30 pts) should render before Sword (20 pts)
    const items = screen.getAllByText(/\+.*Pkt\./);
    expect(items[0].textContent).toContain('+30 Pkt.');
    expect(items[1].textContent).toContain('+20 Pkt.');
  });

  it('4. Radio Option Selection', () => {
    // Magic weapons group max limit is 1, so they render as radio buttons
    render(<OptionGroupComponent {...defaultProps} />);
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(2);

    // Click Axe radio
    fireEvent.click(radios[0]); // Axe of Doom
    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }), 'increment', 1);

    // Mock that Sword is currently selected (count = 1)
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => {
      if (id === 'res-sword') return 1;
      return 0;
    });

    // Re-render and click Axe radio, should decrement Sword and increment Axe
    const { unmount } = render(<OptionGroupComponent {...defaultProps} />);
    const axeRadio = screen.getAllByRole('radio')[0];
    fireEvent.click(axeRadio);

    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-sword' }), 'decrement', 1);
    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }), 'increment', 1);
    unmount();
  });

  it('5. Binary Option Selection (Checkbox)', () => {
    // Define a group where max constraint is 2, so they render as checkboxes
    const checkboxGroup = {
      ...mockGroup,
      constraints: [
        { type: 'max', value: 2, scope: 'parent' }
      ],
      items: [
        { option: { id: 'opt-sword' }, groupConstraints: [{ type: 'max', value: 2 }] },
        { option: { id: 'opt-axe' }, groupConstraints: [{ type: 'max', value: 2 }] }
      ]
    };
    
    mockResolveEntry.mockImplementation((sys, opt, catId) => {
      if (opt.id === 'opt-sword') {
        return { id: 'res-sword', name: 'Sword of Might', constraints: [{ type: 'max', value: 1 }] };
      }
      if (opt.id === 'opt-axe') {
        return { id: 'res-axe', name: 'Axe of Doom', constraints: [{ type: 'max', value: 1 }] };
      }
      return { id: 'unit-resolved', name: 'Knight', categoryLinks: [] };
    });

    render(<OptionGroupComponent {...defaultProps} group={checkboxGroup} />);
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);

    // Click checkbox
    fireEvent.click(checkboxes[0]);
    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }), 'increment', 1);
  });

  it('6. Quantity Option Selection', () => {
    // Mock Sword option to have max constraint of 5 (so multi-count, quantity control)
    mockResolveEntry.mockImplementation((sys, opt, catId) => {
      if (opt.id === 'opt-sword') {
        return { 
          id: 'res-sword', 
          name: 'Sword of Might', 
          constraints: [{ type: 'max', value: 5 }] 
        };
      }
      return { id: 'res-axe', name: 'Axe of Doom', constraints: [] };
    });

    // Set Sword count to 2
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => {
      if (id === 'res-sword') return 2;
      return 0;
    });

    render(<OptionGroupComponent {...defaultProps} />);
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    expect(screen.getByText('2')).toBeDefined();

    const minusBtn = screen.getByTestId('icon-minus').closest('button');
    const plusBtn = screen.getByTestId('icon-plus').closest('button');

    fireEvent.click(plusBtn);
    expect(defaultProps.updateSubSelection).toHaveBeenCalledTimes(1);
    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-sword' }), 'increment', 1);

    defaultProps.updateSubSelection.mockClear();

    fireEvent.click(minusBtn);
    expect(defaultProps.updateSubSelection).toHaveBeenCalledTimes(1);
    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-sword' }), 'decrement', 1);
  });

  it('7. Exceeding Point Limit Violations', () => {
    // Add pts constraint of max 25 on group
    const ptsLimitedGroup = {
      ...mockGroup,
      constraints: [
        { type: 'max', value: 25, field: 'pts' }
      ]
    };

    // Sword costs 20, Axe costs 30.
    // If Sword is selected twice (40 pts), adding Axe (30 pts) would exceed 25 limit and trigger hasGroupError.
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => {
      if (id === 'res-sword') return 2;
      return 0;
    });

    render(<OptionGroupComponent {...defaultProps} group={ptsLimitedGroup} />);

    // Header should show error/danger (background style has danger, hasGroupError = true)
    const header = screen.getByText('Magic Weapons').closest('div').parentElement;
    expect(header.style.backgroundColor).toContain('rgba(239, 68, 68, 0.05)');

    fireEvent.click(header);

    // Axe row should be disabled (disabled class/style)
    const axeRow = screen.getByText('Axe of Doom').closest('.sub-selection-row');
    expect(axeRow.className).toContain('disabled');

    // Click disabled row should not call updateSubSelection
    fireEvent.click(axeRow);
    expect(defaultProps.updateSubSelection).not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }), 'increment', 1);
  });

  it('8. Roster-Wide Uniqueness (Bereits vergeben)', () => {
    mockIsUniqueOptionTakenElsewhere.mockImplementation((res) => {
      if (res.id === 'res-axe') return true;
      return false;
    });
    mockIsOptionRosterUnique.mockImplementation((res) => {
      if (res.id === 'res-axe') return true;
      return false;
    });

    mockResolveEntry.mockImplementation((sys, opt, catId) => {
      if (opt.id === 'opt-sword') {
        return { id: 'res-sword', name: 'Sword of Might', constraints: [] };
      }
      if (opt.id === 'opt-axe') {
        return { 
          id: 'res-axe', 
          name: 'Axe of Doom', 
          constraints: [{ type: 'max', value: 1, scope: 'roster' }] 
        };
      }
      return { id: 'unit-resolved', name: 'Knight', categoryLinks: [] };
    });

    render(<OptionGroupComponent {...defaultProps} />);
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    expect(screen.getByText('(Bereits vergeben)')).toBeDefined();

    const axeRow = screen.getByText('Axe of Doom').closest('.sub-selection-row');
    expect(axeRow.className).toContain('disabled');

    fireEvent.click(axeRow);
    expect(defaultProps.updateSubSelection).not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }), 'increment', 1);
  });

  it('9. Desktop Hover tooltips for option descriptions', () => {
    render(<OptionGroupComponent {...defaultProps} />);
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    const swordText = screen.getByText('Sword of Might');
    
    // Hover
    fireEvent.mouseEnter(swordText);
    expect(defaultProps.onHoverEnter).toHaveBeenCalledWith('Sword of Might', 'A magic weapon', expect.any(Object));

    // Mouse Move
    fireEvent.mouseMove(swordText);
    expect(defaultProps.onHoverMove).toHaveBeenCalled();

    // Mouse Leave
    fireEvent.mouseLeave(swordText);
    expect(defaultProps.onHoverLeave).toHaveBeenCalled();
  });

  it('10. Mobile Help Button triggers setActiveInfo', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
    
    render(<OptionGroupComponent {...defaultProps} />);
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    const infoBtn = screen.getAllByTitle('Beschreibung anzeigen')[0];
    fireEvent.click(infoBtn);

    expect(defaultProps.setActiveInfo).toHaveBeenCalledWith({
      title: 'Axe of Doom',
      text: 'A magic weapon'
    });
  });

  it('11. Debug ID Toggle', () => {
    mockShowDebugIds = true;
    render(<OptionGroupComponent {...defaultProps} />);
    
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    expect(screen.getByText('def:grp-1')).toBeDefined();
    expect(screen.getByText('res-sword')).toBeDefined();
  });

  it('12. Row clicks for binary checkbox and radio items', () => {
    // 12a. Test checkbox row click (increment / decrement)
    const checkboxGroup = {
      ...mockGroup,
      constraints: [{ type: 'max', value: 2, scope: 'parent' }],
      items: [
        { option: { id: 'opt-sword' }, groupConstraints: [{ type: 'max', value: 2 }] },
        { option: { id: 'opt-axe' }, groupConstraints: [{ type: 'max', value: 2 }] }
      ]
    };
    
    mockResolveEntry.mockImplementation((sys, opt, catId) => {
      if (opt.id === 'opt-sword') {
        return { id: 'res-sword', name: 'Sword of Might', constraints: [{ type: 'max', value: 1 }] };
      }
      return { id: 'res-axe', name: 'Axe of Doom', constraints: [{ type: 'max', value: 1 }] };
    });

    defaultProps.getSubSelectionCount.mockReturnValue(0);

    const { unmount } = render(<OptionGroupComponent {...defaultProps} group={checkboxGroup} />);
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    // Click checkbox row (Axe) when unchecked -> increment
    const axeRow = screen.getByText('Axe of Doom').closest('.sub-selection-row');
    fireEvent.click(axeRow);
    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }), 'increment', 1);

    // Mock count = 1 (checked)
    unmount(); // Unmount first to avoid JSDOM duplicate elements
    
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => {
      if (id === 'res-axe') return 1;
      return 0;
    });

    const { unmount: unmount2 } = render(<OptionGroupComponent {...defaultProps} group={checkboxGroup} />);
    const header2 = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header2);

    const axeRow2 = screen.getByText('Axe of Doom').closest('.sub-selection-row');
    fireEvent.click(axeRow2);
    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }), 'decrement', 1);

    unmount2();
  });

  it('13. Click already checked radio button decrements it', () => {
    // Mock that Sword is selected (count = 1)
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => {
      if (id === 'res-sword') return 1;
      return 0;
    });

    render(<OptionGroupComponent {...defaultProps} />);
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    const radios = screen.getAllByRole('radio');
    
    // Click already checked Sword radio
    fireEvent.click(radios[1]); // Sword of Might radio is radios[1]
    
    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-sword' }), 'decrement', 1);
  });
});
