import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UnitSelectionCard from './UnitSelectionCard';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  Trash2: () => <span data-testid="icon-trash" />,
  Copy: () => <span data-testid="icon-copy" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Info: () => <span data-testid="icon-info" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
}));

// Mock Debug Context
vi.mock('../../hooks/DebugContext', () => ({
  useDebugMode: () => ({ showDebugIds: false })
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

// Mock Validators
const mockCollectUnitProfilesAndRules = vi.fn();
const mockFindEntryInSystem = vi.fn();
const mockResolveEntry = vi.fn();

vi.mock('../../solver/validator', () => ({
  collectUnitProfilesAndRules: (...args) => mockCollectUnitProfilesAndRules(...args),
  findEntryInSystem: (...args) => mockFindEntryInSystem(...args),
  resolveEntry: (...args) => mockResolveEntry(...args),
  getSelectionTotalCost: () => 120,
  calculateRosterCosts: () => ({ pts: 120 })
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
    updateSubSelection: vi.fn(),
    activeCatalogue: { id: 'bret-cat' },
    setSelectedCatalogEntry: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
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
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<UnitSelectionCard {...defaultProps} />);
    
    const deleteButton = screen.getByTitle('Löschen');
    fireEvent.click(deleteButton);
    
    expect(confirmSpy).toHaveBeenCalled();
    expect(defaultProps.removeUnit).toHaveBeenCalledWith('sel-1');
  });

  it('does not delete when confirmation is cancelled', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<UnitSelectionCard {...defaultProps} />);
    
    const deleteButton = screen.getByTitle('Löschen');
    fireEvent.click(deleteButton);
    
    expect(confirmSpy).toHaveBeenCalled();
    expect(defaultProps.removeUnit).not.toHaveBeenCalled();
  });

  it('triggers copyUnit when copy button is clicked', () => {
    render(<UnitSelectionCard {...defaultProps} />);
    
    const copyButton = screen.getByTitle('Kopieren');
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

  it('responsive: shows and hides tooltip on hover in desktop layout', () => {
    // Set window width to desktop
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    
    render(<UnitSelectionCard {...defaultProps} />);
    
    const upgradeBadge = screen.getByText('Barded Warhorse');
    
    // Hover over the badge
    fireEvent.mouseEnter(upgradeBadge, { clientX: 100, clientY: 200 });
    
    // Tooltip should be visible
    expect(screen.getByText('Adds +1 to Armour Save')).toBeDefined();
    
    // Move mouse out
    fireEvent.mouseLeave(upgradeBadge);
    
    // Tooltip should be gone
    expect(screen.queryByText('Adds +1 to Armour Save')).toBeNull();
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

  it('triggers setSelectedCatalogEntry with the resolved catalog entry when mini-profile table is clicked', () => {
    render(<UnitSelectionCard {...defaultProps} />);

    const miniProfile = screen.getByTitle('Statblock anzeigen');
    fireEvent.click(miniProfile);

    expect(defaultProps.setSelectedCatalogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'resolved-horse' })
    );
  });

  it('renders unit rules as badges and displays description on hover/click', () => {
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
    
    // Sparkles icon should be present
    expect(screen.getByTestId('icon-sparkles')).toBeDefined();

    // Hover over the rule badge (Desktop)
    fireEvent.mouseEnter(ruleBadge, { clientX: 100, clientY: 200 });
    expect(screen.getByText('Rettet den Ritter vor Schaden')).toBeDefined();
    expect(screen.getByText('[Bretonia, S. 45]')).toBeDefined();

    // Mouse leave hides tooltip
    fireEvent.mouseLeave(ruleBadge);
    expect(screen.queryByText('Rettet den Ritter vor Schaden')).toBeNull();

    // Click on mobile triggers BottomSheet
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
    fireEvent.click(ruleBadge);
    expect(screen.getByTestId('bottom-sheet')).toBeDefined();
    expect(screen.getByText('Rettet den Ritter vor Schaden')).toBeDefined();
  });

  describe('Adversarial & Stress Tests', () => {
    it('handles window resize dynamically around 900px and fires mouse events', () => {
      // Start as desktop
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const { unmount } = render(<UnitSelectionCard {...defaultProps} />);
      const upgradeBadge = screen.getByText('Barded Warhorse');

      // Mouse enter on desktop
      fireEvent.mouseEnter(upgradeBadge, { clientX: 100, clientY: 200 });
      expect(screen.getByText('Adds +1 to Armour Save')).toBeDefined();

      // Resize to mobile
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 850 });
      
      // Moving mouse on mobile should return early and not throw
      fireEvent.mouseMove(upgradeBadge, { clientX: 120, clientY: 220 });

      // Click on mobile should trigger bottom sheet
      fireEvent.click(upgradeBadge);
      expect(screen.getByTestId('bottom-sheet')).toBeDefined();

      // Leave mouse
      fireEvent.mouseLeave(upgradeBadge);
      
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

