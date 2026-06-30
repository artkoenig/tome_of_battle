import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlayMode from './PlayMode';
import PlayUnitDetails from './play/PlayUnitDetails';
import { findEntryInSystem, resolveEntry, collectUnitProfilesAndRules, getSelectionTotalCost } from '../solver/validator';
import usePlayState from '../hooks/usePlayState';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Search: () => <span data-testid="icon-search" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Heart: () => <span data-testid="icon-heart" />,
  Swords: () => <span data-testid="icon-swords" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  BookOpen: () => <span data-testid="icon-book-open" />,
  X: () => <span data-testid="icon-x" />,
}));

// Mock usePlayState custom hook
const mockHandleAdjustWound = vi.fn();
const mockAdjustTracker = vi.fn();
const mockGetUnitCurrentWounds = vi.fn().mockReturnValue(5);

vi.mock('../hooks/usePlayState', () => ({
  default: (initialRoster, setRoster, saveRoster) => ({
    gameState: { round: 1, vp: 0, cp: 0, wounds: { 'sel-1': 5, 'sel-2': 3, 'sel-3': 1 } },
    adjustTracker: mockAdjustTracker,
    getUnitCurrentWounds: mockGetUnitCurrentWounds,
    handleAdjustWound: mockHandleAdjustWound
  })
}));

// Mock Debug Context
let mockShowDebugIds = false;
vi.mock('../hooks/DebugContext', () => ({
  useDebugMode: () => ({ showDebugIds: mockShowDebugIds })
}));

// Mock Database
vi.mock('../db/database', () => ({
  saveRoster: vi.fn()
}));

// Mock Validator
const mockFindEntryInSystem = vi.fn();
const mockResolveEntry = vi.fn();
const mockCollectUnitProfilesAndRules = vi.fn();
const mockGetSelectionTotalCost = vi.fn();

vi.mock('../solver/validator', () => ({
  findEntryInSystem: (...args) => mockFindEntryInSystem(...args),
  resolveEntry: (...args) => mockResolveEntry(...args),
  collectUnitProfilesAndRules: (...args) => mockCollectUnitProfilesAndRules(...args),
  getSelectionTotalCost: (...args) => mockGetSelectionTotalCost(...args),
}));

// Mock Rules Evaluator
vi.mock('../solver/rulesEvaluator', () => ({
  getArmourSave: vi.fn().mockReturnValue({ save: 5, breakdown: ['Base: 5+'] }),
  getWardSave: vi.fn().mockReturnValue({ save: 6, breakdown: ['Blessing: 6+'] }),
  extractModelProfiles: vi.fn().mockImplementation((profiles) => profiles),
  extractUpgradeProfiles: vi.fn().mockImplementation((profiles) => profiles),
  hasBlessing: vi.fn().mockReturnValue(false)
}));

