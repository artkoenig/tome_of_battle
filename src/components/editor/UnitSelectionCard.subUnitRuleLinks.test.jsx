import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnitSelectionCardHarness as UnitSelectionCard } from '../../test-utils/editorHarness';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';

// A unit card renders its independent sub-units as further UnitSelectionCards.
// Those nested cards carry rule chips of their own — the crew of a chariot, for
// example — and a chip whose name resolves to a 6th.whfb.app page shows the
// BookOpen affordance. This suite pins the wiring that makes that affordance do
// something: the recursive render must hand `onShowRule` down, or the icon is
// drawn but the click falls into RuleChipIcon's `if (onShowRule)` guard and the
// rules dialog never opens (see ADR-0015 for the linking seam itself).

const RULE_NAME = 'Killing Blow';
const RULE_URL = 'https://6th.whfb.app/special-rules/killing-blow';

const mockResolveRuleUrl = vi.fn();
vi.mock('../../hooks/useRuleUrl', () => ({
  useRuleUrl: () => mockResolveRuleUrl,
}));

vi.mock('lucide-react', () => ({
  Trash2: () => <span data-testid="icon-trash" />,
  Copy: () => <span data-testid="icon-copy" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  MoreVertical: () => <span data-testid="icon-more-vertical" />,
  ReceiptText: () => <span data-testid="icon-receipt-text" />,
  Info: ({ onClick }) => <span data-testid="icon-info" onClick={onClick} />,
  BookOpen: ({ onClick }) => <span data-testid="icon-book" onClick={onClick} />,
}));

vi.mock('./SelectionConfigurator', () => ({
  default: () => <div data-testid="selection-configurator" />,
}));
vi.mock('./BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="bottom-sheet">{children}</div> : null),
}));

// Catalogue definitions behind the two child selections, keyed by their entry id.
// The crew resolves to a non-collective `model` entry with children of its own,
// which is exactly what makes it an independent sub-unit and gives it a card;
// the upgrade below it carries a cost, so it survives the chip filter.
const DEFINITIONS = {
  'el-crew': {
    id: 'def-crew',
    name: 'Goblin Crew',
    type: 'model',
    collective: false,
    selectionEntries: [{ id: 'def-crew-child' }],
  },
  'el-upgrade': {
    id: 'def-upgrade',
    name: RULE_NAME,
    type: 'upgrade',
    collective: false,
    costs: [{ name: 'pts', value: '5' }],
  },
};

vi.mock('../../roster', async () => ({
  findEntryInSystem: (_system, entryId) => (DEFINITIONS[entryId] ? entryId : null),
  resolveEntry: (_system, entryId) => DEFINITIONS[entryId] || null,
  collectUnitProfilesAndRules: () => ({ profiles: [], rules: [] }),
  getEffectiveSelectionName: (selection) => selection?.name ?? '',
  isIndependentSubUnit: (await vi.importActual('../../roster/subUnit')).isIndependentSubUnit,
  childSelectionsOf: (await vi.importActual('../../roster/rosterTree')).childSelectionsOf,
  groupProfilesByType: (await vi.importActual('../../roster/profileGrouping')).groupProfilesByType,
  ...(await vi.importActual('../../roster/constants')),
}));

const chariot = {
  id: 'sel-chariot',
  name: 'Goblin Wolf Chariot',
  entryLinkId: 'el-chariot',
  number: 1,
  selections: [
    {
      id: 'sel-crew',
      name: 'Goblin Crew',
      entryLinkId: 'el-crew',
      number: 3,
      selections: [
        { id: 'sel-upgrade', name: RULE_NAME, entryLinkId: 'el-upgrade', number: 1, selections: [] },
      ],
    },
  ],
};

const baseProps = {
  selection: chariot,
  selectedRosterSelection: null,
  setSelectedRosterSelection: vi.fn(),
  roster: { costLimitType: 'pts' },
  system: {},
  violations: [],
  // Die Karte liest am Slot ab, welches Kind eine eigene Karte bekommt
  // (`isIndependentSubUnit`, Issue 0156) — die Crew ist eine eigenstaendige
  // Untereinheit, das Upgrade darunter nicht.
  capabilities: new Map([
    ['0/0', { anchorKind: 'occupied', totalCosts: { pts: 60 }, isIndependentSubUnit: false, infoElements: [] }],
    ['0/0/0', { anchorKind: 'occupied', totalCosts: { pts: 30 }, isIndependentSubUnit: true, infoElements: [] }],
    ['0/0/0/0', { anchorKind: 'occupied', totalCosts: { pts: 5 }, isIndependentSubUnit: false, infoElements: [] }],
  ]),
  pathBySelectionId: new Map([['sel-chariot', '0/0'], ['sel-crew', '0/0/0'], ['sel-upgrade', '0/0/0/0']]),
  costTypeLabel: 'Pkt.',
  removeUnit: vi.fn(),
  // Only a top-level card gets `copyUnit`; its presence is what marks this card
  // as the parent and the recursively rendered crew card as the sub-unit.
  copyUnit: vi.fn(),
  subSelectionOperations: createSubSelectionOperationsMock(),
  activeCatalogue: { id: 'og-cat' },
};

describe('UnitSelectionCard rule links on sub-unit cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveRuleUrl.mockReturnValue(RULE_URL);
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  it('renders the crew as its own sub-unit card', () => {
    const { container } = render(<UnitSelectionCard {...baseProps} onShowRule={vi.fn()} />);

    expect(container.querySelector('.selection-node--sub')).not.toBeNull();
  });

  it('opens the rules dialog from a chip on the sub-unit card', () => {
    const onShowRule = vi.fn();
    const { container } = render(<UnitSelectionCard {...baseProps} onShowRule={onShowRule} />);

    const subCard = container.querySelector('.selection-node--sub');
    const bookIcon = subCard.querySelector('[data-testid="icon-book"]');
    expect(bookIcon).not.toBeNull();

    fireEvent.click(bookIcon);

    expect(onShowRule).toHaveBeenCalledWith(RULE_NAME);
  });

  it('opens the rules dialog from the chip label on the sub-unit card', () => {
    const onShowRule = vi.fn();
    const { container } = render(<UnitSelectionCard {...baseProps} onShowRule={onShowRule} />);

    const chip = container.querySelector('.selection-node--sub .upgrade-badge');
    fireEvent.click(chip);

    expect(onShowRule).toHaveBeenCalledWith(RULE_NAME);
  });

  it('shows no book affordance on the sub-unit card when the name has no rule page', () => {
    mockResolveRuleUrl.mockReturnValue(null);
    const { container } = render(<UnitSelectionCard {...baseProps} onShowRule={vi.fn()} />);

    const subCard = container.querySelector('.selection-node--sub');
    expect(subCard.querySelector('[data-testid="icon-book"]')).toBeNull();
  });
});
