import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterEditor from './RosterEditor';
import { createSubSelectionOperationsMock } from '../test-utils/subSelectionOperationsMock';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  Save: () => <span data-testid="icon-save" />,
  Play: () => <span data-testid="icon-play" />,
  Trash2: () => <span data-testid="icon-trash" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Check: () => <span data-testid="icon-check" />,
  Copy: () => <span data-testid="icon-copy" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Edit3: () => <span data-testid="icon-edit3" />,
  Download: () => <span data-testid="icon-download" />,
  Undo2: () => <span data-testid="icon-undo" />,
  Redo2: () => <span data-testid="icon-redo" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
}));

// RosterEditor resolves the RulesIndexDialog URL through the real useRuleUrl hook,
// which reads the whfb6 linking setting. Provide it so the hook has a context.
const mockUseSettings = vi.fn();
vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

// Mock useRoster custom hook
const mockAddUnit = vi.fn();
const mockRemoveUnit = vi.fn();
const mockCopyUnit = vi.fn();
const mockSubSelectionOperations = createSubSelectionOperationsMock();
const mockSave = vi.fn();
const mockSetSelectedRosterSelection = vi.fn();
const mockUpdateRosterName = vi.fn();
const mockUndo = vi.fn();
const mockRedo = vi.fn();
let mockCanUndo = false;
let mockCanRedo = false;

// Mock validator spy functions
const mockResolveEntry = vi.fn().mockReturnValue({ id: 'entry-resolved', name: 'Resolved Entry' });
const mockIsEntryPrimaryInCategory = vi.fn().mockReturnValue(false);
const mockFindEntryInSystem = vi.fn().mockReturnValue({ id: 'entry-raw', name: 'Raw Entry' });
const mockCollectUnitProfilesAndRules = vi.fn().mockReturnValue({ profiles: [], rules: [] });

let mockRoster = {};
let mockCosts = {};
let mockValidationErrors = [];

const defaultMockRoster = {
  id: 'roster-1',
  name: 'Bretonnian Crusaders',
  costLimitType: 'pts',
  costLimit: 1000,
  catalogueId: 'bret-cat',
  forces: [
    {
      id: 'force-1',
      forceEntryId: 'fe-1',
      catalogueId: 'bret-cat',
      selections: [
        { id: 'sel-1', name: 'Paladin', category: 'cat-heroes', cost: 100 },
        { id: 'sel-2', name: 'Knights Errant', category: 'cat-core', cost: 120 },
        { id: 'sel-3', name: 'Knights of the Realm', category: 'cat-core', cost: 200 }
      ]
    }
  ]
};

const defaultMockCosts = { pts: 420 };

const defaultMockValidationErrors = [
  { id: 'err-1', message: 'Minimale Anzahl Kern-Auswahlen nicht erreicht', categoryId: 'cat-core', severity: 'error' },
  { id: 'err-2', message: 'Roster exceeds cost limit', selectionId: null, severity: 'error' }
];

vi.mock('../hooks/useRoster', () => ({
  useRoster: () => ({
    roster: mockRoster,
    costs: mockCosts,
    validationErrors: mockValidationErrors,
    selectedRosterSelection: null,
    setSelectedRosterSelection: mockSetSelectedRosterSelection,
    addUnit: mockAddUnit,
    removeUnit: mockRemoveUnit,
    copyUnit: mockCopyUnit,
    subSelectionOperations: mockSubSelectionOperations,
    updateRosterName: mockUpdateRosterName,
    save: mockSave,
    undo: mockUndo,
    redo: mockRedo,
    canUndo: mockCanUndo,
    canRedo: mockCanRedo
  })
}));

// Mock database saveRoster
vi.mock('../db/database', () => ({
  saveRoster: vi.fn()
}));

