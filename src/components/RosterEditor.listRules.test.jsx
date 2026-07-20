import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterEditor from './RosterEditor';

// This suite isolates how RosterEditor treats a "list rule" category (catalog
// type = upgrade, ADR 0003) versus a normal unit category: the list-rule group
// drops its "+" adder and renders a checklist (ListRuleChecklist) instead of unit
// cards, while unit categories keep both.

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
  // List rules are primary catalog entries in their category, so the (empty) group
  // still surfaces even before any rule is checked — mirroring production.
  isEntryPrimaryInCategory: (_entry, categoryId) => categoryId === 'cat-rules',
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
vi.mock('./editor/ListRuleChecklist', () => ({
  default: ({ categoryId }) => <div data-testid="list-rule-checklist" data-category={categoryId} />,
}));
vi.mock('./editor/RosterSidebar', () => ({
  default: () => <div data-testid="roster-sidebar" />,
}));
vi.mock('./RulesIndexDialog', () => ({
  default: () => <div data-testid="rules-index-dialog" />,
}));

// The card is reduced to a marker that echoes the selection it renders.
vi.mock('./editor/UnitSelectionCard', () => ({
  default: ({ selection }) => (
    <div data-testid="unit-card" data-selection={selection.id}>
      {selection.name}
    </div>
  ),
}));

const mockSystem = {
  id: 'sys-1',
  costTypes: [{ id: 'pts', name: 'Pts' }],
  catalogues: [{ id: 'bret-cat', name: 'Bretonnia', selectionEntries: [{ id: 'rule-entry-1' }] }],
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

// The list-rule category starts empty (the checklist enumerates the catalog
// rules itself); only the unit category holds a selection.
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

  it('renders the ListRuleChecklist for the list-rule group (once expanded) and cards for unit categories', () => {
    renderRosterEditor();

    // The unit category renders its card regardless of the collapsed rule group.
    expect(screen.getByText('Knights Errant')).toBeTruthy();

    // The list-rule group is collapsed by default — expand it first.
    fireEvent.click(screen.getByText('Special list rules').closest('[role="button"]'));

    const checklist = screen.getByTestId('list-rule-checklist');
    expect(checklist.getAttribute('data-category')).toBe('cat-rules');
    // A list rule never renders as a unit card.
    expect(screen.queryAllByTestId('unit-card').map((el) => el.getAttribute('data-selection'))).toEqual(['sel-unit']);
  });

  it('is collapsed by default and expands/collapses when its header is clicked', () => {
    renderRosterEditor();

    // Default: collapsed — the checklist is not rendered.
    expect(screen.queryByTestId('list-rule-checklist')).toBeNull();

    const header = screen.getByText('Special list rules').closest('[role="button"]');
    expect(header).not.toBeNull();

    // Expand.
    fireEvent.click(header);
    expect(screen.getByTestId('list-rule-checklist')).toBeTruthy();

    // Collapse again.
    fireEvent.click(header);
    expect(screen.queryByTestId('list-rule-checklist')).toBeNull();
  });
});
