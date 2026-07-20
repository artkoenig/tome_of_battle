import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ListRuleChecklist from './ListRuleChecklist';

// Seam B: the checkbox list itself. The per-rule enumeration is the solver's job
// (covered by listRules.test.js); the states are computed in RosterEditor and
// passed in via the `states` prop, so this suite drives the UI contract — a
// checkbox per rule, checked ⇔ present, toggling add/remove, inline sub-options
// for a checked container, and the quantity-adder fallback for a non-binary rule.

let mockStates = [];

vi.mock('./SelectionConfigurator', () => ({
  default: ({ selection, isListRule }) => (
    <div data-testid="selection-configurator" data-sel={selection.id} data-list-rule={String(!!isListRule)} />
  ),
}));
vi.mock('./CategoryUnitAdder', () => ({
  default: ({ categoryName, entries }) => (
    <div data-testid="quantity-adder" data-entries={(entries || []).map((e) => e.id).join(',')}>
      {categoryName}
    </div>
  ),
}));
vi.mock('./BottomSheet', () => ({ default: () => null }));
vi.mock('../GothicTooltip', () => ({ default: () => null }));

const baseProps = {
  system: {},
  activeCatalogue: { id: 'cat' },
  categoryId: 'cat-rules',
  roster: { costLimitType: 'pts' },
  force: { id: 'f1', selections: [] },
  addUnit: vi.fn(),
  removeUnit: vi.fn(),
  updateSubSelection: vi.fn(),
  costTypeLabel: 'Pkt.',
  costLimitType: 'pts',
  selectionCounts: {},
  onShowRule: vi.fn(),
};

const switchRule = (over = {}) => ({
  entry: { id: 'e1' },
  name: 'Allow special characters?',
  categoryId: 'cat-rules',
  resolvedId: 'r1',
  checked: false,
  selection: null,
  isBinary: true,
  isContainer: false,
  ...over,
});

const containerRule = (over = {}) => ({
  entry: { id: 'e2' },
  name: 'Campaign rules',
  categoryId: 'cat-rules',
  resolvedId: 'r2',
  checked: true,
  selection: { id: 'sel-2' },
  isBinary: true,
  isContainer: true,
  ...over,
});

describe('ListRuleChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStates = [];
  });

  it('renders one checkbox per catalog list rule, checked exactly when present', () => {
    mockStates = [switchRule({ checked: false }), containerRule({ checked: true })];
    render(<ListRuleChecklist {...baseProps} states={mockStates} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);

    expect(screen.getByRole('checkbox', { name: 'Allow special characters?' }).checked).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Campaign rules' }).checked).toBe(true);
  });

  it('checking an absent rule adds it; unchecking a present rule removes it', () => {
    mockStates = [switchRule({ checked: false }), containerRule({ checked: true, selection: { id: 'sel-2' } })];
    render(<ListRuleChecklist {...baseProps} states={mockStates} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Allow special characters?' }));
    expect(baseProps.addUnit).toHaveBeenCalledWith({ id: 'e1' }, 'cat-rules');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Campaign rules' }));
    expect(baseProps.removeUnit).toHaveBeenCalledWith('sel-2');
  });

  it('shows a checked container rule\'s sub-options inline (list-rule mode), and none for an unchecked one', () => {
    mockStates = [containerRule({ checked: true, selection: { id: 'sel-2' } }), containerRule({
      entry: { id: 'e3' }, name: 'Scenario rules', resolvedId: 'r3', checked: false, selection: null,
    })];
    render(<ListRuleChecklist {...baseProps} states={mockStates} />);

    const configurators = screen.getAllByTestId('selection-configurator');
    expect(configurators.length).toBe(1);
    expect(configurators[0].getAttribute('data-sel')).toBe('sel-2');
    // Sub-options render in list-rule mode (no "Optionen & Ausrüstung" heading, no card).
    expect(configurators[0].getAttribute('data-list-rule')).toBe('true');
  });

  it('collapses a checked container\'s sub-options by clicking the row, without unchecking it', () => {
    mockStates = [containerRule({ checked: true, selection: { id: 'sel-2' } })];
    render(<ListRuleChecklist {...baseProps} states={mockStates} />);

    // Default: expanded — sub-options visible right after checking.
    expect(screen.getByTestId('selection-configurator')).not.toBeNull();

    // The whole container row is the collapse toggle (role=button); the chevron is icon-only.
    const collapseRow = screen.getByRole('button', { name: 'Unteroptionen einklappen' });
    fireEvent.click(collapseRow);

    // Collapsed: sub-options hidden, but the rule stays checked (no removal).
    expect(screen.queryByTestId('selection-configurator')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Campaign rules' }).checked).toBe(true);
    expect(baseProps.removeUnit).not.toHaveBeenCalled();

    // Re-expanding brings them back.
    fireEvent.click(screen.getByRole('button', { name: 'Unteroptionen ausklappen' }));
    expect(screen.getByTestId('selection-configurator')).not.toBeNull();
  });

  it('on a container, the checkbox toggles the rule without collapsing (independent of the row click)', () => {
    mockStates = [containerRule({ checked: true, selection: { id: 'sel-2' } })];
    render(<ListRuleChecklist {...baseProps} states={mockStates} />);

    // Clicking the checkbox removes the rule but must NOT collapse the sub-options
    // (its click is isolated from the row's collapse handler).
    fireEvent.click(screen.getByRole('checkbox', { name: 'Campaign rules' }));
    expect(baseProps.removeUnit).toHaveBeenCalledWith('sel-2');
    expect(baseProps.removeUnit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('selection-configurator')).not.toBeNull();
  });

  it('offers no collapse toggle for a switch rule that has no sub-options', () => {
    mockStates = [switchRule({ checked: true, selection: { id: 'sel-1' }, isContainer: false })];
    render(<ListRuleChecklist {...baseProps} states={mockStates} />);

    expect(screen.queryByRole('button', { name: /Unteroptionen/ })).toBeNull();
  });

  it('does not render sub-options for a checked switch rule that has no sub-options', () => {
    mockStates = [switchRule({ checked: true, selection: { id: 'sel-1' }, isContainer: false })];
    render(<ListRuleChecklist {...baseProps} states={mockStates} />);

    expect(screen.queryByTestId('selection-configurator')).toBeNull();
  });

  it('falls back to the quantity adder (no checkbox) for a non-binary rule', () => {
    mockStates = [switchRule({ name: 'Detachments', entry: { id: 'e9' }, resolvedId: 'r9', isBinary: false })];
    render(<ListRuleChecklist {...baseProps} states={mockStates} />);

    expect(screen.queryByRole('checkbox')).toBeNull();
    const adder = screen.getByTestId('quantity-adder');
    expect(adder.textContent).toBe('Detachments');
    expect(adder.getAttribute('data-entries')).toBe('e9');
  });

  it('renders nothing when the category has no list rules', () => {
    mockStates = [];
    const { container } = render(<ListRuleChecklist {...baseProps} states={mockStates} />);
    expect(container.firstChild).toBeNull();
  });
});
