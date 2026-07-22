import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OptionGroupComponent from './OptionGroup';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: ({ onClick, ...rest }) => <span data-testid="icon-info" onClick={onClick} {...rest} />,
  BookOpen: ({ onClick, ...rest }) => <span data-testid="icon-book" onClick={onClick} {...rest} />,
}));

// Mock the rules lookup so grouped options can be exercised with and without a link
const mockGetRuleUrl = vi.fn().mockReturnValue(null);
vi.mock('../../data/rulesLookup', () => ({
  getRuleUrl: (name) => mockGetRuleUrl(name),
}));

// Grouped magic items / weapons resolve their link through RuleChipIcon, which
// uses the real useRuleUrl hook. Mocking only useSettings lets the group be
// exercised with linking on and off without stubbing the hook itself.
const mockUseSettings = vi.fn();
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

// Mock Validator
const mockResolveEntry = vi.fn();
const mockFindEntryInSystem = vi.fn();
const mockGetModifiedConstraintValue = vi.fn();
const mockComputeRosterCounts = vi.fn();
const mockGetOptionDisplayCost = vi.fn();
const mockGetSelectionTotalCost = vi.fn();
const mockIsUniqueOptionTakenElsewhere = vi.fn();
const mockIsOptionRosterUnique = vi.fn();

