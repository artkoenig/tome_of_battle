import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterEditor from './RosterEditor';

// This suite isolates how RosterEditor treats a "list rule" category (catalog
// type = upgrade, ADR 0003) versus a normal unit category: the list-rule group
// must drop its "+" adder and render its cards in list-rule mode, while unit
// categories keep both.

vi.mock('../hooks/useRuleUrl', () => ({
  useRuleUrl: () => vi.fn(),
}));

vi.mock('lucide-react', () => ({
  Save: () => <span />,
  Play: () => <span />,
  Trash2: () => <span />,
  AlertTriangle: () => <span />,
  Check: () => <span />,
  Copy: () => <span />,
  ArrowLeft: () => <span />,
  Edit3: () => <span />,
  Download: () => <span />,
  Undo2: () => <span />,
  Redo2: () => <span />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
}));

vi.mock('../hooks/useRoster', () => ({
  useRoster: () => ({
    roster: mockRoster,
    costs: { pts: 420 },
    validationErrors: [],
    selectedRosterSelection: null,
    setSelectedRosterSelection: vi.fn(),
    addUnit: vi.fn(),
    removeUnit: vi.fn(),
    copyUnit: vi.fn(),
    updateSubSelection: vi.fn(),
    updateRosterName: vi.fn(),
    save: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
  }),
}));

vi.mock('../db/database', () => ({
  saveRoster: vi.fn(),
}));

// A list rule is any selection sitting in the 'cat-rules' category here; this
// stands in for the real type=upgrade classification the solver performs.
vi.mock('../solver/validator', () => ({
  computeRosterCounts: () => ({ selectionCounts: {}, categoryCounts: {} }),
  getModifiedConstraintValue: (constraint) => (constraint.type === 'min' ? 0 : Infinity),
  getEffectiveModifiers: (source) => source?.modifiers || [],
  calculateRosterCosts: () => ({ pts: 420 }),
  resolveEntry: () => ({ id: 'entry-resolved', name: 'Resolved Entry' }),
  findEntryInSystem: () => ({ id: 'entry-raw', name: 'Raw Entry' }),
  collectUnitProfilesAndRules: () => ({ profiles: [], rules: [] }),
  getSelectionTotalCost: (sel) => sel.cost,
  findForceEntryById: (system, id) => system?.forceEntries?.find((fe) => fe.id === id) || null,
  isCategoryLinkHidden: (link) => link.hidden === true,
  isEntryPrimaryInCategory: () => false,
  collectUnreachableArmyWideSelectors: () => [],
  getExtraResourceTotals: () => [],
  formatConstraintLimit: (value) => `${value}`,
  hasBlockingViolations: () => false,
  ValidationSeverity: { ERROR: 'error', WARNING: 'warning', INFO: 'info' },
  isListRuleSelection: (_system, selection) => selection.category === 'cat-rules',
  isListRuleCategory: (_system, _catalogue, categoryId) => categoryId === 'cat-rules',
}));

vi.mock('./editor/CategoryUnitAdder', () => ({
  default: ({ categoryName }) => <div data-testid="category-unit-adder">{categoryName}</div>,
}));
vi.mock('./editor/RosterSidebar', () => ({
  default: () => <div data-testid="roster-sidebar" />,
}));
vi.mock('./RulesIndexDialog', () => ({
  default: () => <div data-testid="rules-index-dialog" />,
}));

// The card is reduced to a marker that echoes the selection it renders and the
// isListRule mode it was handed.
vi.mock('./editor/UnitSelectionCard', () => ({
  default: ({ selection, isListRule }) => (
    <div data-testid="unit-card" data-selection={selection.id} data-list-rule={String(!!isListRule)}>
      {selection.name}
    </div>
  ),
}));

const mockSystem = {
  id: 'sys-1',
  costTypes: [{ id: 'pts', name: 'Pts' }],
  catalogues: [{ id: 'bret-cat', name: 'Bretonnia', selectionEntries: [] }],
  forceEntries: [
    {
      id: 'fe-1',
      categoryLinks: [
        { targetId: 'cat-rules', name: 'Special list rules' },
        { targetId: 'cat-core', name: 'Core' },
      ],
    },
  ],
  categoryEntries: [
    { id: 'cat-rules', name: 'Special list rules' },
    { id: 'cat-core', name: 'Core' },
  ],
};

let mockRoster = {};

const defaultMockRoster = {
  id: 'roster-1',
  name: 'Bretonnian Crusaders',
  costLimitType: 'pts',
  costLimit: 1000,
  catalogueId: 'bret-cat',
  forces: [
    {
      id: 'force-1',
      forceEntryId: 'fe-1',
      catalogueId: 'bret-cat',
      selections: [
        { id: 'sel-rule', name: 'Allow experimental rules?', category: 'cat-rules', cost: 0 },
        { id: 'sel-unit', name: 'Knights Errant', category: 'cat-core', cost: 120 },
      ],
    },
  ],
};

function renderRosterEditor() {
  return render(<RosterEditor system={mockSystem} roster={{}} onBack={vi.fn()} onPlay={vi.fn()} />);
}

describe('RosterEditor list-rule groups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoster = JSON.parse(JSON.stringify(defaultMockRoster));
  });

  it('renders no "+" adder for the list-rule group but keeps it for unit categories', () => {
    renderRosterEditor();

    const adderNames = screen.getAllByTestId('category-unit-adder').map((el) => el.textContent);
    expect(adderNames).toContain('Core');
    expect(adderNames).not.toContain('Special list rules');
  });

  it('renders the list-rule card in list-rule mode and the unit card normally (once expanded)', () => {
    renderRosterEditor();

    // The list-rule group is collapsed by default — expand it first.
    fireEvent.click(screen.getByText('Special list rules').closest('[role="button"]'));

    const ruleCard = screen.getByText('Allow experimental rules?').closest('[data-testid="unit-card"]');
    const unitCard = screen.getByText('Knights Errant').closest('[data-testid="unit-card"]');

    expect(ruleCard.getAttribute('data-list-rule')).toBe('true');
    expect(unitCard.getAttribute('data-list-rule')).toBe('false');
  });

  it('is collapsed by default and expands/collapses when its header is clicked', () => {
    renderRosterEditor();

    // Default: collapsed — the rule cards are not rendered, the unit category is.
    expect(screen.queryByText('Allow experimental rules?')).toBeNull();
    expect(screen.getByText('Knights Errant')).toBeTruthy();

    const header = screen.getByText('Special list rules').closest('[role="button"]');
    expect(header).not.toBeNull();

    // Expand.
    fireEvent.click(header);
    expect(screen.getByText('Allow experimental rules?')).toBeTruthy();

    // Collapse again.
    fireEvent.click(header);
    expect(screen.queryByText('Allow experimental rules?')).toBeNull();
  });
});
