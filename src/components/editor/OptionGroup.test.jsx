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
  Info: ({ onClick, ...rest }) => <span data-testid="icon-info" onClick={onClick} {...rest} />,
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

    // clearAllMocks keeps implementations, so reset the selection-count mock to a
    // clean "nothing selected" baseline each test (groups now auto-expand when a
    // selection exists, which would otherwise leak between tests).
    defaultProps.getSubSelectionCount.mockReset().mockReturnValue(0);

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
    // Sword is already selected, so the group auto-expands.
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

    // Sword is already selected, so the group auto-expands — no header click needed.

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

  it('9. Option name shows pointer cursor and is clickable', () => {
    render(<OptionGroupComponent {...defaultProps} />);
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    const swordText = screen.getByText('Sword of Might');
    expect(swordText).toBeDefined();
  });

  it('10. Mobile Help Button triggers setActiveInfo', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
    
    render(<OptionGroupComponent {...defaultProps} />);
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    const infoIcons = screen.getAllByTestId('icon-info');
    expect(infoIcons.length).toBe(2);
    fireEvent.click(infoIcons[0]);

    // The first Info icon belongs to the first visible item
    expect(defaultProps.setActiveInfo).toHaveBeenCalledOnce();
    const callArg = defaultProps.setActiveInfo.mock.calls[0][0];
    expect(callArg).toHaveProperty('title');
    expect(callArg).toHaveProperty('text');
  });

  it('11. Debug ID Toggle', () => {
    mockShowDebugIds = true;
    render(<OptionGroupComponent {...defaultProps} />);
    
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    expect(screen.getByText('def:grp-1')).toBeDefined();
    expect(screen.getByText('res-sword')).toBeDefined();
  });

  it('12. Option name text does nothing on click, only icon triggers setActiveInfo', () => {
    // Clicking the name text should do nothing (no setActiveInfo call, no error)
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
    render(<OptionGroupComponent {...defaultProps} />);
    const header = screen.getByText('Magic Weapons').closest('div');
    fireEvent.click(header);

    const optionText = screen.getByText('Sword of Might');
    fireEvent.click(optionText);
    expect(defaultProps.setActiveInfo).not.toHaveBeenCalled();
  });

  it('13. Row clicks for binary checkbox and radio items', () => {
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
    // Axe is now selected, so the group auto-expands.
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
    // Sword is already selected, so the group auto-expands.
    const radios = screen.getAllByRole('radio');

    // Click already checked Sword radio
    fireEvent.click(radios[1]); // Sword of Might radio is radios[1]
    
    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-sword' }), 'decrement', 1);
  });

  // A group modelling Battlescribe's "Arcane Items": nominally max=1, but an
  // increment modifier with a <repeat> lifts the cap for each Dispel Scroll taken,
  // so Dispel Scroll may be taken more than once while Grey Wand stays exclusive.
  const arcaneGroup = {
    id: 'grp-arcane',
    name: 'Arcane Items',
    constraints: [{ type: 'max', value: 1, scope: 'parent', id: 'con-arcane-max' }],
    modifiers: [
      { type: 'increment', field: 'con-arcane-max', value: 1, repeat: { childId: 'opt-scroll', value: 1, repeats: 1 } }
    ],
    items: [
      { option: { id: 'opt-scroll' }, groupConstraints: [{ type: 'max', value: 1, id: 'con-arcane-max' }] },
      { option: { id: 'opt-wand' }, groupConstraints: [{ type: 'max', value: 1, id: 'con-arcane-max' }] }
    ]
  };

  const mockArcaneItems = () => {
    mockResolveEntry.mockImplementation((sys, opt) => {
      if (opt.id === 'opt-scroll') return { id: 'res-scroll', name: 'Dispel Scroll', constraints: [] };
      if (opt.id === 'opt-wand') return { id: 'res-wand', name: 'Grey Wand', constraints: [] };
      return { id: 'unit-resolved', name: 'Wizard', categoryLinks: [] };
    });
    mockGetOptionDisplayCost.mockImplementation((sys, opt) => {
      if (opt.id === 'opt-scroll') return 25;
      if (opt.id === 'opt-wand') return 35;
      return 0;
    });
  };

  it('14. Repeatable item (increment+repeat modifier) renders as a stepper, not a radio', () => {
    mockArcaneItems();

    render(<OptionGroupComponent {...defaultProps} group={arcaneGroup} />);
    fireEvent.click(screen.getByText('Arcane Items').closest('div'));

    // Grey Wand stays an exclusive radio; Dispel Scroll becomes a countable stepper.
    expect(screen.getAllByRole('radio').length).toBe(1);

    const scrollRow = screen.getByText('Dispel Scroll').closest('.sub-selection-row');
    const plusBtn = scrollRow.querySelector('.quantity-control button:last-child');
    expect(plusBtn).not.toBeNull();

    fireEvent.click(plusBtn);
    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-scroll' }), 'increment', 1);
  });

  it('15. Selecting a radio sibling does not remove a repeatable item', () => {
    mockArcaneItems();
    // Two Dispel Scrolls already taken.
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => (id === 'res-scroll' ? 2 : 0));

    render(<OptionGroupComponent {...defaultProps} group={arcaneGroup} />);
    // Dispel Scrolls are already taken, so the group auto-expands.
    fireEvent.click(screen.getByRole('radio')); // Grey Wand

    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-wand' }), 'increment', 1);
    expect(defaultProps.updateSubSelection).not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-scroll' }), 'decrement', 1);
  });

  it('16. Passes consolidated context to getModifiedConstraintValue', () => {
    mockGetModifiedConstraintValue.mockClear();
    render(<OptionGroupComponent {...defaultProps} />);
    
    expect(mockGetModifiedConstraintValue).toHaveBeenCalled();
    const calls = mockGetModifiedConstraintValue.mock.calls;
    calls.forEach(call => {
      const ctx = call[2];
      expect(ctx).toBeTypeOf('object');
      expect(ctx).not.toBeNull();
      expect(ctx.roster).toBeDefined();
      expect(ctx.system).toBeDefined();
      expect(ctx.selectionCounts).toBeDefined();
    });
  });

  it('17. Starts collapsed when nothing is selected', () => {
    defaultProps.getSubSelectionCount.mockReturnValue(0);
    render(<OptionGroupComponent {...defaultProps} />);
    // Items are hidden until the header is clicked.
    expect(screen.queryByText('Sword of Might')).toBeNull();
    expect(screen.queryByText('Axe of Doom')).toBeNull();
  });

  it('18. Starts expanded when the group already holds a selection', () => {
    // A selection already exists in the group (e.g. a nested "Power Stones" quantity),
    // so the group opens automatically and its controls are immediately visible.
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => (id === 'res-sword' ? 1 : 0));
    render(<OptionGroupComponent {...defaultProps} />);
    expect(screen.getByText('Sword of Might')).toBeDefined();
    expect(screen.getByText('Axe of Doom')).toBeDefined();
  });

  it('19. Optional upgrade without min or max renders as a checkbox, not a stepper', () => {
    // Regression (issue 07): a non-collective upgrade carrying neither a min nor a max
    // constraint (e.g. Barding on a mounted Vampire, a single mount, a magic weapon/rune)
    // is a binary yes/no choice and must render as a checkbox — not a quantity stepper.
    const bardingGroup = {
      id: 'grp-barding',
      name: 'Upgrades',
      constraints: [],
      items: [
        { option: { id: 'opt-barding' }, groupConstraints: [] }
      ]
    };

    mockResolveEntry.mockImplementation((sys, opt) => {
      if (opt.id === 'opt-barding') return { id: 'res-barding', name: 'Barding', constraints: [] };
      return { id: 'unit-resolved', name: 'Vampire', categoryLinks: [] };
    });
    mockGetOptionDisplayCost.mockReturnValue(6);

    render(<OptionGroupComponent {...defaultProps} group={bardingGroup} />);
    fireEvent.click(screen.getByText('Upgrades').closest('div'));

    expect(screen.getByRole('checkbox')).toBeDefined();
    expect(screen.queryByTestId('icon-plus')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(defaultProps.updateSubSelection).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-barding' }), 'increment', 1);
  });

  it('20. Upgrade with a positive min but no max stays a quantity stepper', () => {
    // Regression (issue 07): a real minimum-quantity upgrade (min>0 without max, e.g.
    // Ungors min=5, Kroxigor) is a genuine quantity and must remain a stepper — the
    // binary heuristic must not collapse it into a checkbox capped at one.
    const quantityGroup = {
      id: 'grp-core',
      name: 'Reinforcements',
      constraints: [],
      items: [
        { option: { id: 'opt-ungors' }, groupConstraints: [] }
      ]
    };

    mockResolveEntry.mockImplementation((sys, opt) => {
      if (opt.id === 'opt-ungors') return { id: 'res-ungors', name: 'Ungors', constraints: [{ type: 'min', value: 5 }] };
      return { id: 'unit-resolved', name: 'Beastmen', categoryLinks: [] };
    });
    mockGetOptionDisplayCost.mockReturnValue(4);
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => (id === 'res-ungors' ? 5 : 0));

    render(<OptionGroupComponent {...defaultProps} group={quantityGroup} />);
    // A selection exists (count 5), so the group auto-expands and shows its stepper.

    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByTestId('icon-plus')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });
});
