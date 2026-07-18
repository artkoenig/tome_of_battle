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
  Info: () => <span data-testid="icon-info" />,
  X: () => <span data-testid="icon-x" />,
  ReceiptText: () => <span data-testid="icon-receipt-text" />,
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

// Mock Database
vi.mock('../db/database', () => ({
  saveRoster: vi.fn()
}));

// Mock the central rule-URL resolver. These integration tests do not exercise the
// rules dialog, so a resolver that never yields a URL keeps them focused; the
// dialog wiring is covered by PlayMode.ruleLinks.test.jsx.
vi.mock('../hooks/useRuleUrl', () => ({
  useRuleUrl: () => () => null,
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
  findForceEntryById: (system, id) => system?.forceEntries?.find(fe => fe.id === id) || null,
  isCategoryLinkHidden: (link) => link.hidden === true,
  calculateRosterCosts: () => ({}),
  getExtraResourceTotals: () => [],
}));

vi.mock('../solver/rulesEvaluator', () => ({
  getArmourSave: vi.fn().mockReturnValue({ save: 5, breakdown: ['Base: 5+'] }),
  getWardSave: vi.fn().mockReturnValue({ save: 6, breakdown: ['Blessing: 6+'] }),
  extractModelProfiles: vi.fn().mockImplementation((profiles) => profiles.filter(p => p.profileTypeName === 'Model')),
  extractUpgradeProfiles: vi.fn().mockImplementation((profiles) => profiles),
  extractWeaponProfiles: vi.fn().mockImplementation((profiles) => profiles.filter(p => p.profileTypeName === 'Weapon' || p.profileTypeName === 'Waffe')),
  extractArmourProfiles: vi.fn().mockImplementation((profiles) => profiles.filter(p => p.profileTypeName === 'Armour' || p.profileTypeName === 'Rüstung')),
  groupProfilesByType: vi.fn().mockImplementation((profiles) => {
    if (!Array.isArray(profiles)) return [];
    const modelProfiles = profiles.filter(p => p.profileTypeName === 'Model');
    const modelSet = new Set(modelProfiles);
    const groups = [];
    if (modelProfiles.length > 0) {
      groups.push({ typeName: modelProfiles[0].profileTypeName || '', profiles: modelProfiles, isModel: true });
    }
    const map = new Map();
    profiles.forEach(p => {
      if (modelSet.has(p)) return;
      const key = p.profileTypeName || '';
      let g = map.get(key);
      if (!g) { g = { typeName: key, profiles: [], isModel: false }; map.set(key, g); groups.push(g); }
      g.profiles.push(p);
    });
    return groups;
  }),
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

  // Regression (Issue 19, A1): the cost sort must call getSelectionTotalCost with the
  // EvaluationContext object (system/roster/currentCatalogueId), not the old positional
  // form which put `system` into the context slot and dropped roster/catalogueId —
  // silently disabling modifier-aware costs and sorting by unmodified cost.
  it('1b. sorts using getSelectionTotalCost with an EvaluationContext object', () => {
    render(<PlayMode system={mockSystem} roster={mockRoster} onBack={mockOnBack} />);

    expect(mockGetSelectionTotalCost).toHaveBeenCalled();
    mockGetSelectionTotalCost.mock.calls.forEach(call => {
      expect(call).toHaveLength(4);
      const [, costTypeArg, parentCountArg, contextArg] = call;
      expect(costTypeArg).toBe('pts');
      expect(parentCountArg).toBe(1);
      expect(contextArg).toEqual({
        system: mockSystem,
        roster: mockRoster,
        currentCatalogueId: 'cat-1',
      });
    });
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

    const mockSetSaveSummaryOpen = vi.fn();
    const mockSetSaveSummaryData = vi.fn();

    render(
      <PlayUnitDetails
        selection={mockSelection}
        system={mockSystem}
        roster={mockRosterProps}
        gameState={{ wounds: {} }}
        handleAdjustWound={vi.fn()}
        handleMouseEnter={vi.fn()}
        handleMouseLeave={vi.fn()}
        setSaveSummaryData={mockSetSaveSummaryData}
        setSaveSummaryOpen={mockSetSaveSummaryOpen}
      />
    );

    // Rule chip should be rendered
    const chip = screen.getByText('Direct Vow');
    expect(chip).toBeDefined();

    // Set mobile viewport and click – only mobile triggers the bottom sheet
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
    fireEvent.click(chip);
    expect(mockSetSaveSummaryOpen).toHaveBeenCalledWith(true);
    expect(mockSetSaveSummaryData).toHaveBeenCalled();
  });

  it('9. Render Destroyed Overlay when wounds are 0', () => {
    const mockSelection = { id: 'sel-dead', name: 'Dead Unit', category: 'cat-core', entryLinkId: 'el-dead' };
    const mockRosterProps = { catalogueId: 'cat-1', costLimitType: 'pts' };

    render(
      <PlayUnitDetails
        selection={mockSelection}
        system={mockSystem}
        roster={mockRosterProps}
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

  it('10. Render weapon profiles inside PlayUnitDetails', () => {
    const mockSelection = { 
      id: 'sel-weapons', 
      name: 'Weaponized Unit', 
      category: 'cat-core', 
      entryLinkId: 'el-weapons',
      selections: [
        { id: 'sub-sword', name: 'Great Sword', entryLinkId: 'el-sword', number: 1 }
      ]
    };
    const mockRosterProps = { catalogueId: 'cat-1', costLimitType: 'pts' };

    mockCollectUnitProfilesAndRules.mockReturnValue({
      profiles: [
        {
          id: 'p1',
          profileTypeName: 'Model',
          name: 'Warrior',
          characteristics: [
            { name: 'M', value: '4' },
            { name: 'WS', value: '4' }
          ]
        },
        {
          id: 'p2',
          profileTypeName: 'Model',
          name: 'Warhorse',
          characteristics: [
            { name: 'M', value: '8' },
            { name: 'WS', value: '3' }
          ]
        },
        {
          id: 'w1',
          profileTypeName: 'Weapon',
          name: 'Great Sword',
          characteristics: [
            { name: 'Range', value: 'Combat' },
            { name: 'Strength', value: '+2' }
          ],
          _sourceSelection: mockSelection.selections[0]
        }
      ],
      rules: []
    });

    render(
      <PlayUnitDetails
        selection={mockSelection}
        system={mockSystem}
        roster={mockRosterProps}
        gameState={{ wounds: { 'sel-weapons': 5 } }}
        handleAdjustWound={vi.fn()}
        handleMouseEnter={vi.fn()}
        handleMouseLeave={vi.fn()}
        setSaveSummaryData={vi.fn()}
        setSaveSummaryOpen={vi.fn()}
      />
    );

    expect(screen.getByText('Warrior')).toBeDefined();
    expect(screen.getByText('Great Sword')).toBeDefined();
    expect(screen.getByText('Combat')).toBeDefined();
    expect(screen.getByText('+2')).toBeDefined();
    expect(screen.getByText('Weapon')).toBeDefined();
    expect(screen.queryByText('Waffe')).toBeNull();
    expect(screen.queryByText('Waffen')).toBeNull();
    expect(screen.queryByText('Waffenwerte')).toBeNull();
    // Since Great Sword is filtered, the upgrades list is empty, and the section heading shouldn't render
    expect(screen.queryByText('Ausrüstung & Upgrades')).toBeNull();
  });

  it('11. Render armour profiles inside PlayUnitDetails', () => {
    const mockSelection = { 
      id: 'sel-armours', 
      name: 'Armoured Unit', 
      category: 'cat-core', 
      entryLinkId: 'el-armours',
      selections: [
        { id: 'sub-shield', name: 'Shield', entryLinkId: 'el-shield', number: 1 }
      ]
    };
    const mockRosterProps = { catalogueId: 'cat-1', costLimitType: 'pts' };

    mockCollectUnitProfilesAndRules.mockReturnValue({
      profiles: [
        {
          id: 'p1',
          profileTypeName: 'Model',
          name: 'Warrior',
          characteristics: [
            { name: 'M', value: '4' },
            { name: 'WS', value: '4' }
          ]
        },
        {
          id: 'p2',
          profileTypeName: 'Model',
          name: 'Warhorse',
          characteristics: [
            { name: 'M', value: '8' },
            { name: 'WS', value: '3' }
          ]
        },
        {
          id: 'a1',
          profileTypeName: 'Armour',
          name: 'Shield',
          characteristics: [
            { name: 'Saving Throw Modifier', value: '-1' }
          ],
          _sourceSelection: mockSelection.selections[0]
        }
      ],
      rules: []
    });

    render(
      <PlayUnitDetails
        selection={mockSelection}
        system={mockSystem}
        roster={mockRosterProps}
        gameState={{ wounds: { 'sel-armours': 5 } }}
        handleAdjustWound={vi.fn()}
        handleMouseEnter={vi.fn()}
        handleMouseLeave={vi.fn()}
        setSaveSummaryData={vi.fn()}
        setSaveSummaryOpen={vi.fn()}
      />
    );

    expect(screen.getByText('Warrior')).toBeDefined();
    expect(screen.getByText('Shield')).toBeDefined();
    expect(screen.getByText('-1')).toBeDefined();
    expect(screen.getByText('Armour')).toBeDefined();
    // Since Shield is filtered, the upgrades list is empty, and the section heading shouldn't render
    expect(screen.queryByText('Ausrüstung & Upgrades')).toBeNull();
  });

  it('12. Suppresses the rule entry when an equipment entry already carries the same name', () => {
    mockCollectUnitProfilesAndRules.mockReturnValue({
      profiles: [],
      rules: [{ id: 'r-virtue', name: 'Virtue of Audacity', description: 'Herausforderung.' }]
    });
    mockFindEntryInSystem.mockImplementation((_s, id) => ({ id }));
    mockResolveEntry.mockImplementation((_s, entry) => {
      if (entry?.id === 'el-virtue') {
        return {
          id: 'virtue', name: 'Virtue of Audacity',
          costs: [{ name: 'pts', value: '5.0' }],
          rules: [{ description: 'Herausforderung.' }], profiles: []
        };
      }
      return { id: 'resolved-unit', name: 'Bretonnian Lord', profiles: [] };
    });

    const mockSelection = {
      id: 'sel-lord', name: 'Bretonnian Lord', category: 'cat-core', entryLinkId: 'el-unit',
      selections: [{ id: 'sub-virtue', name: 'Virtue of Audacity', entryLinkId: 'el-virtue', number: 1 }]
    };

    render(
      <PlayUnitDetails
        selection={mockSelection}
        system={mockSystem}
        roster={{ catalogueId: 'cat-1', costLimitType: 'pts' }}
        gameState={{ wounds: {} }}
        handleAdjustWound={vi.fn()}
        handleMouseEnter={vi.fn()}
        handleMouseLeave={vi.fn()}
        setSaveSummaryData={vi.fn()}
        setSaveSummaryOpen={vi.fn()}
      />
    );

    // The item is listed under equipment...
    expect(screen.getByText('Virtue of Audacity')).toBeDefined();
  });

  it('13. Hides a wrapper equipment entry that only groups child options', () => {
    mockCollectUnitProfilesAndRules.mockReturnValue({ profiles: [], rules: [] });
    mockFindEntryInSystem.mockImplementation((_s, id) => ({ id }));
    mockResolveEntry.mockImplementation((_s, entry) => {
      if (entry?.id === 'el-magic') {
        // Container: has children but no cost / profile / rule of its own.
        return {
          id: 'magic', name: 'Magic Items',
          costs: [{ name: 'pts', value: '0.0' }],
          rules: [], profiles: [],
          selectionEntries: [{ id: 'mw', name: 'Some Magic Weapon' }]
        };
      }
      return { id: 'resolved-unit', name: 'Orc Great Shaman', profiles: [] };
    });

    const mockSelection = {
      id: 'sel-wiz', name: 'Orc Great Shaman', category: 'cat-core', entryLinkId: 'el-unit',
      selections: [{ id: 'sub-magic', name: 'Magic Items', entryLinkId: 'el-magic', number: 1 }]
    };

    render(
      <PlayUnitDetails
        selection={mockSelection}
        system={mockSystem}
        roster={{ catalogueId: 'cat-1', costLimitType: 'pts' }}
        gameState={{ wounds: {} }}
        handleAdjustWound={vi.fn()}
        handleMouseEnter={vi.fn()}
        handleMouseLeave={vi.fn()}
        setSaveSummaryData={vi.fn()}
        setSaveSummaryOpen={vi.fn()}
      />
    );

    // The empty wrapper is dropped, so the equipment chip does not render.
    expect(screen.queryByText('Magic Items')).toBeNull();
  });

  it('14. Renders independent sub-units recursively in Play Mode, hides wound controls on parent, and hides sub-unit profiles', () => {
    mockCollectUnitProfilesAndRules.mockImplementation((_sys, sel) => {
      if (sel.id === 'sub-unit-1') {
        return {
          profiles: [
            {
              id: 'prof-child',
              profileTypeName: 'Model',
              name: 'Goblin Wolf Chariot Sub Profile',
              characteristics: [{ name: 'Wounds', value: '4' }]
            }
          ],
          rules: []
        };
      }
      return { profiles: [], rules: [] };
    });
    mockFindEntryInSystem.mockImplementation((_s, id) => ({ id }));
    mockResolveEntry.mockImplementation((_s, entry) => {
      if (entry?.id === 'el-unit') {
        return { id: 'resolved-parent', name: 'Goblin Wolf Chariots', profiles: [] };
      }
      if (entry?.id === 'el-sub-unit') {
        return { 
          id: 'resolved-child', 
          name: 'Goblin Wolf Chariot Sub', 
          type: 'model', 
          collective: false, 
          selectionEntries: [{ id: 'crew-member' }] 
        };
      }
      return { id: 'resolved-generic', name: 'Generic', profiles: [] };
    });

    const mockSelection = {
      id: 'sel-parent', 
      name: 'Goblin Wolf Chariots', 
      category: 'cat-core', 
      entryLinkId: 'el-unit',
      selections: [{ id: 'sub-unit-1', name: 'Goblin Wolf Chariot Sub', entryLinkId: 'el-sub-unit', number: 1 }]
    };

    render(
      <PlayUnitDetails
        selection={mockSelection}
        system={mockSystem}
        roster={{ catalogueId: 'cat-1', costLimitType: 'pts' }}
        gameState={{ wounds: { 'sel-parent': 5, 'sub-unit-1': 3 } }}
        handleAdjustWound={vi.fn()}
        handleMouseEnter={vi.fn()}
        handleMouseLeave={vi.fn()}
        setSaveSummaryData={vi.fn()}
        setSaveSummaryOpen={vi.fn()}
      />
    );

    // The parent card should be rendered
    expect(screen.getByText('Goblin Wolf Chariots')).toBeDefined();

    // The sub-unit card should be rendered recursively
    expect(screen.getByText('Goblin Wolf Chariot Sub')).toBeDefined();

    // The parent card should NOT show wound controls (since it has sub-units)
    // The child card should show its wounds: "3 / 1"
    expect(screen.queryByText('5 / 1')).toBeNull();
    expect(screen.getByText('3 / 1')).toBeDefined();

    // Sub-unit profile should NOT be rendered
    expect(screen.queryByText('Goblin Wolf Chariot Sub Profile')).toBeNull();
  });
});
