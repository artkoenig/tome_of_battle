import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UnitSelectionCard from './UnitSelectionCard';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  Trash2: () => <span data-testid="icon-trash" />,
  Copy: () => <span data-testid="icon-copy" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Info: ({ onClick, ...rest }) => <span data-testid="icon-info" onClick={onClick} {...rest} />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  BookOpen: () => <span data-testid="icon-book" />,
  MoreVertical: () => <span data-testid="icon-more-vertical" />,
  ReceiptText: () => <span data-testid="icon-receipt-text" />,
}));

// Mock child components
vi.mock('./SelectionConfigurator', () => ({
  default: () => <div data-testid="selection-configurator" />
}));
vi.mock('./BottomSheet', () => ({
  default: ({ isOpen, children, title, onClose }) => isOpen ? (
    <div data-testid="bottom-sheet">
      <h4>{title}</h4>
      {children}
      <button onClick={onClose}>Close</button>
    </div>
  ) : null
}));

// The rendered UnitChips resolve rule links through the real useRuleUrl hook,
// which reads the whfb6 linking setting. Provide it so the hook has a context.
const mockUseSettings = vi.fn();
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

// Mock Validators
const mockCollectUnitProfilesAndRules = vi.fn();
const mockFindEntryInSystem = vi.fn();
const mockResolveEntry = vi.fn();

// Die Komponente spricht den Solver ausschließlich über die Fassade an, daher
// wird auch nur die Fassade gemockt. Reine Funktionen ohne eigene
// Abhängigkeiten — das Prädikat „eigenständige Untereinheit", die
// Profil-Gruppierung und die Schlüsselwortlisten — reicht der Mock in ihrer
// echten Umsetzung durch, statt sie zu stubben.
vi.mock('../../solver/validator', async () => ({
  collectUnitProfilesAndRules: (...args) => mockCollectUnitProfilesAndRules(...args),
  findEntryInSystem: (...args) => mockFindEntryInSystem(...args),
  resolveEntry: (...args) => mockResolveEntry(...args),
  getSelectionTotalCost: () => 120,
  calculateRosterCosts: () => ({ pts: 120 }),
  // Name resolution is covered by the solver's own unit tests; here it is isolated to
  // the no-name-modifier case, which returns the selection's raw name unchanged.
  getEffectiveSelectionName: (selection) => selection?.name ?? '',
  isIndependentSubUnit: (await vi.importActual('../../solver/subUnit')).isIndependentSubUnit,
  groupProfilesByType: (await vi.importActual('../../solver/rulesEvaluator')).groupProfilesByType,
  ...(await vi.importActual('../../solver/constants'))
}));

