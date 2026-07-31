import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ListRuleChecklist from './ListRuleChecklist';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';

/**
 * Issue 0138, AC5 — "Prüfrunde 1" F2 follow-up.
 *
 * A fresh-context reviewer confirmed that on a narrow/touch viewport (this
 * project's own established mobile breakpoint, `window.innerWidth <= 900`,
 * already used throughout ListRuleChecklist.jsx's own `handleMouseEnter`/
 * `handleMouseMove`), a mandatory list-rule row's explanation is unreachable:
 * it is wired through hover only, and `handleMouseEnter` bails out before
 * `<=900px` without showing anything. AC5 requires "einen sichtbaren Hinweis
 * (Tooltip/Text)" — today that hint is genuinely absent below 900px.
 *
 * Convention followed: this codebase's own established pattern for testing a
 * narrow-viewport tap fallback lives in `UnitSelectionCard.test.jsx`
 * ("responsive: triggers BottomSheet onClick of upgrade badge on mobile
 * layout" / "responsive: does not show BottomSheet onClick on desktop
 * layout") — set `window.innerWidth`, mock `BottomSheet` to render its
 * content behind a `data-testid="bottom-sheet"` when `isOpen`, tap the
 * affordance, assert the sheet appears (or doesn't, on desktop). Neither
 * `SelectionConfigurator.*.test.jsx` nor `RuleChipIcon.test.jsx` has its own
 * narrow-viewport/BottomSheet test for the `onInfoClick` fallback those files
 * wire (checked — none of them reference `innerWidth` or a bottom-sheet
 * testid), so `UnitSelectionCard.test.jsx` is the concrete precedent this
 * suite mirrors.
 *
 * Target of the simulated tap: the `.list-rule-checkbox-slot` wrapper span
 * that already exists around the checkbox in both mandatory-row shapes (see
 * ListRuleChecklist.jsx lines ~148-163 and ~171-184) and already carries the
 * hover listeners for exactly the reason documented in that file — a
 * `disabled` form element receives no mouse events in browsers or jsdom, so
 * the wrapper is the interaction surface, not the checkbox itself. A tap
 * fallback needs a non-disabled element for the same reason, and this
 * wrapper is the only one already present at both call sites.
 *
 * `BottomSheet` is deliberately mocked here (rather than left real, as in
 * the sibling `ListRuleChecklist.mandatory.test.jsx`) so the sheet's
 * presence/content is directly observable via a stable testid, following the
 * `UnitSelectionCard.test.jsx` mock exactly.
 */

vi.mock('./SelectionConfigurator', () => ({
  default: ({ selection, isListRule }) => (
    <div data-testid="selection-configurator" data-sel={selection.id} data-list-rule={String(!!isListRule)} />
  ),
}));
vi.mock('./CategoryUnitAdder', () => ({
  default: () => <div data-testid="quantity-adder" />,
}));
vi.mock('./BottomSheet', () => ({
  default: ({ isOpen, children, title }) =>
    isOpen ? (
      <div data-testid="bottom-sheet">
        <h4>{title}</h4>
        {children}
      </div>
    ) : null,
}));
vi.mock('../GothicTooltip', () => ({ default: () => null }));

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

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
};

/** The wrapper span around a row's checkbox — see file-header comment for why. */
const checkboxSlotFor = (name) =>
  screen.getByRole('checkbox', { name }).closest('.list-rule-checkbox-slot');

describe('ListRuleChecklist — mandatory rows on a narrow viewport (Issue 0138, AC5, Prüfrunde 1 F2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tapping a mandatory switch-row rule on a narrow (mobile) viewport reveals a visible explanation', () => {
    setViewportWidth(500);
    const state = mandatorySwitchRule();
    render(<ListRuleChecklist {...baseProps} states={[state]} />);

    fireEvent.click(checkboxSlotFor(state.name));

    const sheet = screen.queryByTestId('bottom-sheet');
    expect(sheet).not.toBeNull();
    // More than just the row's own name must be shown — an actual explanation,
    // not merely a bare re-statement of the title.
    expect(sheet.textContent.trim().length).toBeGreaterThan(state.name.length);
  });

  it('tapping a mandatory container-row rule on a narrow viewport also reveals a visible explanation', () => {
    setViewportWidth(500);
    const state = mandatoryContainerRule();
    render(<ListRuleChecklist {...baseProps} states={[state]} />);

    fireEvent.click(checkboxSlotFor(state.name));

    const sheet = screen.queryByTestId('bottom-sheet');
    expect(sheet).not.toBeNull();
    expect(sheet.textContent.trim().length).toBeGreaterThan(state.name.length);
  });

  it("boundary: at exactly window.innerWidth = 900 (this project's own inclusive mobile threshold), tapping still reveals the explanation", () => {
    setViewportWidth(900);
    const state = mandatorySwitchRule();
    render(<ListRuleChecklist {...baseProps} states={[state]} />);

    fireEvent.click(checkboxSlotFor(state.name));

    expect(screen.queryByTestId('bottom-sheet')).not.toBeNull();
  });

  it('does not reveal any explanation when tapping a non-mandatory rule on a narrow viewport', () => {
    setViewportWidth(500);
    const state = optionalSwitchRule();
    render(<ListRuleChecklist {...baseProps} states={[state]} />);

    fireEvent.click(checkboxSlotFor(state.name));

    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  it('on a desktop viewport (where hover already conveys the explanation), tapping the same spot does not spuriously open the sheet', () => {
    setViewportWidth(1024);
    const state = mandatorySwitchRule();
    render(<ListRuleChecklist {...baseProps} states={[state]} />);

    fireEvent.click(checkboxSlotFor(state.name));

    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });
});