// Mock Validators
// Only the rules engine is stubbed; the roster-tree primitives that the facade
// re-exports stay real, since they are pure traversal without any rules in them.
vi.mock('../solver/validator', async (importOriginal) => ({
  ...(await importOriginal()),
  computeRosterCounts: () => ({
    selectionCounts: {},
    categoryCounts: { 'force-1': { 'cat-heroes': 1, 'cat-core': 2 } }
  }),
  getModifiedConstraintValue: (constraint) => (constraint.type === 'min' ? 2 : 5),
  getEffectiveModifiers: (source) => source?.modifiers || [],
  calculateRosterCosts: () => ({ pts: 420 }),
  resolveEntry: (...args) => mockResolveEntry(...args),
  isEntryPrimaryInCategory: (...args) => mockIsEntryPrimaryInCategory(...args),
  findEntryInSystem: (...args) => mockFindEntryInSystem(...args),
  collectUnitProfilesAndRules: (...args) => mockCollectUnitProfilesAndRules(...args),
  getSelectionTotalCost: (sel) => sel.cost,
  findForceEntryById: (system, id) => system?.forceEntries?.find(fe => fe.id === id) || null,
  isCategoryLinkHidden: (link) => link.hidden === true,
  collectUnreachableArmyWideSelectors: () => [],
  getExtraResourceTotals: () => [],
  formatConstraintLimit: (value, constraint) =>
    (constraint?.percentValue === true || constraint?.type === 'percent') ? `${value} %` : `${value}`,
  hasBlockingViolations: (errors) => (errors || []).some(e => e.severity === 'error'),
  ValidationSeverity: { ERROR: 'error', WARNING: 'warning', INFO: 'info' },
  resolveListRuleGroup: () => ({ isListRuleGroup: false, states: [] }),
}));

// Dummy child components to speed up execution
vi.mock('./editor/CategoryUnitAdder', () => ({
  default: ({ categoryId, addUnit }) => (
    <button data-testid={`adder-${categoryId}`} onClick={() => addUnit('mock-added-unit')}>
      Add to {categoryId}
    </button>
  )
}));
vi.mock('./editor/ListRuleChecklist', () => ({
  default: () => <div data-testid="list-rule-checklist" />
}));
vi.mock('./editor/RosterSidebar', () => ({
  default: () => <div data-testid="roster-sidebar" />
}));
vi.mock('./editor/UnitSelectionCard', () => ({
  default: ({ selection }) => <div data-testid={`unit-card-${selection.id}`}>{selection.name}</div>
}));