describe('PlayMode Component', () => {
  const mockSystem = {
    id: 'sys-1',
    forceEntries: [
      {
        id: 'fe-1',
        categoryLinks: [
          { targetId: 'cat-core', name: 'Core' },
          { targetId: 'cat-special', name: 'Special' }
        ]
      }
    ],
    categoryEntries: [
      { id: 'cat-core', name: 'Core Units' },
      { id: 'cat-special', name: 'Special Units' }
    ]
  };

  const mockRoster = {
    costLimitType: 'pts',
    catalogueId: 'cat-1',
    forces: [
      {
        id: 'force-1',
        forceEntryId: 'fe-1',
        selections: [
          { id: 'sel-1', name: 'Knights Core', category: 'cat-core', entryLinkId: 'el-1' },
          { id: 'sel-2', name: 'Trebuchet Special', category: 'cat-special', entryLinkId: 'el-2' },
          { id: 'sel-3', name: 'Peasants Core', category: 'cat-core', entryLinkId: 'el-3' }
        ]
      }
    ]
  };

  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockShowDebugIds = false;
    
    // Default mock validator outputs
    mockCollectUnitProfilesAndRules.mockReturnValue({
      profiles: [
        {
          profileTypeName: 'Model',
          name: 'Knight',
          characteristics: [
            { name: 'M', value: '4' },
            { name: 'WS', value: '4' }
          ]
        }
      ],
      rules: []
    });

    mockFindEntryInSystem.mockReturnValue({ id: 'raw-entry' });
    mockResolveEntry.mockReturnValue({
      id: 'resolved-entry',
      name: 'Resolved Entry',
      profiles: [{ characteristics: [{ name: 'Lebenspunkte', value: '1' }] }]
    });

    mockGetSelectionTotalCost.mockImplementation((sel) => {
      if (sel.id === 'sel-1') return 150;
      if (sel.id === 'sel-2') return 100;
      if (sel.id === 'sel-3') return 50;
      return 0;
    });

    // Default to desktop
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  it('1. Render Categories & Units with sorted costs', () => {
    render(<PlayMode system={mockSystem} roster={mockRoster} onBack={mockOnBack} />);

    expect(screen.getByText('Core Units')).toBeDefined();
    expect(screen.getByText('Special Units')).toBeDefined();

    expect(screen.getByText('Knights Core')).toBeDefined();
    expect(screen.getByText('Trebuchet Special')).toBeDefined();
    expect(screen.getByText('Peasants Core')).toBeDefined();

    // Verify sorting descending by cost in Core category
    // sel-1 (150 pts) should appear before sel-3 (50 pts) in the DOM
    const unitElements = screen.getAllByText(/Pkt\./);
    expect(unitElements[0].textContent).toContain('150 Pkt.');
    expect(unitElements[1].textContent).toContain('50 Pkt.');
  });

  it('2. Back Button Action', () => {
    render(<PlayMode system={mockSystem} roster={mockRoster} onBack={mockOnBack} />);

    const backBtn = screen.getByTitle('Kriegsplanung (Editieren)');
    fireEvent.click(backBtn);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('3. Wound Adjustment Dispatch', () => {
    render(<PlayMode system={mockSystem} roster={mockRoster} onBack={mockOnBack} />);

    // Click Minus button on Knights Core (sel-1)
    const minusBtn = screen.getAllByTestId('icon-minus')[0].closest('button');
    fireEvent.click(minusBtn);

    expect(mockHandleAdjustWound).toHaveBeenCalledWith('sel-1', -1, 1);

    // Click Plus button
    const plusBtn = screen.getAllByTestId('icon-plus')[0].closest('button');
    fireEvent.click(plusBtn);

    expect(mockHandleAdjustWound).toHaveBeenCalledWith('sel-1', 1, 1);
  });

  it('4. Desktop Layout Tooltips (AS/WS)', () => {
    // Set window width to desktop
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });

    render(<PlayMode system={mockSystem} roster={mockRoster} onBack={mockOnBack} />);

    const asBadge = screen.getAllByText('AS: 5+')[0];
    
    // Hover over AS badge
    fireEvent.mouseEnter(asBadge, { clientX: 100, clientY: 200 });

    // Tooltip should be visible
    expect(screen.getByText('Rüstungswurf (AS)')).toBeDefined();
    expect(screen.getByText('Base: 5+')).toBeDefined();

    // Mouse leave
    fireEvent.mouseLeave(asBadge);
    expect(screen.queryByText('Rüstungswurf (AS)')).toBeNull();
  });

  it('5. Mobile Layout BottomSheet (AS/WS)', async () => {
    // Set window width to mobile
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });

    render(<PlayMode system={mockSystem} roster={mockRoster} onBack={mockOnBack} />);

    const asBadge = screen.getAllByText('AS: 5+')[0];

    // Hover should not show tooltip on mobile
    fireEvent.mouseEnter(asBadge);
    expect(screen.queryByText('Rüstungswurf (AS)')).toBeNull();

    // Click badge should trigger bottom sheet
    fireEvent.click(asBadge);
    expect(screen.getByText('Rüstungswurf (AS)')).toBeDefined();
    expect(screen.getByText('Base: 5+')).toBeDefined();

    // Click close button on bottom sheet
    const closeBtn = screen.getByTitle('Schließen'); // BottomSheet.jsx has 'Schließen' title
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Base: 5+')).toBeNull();
    });
  });

  it('7. Render Debug IDs when showDebugIds is active', () => {
    mockShowDebugIds = true;
    
    render(<PlayMode system={mockSystem} roster={mockRoster} onBack={mockOnBack} />);

    expect(screen.getAllByText('def:el-1').length).toBeGreaterThan(0);
  });

  it('8. Renders Uncategorized Selections', () => {
    const customRoster = {
      ...mockRoster,
      forces: [
        {
          id: 'force-1',
          forceEntryId: 'fe-1',
          selections: [
            { id: 'sel-uncat', name: 'Uncategorized Unit', category: 'cat-uncat', entryLinkId: 'el-uncat' }
          ]
        }
      ]
    };

    mockGetSelectionTotalCost.mockReturnValue(80);

    render(<PlayMode system={mockSystem} roster={customRoster} onBack={mockOnBack} />);

    expect(screen.getByText('Sonstige Auswahlen')).toBeDefined();
    expect(screen.getByText('Uncategorized Unit')).toBeDefined();
  });

  it('6. Collapsible Special Rules (Direct)', async () => {
    mockCollectUnitProfilesAndRules.mockImplementation((sys, sel, catId) => ({
      profiles: [],
      rules: [{ id: 'rule-direct', name: 'Direct Vow', description: 'Direct test description' }]
    }));

    const mockSelection = { id: 'sel-direct', name: 'Direct Unit', category: 'cat-core', entryLinkId: 'el-direct' };
    const mockRosterProps = { catalogueId: 'cat-1', costLimitType: 'pts' };

    render(
      <PlayUnitDetails
        selection={mockSelection}
        system={mockSystem}
        roster={mockRosterProps}
        showDebugIds={false}
        gameState={{ wounds: {} }}
        handleAdjustWound={vi.fn()}
        handleMouseEnter={vi.fn()}
        handleMouseLeave={vi.fn()}
        setSaveSummaryData={vi.fn()}
        setSaveSummaryOpen={vi.fn()}
      />
    );

    expect(screen.queryByText('Direct test description')).toBeNull();

    const rulesHeader = screen.getByText(/Sonderregeln/).closest('h4');
    fireEvent.click(rulesHeader);

    await waitFor(() => {
      expect(screen.getByText('Direct test description')).toBeDefined();
    });

    fireEvent.click(rulesHeader);
    await waitFor(() => {
      expect(screen.queryByText('Direct test description')).toBeNull();
    });
  });

  it('9. Render Destroyed Overlay when wounds are 0', () => {
    const mockSelection = { id: 'sel-dead', name: 'Dead Unit', category: 'cat-core', entryLinkId: 'el-dead' };
    const mockRosterProps = { catalogueId: 'cat-1', costLimitType: 'pts' };

    render(
      <PlayUnitDetails
        selection={mockSelection}
        system={mockSystem}
        roster={mockRosterProps}
        showDebugIds={false}
        gameState={{ wounds: { 'sel-dead': 0 } }}
        handleAdjustWound={vi.fn()}
        handleMouseEnter={vi.fn()}
        handleMouseLeave={vi.fn()}
        setSaveSummaryData={vi.fn()}
        setSaveSummaryOpen={vi.fn()}
      />
    );

    const overlay = screen.getByText('Vernichtet');
    expect(overlay).toBeDefined();
    expect(overlay.className).toContain('destroyed-text');
    expect(overlay.closest('.destroyed-overlay')).toBeDefined();

    const card = screen.getByText('Dead Unit').closest('.play-unit-card');
    expect(card.className).toContain('unit-destroyed');
  });
});
