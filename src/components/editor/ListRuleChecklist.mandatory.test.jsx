import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ListRuleChecklist from './ListRuleChecklist';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';
import { t } from '../../i18n/i18nStore';

/**
 * Issue 0138, AC5 — a `state.mandatory` row renders a disabled checkbox
 * (unchanged) and a *visible* explanation reachable on a desktop-width
 * viewport, at both checkbox locations (the plain switch-row and the
 * expandable container-row), per Plan Contract 3/3a/3b.
 *
 * Revision (Prüfrunde 1, F2): the explanation no longer lives as a
 * hover-only tooltip wired to the (disabled) checkbox itself — that
 * mechanism is unreachable on a narrow/touch viewport and is being removed
 * entirely (no more `.list-rule-checkbox-slot` hover wrapper, no more
 * `handleMandatoryMouse*` handlers on the checkbox). Instead, a mandatory
 * row gets the SAME info-icon affordance `SelectionConfigurator.jsx` already
 * uses for every other option's catalogue description: `RuleChipIcon`, fed
 * by `resolveEntry(system, state.entry, activeCatalogue?.id)` +
 * `renderUpgradeDetails(res, system)`, rendered next to `state.name`. For a
 * mandatory row specifically:
 *   - the icon appears unconditionally (even when no description resolves),
 *   - its content is the real catalogue description followed by the
 *     existing `t('editor.listRules.mandatoryTooltip')` sentence,
 *   - it is never pre-empted by `RuleChipIcon`'s normal external-rule-link
 *     (BookOpen) priority, even when `useRuleUrl` resolves a 6th.whfb.app
 *     mapping for the row's name (Contract 3b).
 *
 * This file covers the desktop/hover half of that affordance; the narrow-
 * viewport/tap half lives in the sibling
 * `ListRuleChecklist.mandatoryNarrowViewport.test.jsx`.
 *
 * Convention followed for the icon itself: `RuleChipIcon.test.jsx` /
 * `UnitChips.test.jsx` — mock `lucide-react`'s `Info`/`BookOpen` as stable
 * testids, mock RuleChipIcon's own two dependencies (the rule-link lookup
 * and the whfb6-linking setting), but leave `RuleChipIcon` itself real so
 * its link-vs-info priority (and the mandatory-row override of it) is
 * actually exercised end to end, not stubbed away.
 *
 * `state.entry` carries real `rules[].description` text in these fixtures
 * (the same shape `resolveEntry`/`renderUpgradeDetails` read for every other
 * option) rather than a mocked resolver, so the hover assertions check an
 * actual, known description string rather than pinning `renderUpgradeDetails`'s
 * internal formatting.
 *
 * `GothicTooltip` is deliberately left UNMOCKED (as in the previous revision
 * of this file) so the hover explanation itself is observable in the DOM via
 * `.gothic-tooltip`.
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
const OPTIONAL_DESCRIPTION_TEXT = 'This switch is a courtesy and is never required.';
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
  entry: {
    id: 'e-optional',
    name: 'Allow experimental rules?',
    rules: [{ name: 'Allow experimental rules?', description: OPTIONAL_DESCRIPTION_TEXT }],
  },
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

describe('ListRuleChecklist — mandatory rows (Issue 0138, AC5, info-icon design)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    mockGetRuleUrl.mockReturnValue(null);
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true });
  });

  describe('checkbox stays locked (regression, AC5 "nicht abwählbar")', () => {
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

    it("clicking a mandatory rule's checkbox does not toggle it (no add/remove call)", () => {
      render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);
      fireEvent.click(screen.getByRole('checkbox', { name: 'The Laws of Undeath' }));
      expect(baseProps.addUnit).not.toHaveBeenCalled();
      expect(baseProps.removeUnit).not.toHaveBeenCalled();
    });
  });

  describe('info icon next to the row name (Plan Contract 3a)', () => {
    it("shows an info icon next to a mandatory switch-row rule's name", () => {
      render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);
      expect(screen.getByTestId('icon-info')).toBeTruthy();
    });

    it("shows an info icon next to a mandatory container-row rule's name", () => {
      render(<ListRuleChecklist {...baseProps} states={[mandatoryContainerRule()]} />);
      expect(screen.getByTestId('icon-info')).toBeTruthy();
    });

    it('still shows the info icon when the mandatory entry carries no catalogue description at all (unconditional, not gated on renderUpgradeDetails finding something)', () => {
      render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule({ entry: { id: 'e-mandatory' } })]} />);
      expect(screen.getByTestId('icon-info')).toBeTruthy();
    });

    it('the explanation is no longer reachable by hovering the checkbox itself — it moved to the info icon', () => {
      render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);
      const checkbox = screen.getByRole('checkbox', { name: 'The Laws of Undeath' });

      fireEvent.mouseEnter(checkbox, { clientX: 10, clientY: 10 });

      expect(document.querySelector('.gothic-tooltip')).toBeNull();
    });
  });

  describe('hovering the info icon on a desktop viewport shows the real description followed by the mandatory note (Plan Contract 3a)', () => {
    it('switch-row rule', () => {
      render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);

      fireEvent.mouseEnter(screen.getByTestId('icon-info'), { clientX: 10, clientY: 10 });

      const tooltip = document.querySelector('.gothic-tooltip');
      expect(tooltip).not.toBeNull();
      const text = tooltip.textContent;
      expect(text).toContain(DESCRIPTION_TEXT);
      expect(text).toContain(MANDATORY_NOTE);
      // The catalogue description comes first, the mandatory note is appended
      // after it — not instead of it.
      expect(text.indexOf(DESCRIPTION_TEXT)).toBeLessThan(text.indexOf(MANDATORY_NOTE));
    });

    it('container-row rule', () => {
      render(<ListRuleChecklist {...baseProps} states={[mandatoryContainerRule()]} />);

      fireEvent.mouseEnter(screen.getByTestId('icon-info'), { clientX: 10, clientY: 10 });

      const tooltip = document.querySelector('.gothic-tooltip');
      expect(tooltip).not.toBeNull();
      const text = tooltip.textContent;
      expect(text).toContain(CONTAINER_DESCRIPTION_TEXT);
      expect(text).toContain(MANDATORY_NOTE);
      expect(text.indexOf(CONTAINER_DESCRIPTION_TEXT)).toBeLessThan(text.indexOf(MANDATORY_NOTE));
    });
  });

  describe("the mandatory hint is never pre-empted by RuleChipIcon's external-rule-link priority (Plan Contract 3b)", () => {
    beforeEach(() => {
      // A 6th.whfb.app mapping exists for this row's name — RuleChipIcon's
      // ordinary priority would show BookOpen and hide the Info affordance.
      mockGetRuleUrl.mockImplementation((name) =>
        name === 'The Laws of Undeath' ? 'https://6th.whfb.app/special-rules/the-laws-of-undeath' : null
      );
      mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true });
    });

    it('still shows the info icon, not a bare external BookOpen link, for a mandatory row', () => {
      render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);

      expect(screen.queryByTestId('icon-book')).toBeNull();
      expect(screen.getByTestId('icon-info')).toBeTruthy();
    });

    it('the mandatory note stays reachable via hover even though a rule link exists', () => {
      render(<ListRuleChecklist {...baseProps} states={[mandatorySwitchRule()]} />);

      fireEvent.mouseEnter(screen.getByTestId('icon-info'), { clientX: 10, clientY: 10 });

      const tooltip = document.querySelector('.gothic-tooltip');
      expect(tooltip).not.toBeNull();
      expect(tooltip.textContent).toContain(MANDATORY_NOTE);
    });
  });

  describe('non-mandatory rows are unchanged — no new affordance leaks onto them', () => {
    it('renders no info icon and no book icon for a non-mandatory row, even though its entry has a catalogue description', () => {
      render(<ListRuleChecklist {...baseProps} states={[optionalSwitchRule()]} />);
      expect(screen.queryByTestId('icon-info')).toBeNull();
      expect(screen.queryByTestId('icon-book')).toBeNull();
    });

    it("hovering a non-mandatory rule's checkbox shows no tooltip (unchanged)", () => {
      render(<ListRuleChecklist {...baseProps} states={[optionalSwitchRule()]} />);
      const checkbox = screen.getByRole('checkbox', { name: 'Allow experimental rules?' });

      fireEvent.mouseEnter(checkbox, { clientX: 10, clientY: 10 });

      expect(document.querySelector('.gothic-tooltip')).toBeNull();
    });
  });
});