describe('RosterEditor Component', () => {
  const mockSystem = {
    id: 'sys-1',
    costTypes: [{ id: 'pts', name: 'Pts' }],
    catalogues: [{ id: 'bret-cat', name: 'Bretonnia', selectionEntries: [{ id: 'dummy-entry' }] }],
    forceEntries: [
      {
        id: 'fe-1',
        categoryLinks: [
          { targetId: 'cat-heroes', name: 'Heroes', constraints: [{ type: 'min', value: 1 }] },
          { targetId: 'cat-core', name: 'Core', constraints: [{ type: 'min', value: 2 }] }
        ]
      }
    ],
    categoryEntries: [
      { id: 'cat-heroes', name: 'Heroes' },
      { id: 'cat-core', name: 'Core' }
    ]
  };

  const mockOnBack = vi.fn();
  const mockOnPlay = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true });
    mockRoster = JSON.parse(JSON.stringify(defaultMockRoster));
    mockCosts = JSON.parse(JSON.stringify(defaultMockCosts));
    mockValidationErrors = JSON.parse(JSON.stringify(defaultMockValidationErrors));
    mockCanUndo = false;
    mockCanRedo = false;
  });

  it('renders the roster header details and cost indicators', () => {
    render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
    expect(screen.getByText('Bretonnian Crusaders')).toBeDefined();
    expect(document.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim()).toBe('420 / 1000Pkt.');
  });

  it('keeps units within a category in their original (insertion) order', () => {
    render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
    const unitCards = screen.getAllByTestId(/unit-card-sel-/);

    // Core has sel-2 (Knights Errant) added before sel-3 (Knights of the Realm).
    // Units must not be re-sorted by cost, so insertion order is preserved.
    expect(unitCards[1].textContent).toContain('Knights Errant');
    expect(unitCards[2].textContent).toContain('Knights of the Realm');
  });

  it('does not render a manual save button (uses auto-save)', () => {
    render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
    const saveButton = screen.queryByRole('button', { name: /speichern/i });
    expect(saveButton).toBeNull();
  });


  it('verifies that validator methods are called with the expected game system and catalog context', () => {
    render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);

    // RosterEditor.jsx checks effective primary-category membership when deciding which
    // category sections to surface. Ensure that check runs against our game system.
    expect(mockIsEntryPrimaryInCategory).toHaveBeenCalled();
    expect(mockIsEntryPrimaryInCategory).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ system: expect.objectContaining({ id: 'sys-1' }) })
    );
  });

  it('verifies that triggering the CategoryUnitAdder calls the addUnit function from useRoster', () => {
    render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
    const adderButton = screen.getByTestId('adder-cat-heroes');
    fireEvent.click(adderButton);
    expect(mockAddUnit).toHaveBeenCalledTimes(1);
    expect(mockAddUnit).toHaveBeenCalledWith('mock-added-unit');
  });

  describe('Adversarial & Stress Tests', () => {
    it('throws TypeError when validationErrors is null or undefined', () => {
      // Simulate validationErrors being null/undefined (e.g. from a hook failure)
      mockValidationErrors = null;
      expect(() => render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />)).toThrow();
    });

    it('throws TypeError when validationErrors contains null elements', () => {
      // Simulate a null element in validationErrors list
      mockValidationErrors = [null];
      expect(() => render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />)).toThrow();
    });

    it('survives validationErrors containing errors without message key', () => {
      mockValidationErrors = [{ id: 'err-1', categoryId: 'cat-core' }]; // missing message
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      expect(screen.getByText('Bretonnian Crusaders')).toBeDefined();
    });

    it('handles zero costLimit without crashing and using division fallback', () => {
      mockRoster.costLimit = 0;
      mockCosts = { pts: 100 };
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      // 100 / (0 || 1) * 100 = 10000 -> Math.min(100, 10000) = 100
      expect(document.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim()).toBe('100 / 0Pkt.');
    });

    it('handles negative costLimit values', () => {
      mockRoster.costLimit = -100;
      mockCosts = { pts: 50 };
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      // 50 / -100 * 100 = -50 -> Math.min(100, -50) = -50.
      // Expect component to render without throwing, even if CSS width becomes -50%
      expect(document.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim()).toBe('50 / -100Pkt.');
    });

    it('handles NaN costLimit values', () => {
      mockRoster.costLimit = NaN;
      mockCosts = { pts: 100 };
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      // NaN || 1 evaluates to 1. 100 / 1 * 100 = 10000 -> Math.min(100, 10000) = 100
      // NaN is falsy, so roster.costLimit || 0 evaluates to 0
      expect(document.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim()).toBe('100 / 0Pkt.');
    });

    it('handles Infinity costLimit values', () => {
      mockRoster.costLimit = Infinity;
      mockCosts = { pts: 100 };
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      // 100 / Infinity * 100 = 0 -> Math.min(100, 0) = 0
      expect(document.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim()).toBe('100 / InfinityPkt.');
    });

    it('handles non-numeric costLimit string gracefully or identifies NaN representation', () => {
      mockRoster.costLimit = "unlimited";
      mockCosts = { pts: 100 };
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      // "unlimited" || 1 evaluates to "unlimited". 100 / "unlimited" evaluates to NaN.
      // Style width will be NaN%, but it should not crash.
      expect(document.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim()).toBe('100 / unlimitedPkt.');
    });
  });

  describe('Lagerbericht Play Button and Flavor Text', () => {
    it('does not render "Spielen" button when validation errors exist', () => {
      // default mockValidationErrors contains errors, so roster is invalid
      const { container } = render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      const mobilePlayBtn = container.querySelector('.mobile-only button');
      expect(mobilePlayBtn).toBeNull();
    });

    it('renders "Spielen" button and the cool flavor text when roster is valid', () => {
      mockValidationErrors = []; // Valid roster!
      const { container } = render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      
      const mobilePlayBtn = container.querySelector('.mobile-only button');
      expect(mobilePlayBtn).not.toBeNull();
      expect(mobilePlayBtn.textContent).toMatch(/Spielen/i);
      
      const flavorText = screen.getByText(/Die Schlachtreihen stehen fest/i);
      expect(flavorText).toBeDefined();
    });
  });

  describe('Milestone 1 UI/UX Optimizations', () => {
    it('does not render "Keine Auswahlen vorhanden" when categories are empty', () => {
      mockRoster.forces[0].selections = [];
      render(<RosterEditor system={mockSystem} roster={mockRoster} onBack={mockOnBack} onPlay={mockOnPlay} />);
      expect(screen.queryByText(/Keine Auswahlen vorhanden/i)).toBeNull();
    });

    it('applies correct badge classes (badge-danger when invalid, badge-muted when valid)', () => {
      const { container } = render(<RosterEditor system={mockSystem} roster={mockRoster} onBack={mockOnBack} onPlay={mockOnPlay} />);
      
      const headers = container.querySelectorAll('.roster-category-header');
      expect(headers.length).toBe(2);
      
      headers.forEach(header => {
        const title = header.querySelector('h3').textContent;
        const badge = header.querySelector('span.badge');
        
        if (title.includes('Heroes')) {
          expect(badge.className).toContain('badge-muted');
          expect(badge.className).not.toContain('badge-danger');
          expect(badge.style.backgroundColor).toBe('');
        } else if (title.includes('Core')) {
          expect(badge.className).toContain('badge-danger');
          expect(badge.className).not.toContain('badge-muted');
          expect(badge.style.backgroundColor).toBe('');
        }
      });
    });
  });

  describe('Roster Title', () => {
    it('renders the title as read-only (editing moved to the dashboard)', () => {
      render(<RosterEditor system={mockSystem} roster={mockRoster} onBack={mockOnBack} onPlay={mockOnPlay} />);

      // Title is shown but no longer editable in the editor
      expect(screen.getByText('Bretonnian Crusaders')).toBeDefined();
      expect(screen.queryByTitle('Titel bearbeiten')).toBeNull();
    });
  });

  describe('Roster Export UI', () => {
    it('calls onExportRoster when clicking the Exportieren button in header', () => {
      const mockExport = vi.fn();
      render(
        <RosterEditor 
          system={mockSystem} 
          roster={mockRoster} 
          onBack={mockOnBack} 
          onPlay={mockOnPlay} 
          onExportRoster={mockExport} 
        />
      );

      const exportBtn = screen.getByText('Exportieren');
      expect(exportBtn).toBeDefined();
      fireEvent.click(exportBtn);
      
      expect(mockExport).toHaveBeenCalledWith(mockRoster);
    });
  });

  describe('Undo/Redo Buttons', () => {
    it('renders undo and redo buttons in the toolbar', () => {
      render(<RosterEditor system={mockSystem} roster={mockRoster} onBack={mockOnBack} onPlay={mockOnPlay} />);

      expect(screen.getByTitle('Rückgängig')).toBeDefined();
      expect(screen.getByTitle('Wiederherstellen')).toBeDefined();
    });

    it('disables both buttons when no undo/redo history is available', () => {
      mockCanUndo = false;
      mockCanRedo = false;
      render(<RosterEditor system={mockSystem} roster={mockRoster} onBack={mockOnBack} onPlay={mockOnPlay} />);

      expect(screen.getByTitle('Rückgängig').disabled).toBe(true);
      expect(screen.getByTitle('Wiederherstellen').disabled).toBe(true);
    });

    it('enables the undo button when canUndo is true and calls undo on click', () => {
      mockCanUndo = true;
      mockCanRedo = false;
      render(<RosterEditor system={mockSystem} roster={mockRoster} onBack={mockOnBack} onPlay={mockOnPlay} />);

      const undoBtn = screen.getByTitle('Rückgängig');
      expect(undoBtn.disabled).toBe(false);

      fireEvent.click(undoBtn);
      expect(mockUndo).toHaveBeenCalledTimes(1);
    });

    it('enables the redo button when canRedo is true and calls redo on click', () => {
      mockCanUndo = false;
      mockCanRedo = true;
      render(<RosterEditor system={mockSystem} roster={mockRoster} onBack={mockOnBack} onPlay={mockOnPlay} />);

      const redoBtn = screen.getByTitle('Wiederherstellen');
      expect(redoBtn.disabled).toBe(false);

      fireEvent.click(redoBtn);
      expect(mockRedo).toHaveBeenCalledTimes(1);
    });
  });
});


