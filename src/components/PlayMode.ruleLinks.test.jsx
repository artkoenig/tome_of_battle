import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayMode from './PlayMode';

// This suite isolates PlayMode's rule-link wiring: the `onShowRule` seam that all
// play-mode chip groups funnel through, and the resulting RulesIndexDialog URL.
// Both must be governed by the central `useRuleUrl` hook so the global whfb6
// linking setting is honored (see ADR-0015 and issue 17/03). PlayUnitDetails and
// RulesIndexDialog are mocked so the test observes only PlayMode's behavior.

const RULE_NAME = 'Killing Blow';
const RULE_URL = 'https://6th.whfb.app/special-rules/killing-blow';
const REGELBUCH_URL = 'https://6th.whfb.app/?utm_source=6th-builder&utm_medium=referral';

const mockResolveRuleUrl = vi.fn();

vi.mock('../hooks/useRuleUrl', () => ({
  useRuleUrl: () => mockResolveRuleUrl,
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Search: () => <span data-testid="icon-search" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Heart: () => <span data-testid="icon-heart" />,
  Swords: () => <span data-testid="icon-swords" />,
  BookOpen: () => <span data-testid="icon-book-open" />,
  X: () => <span data-testid="icon-x" />,
}));

vi.mock('../db/database', () => ({
  saveRoster: vi.fn(),
}));

vi.mock('../hooks/usePlayState', () => ({
  default: () => ({
    gameState: { wounds: {} },
    adjustTracker: vi.fn(),
    getUnitCurrentWounds: vi.fn(),
    handleAdjustWound: vi.fn(),
  }),
}));

vi.mock('../solver/validator', () => ({
  findEntryInSystem: vi.fn(() => ({ id: 'entry' })),
  resolveEntry: vi.fn(() => ({ id: 'resolved', name: 'Resolved', profiles: [] })),
  collectUnitProfilesAndRules: vi.fn(() => ({ profiles: [], rules: [] })),
  getSelectionTotalCost: vi.fn(() => 100),
  findForceEntryById: (system, id) => system?.forceEntries?.find((fe) => fe.id === id) || null,
  calculateRosterCosts: () => ({}),
  getExtraResourceTotals: () => [],
  // These tests exercise rule links, not play-view grouping; nothing is a list
  // configuration here, so grouping stays as it was.
  isListConfiguration: () => false,
}));

// PlayUnitDetails is the component that renders the three chip groups. Here it is
// reduced to a single button that triggers the `onShowRule` callback PlayMode
// passes down, standing in for a user clicking a linked rule chip.
vi.mock('./play/PlayUnitDetails', () => ({
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
  forceEntries: [{ id: 'fe-1', categoryLinks: [{ targetId: 'cat-core', name: 'Core' }] }],
  categoryEntries: [{ id: 'cat-core', name: 'Core Units' }],
};

const mockRoster = {
  catalogueId: 'cat-1',
  costLimitType: 'pts',
  forces: [
    {
      id: 'force-1',
      forceEntryId: 'fe-1',
      selections: [{ id: 'sel-1', name: 'Knights', category: 'cat-core', entryLinkId: 'el-1' }],
    },
  ],
};

function renderPlayMode() {
  return render(<PlayMode system={mockSystem} roster={mockRoster} onBack={vi.fn()} />);
}

describe('PlayMode rule-link wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  it('resolves the rule name through the central hook when a chip is clicked', () => {
    mockResolveRuleUrl.mockReturnValue(RULE_URL);
    renderPlayMode();

    fireEvent.click(screen.getByTestId('chip-show-rule'));

    expect(mockResolveRuleUrl).toHaveBeenCalledWith(RULE_NAME);
  });

  it('opens the rules dialog with the hook-resolved URL when linking is enabled', () => {
    mockResolveRuleUrl.mockReturnValue(RULE_URL);
    renderPlayMode();

    fireEvent.click(screen.getByTestId('chip-show-rule'));

    const dialog = screen.getByTestId('rules-index-dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('data-url')).toBe(RULE_URL);
    expect(dialog.textContent).toBe(RULE_NAME);
  });

  it('shows the catalog fallback (no external dialog) when linking is disabled', () => {
    mockResolveRuleUrl.mockReturnValue(null);
    renderPlayMode();

    fireEvent.click(screen.getByTestId('chip-show-rule'));

    expect(screen.queryByTestId('rules-index-dialog')).toBeNull();
  });

  it('reflects a toggled setting on the next click without remounting', () => {
    renderPlayMode();

    // Setting off: clicking a chip must not open the external dialog.
    mockResolveRuleUrl.mockReturnValue(null);
    fireEvent.click(screen.getByTestId('chip-show-rule'));
    expect(screen.queryByTestId('rules-index-dialog')).toBeNull();

    // Setting on: the very next click opens the dialog, no reload in between.
    mockResolveRuleUrl.mockReturnValue(RULE_URL);
    fireEvent.click(screen.getByTestId('chip-show-rule'));
    expect(screen.getByTestId('rules-index-dialog').getAttribute('data-url')).toBe(RULE_URL);
  });

  it('keeps an already-open dialog intact when the setting is toggled off', () => {
    mockResolveRuleUrl.mockReturnValue(RULE_URL);
    const { rerender } = renderPlayMode();
    fireEvent.click(screen.getByTestId('chip-show-rule'));
    expect(screen.getByTestId('rules-index-dialog')).toBeTruthy();

    // Toggling the setting off re-renders the same PlayMode instance; the dialog
    // captured its URL at open time, so it must remain until closed manually.
    mockResolveRuleUrl.mockReturnValue(null);
    rerender(<PlayMode system={mockSystem} roster={mockRoster} onBack={vi.fn()} />);

    const dialog = screen.getByTestId('rules-index-dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('data-url')).toBe(RULE_URL);
  });

  it('keeps the Regelbuch button visible and functional regardless of the setting', () => {
    mockResolveRuleUrl.mockReturnValue(null);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPlayMode();

    const regelbuchButtons = screen.getAllByTitle('Regelbuch öffnen (neuer Tab)');
    expect(regelbuchButtons.length).toBeGreaterThan(0);

    fireEvent.click(regelbuchButtons[0]);
    expect(openSpy).toHaveBeenCalledWith(REGELBUCH_URL, '_blank');

    openSpy.mockRestore();
  });
});