// Die Komponente spricht den Solver ausschließlich über die Fassade an, daher
// wird auch nur die Fassade gemockt. Scope-Klassifikation und
// Schlüsselwortlisten sind ohne eigene Abhängigkeiten — der Mock reicht ihre
// echte Umsetzung durch, statt sie zu stubben.
vi.mock('../../solver/validator', async () => ({
  isEntryScope: (await vi.importActual('../../solver/battlescribeConstants')).isEntryScope,
  // Reine Baum-Primitive: die echte Implementierung durchreichen statt sie im Mock
  // nachzubauen — ihre Rekursion ist in rosterTree.test.js eigens abgedeckt.
  findForceContainingSelection: (await vi.importActual('../../solver/rosterTree')).findForceContainingSelection,
  resolveCostLimitTypeId: (await vi.importActual('../../solver/rosterCounter')).resolveCostLimitTypeId,
  resolveCostLimitLabel: (await vi.importActual('../../solver/rosterCounter')).resolveCostLimitLabel,
  resolveEntry: (...args) => mockResolveEntry(...args),
  findEntryInSystem: (...args) => mockFindEntryInSystem(...args),
  getModifiedConstraintValue: (...args) => mockGetModifiedConstraintValue(...args),
  // Effektive Grenze über denselben (gemockten) getModifiedConstraintValue, plus die
  // Normalisierung fehlend/negativ → Fallback, die die echte Fassade vornimmt.
  getEffectiveConstraintLimit: (constraint, modifiers, ctx, fallback = 0) => {
    if (!constraint) return fallback;
    const value = mockGetModifiedConstraintValue(constraint, modifiers, ctx);
    return (value === undefined || value === null || value < 0) ? fallback : value;
  },
  // Statische „Max-hebbar"-Erkennung: die echte Solver-Implementierung durchreichen —
  // sie ist rein und in modifierEvaluator.maxRaisable.test.js eigens abgedeckt.
  canGroupMaxBeRaisedAboveSingleChoice:
    (await vi.importActual('../../solver/modifierEvaluator')).canGroupMaxBeRaisedAboveSingleChoice,
  computeRosterCounts: (...args) => mockComputeRosterCounts(...args),
  getOptionDisplayCost: (...args) => mockGetOptionDisplayCost(...args),
  getSelectionTotalCost: (...args) => mockGetSelectionTotalCost(...args),
  // Faithful copy of the real getEffectiveModifiers seam (src/solver/modifierEvaluator.js):
  // direct modifiers plus modifierGroup modifiers, each folding its group's conditions.
  getEffectiveModifiers: (source) => {
    if (!source) return [];
    const collect = (grp, conds, condGroups) => {
      const nextConds = [...conds, ...(grp.conditions || [])];
      const nextCondGroups = [...condGroups, ...(grp.conditionGroups || [])];
      const own = (grp.modifiers || []).map(mod => ({
        ...mod,
        conditions: [...nextConds, ...(mod.conditions || [])],
        conditionGroups: [...nextCondGroups, ...(mod.conditionGroups || [])],
        repeat: grp.repeat && !mod.repeat ? grp.repeat : mod.repeat,
      }));
      const nested = (grp.modifierGroups || []).flatMap(inner => collect(inner, nextConds, nextCondGroups));
      return [...own, ...nested];
    };
    const groupModifiers = (source.modifierGroups || []).flatMap(grp => collect(grp, [], []));
    return [...(source.modifiers || []), ...groupModifiers];
  },
  // Name resolution is covered by the solver's own unit tests; here it is isolated to
  // the no-name-modifier case, which returns the source's raw name unchanged.
  getEffectiveName: (source) => source?.name ?? '',
  getEffectiveSelectionName: (selection) => selection?.name ?? '',
  formatConstraintLimit: (value, constraint) =>
    (constraint?.percentValue === true || constraint?.type === 'percent') ? `${value} %` : `${value}`,
  // Faithful copy of the real isCostField SSOT (src/solver/constraintScope.js).
  isCostField: (field, system, roster = null) => {
    if (!field || field === 'selections') return false;
    if (field === 'pts' || field === 'ecfa-8486-4f6c-c249') return true;
    if (roster && field === roster.costLimitType) return true;
    return !!system?.costTypes?.some(costType => costType.id === field);
  },
  TOP_LEVEL_PARENT_COUNT: 1,
  isUniqueOptionTakenElsewhere: (...args) => mockIsUniqueOptionTakenElsewhere(...args),
  isOptionRosterUnique: (...args) => mockIsOptionRosterUnique(...args),
  ...(await vi.importActual('../../solver/constants')),
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
    subSelectionOperations: createSubSelectionOperationsMock(),
    getOptionDescription: vi.fn().mockReturnValue('A magic weapon'),
    activeCatalogue: { id: 'cat-bretonnia' },
    setActiveInfo: vi.fn(),
    onHoverEnter: vi.fn(),
    onHoverMove: vi.fn(),
    onHoverLeave: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuleUrl.mockReturnValue(null);
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true });

    // clearAllMocks keeps implementations, so reset the selection-count mock to a
    // clean "nothing selected" baseline each test (groups now auto-expand when a
    // selection exists, which would otherwise leak between tests).
    defaultProps.getSubSelectionCount.mockReset().mockReturnValue(0);

    mockFindEntryInSystem.mockReturnValue({ id: 'raw-entry' });
    mockResolveEntry.mockImplementation((sys, opt, _catId) => {
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
    render(<OptionGroupComponent {...defaultProps} />);

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
    const items = screen.getAllByText(/\+.*Points/);
    expect(items[0].textContent).toContain('+30 Points');
    expect(items[1].textContent).toContain('+20 Points');
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
    expect(defaultProps.subSelectionOperations.increaseCount).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }));

    // Mock that Sword is currently selected (count = 1)
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => {
      if (id === 'res-sword') return 1;
      return 0;
    });

    // Re-render and click Axe radio, should decrement Sword and increment Axe
    const { unmount } = render(<OptionGroupComponent {...defaultProps} />);
    const axeRadio = screen.getAllByRole('radio')[0];
    fireEvent.click(axeRadio);

    expect(defaultProps.subSelectionOperations.decreaseCount).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-sword' }));
    expect(defaultProps.subSelectionOperations.increaseCount).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }));
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
    
    mockResolveEntry.mockImplementation((sys, opt, _catId) => {
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
    expect(defaultProps.subSelectionOperations.increaseCount).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }));
  });

  it('6. Quantity Option Selection', () => {
    // Mock Sword option to have max constraint of 5 (so multi-count, quantity control)
    mockResolveEntry.mockImplementation((sys, opt, _catId) => {
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
    expect(defaultProps.subSelectionOperations.increaseCount).toHaveBeenCalledTimes(1);
    expect(defaultProps.subSelectionOperations.increaseCount).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-sword' }));

    fireEvent.click(minusBtn);
    expect(defaultProps.subSelectionOperations.decreaseCount).toHaveBeenCalledTimes(1);
    expect(defaultProps.subSelectionOperations.decreaseCount).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-sword' }));
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

    // Header should show error/danger (error modifier class, hasGroupError = true)
    const header = screen.getByText('Magic Weapons').closest('div').parentElement;
    expect(header.className).toContain('option-group-header--error');

    // Sword is already selected, so the group auto-expands — no header click needed.

    // Axe row should be disabled (disabled class/style)
    const axeRow = screen.getByText('Axe of Doom').closest('.sub-selection-row');
    expect(axeRow.className).toContain('disabled');

    // Click disabled row should not trigger any count change
    fireEvent.click(axeRow);
    expect(defaultProps.subSelectionOperations.increaseCount).not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }));
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

    mockResolveEntry.mockImplementation((sys, opt, _catId) => {
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
    expect(defaultProps.subSelectionOperations.increaseCount).not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }));
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
    
    mockResolveEntry.mockImplementation((sys, opt, _catId) => {
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
    expect(defaultProps.subSelectionOperations.increaseCount).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }));

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
    expect(defaultProps.subSelectionOperations.decreaseCount).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }));

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
    
    expect(defaultProps.subSelectionOperations.decreaseCount).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-sword' }));
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
    expect(defaultProps.subSelectionOperations.increaseCount).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-scroll' }));
  });

  it('15. Selecting a radio sibling does not remove a repeatable item', () => {
    mockArcaneItems();
    // Two Dispel Scrolls already taken.
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => (id === 'res-scroll' ? 2 : 0));

    render(<OptionGroupComponent {...defaultProps} group={arcaneGroup} />);
    // Dispel Scrolls are already taken, so the group auto-expands.
    fireEvent.click(screen.getByRole('radio')); // Grey Wand

    expect(defaultProps.subSelectionOperations.increaseCount).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-wand' }));
    expect(defaultProps.subSelectionOperations.decreaseCount).not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-scroll' }));
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
    expect(defaultProps.subSelectionOperations.increaseCount).toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-barding' }));
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

  it('21. Grouped option with a rule mapping shows the rule link and calls onShowRule', () => {
    // Regression (finding 1): magic items / weapons live in groups, so grouped
    // options must offer the 6th.whfb.app rule link too — not only standalone ones.
    mockGetRuleUrl.mockImplementation((name) => (name === 'Sword of Might' ? 'https://6th.whfb.app/magic-items/sword-of-might' : null));
    const onShowRule = vi.fn();

    render(<OptionGroupComponent {...defaultProps} onShowRule={onShowRule} />);

    // Expand the group to reveal the items.
    fireEvent.click(screen.getByText('Magic Weapons').closest('div'));

    const bookIcons = screen.getAllByTestId('icon-book');
    expect(bookIcons).toHaveLength(1); // only the mapped item ("Sword of Might")
    fireEvent.click(bookIcons[0]);
    expect(onShowRule).toHaveBeenCalledWith('Sword of Might');
  });

  it('22. Grouped option link takes priority over the catalogue Info', () => {
    mockGetRuleUrl.mockImplementation((name) => (name === 'Sword of Might' ? 'https://6th.whfb.app/magic-items/sword-of-might' : null));

    render(<OptionGroupComponent {...defaultProps} onShowRule={vi.fn()} />);
    fireEvent.click(screen.getByText('Magic Weapons').closest('div'));

    // "Sword of Might" -> BookOpen (no Info); "Axe of Doom" -> Info only.
    expect(screen.getAllByTestId('icon-book')).toHaveLength(1);
    expect(screen.getAllByTestId('icon-info')).toHaveLength(1);
  });

  it('23. Grouped option shows the catalogue Info instead of the link when linking is disabled', () => {
    // Setting off: even a mapped magic item must fall back to the catalogue Info,
    // so no BookOpen link is offered anywhere in the group.
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: false });
    mockGetRuleUrl.mockImplementation((name) => (name === 'Sword of Might' ? 'https://6th.whfb.app/magic-items/sword-of-might' : null));

    render(<OptionGroupComponent {...defaultProps} onShowRule={vi.fn()} />);
    fireEvent.click(screen.getByText('Magic Weapons').closest('div'));

    expect(screen.queryByTestId('icon-book')).toBeNull();
    // Both items now offer the catalogue Info fallback (both carry a description).
    expect(screen.getAllByTestId('icon-info')).toHaveLength(2);
  });

  it('24. Repeatable item defined via a modifierGroup renders as a stepper (Issue 19, B1)', () => {
    // Regression: the increment+repeat modifier that lifts the group cap lives inside a
    // modifierGroup here, not directly on group.modifiers. Before getEffectiveModifiers
    // was adopted, isRepeatableWithinGroup read raw group.modifiers and missed it, so
    // Dispel Scroll would wrongly render as an exclusive radio contradicting the validator.
    mockArcaneItems();
    const groupWithModifierGroup = {
      id: 'grp-arcane-mg',
      name: 'Arcane Items',
      constraints: [{ type: 'max', value: 1, scope: 'parent', id: 'con-arcane-max' }],
      modifierGroups: [
        {
          modifiers: [
            { type: 'increment', field: 'con-arcane-max', value: 1, repeat: { childId: 'opt-scroll', value: 1, repeats: 1 } }
          ]
        }
      ],
      items: [
        { option: { id: 'opt-scroll' }, groupConstraints: [{ type: 'max', value: 1, id: 'con-arcane-max' }] },
        { option: { id: 'opt-wand' }, groupConstraints: [{ type: 'max', value: 1, id: 'con-arcane-max' }] }
      ]
    };

    render(<OptionGroupComponent {...defaultProps} group={groupWithModifierGroup} />);
    fireEvent.click(screen.getByText('Arcane Items').closest('div'));

    // Grey Wand stays an exclusive radio; Dispel Scroll becomes a countable stepper.
    expect(screen.getAllByRole('radio').length).toBe(1);
    const scrollRow = screen.getByText('Dispel Scroll').closest('.sub-selection-row');
    expect(scrollRow.querySelector('.quantity-control button:last-child')).not.toBeNull();
  });

  it('25. modifierGroup-gated group-constraint modifiers reach getModifiedConstraintValue (Issue 19, B1)', () => {
    // Regression: a group's max modifier nested in a modifierGroup must be passed to the
    // limit resolver so the displayed limit matches what the rosterValidator enforces.
    mockGetModifiedConstraintValue.mockClear();
    const groupWithGatedMax = {
      id: 'grp-gated',
      name: 'Magic Weapons',
      constraints: [{ type: 'max', value: 1, id: 'con-max', scope: 'parent' }],
      modifierGroups: [
        { modifiers: [{ type: 'set', field: 'con-max', value: 2 }] }
      ],
      items: [
        { option: { id: 'opt-sword' }, groupConstraints: [{ type: 'max', value: 1, id: 'con-max' }] }
      ]
    };

    render(<OptionGroupComponent {...defaultProps} group={groupWithGatedMax} />);

    const maxCall = mockGetModifiedConstraintValue.mock.calls.find(
      call => call[0]?.id === 'con-max' && call[0]?.type === 'max'
    );
    expect(maxCall).toBeDefined();
    const modifiersArg = maxCall[1];
    expect(modifiersArg.some(mod => mod.field === 'con-max' && mod.type === 'set')).toBe(true);
  });

  // ── Issue 57: Radio-vs-Checkbox aus effektiven Werten + Max-hebbar-Regel ──
  // Rüstungsgruppe wie am Empire-Captain: Gruppe `max=1` plus bedingter increment auf
  // genau diese Max-Constraint, gekoppelt an die Shield-Auswahl. Der increment-Modifier
  // trägt KEIN <repeat>, ist also das „inhärent mehrfach"-Signal (kein Stepper-Muster).
  const ARMOUR_MAX_ID = 'con-armour-max';
  const SHIELD_PRESENT = () => ({ type: 'greaterThan', field: 'selections', scope: 'parent', childId: 'res-shield', value: 0 });
  const armourGroup = {
    id: 'grp-armour',
    name: 'Armour',
    constraints: [{ type: 'max', value: 1, scope: 'parent', field: 'selections', id: ARMOUR_MAX_ID }],
    modifiers: [{ type: 'increment', field: ARMOUR_MAX_ID, value: 1, valueObject: 1, conditions: [SHIELD_PRESENT()] }],
    items: [
      { option: { id: 'opt-fullplate' }, groupConstraints: [{ type: 'max', value: 1, id: ARMOUR_MAX_ID }] },
      { option: { id: 'opt-heavy' }, groupConstraints: [{ type: 'max', value: 1, id: ARMOUR_MAX_ID }] },
      { option: { id: 'opt-light' }, groupConstraints: [{ type: 'max', value: 1, id: ARMOUR_MAX_ID }] },
      { option: { id: 'opt-shield' }, groupConstraints: [{ type: 'max', value: 1, id: ARMOUR_MAX_ID }] }
    ]
  };

  const mockArmourItems = () => {
    mockResolveEntry.mockImplementation((sys, opt) => {
      switch (opt.id) {
        case 'opt-fullplate': return { id: 'res-fullplate', name: 'Full Plate Armour', constraints: [] };
        case 'opt-heavy': return { id: 'res-heavy', name: 'Heavy Armour', constraints: [] };
        case 'opt-light': return { id: 'res-light', name: 'Light Armour', constraints: [] };
        case 'opt-shield': return { id: 'res-shield', name: 'Shield', constraints: [] };
        default: return { id: 'unit-resolved', name: 'Captain', categoryLinks: [] };
      }
    });
    mockGetOptionDisplayCost.mockImplementation((sys, opt) => {
      if (opt.id === 'opt-fullplate') return 12;
      if (opt.id === 'opt-shield') return 3;
      return 4;
    });
  };

  it('26. Armour+Shield: max-hebbare Gruppe rendert als Checkboxen — auch bevor ein Schild gewählt ist', () => {
    // Kein Schild gewählt: das aktuelle effektive Max ist 1 (der raw-basierte Bug würde
    // hier Radios erzwingen und den Teufelskreis auslösen). Da ein Modifier das Max über 1
    // heben KANN, muss die Gruppe dennoch als Mehrfachauswahl rendern.
    mockArmourItems();
    render(<OptionGroupComponent {...defaultProps} group={armourGroup} />);
    fireEvent.click(screen.getByText('Armour').closest('div'));

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);

    // Eine Rüstung anwählbar, ohne dass etwas anderes verdrängt wird.
    const fullPlateRow = screen.getByText('Full Plate Armour').closest('.sub-selection-row');
    fireEvent.click(fullPlateRow);
    expect(defaultProps.subSelectionOperations.increaseCount)
      .toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-fullplate' }));
  });

  it('27. Armour+Shield: das Schild verdrängt die gewählte Rüstung NICHT (Teufelskreis aufgelöst)', () => {
    // Full Plate ist bereits gewählt; das Anwählen des Schilds darf die Rüstung nicht
    // deselektieren — genau das tat die alte Radio-Logik.
    mockArmourItems();
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => (id === 'res-fullplate' ? 1 : 0));

    render(<OptionGroupComponent {...defaultProps} group={armourGroup} />);
    // Auswahl vorhanden → Gruppe klappt automatisch auf.
    const shieldRow = screen.getByText('Shield').closest('.sub-selection-row');
    fireEvent.click(shieldRow);

    expect(defaultProps.subSelectionOperations.increaseCount)
      .toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-shield' }));
    expect(defaultProps.subSelectionOperations.decreaseCount)
      .not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-fullplate' }));
  });

  it('28. Armour+Shield: nach Schild-Wahl zeigt das Gruppen-Label das erhöhte Max (Live-Zähler 2/2)', () => {
    // Rüstung + Schild gemeinsam gewählt; der Modifier hebt das effektive Max auf 2.
    mockArmourItems();
    defaultProps.getSubSelectionCount.mockImplementation((sel, id) => (id === 'res-fullplate' || id === 'res-shield') ? 1 : 0);
    // Effektives Max der Rüstungs-Constraint bei gewähltem Schild: 2.
    mockGetModifiedConstraintValue.mockImplementation((con) => (con.id === ARMOUR_MAX_ID ? 2 : con.value));

    render(<OptionGroupComponent {...defaultProps} group={armourGroup} />);

    // Live-Zähler „2 / 2" (belegt / erhöhtes Max), nicht mehr „Max: 1".
    expect(screen.getByText(/2\s*\/\s*2/)).toBeDefined();

    // Beide als angehakte Checkboxen (wie NewRecruit).
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);
    const fullPlateBox = screen.getByText('Full Plate Armour').closest('.sub-selection-row').querySelector('input[type="checkbox"]');
    const shieldBox = screen.getByText('Shield').closest('.sub-selection-row').querySelector('input[type="checkbox"]');
    expect(fullPlateBox.checked).toBe(true);
    expect(shieldBox.checked).toBe(true);
  });

  it('29. Umgekehrter Fall: sinkt das effektive Max bedingt auf 1, wird die Gruppe zum Radio (Ausschluss)', () => {
    // Weapons-Gruppe: Basis-Max 2 (Mehrfach), per decrement bedingt auf 1 gesenkt (z. B.
    // Battle Standard Bearer). Kein Modifier HEBT über 1 → echte Einzelwahl → Radios.
    const weaponsGroup = {
      id: 'grp-weapons',
      name: 'Weapons',
      constraints: [{ type: 'max', value: 2, scope: 'parent', field: 'selections', id: 'con-weapons-max' }],
      modifiers: [{ type: 'decrement', field: 'con-weapons-max', value: 1, valueObject: 1, conditions: [{ type: 'greaterThan', field: 'selections', scope: 'parent', childId: 'res-bsb', value: 0 }] }],
      items: [
        { option: { id: 'opt-sword' }, groupConstraints: [{ type: 'max', value: 2, id: 'con-weapons-max' }] },
        { option: { id: 'opt-axe' }, groupConstraints: [{ type: 'max', value: 2, id: 'con-weapons-max' }] }
      ]
    };
    // Effektiv gesenkt auf 1 (BSB aktiv).
    mockGetModifiedConstraintValue.mockImplementation((con) => (con.id === 'con-weapons-max' ? 1 : con.value));

    render(<OptionGroupComponent {...defaultProps} group={weaponsGroup} />);
    fireEvent.click(screen.getByText('Weapons').closest('div'));

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('30. Deaktivierung: sinkt das effektive Max bedingt auf 0, ist die Gruppe nicht mehr wählbar', () => {
    const bardingGroup = {
      id: 'grp-barding',
      name: 'Mount Options',
      constraints: [{ type: 'max', value: 1, scope: 'parent', field: 'selections', id: 'con-barding-max' }],
      modifiers: [{ type: 'set', field: 'con-barding-max', value: '0', valueObject: 0, conditions: [{ type: 'greaterThan', field: 'selections', scope: 'parent', childId: 'res-onfoot', value: 0 }] }],
      items: [
        { option: { id: 'opt-barding' }, groupConstraints: [{ type: 'max', value: 1, id: 'con-barding-max' }] }
      ]
    };
    mockResolveEntry.mockImplementation((sys, opt) =>
      opt.id === 'opt-barding' ? { id: 'res-barding', name: 'Barding', constraints: [] } : { id: 'unit-resolved', name: 'Captain', categoryLinks: [] });
    mockGetOptionDisplayCost.mockReturnValue(6);
    // Effektives Gruppen-Max auf 0 gesenkt.
    mockGetModifiedConstraintValue.mockImplementation((con) => (con.id === 'con-barding-max' ? 0 : con.value));

    render(<OptionGroupComponent {...defaultProps} group={bardingGroup} />);
    fireEvent.click(screen.getByText('Mount Options').closest('div'));

    const bardingRow = screen.getByText('Barding').closest('.sub-selection-row');
    expect(bardingRow.className).toContain('disabled');
    fireEvent.click(bardingRow);
    expect(defaultProps.subSelectionOperations.increaseCount)
      .not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-barding' }));
  });

  // ── Issue 57/04: Unter-Option einer gruppierten Upgrade-Mount nistet unter der Mount ──
  it('31. A sub-option of a grouped upgrade-mount edits its owning mount selection, not the unit', () => {
    // The collector re-emits a chosen upgrade-mount's Barding tagged with ownerSelectionId =
    // the mount's roster selection id. The mutation must target that owner so Barding nests
    // under the mount, not as a sibling on the unit. Count/display still read the unit.
    const MOUNT_SELECTION_ID = 'sel-mount-instance';
    const mountSubOptionGroup = {
      id: 'grp-warhorse',
      name: 'Empire Warhorse',
      constraints: [],
      items: [
        { option: { id: 'opt-barding' }, ownerSelectionId: MOUNT_SELECTION_ID, groupConstraints: [] }
      ]
    };
    mockResolveEntry.mockImplementation((sys, opt) =>
      opt.id === 'opt-barding'
        ? { id: 'res-barding', name: 'Barding', constraints: [] }
        : { id: 'unit-resolved', name: 'Captain', categoryLinks: [] });
    mockGetOptionDisplayCost.mockReturnValue(6);

    render(<OptionGroupComponent {...defaultProps} group={mountSubOptionGroup} />);
    fireEvent.click(screen.getByText('Empire Warhorse').closest('div'));

    fireEvent.click(screen.getByRole('checkbox'));
    expect(defaultProps.subSelectionOperations.increaseCount)
      .toHaveBeenCalledWith(MOUNT_SELECTION_ID, expect.objectContaining({ id: 'opt-barding' }));
    expect(defaultProps.subSelectionOperations.increaseCount)
      .not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-barding' }));
  });
});
