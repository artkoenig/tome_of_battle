import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterEditor from './RosterEditor';
import { createSubSelectionOperationsMock } from '../test-utils/subSelectionOperationsMock';

// This suite isolates RosterEditor's rule-link wiring: the `onShowRule` seam that
// UnitSelectionCard's chips funnel through, and the resulting RulesIndexDialog URL.
// Mirrors PlayMode.ruleLinks.test.jsx so both call sites are held to the same
// contract (see ADR-0015 and issue 17/02): the URL must be captured at open time
// so an already-open dialog survives the setting being toggled off mid-session.

const RULE_NAME = 'Killing Blow';
const RULE_URL = 'https://6th.whfb.app/special-rules/killing-blow';

const mockResolveRuleUrl = vi.fn();

vi.mock('../hooks/useRuleUrl', () => ({
  useRuleUrl: () => mockResolveRuleUrl,
}));

vi.mock('lucide-react', () => ({
  Save: () => <span data-testid="icon-save" />,
  Play: () => <span data-testid="icon-play" />,
  Trash2: () => <span data-testid="icon-trash" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Check: () => <span data-testid="icon-check" />,
  Copy: () => <span data-testid="icon-copy" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Edit3: () => <span data-testid="icon-edit3" />,
  Download: () => <span data-testid="icon-download" />,
  Undo2: () => <span data-testid="icon-undo" />,
  Redo2: () => <span data-testid="icon-redo" />,
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
    subSelectionOperations: createSubSelectionOperationsMock(),
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

// Only the rules engine is stubbed; the roster-tree primitives that the facade
// re-exports stay real, since they are pure traversal without any rules in them.
vi.mock('../solver/validator', async (importOriginal) => ({
  ...(await importOriginal()),
  computeRosterCounts: () => ({ selectionCounts: {}, categoryCounts: {} }),
  getModifiedConstraintValue: (constraint) => (constraint.type === 'min' ? 1 : 5),
  getEffectiveModifiers: (source) => source?.modifiers || [],
  calculateRosterCosts: () => ({ pts: 420 }),
  resolveEntry: () => ({ id: 'entry-resolved', name: 'Resolved Entry' }),
  findEntryInSystem: () => ({ id: 'entry-raw', name: 'Raw Entry' }),
  collectUnitProfilesAndRules: () => ({ profiles: [], rules: [] }),
  getSelectionTotalCost: (sel) => sel.cost,
  findForceEntryById: (system, id) => system?.forceEntries?.find((fe) => fe.id === id) || null,
  isCategoryLinkHidden: (link) => link.hidden === true,
  collectUnreachableArmyWideSelectors: () => [],
  getExtraResourceTotals: () => [],
  formatConstraintLimit: (value, constraint) =>
    (constraint?.percentValue === true || constraint?.type === 'percent') ? `${value} %` : `${value}`,
  hasBlockingViolations: (errors) => (errors || []).some(e => e.severity === 'error'),
  ValidationSeverity: { ERROR: 'error', WARNING: 'warning', INFO: 'info' },
  resolveListRuleGroup: () => ({ isListRuleGroup: false, states: [] }),
}));

vi.mock('./editor/CategoryUnitAdder', () => ({
  default: () => <div data-testid="category-unit-adder" />,
}));
vi.mock('./editor/ListRuleChecklist', () => ({
  default: () => <div data-testid="list-rule-checklist" />,
}));
vi.mock('./editor/RosterSidebar', () => ({
  default: () => <div data-testid="roster-sidebar" />,
}));

// UnitSelectionCard is the component that renders a unit's rule chips. Here it is
// reduced to a single button that triggers the `onShowRule` callback RosterEditor
// passes down, standing in for a user clicking a linked rule chip.
vi.mock('./editor/UnitSelectionCard', () => ({
  default: ({ onShowRule }) => (
    <button type="button" data-testid="chip-show-rule" onClick={() => onShowRule(RULE_NAME)}>
      show rule
    </button>
  ),
}));

vi.mock('./RulesIndexDialog', () => ({
  default: ({ ruleName, url }) => (
    <div data-testid="rules-index-dialog" data-url={url}>
      {ruleName}
    </div>
  ),
}));

const mockSystem = {
  id: 'sys-1',
  costTypes: [{ id: 'pts', name: 'Pts' }],
  catalogues: [{ id: 'bret-cat', name: 'Bretonnia', selectionEntries: [] }],
  forceEntries: [
    { id: 'fe-1', categoryLinks: [{ targetId: 'cat-core', name: 'Core', constraints: [{ type: 'min', value: 1 }] }] },
  ],
  categoryEntries: [{ id: 'cat-core', name: 'Core' }],
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
      selections: [{ id: 'sel-1', name: 'Knights Errant', category: 'cat-core', cost: 120 }],
    },
  ],
};

function renderRosterEditor() {
  return render(<RosterEditor system={mockSystem} roster={{}} onBack={vi.fn()} onPlay={vi.fn()} />);
}

describe('RosterEditor rule-link wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoster = JSON.parse(JSON.stringify(defaultMockRoster));
  });

  it('resolves the rule name through the central hook when a chip is clicked', () => {
    mockResolveRuleUrl.mockReturnValue(RULE_URL);
    renderRosterEditor();

    fireEvent.click(screen.getByTestId('chip-show-rule'));

    expect(mockResolveRuleUrl).toHaveBeenCalledWith(RULE_NAME);
  });

  it('opens the rules dialog with the hook-resolved URL when linking is enabled', () => {
    mockResolveRuleUrl.mockReturnValue(RULE_URL);
    renderRosterEditor();

    fireEvent.click(screen.getByTestId('chip-show-rule'));

    const dialog = screen.getByTestId('rules-index-dialog');
    expect(dialog.getAttribute('data-url')).toBe(RULE_URL);
    expect(dialog.textContent).toBe(RULE_NAME);
  });

  it('does not open the dialog when linking is disabled', () => {
    mockResolveRuleUrl.mockReturnValue(null);
    renderRosterEditor();

    fireEvent.click(screen.getByTestId('chip-show-rule'));

    expect(screen.queryByTestId('rules-index-dialog')).toBeNull();
  });

  it('keeps an already-open dialog intact when the setting is toggled off', () => {
    mockResolveRuleUrl.mockReturnValue(RULE_URL);
    const { rerender } = renderRosterEditor();
    fireEvent.click(screen.getByTestId('chip-show-rule'));
    expect(screen.getByTestId('rules-index-dialog')).toBeTruthy();

    // Toggling the setting off re-renders the same RosterEditor instance; the
    // dialog captured its URL at open time, so it must remain until closed
    // manually instead of breaking because resolveRuleUrl now returns null.
    mockResolveRuleUrl.mockReturnValue(null);
    rerender(<RosterEditor system={mockSystem} roster={{}} onBack={vi.fn()} onPlay={vi.fn()} />);

    const dialog = screen.getByTestId('rules-index-dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('data-url')).toBe(RULE_URL);
  });
});
