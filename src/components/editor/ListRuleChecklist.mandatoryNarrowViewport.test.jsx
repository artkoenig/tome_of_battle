import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListRuleChecklistHarness as ListRuleChecklist } from '../../test-utils/harnesses/ListRuleChecklistHarness';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';
import { t } from '../../i18n/i18nStore';

/**
 * Issue 0138, AC5 — "Prüfrunde 1" F2 follow-up, revised design.
 *
 * A fresh-context reviewer confirmed that on a narrow/touch viewport (this
 * project's own established mobile breakpoint, `window.innerWidth <= 900`),
 * a mandatory list-rule row's explanation was unreachable under the
 * *original* hover-on-checkbox design. The fix that followed does not bolt a
 * tap alternative onto that checkbox mechanism; it replaces it outright with
 * the SAME info-icon pattern `SelectionConfigurator.jsx` already uses for
 * every other option's catalogue description (`RuleChipIcon`, fed by
 * `resolveEntry`/`renderUpgradeDetails`), rendered next to `state.name`. That
 * pattern already carries both halves of the interaction — hover +
 * `GothicTooltip` on wide viewports (covered by the sibling
 * `ListRuleChecklist.mandatory.test.jsx`), tap + `BottomSheet` on narrow ones
 * (covered here) — so no bespoke tap mechanism is needed.
 *
 * Consequence: the `.list-rule-checkbox-slot` wrapper and its dedicated
 * `handleMandatoryMouse*`/tap handlers are gone; the checkbox itself carries
 * no interaction for the explanation anymore, on any viewport width. The tap
 * target here is the info icon (`RuleChipIcon`'s rendered `Info`), exactly as
 * `UnitSelectionCard.test.jsx` ("responsive: triggers BottomSheet onClick of
 * upgrade badge on mobile layout" / "... does not show BottomSheet onClick on
 * desktop layout") already establishes the mock-BottomSheet-behind-a-testid
 * convention for this exact kind of tap fallback, and exactly as
 * `SelectionConfigurator.jsx`'s own `onInfoClick` wiring
 * (`res && window.innerWidth <= 900`) establishes the desktop-side guard.
 *
 * `BottomSheet` is mocked here (rather than left real, as in the sibling
 * `ListRuleChecklist.mandatory.test.jsx`) so the sheet's presence/content is
 * directly observable via a stable testid, following `UnitSelectionCard.test.jsx`'s
 * mock exactly. `GothicTooltip` is mocked away since this file exercises the
 * tap half only.
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

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Info: ({ onClick, ...rest }) => <span data-testid="icon-info" onClick={onClick} {...rest} />,
  BookOpen: ({ onClick, ...rest }) => <span data-testid="icon-book" onClick={onClick} {...rest} />,
}));

const mockGetRuleUrl = vi.fn();
vi.mock('../../data/rulesLookup', () => ({
  getRuleUrl: (name) => mockGetRuleUrl(name),
}));

const mockUseSettings = vi.fn();
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

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

const DESCRIPTION_TEXT = 'The dead shall walk the earth eternal, bound to the will of the Vampire Counts.';
const CONTAINER_DESCRIPTION_TEXT = 'A pact sealed with the von Carstein bloodline binds this force to endless war.';
const MANDATORY_NOTE = t('editor.listRules.mandatoryTooltip');

const mandatorySwitchRule = (over = {}) => ({
  entry: {
    id: 'e-mandatory',
    name: 'The Laws of Undeath',
    rules: [{ name: 'The Laws of Undeath', description: DESCRIPTION_TEXT }],
  },
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
  entry: { id: 'e-optional', name: 'Allow experimental rules?' },
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
  entry: {
    id: 'e-mandatory-container',
    name: 'Army of Sylvania',
    rules: [{ name: 'Army of Sylvania', description: CONTAINER_DESCRIPTION_TEXT }],
  },
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

describe('ListRuleChecklist — mandatory rows on a narrow viewport (Issue 0138, AC5, Prüfrunde 1 F2, info-icon design)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuleUrl.mockReturnValue(null);
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true });
  });

  it('tapping a mandatory switch-row rule\'s info icon on a narrow (mobile) viewport reveals the description followed by the mandatory note', () => {
    setViewportWidth(500);
    render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);

    fireEvent.click(screen.getByTestId('icon-info'));

    const sheet = screen.queryByTestId('bottom-sheet');
    expect(sheet).not.toBeNull();
    const text = sheet.textContent;
    expect(text).toContain(DESCRIPTION_TEXT);
    expect(text).toContain(MANDATORY_NOTE);
    expect(text.indexOf(DESCRIPTION_TEXT)).toBeLessThan(text.indexOf(MANDATORY_NOTE));
  });

  it('tapping a mandatory container-row rule\'s info icon on a narrow viewport also reveals the combined content', () => {
    setViewportWidth(500);
    render(<ListRuleChecklist {...baseProps} states={[mandatoryContainerRule()]} />);

    fireEvent.click(screen.getByTestId('icon-info'));

    const sheet = screen.queryByTestId('bottom-sheet');
    expect(sheet).not.toBeNull();
    const text = sheet.textContent;
    expect(text).toContain(CONTAINER_DESCRIPTION_TEXT);
    expect(text).toContain(MANDATORY_NOTE);
    expect(text.indexOf(CONTAINER_DESCRIPTION_TEXT)).toBeLessThan(text.indexOf(MANDATORY_NOTE));
  });

  it("boundary: at exactly window.innerWidth = 900 (this project's own inclusive mobile threshold), tapping the info icon still reveals the explanation", () => {
    setViewportWidth(900);
    render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);

    fireEvent.click(screen.getByTestId('icon-info'));

    expect(screen.queryByTestId('bottom-sheet')).not.toBeNull();
  });

  it('on a desktop viewport (where hover already conveys the explanation), tapping the info icon does not spuriously open the sheet', () => {
    setViewportWidth(1024);
    render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);

    fireEvent.click(screen.getByTestId('icon-info'));

    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  it('a mandatory row\'s explanation stays reachable by tap even when a 6th.whfb.app rule link resolves for its name (no bare external link hiding it, Plan Contract 3b)', () => {
    setViewportWidth(500);
    mockGetRuleUrl.mockImplementation((name) =>
      name === 'The Laws of Undeath' ? 'https://6th.whfb.app/special-rules/the-laws-of-undeath' : null
    );
    render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);

    expect(screen.queryByTestId('icon-book')).toBeNull();
    fireEvent.click(screen.getByTestId('icon-info'));

    const sheet = screen.queryByTestId('bottom-sheet');
    expect(sheet).not.toBeNull();
    expect(sheet.textContent).toContain(MANDATORY_NOTE);
  });

  it('does not render an info icon for a non-mandatory row on a narrow viewport (no new affordance leaks onto it)', () => {
    setViewportWidth(500);
    render(<ListRuleChecklist {...baseProps} states={[optionalSwitchRule()]} />);

    expect(screen.queryByTestId('icon-info')).toBeNull();
    expect(screen.queryByTestId('icon-book')).toBeNull();
  });

  it("tapping a non-mandatory rule's checkbox on a narrow viewport does not open the sheet (the checkbox itself carries no tap interaction anymore)", () => {
    setViewportWidth(500);
    render(<ListRuleChecklist {...baseProps} states={[optionalSwitchRule()]} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Allow experimental rules?' }));

    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  /**
   * Issue 0140, criterion 4 — Issue 0138's criterion 4 stays untouched: a
   * mandatory rule missing from a pre-existing roster "bleibt ein manuell zu
   * behebender Fehler wie bisher". On a narrow viewport that manual fix has to
   * work too, and the hint must stay reachable while the rule is still absent —
   * the hint is not tied to the lock.
   */
  describe('an ABSENT mandatory rule on a narrow viewport (Issue 0140 AC4)', () => {
    it('its checkbox is enabled, and tapping it adds the rule', () => {
      setViewportWidth(500);
      render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule({ checked: false, selection: null })]} />);

      const checkbox = screen.getByRole('checkbox', { name: 'The Laws of Undeath' });
      expect(checkbox.disabled).toBe(false);

      fireEvent.click(checkbox);

      expect(baseProps.addUnit).toHaveBeenCalledTimes(1);
      expect(baseProps.addUnit).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'e-mandatory' }),
        'cat-rules'
      );
    });

    it('tapping its info icon still reveals the description followed by the mandatory note', () => {
      setViewportWidth(500);
      render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule({ checked: false, selection: null })]} />);

      fireEvent.click(screen.getByTestId('icon-info'));

      const sheet = screen.queryByTestId('bottom-sheet');
      expect(sheet).not.toBeNull();
      expect(sheet.textContent).toContain(DESCRIPTION_TEXT);
      expect(sheet.textContent).toContain(MANDATORY_NOTE);
    });
  });
});
