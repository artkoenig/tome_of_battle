import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ListRuleChecklist from './ListRuleChecklist';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';

/**
 * Issue 0138, AC5/AC6 — a `state.mandatory` row renders a disabled checkbox
 * with a visible explanation, at both checkbox locations (the plain
 * switch-row and the expandable container-row), per Plan contract 3.
 *
 * Unlike ListRuleChecklist.test.jsx, GothicTooltip is deliberately left
 * UNMOCKED here so the hover explanation itself can be observed in the DOM —
 * without pinning the exact copy (the `editor.listRules.mandatoryTooltip` i18n
 * key doesn't exist yet and its wording is not part of the acceptance
 * criteria).
 */

vi.mock('./SelectionConfigurator', () => ({
  default: ({ selection, isListRule }) => (
    <div data-testid="selection-configurator" data-sel={selection.id} data-list-rule={String(!!isListRule)} />
  ),
}));
vi.mock('./CategoryUnitAdder', () => ({
  default: () => <div data-testid="quantity-adder" />,
}));
vi.mock('./BottomSheet', () => ({ default: () => null }));

const baseProps = {
  system: {},
  activeCatalogue: { id: 'cat' },
  categoryId: 'cat-rules',
  roster: { costLimitType: 'pts' },
  force: { id: 'f1', selections: [] },
  addUnit: vi.fn(),
  removeUnit: vi.fn(),
  subSelectionOperations: createSubSelectionOperationsMock(),
  costTypeLabel: 'Pkt.',
  costLimitType: 'pts',
  selectionCounts: {},
  onShowRule: vi.fn(),
};

const mandatorySwitchRule = (over = {}) => ({
  entry: { id: 'e-mandatory' },
  name: 'The Laws of Undeath',
  categoryId: 'cat-rules',
  resolvedId: 'r-mandatory',
  checked: true,
  selection: { id: 'sel-mandatory' },
  isBinary: true,
  isContainer: false,
  mandatory: true,
  ...over,
});

const optionalSwitchRule = (over = {}) => ({
  entry: { id: 'e-optional' },
  name: 'Allow experimental rules?',
  categoryId: 'cat-rules',
  resolvedId: 'r-optional',
  checked: false,
  selection: null,
  isBinary: true,
  isContainer: false,
  mandatory: false,
  ...over,
});

const mandatoryContainerRule = (over = {}) => ({
  entry: { id: 'e-mandatory-container' },
  name: 'Army of Sylvania',
  categoryId: 'cat-rules',
  resolvedId: 'r-mandatory-container',
  checked: true,
  selection: { id: 'sel-mandatory-container' },
  isBinary: true,
  isContainer: true,
  mandatory: true,
  ...over,
});

describe('ListRuleChecklist — mandatory rows (Issue 0138, AC5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  it('disables the checkbox of a mandatory switch-row rule', () => {
    render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);
    expect(screen.getByRole('checkbox', { name: 'The Laws of Undeath' }).disabled).toBe(true);
  });

  it("leaves a non-mandatory switch-row rule's checkbox enabled", () => {
    render(<ListRuleChecklist {...baseProps} states={[optionalSwitchRule()]} />);
    expect(screen.getByRole('checkbox', { name: 'Allow experimental rules?' }).disabled).toBe(false);
  });

  it('disables the checkbox of a mandatory container-row rule', () => {
    render(<ListRuleChecklist {...baseProps} states={[mandatoryContainerRule()]} />);
    expect(screen.getByRole('checkbox', { name: 'Army of Sylvania' }).disabled).toBe(true);
  });

  it("leaves a non-mandatory, checked container-row rule's checkbox enabled", () => {
    render(<ListRuleChecklist {...baseProps} states={[mandatoryContainerRule({ mandatory: false })]} />);
    expect(screen.getByRole('checkbox', { name: 'Army of Sylvania' }).disabled).toBe(false);
  });

  it('AC5 boundary: a mandatory row is disabled even before it is checked (disabling follows mandatory, not checked)', () => {
    render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule({ checked: false, selection: null })]} />);
    expect(screen.getByRole('checkbox', { name: 'The Laws of Undeath' }).disabled).toBe(true);
  });

  it("clicking a mandatory rule's checkbox does not toggle it (no add/remove call) — AC5 'nicht abwählbar'", () => {
    render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'The Laws of Undeath' }));
    expect(baseProps.addUnit).not.toHaveBeenCalled();
    expect(baseProps.removeUnit).not.toHaveBeenCalled();
  });

  it("shows a visible explanation when hovering a mandatory rule's checkbox", () => {
    render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);
    const checkbox = screen.getByRole('checkbox', { name: 'The Laws of Undeath' });

    fireEvent.mouseEnter(checkbox, { clientX: 10, clientY: 10 });

    const tooltip = document.querySelector('.gothic-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent.trim().length).toBeGreaterThan(0);
  });

  it('shows no such explanation for a non-mandatory rule on hover', () => {
    render(<ListRuleChecklist {...baseProps} states={[optionalSwitchRule()]} />);
    const checkbox = screen.getByRole('checkbox', { name: 'Allow experimental rules?' });

    fireEvent.mouseEnter(checkbox, { clientX: 10, clientY: 10 });

    expect(document.querySelector('.gothic-tooltip')).toBeNull();
  });
});