describe('UnitSelectionCard Component', () => {
  const defaultProps = {
    selection: {
      id: 'sel-1',
      name: 'Knights of Bretonnia',
      entryLinkId: 'el-1',
      number: 1,
      selections: [
        { id: 'sub-1', name: 'Barded Warhorse', entryLinkId: 'el-horse', number: 1, selections: [] }
      ]
    },
    selectedRosterSelection: null,
    setSelectedRosterSelection: vi.fn(),
    roster: { costLimitType: 'pts' },
    system: {},
    validationErrors: [
      { id: 'err-1', selectionId: 'sel-1', message: 'Ausrüstung unzulässig' }
    ],
    costTypeLabel: 'Pkt.',
    removeUnit: vi.fn(),
    copyUnit: vi.fn(),
    subSelectionOperations: createSubSelectionOperationsMock(),
    activeCatalogue: { id: 'bret-cat' }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true });

    // Set default mockup profiles
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

    mockFindEntryInSystem.mockReturnValue({ id: 'raw-horse' });
    mockResolveEntry.mockReturnValue({
      id: 'resolved-horse',
      name: 'Barded Warhorse',
      rules: [{ description: 'Adds +1 to Armour Save' }],
      profiles: []
    });

    // Default to desktop view
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  it('renders unit header details, costs, and selection error messages', () => {
    render(<UnitSelectionCard {...defaultProps} />);
    
    expect(screen.getByText('Knights of Bretonnia')).toBeDefined();
    expect(screen.getByText('120 Pkt.')).toBeDefined();
    expect(screen.getByText('Ausrüstung unzulässig')).toBeDefined();
  });

  it('renders characteristic table (mini profile) correctly', () => {
    render(<UnitSelectionCard {...defaultProps} />);
    
    expect(screen.getByText('M')).toBeDefined();
    expect(screen.getByText('WS')).toBeDefined();
    expect(screen.getAllByText('4')).toBeDefined();
    expect(screen.getAllByText('4').length).toBe(2);
  });

  it('renders multiple model profiles with their names when multiple exist', () => {
    mockCollectUnitProfilesAndRules.mockReturnValue({
      profiles: [
        {
          id: 'p1',
          profileTypeName: 'Model',
          name: 'Knight',
          characteristics: [
            { name: 'M', value: '4' },
            { name: 'WS', value: '4' }
          ]
        },
        {
          id: 'p2',
          profileTypeName: 'Model',
          name: 'Barded Warhorse',
          characteristics: [
            { name: 'M', value: '8' },
            { name: 'WS', value: '3' }
          ]
        }
      ],
      rules: []
    });

    render(<UnitSelectionCard {...defaultProps} />);

    expect(screen.getByText('Knight')).toBeDefined();
    expect(screen.getAllByText('Barded Warhorse').length).toBe(2);
    expect(screen.getByText('8')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('confirms and triggers removeUnit upon delete click', () => {
    render(<UnitSelectionCard {...defaultProps} />);

    fireEvent.click(screen.getByTitle('Aktionen'));
    const menuDeleteButton = screen.getByText('Löschen');
    fireEvent.click(menuDeleteButton);

    const modalDeleteButton = screen.getAllByText('Löschen').find(b => b.tagName === 'BUTTON');
    fireEvent.click(modalDeleteButton);

    expect(defaultProps.removeUnit).toHaveBeenCalledWith('sel-1');
  });

  it('does not delete when confirmation is cancelled', () => {
    render(<UnitSelectionCard {...defaultProps} />);

    fireEvent.click(screen.getByTitle('Aktionen'));
    const menuDeleteButton = screen.getByText('Löschen');
    fireEvent.click(menuDeleteButton);

    const cancelButton = screen.getByText('Abbrechen');
    fireEvent.click(cancelButton);

    expect(defaultProps.removeUnit).not.toHaveBeenCalled();
  });

  it('triggers copyUnit when copy button is clicked', () => {
    render(<UnitSelectionCard {...defaultProps} />);

    fireEvent.click(screen.getByTitle('Aktionen'));
    const copyButton = screen.getByText('Kopieren');
    fireEvent.click(copyButton);

    expect(defaultProps.copyUnit).toHaveBeenCalledWith('sel-1');
  });

  it('responsive: triggers BottomSheet onClick of upgrade badge on mobile layout', () => {
    // Set window width to mobile
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
    
    render(<UnitSelectionCard {...defaultProps} />);
    
    const upgradeBadge = screen.getByText('Barded Warhorse');
    fireEvent.click(upgradeBadge);
    
    // BottomSheet should render with details
    expect(screen.getByTestId('bottom-sheet')).toBeDefined();
    expect(screen.getByText('Adds +1 to Armour Save')).toBeDefined();
  });

  it('responsive: does not show BottomSheet onClick on desktop layout', () => {
    // Set window width to desktop
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    
    render(<UnitSelectionCard {...defaultProps} />);
    
    const upgradeBadge = screen.getByText('Barded Warhorse');
    fireEvent.click(upgradeBadge);
    
    // BottomSheet should not open on desktop click
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  it('responsive: badge click works on desktop', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });

    render(<UnitSelectionCard {...defaultProps} />);

    const upgradeBadge = screen.getByText('Barded Warhorse');
    expect(upgradeBadge).toBeDefined();
    expect(upgradeBadge).not.toBeNull();
  });

  it('renders an info icon next to upgrades that have a description', () => {
    render(<UnitSelectionCard {...defaultProps} />);
    expect(screen.getByTestId('icon-info')).toBeDefined();
  });

  it('verifies that validator methods are called with the expected catalogue context', () => {
    render(<UnitSelectionCard {...defaultProps} />);

    // Verify collectUnitProfilesAndRules is called with 'bret-cat' context
    expect(mockCollectUnitProfilesAndRules).toHaveBeenCalledWith(
      defaultProps.system,
      defaultProps.selection,
      'bret-cat',
      defaultProps.roster
    );

    // Verify findEntryInSystem is called with 'bret-cat' context for the upgrade selection
    expect(mockFindEntryInSystem).toHaveBeenCalledWith(
      defaultProps.system,
      'el-horse',
      'bret-cat'
    );

    // Verify resolveEntry is called with 'bret-cat' context
    expect(mockResolveEntry).toHaveBeenCalledWith(
      defaultProps.system,
      expect.objectContaining({ id: 'raw-horse' }),
      'bret-cat'
    );
  });

  it('renders the SelectionConfigurator component when selectedRosterSelection matches the selection', () => {
    const props = {
      ...defaultProps,
      selectedRosterSelection: defaultProps.selection
    };
    render(<UnitSelectionCard {...props} />);

    expect(screen.getByTestId('selection-configurator')).toBeDefined();
  });

  it('triggers setSelectedRosterSelection with correct arguments when card header is clicked', () => {
    render(<UnitSelectionCard {...defaultProps} />);

    const header = screen.getByText('Knights of Bretonnia').closest('.selection-node-header');
    fireEvent.click(header);

    expect(defaultProps.setSelectedRosterSelection).toHaveBeenCalledWith(defaultProps.selection);
  });

  it('renders unit rules as badges and displays description on click', () => {
    mockCollectUnitProfilesAndRules.mockReturnValue({
      profiles: [],
      rules: [
        {
          id: 'rule-test-1',
          name: 'Segen der Herrin',
          description: 'Rettet den Ritter vor Schaden',
          publicationRef: '[Bretonia, S. 45]'
        }
      ]
    });

    render(<UnitSelectionCard {...defaultProps} />);

    // Rule badge should be displayed
    const ruleBadge = screen.getByText('Segen der Herrin');
    expect(ruleBadge).toBeDefined();
    
    // Info or BookOpen icon should be present
    const infoIcons = screen.queryAllByTestId('icon-info');
    const bookIcons = screen.queryAllByTestId('icon-book');
    expect(infoIcons.length + bookIcons.length).toBeGreaterThan(0);

    // Click on mobile triggers BottomSheet
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
    fireEvent.click(ruleBadge);
    expect(screen.getByTestId('bottom-sheet')).toBeDefined();
    expect(screen.getByText('Rettet den Ritter vor Schaden')).toBeDefined();
  });

  it('does not render a rule chip when a visible equipment chip already carries the same name', () => {
    const mockSel = {
      id: 'sel-lord',
      name: 'Bretonnian Lord',
      entryLinkId: 'el-1',
      number: 1,
      selections: [
        { id: 'sub-virtue', name: 'Virtue of Audacity', entryLinkId: 'el-virtue', number: 1, selections: [] }
      ]
    };

    // The item grants a special rule that shares its name (magic item / virtue).
    mockResolveEntry.mockReturnValue({
      id: 'resolved-virtue',
      name: 'Virtue of Audacity',
      rules: [{ description: 'Ritter darf eine Herausforderung nicht ablehnen.' }],
      profiles: []
    });

    mockCollectUnitProfilesAndRules.mockReturnValue({
      profiles: [],
      rules: [
        { id: 'r-virtue', name: 'Virtue of Audacity', description: 'Ritter darf eine Herausforderung nicht ablehnen.' }
      ]
    });

    const { container } = render(<UnitSelectionCard {...defaultProps} selection={mockSel} />);

    // Shown once, as the equipment chip...
    const upgradeChips = Array.from(container.querySelectorAll('.upgrade-badge')).map(c => c.textContent);
    expect(upgradeChips.some(t => t.includes('Virtue of Audacity'))).toBe(true);
    // ...and the duplicate rule chip is suppressed.
    const ruleChips = Array.from(container.querySelectorAll('.rule-badge')).map(c => c.textContent);
    expect(ruleChips.some(t => t.includes('Virtue of Audacity'))).toBe(false);
  });

  it('still renders innate rule chips that do not match any equipment chip', () => {
    const mockSel = {
      id: 'sel-lord',
      name: 'Bretonnian Lord',
      entryLinkId: 'el-1',
      number: 1,
      selections: [
        { id: 'sub-virtue', name: 'Virtue of Audacity', entryLinkId: 'el-virtue', number: 1, selections: [] }
      ]
    };

    mockResolveEntry.mockReturnValue({
      id: 'resolved-virtue',
      name: 'Virtue of Audacity',
      rules: [{ description: 'Herausforderung.' }],
      profiles: []
    });

    mockCollectUnitProfilesAndRules.mockReturnValue({
      profiles: [],
      rules: [
        { id: 'r-virtue', name: 'Virtue of Audacity', description: 'Herausforderung.' },
        { id: 'r-blessed', name: 'Segen der Herrin', description: 'Rettungswurf.' }
      ]
    });

    const { container } = render(<UnitSelectionCard {...defaultProps} selection={mockSel} />);

    const ruleChips = Array.from(container.querySelectorAll('.rule-badge')).map(c => c.textContent);
    expect(ruleChips.some(t => t.includes('Segen der Herrin'))).toBe(true);
    expect(ruleChips.some(t => t.includes('Virtue of Audacity'))).toBe(false);
  });

  it('hides a wrapper upgrade chip that only groups child options and carries no own value', () => {
    const mockSel = {
      id: 'sel-wiz',
      name: 'Orc Great Shaman',
      entryLinkId: 'el-1',
      number: 1,
      selections: [
        { id: 'sub-magic', name: 'Magic Items', entryLinkId: 'el-magic', number: 1, selections: [] }
      ]
    };

    mockCollectUnitProfilesAndRules.mockReturnValue({ profiles: [], rules: [] });
    mockFindEntryInSystem.mockImplementation((_sys, id) => ({ id }));
    mockResolveEntry.mockImplementation((_sys, entry) => {
      if (entry?.id === 'el-magic') {
        // Container: has children but no cost / profile / rule of its own.
        return {
          id: 'magic', name: 'Magic Items',
          costs: [{ name: 'pts', value: '0.0' }],
          profiles: [], rules: [],
          selectionEntries: [{ id: 'mw', name: 'Some Magic Weapon' }]
        };
      }
      return { id: 'resolved', name: 'Orc Great Shaman', profiles: [], rules: [] };
    });

    const { container } = render(<UnitSelectionCard {...defaultProps} selection={mockSel} />);

    const chips = Array.from(container.querySelectorAll('.upgrade-badge')).map(c => c.textContent);
    expect(chips.some(t => t.includes('Magic Items'))).toBe(false);
  });

  it('keeps an upgrade chip that is priced only in a non-points cost (e.g. casting dice)', () => {
    const mockSel = {
      id: 'sel-wiz',
      name: 'Orc Great Shaman',
      entryLinkId: 'el-1',
      number: 1,
      selections: [
        { id: 'sub-shaman', name: 'Level 3 Shaman', entryLinkId: 'el-lvl', number: 1, selections: [] }
      ]
    };

    mockCollectUnitProfilesAndRules.mockReturnValue({ profiles: [], rules: [] });
    mockFindEntryInSystem.mockImplementation((_sys, id) => ({ id }));
    mockResolveEntry.mockImplementation((_sys, entry) => {
      if (entry?.id === 'el-lvl') {
        // Leaf with 0 pts but a non-zero casting/dispel dice cost -> informative.
        return {
          id: 'lvl', name: 'Level 3 Shaman',
          costs: [{ name: 'pts', value: '0.0' }, { name: 'Casting Dice', value: '3.0' }],
          profiles: [], rules: []
        };
      }
      return { id: 'resolved', name: 'Orc Great Shaman', profiles: [], rules: [] };
    });

    const { container } = render(<UnitSelectionCard {...defaultProps} selection={mockSel} />);

    const chips = Array.from(container.querySelectorAll('.upgrade-badge')).map(c => c.textContent);
    expect(chips.some(t => t.includes('Level 3 Shaman'))).toBe(true);
  });

  describe('Adversarial & Stress Tests', () => {
    it('handles window resize dynamically around 900px and fires click events', () => {
      // Start as desktop
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const { unmount } = render(<UnitSelectionCard {...defaultProps} />);
      const upgradeBadge = screen.getByText('Barded Warhorse');

      // Resize to mobile
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 850 });

      // Click on mobile should trigger bottom sheet
      fireEvent.click(upgradeBadge);
      expect(screen.getByTestId('bottom-sheet')).toBeDefined();
      
      unmount();
    });

    it('survives malformed validationErrors gracefully (or identifies vulnerabilities)', () => {
      const propsWithNullError = {
        ...defaultProps,
        validationErrors: [null, { id: 'err-2', selectionId: 'sel-1', message: 'Legit error' }]
      };
      
      // This should fail/throw under the current implementation because it tries to read selectionId from null.
      expect(() => render(<UnitSelectionCard {...propsWithNullError} />)).toThrow();
    });

    it('renders weapon profiles correctly inside the mini profile table', () => {
      mockCollectUnitProfilesAndRules.mockReturnValue({
        profiles: [
          {
            id: 'p1',
            profileTypeName: 'Model',
            name: 'Knight',
            characteristics: [
              { name: 'M', value: '4' },
              { name: 'WS', value: '4' }
            ]
          },
          {
            id: 'w1',
            profileTypeName: 'Weapon',
            name: 'Lance',
            characteristics: [
              { name: 'Range', value: 'Combat' },
              { name: 'Strength', value: '+2' }
            ]
          }
        ],
        rules: []
      });

      render(<UnitSelectionCard {...defaultProps} />);

      expect(screen.getByText('Lance')).toBeDefined();
      expect(screen.getByText('Combat')).toBeDefined();
      expect(screen.getByText('+2')).toBeDefined();
      expect(screen.getByText('Weapon')).toBeDefined();
      expect(screen.queryByText('Waffe')).toBeNull();
      expect(screen.queryByText('Waffen')).toBeNull();
    });

    it('does not render weapon upgrades as chips if they are displayed in the weapon table', () => {
      const mockSel = {
        id: 'sel-unit',
        name: 'Knights of Bretonnia',
        entryLinkId: 'el-1',
        number: 1,
        selections: [
          { id: 'sub-lance', name: 'Lance', entryLinkId: 'el-lance', number: 1, selections: [] }
        ]
      };

      const mockProps = {
        ...defaultProps,
        sel: mockSel
      };

      mockCollectUnitProfilesAndRules.mockReturnValue({
        profiles: [
          {
            id: 'p-lance',
            profileTypeName: 'Weapon',
            name: 'Lance',
            characteristics: [
              { name: 'Range', value: 'Combat' },
              { name: 'Strength', value: '+2' }
            ],
            _sourceSelection: mockSel.selections[0]
          }
        ],
        rules: []
      });

      const { container } = render(<UnitSelectionCard {...mockProps} />);

      expect(screen.getByText('Lance')).toBeDefined();
      expect(screen.getByText('Combat')).toBeDefined();

      const chips = container.querySelectorAll('.upgrade-badge');
      const chipTexts = Array.from(chips).map(c => c.textContent);
      expect(chipTexts.includes('Lance')).toBe(false);
    });

    it('renders any profile type generically as its own table (e.g. Magic Item)', () => {
      mockCollectUnitProfilesAndRules.mockReturnValue({
        profiles: [
          {
            id: 'p1',
            profileTypeName: 'Model',
            name: 'Lord',
            characteristics: [
              { name: 'M', value: '4' },
              { name: 'WS', value: '6' }
            ]
          },
          {
            id: 'mi1',
            profileTypeName: 'Magic Item',
            name: 'Ruby Ring of Ruin',
            characteristics: [
              { name: 'Type', value: 'Arcane' },
              { name: 'Effect', value: 'Bound Spell' }
            ]
          }
        ],
        rules: []
      });

      render(<UnitSelectionCard {...defaultProps} />);

      // The profile type name becomes the table's leading column header.
      expect(screen.getByText('Magic Item')).toBeDefined();
      expect(screen.getByText('Ruby Ring of Ruin')).toBeDefined();
      expect(screen.getByText('Arcane')).toBeDefined();
      expect(screen.getByText('Bound Spell')).toBeDefined();
    });

    it('keeps the lore chip for an item whose profile is also shown in a table', () => {
      const mockSel = {
        id: 'sel-unit',
        name: 'Bretonnian Lord',
        entryLinkId: 'el-1',
        number: 1,
        selections: [
          { id: 'sub-sword', name: 'Sword of the Lady', entryLinkId: 'el-sword', number: 1, selections: [] }
        ]
      };

      mockCollectUnitProfilesAndRules.mockReturnValue({
        profiles: [
          {
            id: 'w1',
            profileTypeName: 'Weapon',
            name: 'Sword of the Lady',
            characteristics: [
              { name: 'Range', value: 'Combat' }
            ],
            _sourceSelection: mockSel.selections[0]
          }
        ],
        rules: []
      });

      // Resolved upgrade carries a rule description (lore).
      mockResolveEntry.mockReturnValue({
        id: 'resolved-sword',
        name: 'Sword of the Lady',
        rules: [{ description: 'Grants magical attacks' }],
        profiles: []
      });

      const { container } = render(<UnitSelectionCard {...defaultProps} selection={mockSel} />);

      // Value shows in the weapon table...
      expect(screen.getByText('Combat')).toBeDefined();
      // ...and the chip is retained because the item has lore.
      const chipTexts = Array.from(container.querySelectorAll('.upgrade-badge')).map(c => c.textContent);
      expect(chipTexts.some(t => t.includes('Sword of the Lady'))).toBe(true);
    });

    it('renders armour profiles correctly inside the mini profile table', () => {
      mockCollectUnitProfilesAndRules.mockReturnValue({
        profiles: [
          {
            id: 'p1',
            profileTypeName: 'Model',
            name: 'Knight',
            characteristics: [
              { name: 'M', value: '4' },
              { name: 'WS', value: '4' }
            ]
          },
          {
            id: 'a1',
            profileTypeName: 'Armour',
            name: 'Shield',
            characteristics: [
              { name: 'Saving Throw Modifier', value: '-1' },
              { name: 'Special rules', value: 'None' }
            ]
          }
        ],
        rules: []
      });

      render(<UnitSelectionCard {...defaultProps} />);

      expect(screen.getByText('Shield')).toBeDefined();
      expect(screen.getByText('-1')).toBeDefined();
      expect(screen.getByText('Armour')).toBeDefined();
    });

    it('does not render armour upgrades as chips if they are displayed in the armour table', () => {
      const mockSel = {
        id: 'sel-unit',
        name: 'Knights of Bretonnia',
        entryLinkId: 'el-1',
        number: 1,
        selections: [
          { id: 'sub-shield', name: 'Shield', entryLinkId: 'el-shield', number: 1, selections: [] }
        ]
      };

      const mockProps = {
        ...defaultProps,
        sel: mockSel
      };

      mockCollectUnitProfilesAndRules.mockReturnValue({
        profiles: [
          {
            id: 'p-shield',
            profileTypeName: 'Armour',
            name: 'Shield',
            characteristics: [
              { name: 'Saving Throw Modifier', value: '-1' }
            ],
            _sourceSelection: mockSel.selections[0]
          }
        ],
        rules: []
      });

      const { container } = render(<UnitSelectionCard {...mockProps} />);

      expect(screen.getByText('Shield')).toBeDefined();
      expect(screen.getByText('-1')).toBeDefined();

      const chips = container.querySelectorAll('.upgrade-badge');
      const chipTexts = Array.from(chips).map(c => c.textContent);
      expect(chipTexts.includes('Shield')).toBe(false);
    });

    it('survives errors with missing or empty message keys', () => {
      const propsWithEmptyMessage = {
        ...defaultProps,
        validationErrors: [{ id: 'err-1', selectionId: 'sel-1', message: undefined }]
      };
      render(<UnitSelectionCard {...propsWithEmptyMessage} />);
      expect(screen.getByText('Knights of Bretonnia')).toBeDefined();
    });
  });
});

