import React from 'react';
import { SlotIndex } from '../../../contexts/ruleengine/readmodel/slotIndex';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterEditor from '../../../ui/components/RosterEditor';
import { createSubSelectionOperationsMock } from '../../../tests/test-utils/subSelectionOperationsMock';
import { useRosterCommands } from '../../../ui/viewmodels/rosterContexts';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  // Das Auffuell-Panel des Editors (Issue 0135) rendert diese Symbole.
  Wand2: () => <span data-testid="icon-wand" />,
  Plus: () => <span data-testid="icon-plus" />,
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
vi.mock('../../../ui/viewmodels/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

// Mock useRosterState custom hook
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
let mockViolations = [];

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

// Verletzungen in der Berichtsform der Evaluator-Fassade: eine an einem
// Kategorie-Anker (färbt den Zähl-Chip der Kategorie) und eine Autoren-Meldung
// auf Roster-Ebene (Text-Pass-through).
const defaultMockViolations = [
  {
    origin: 'derivedLimit',
    severity: 'error',
    anchor: { defId: 'cat-core', name: 'Core', path: '0/3', anchorKind: 'categoryAnchor', isValueUnstable: false },
  },
  {
    origin: 'authorMessage',
    severity: 'error',
    text: 'Roster exceeds cost limit',
    anchor: { defId: 'roster', name: 'Roster', path: null, anchorKind: 'roster', isValueUnstable: false },
  }
];

// Der Zustandsknoten des Editors (ADR-0038): der Editor liest ihn direkt und
// spannt daraus die beiden Roster-Kontexte auf.
vi.mock('../../../ui/viewmodels/useRosterState', () => ({
  useRosterState: () => ({
    roster: mockRoster,
    report: {
      violations: mockViolations,
      slots: SlotIndex.fromMaps(),
      // Kosten kommen seit Issue 0121, Task 7 aus dem Bericht (costTotals);
      // der frühere Solver-Kostenpfad (`costs`) existiert im Hook nicht mehr.
      costTotals: mockCosts,
      description: null,
      unresolvedSelections: [],
      diagnostics: [],
    },
    selectedRosterSelection: null,
    setSelectedRosterSelection: mockSetSelectedRosterSelection,
    commands: {
      raiseUnit: mockAddUnit,
      removeUnit: mockRemoveUnit,
      copyUnit: mockCopyUnit,
      subSelectionOperations: mockSubSelectionOperations,
      updateRosterName: mockUpdateRosterName,
      save: mockSave,
      undo: mockUndo,
      redo: mockRedo,
    },
    canUndo: mockCanUndo,
    canRedo: mockCanRedo
  })
}));

// Mock database saveRoster
vi.mock('../../../platform/persistence/database', () => ({
  saveRoster: vi.fn()
}));

// Mock Validators
// Only the rules engine is stubbed; the roster-tree primitives that the barrel
// re-exports stay real, since they are pure traversal without any rules in them
// (seit Issue 0121, Task 8 liegt das Schreibmodell unter src/contexts/armylist/model/).
vi.mock('../../../contexts/armylist/model', async (importOriginal) => ({
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
  resolveListRuleGroup: () => ({ isListRuleGroup: false, states: [] }),
}));

// Dummy child components to speed up execution
// Der Aushebe-Callback kommt seit Issue 0164 aus dem Kommando-Kontext, nicht
// mehr als Stuetze — die Attrappe greift ihn dort ab.
vi.mock('../../../ui/components/editor/CategoryUnitAdder', () => ({
  default: function CategoryUnitAdderStub({ categoryId, forceId }) {
    const { raiseUnit } = useRosterCommands();
    return (
      <button data-testid={`adder-${categoryId}`} onClick={() => raiseUnit('mock-added-unit', categoryId, forceId)}>
        Add to {categoryId}
      </button>
    );
  }
}));
vi.mock('../../../ui/components/editor/ListRuleChecklist', () => ({
  default: () => <div data-testid="list-rule-checklist" />
}));
vi.mock('../../../ui/components/editor/RosterSidebar', () => ({
  default: () => <div data-testid="roster-sidebar" />
}));
vi.mock('../../../ui/components/editor/UnitSelectionCard', () => ({
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
    mockViolations = JSON.parse(JSON.stringify(defaultMockViolations));
    mockCanUndo = false;
    mockCanRedo = false;
  });

  it('renders the roster header details and cost indicators', () => {
    render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
    expect(screen.getByText('Bretonnian Crusaders')).toBeDefined();
    expect(document.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim()).toBe('420 / 1000Pts');
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


  it('decides which category sections to surface from the report, without a second catalogue pass', () => {
    render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);

    // Whether a category is a usable slot comes from the slots of the report
    // (`capability.primaryCategoryId`, Issue 0156) — the editor no longer walks
    // the catalogue for it, nor collects profiles for the chip filter.
    expect(mockIsEntryPrimaryInCategory).not.toHaveBeenCalled();
    expect(mockCollectUnitProfilesAndRules).not.toHaveBeenCalled();
    expect(screen.getByTestId('adder-cat-heroes')).toBeDefined();
  });

  it('verifies that triggering the CategoryUnitAdder calls the raiseUnit function from useRosterState', () => {
    render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
    const adderButton = screen.getByTestId('adder-cat-heroes');
    fireEvent.click(adderButton);
    expect(mockAddUnit).toHaveBeenCalledTimes(1);
    // Die Kontingent-Sektion bindet ihr eigenes Kontingent an das Ausheben.
    expect(mockAddUnit).toHaveBeenCalledWith('mock-added-unit', 'cat-heroes', 'force-1');
  });

  describe('Adversarial & Stress Tests', () => {
    it('throws TypeError when violations is null or undefined', () => {
      // Simulate violations being null/undefined (e.g. from a hook failure)
      mockViolations = null;
      expect(() => render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />)).toThrow();
    });

    it('survives violations containing null elements', () => {
      // Ein null-Element blockiert nicht (isBlockingViolation über ?.) und
      // rendert als leere Meldung, statt den Editor zu reißen.
      mockViolations = [null];
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      expect(screen.getByText('Bretonnian Crusaders')).toBeDefined();
    });

    it('survives violations without limit classification (generic fallback)', () => {
      mockViolations = [{
        origin: 'derivedLimit',
        severity: 'error',
        anchor: { defId: 'def-1', name: 'Core', path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
      }]; // missing limit → generischer i18n-Schlüssel
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      expect(screen.getByText('Bretonnian Crusaders')).toBeDefined();
    });

    it('handles zero costLimit without crashing and using division fallback', () => {
      mockRoster.costLimit = 0;
      mockCosts = { pts: 100 };
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      // 100 / (0 || 1) * 100 = 10000 -> Math.min(100, 10000) = 100
      expect(document.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim()).toBe('100 / 0Pts');
    });

    it('handles negative costLimit values', () => {
      mockRoster.costLimit = -100;
      mockCosts = { pts: 50 };
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      // 50 / -100 * 100 = -50 -> Math.min(100, -50) = -50.
      // Expect component to render without throwing, even if CSS width becomes -50%
      expect(document.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim()).toBe('50 / -100Pts');
    });

    it('handles NaN costLimit values', () => {
      mockRoster.costLimit = NaN;
      mockCosts = { pts: 100 };
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      // NaN || 1 evaluates to 1. 100 / 1 * 100 = 10000 -> Math.min(100, 10000) = 100
      // NaN is falsy, so roster.costLimit || 0 evaluates to 0
      expect(document.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim()).toBe('100 / 0Pts');
    });

    it('handles Infinity costLimit values', () => {
      mockRoster.costLimit = Infinity;
      mockCosts = { pts: 100 };
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      // 100 / Infinity * 100 = 0 -> Math.min(100, 0) = 0
      expect(document.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim()).toBe('100 / InfinityPts');
    });

    it('handles non-numeric costLimit string gracefully or identifies NaN representation', () => {
      mockRoster.costLimit = "unlimited";
      mockCosts = { pts: 100 };
      render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      // "unlimited" || 1 evaluates to "unlimited". 100 / "unlimited" evaluates to NaN.
      // Style width will be NaN%, but it should not crash.
      expect(document.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim()).toBe('100 / unlimitedPts');
    });
  });

  describe('Lagerbericht Play Button and Flavor Text', () => {
    it('does not render "Spielen" button when blocking violations exist', () => {
      // default mockViolations contains errors, so roster is invalid
      const { container } = render(<RosterEditor system={mockSystem} roster={{}} onBack={mockOnBack} onPlay={mockOnPlay} />);
      const mobilePlayBtn = container.querySelector('.mobile-only button');
      expect(mobilePlayBtn).toBeNull();
    });

    it('renders "Spielen" button and the cool flavor text when roster is valid', () => {
      mockViolations = []; // Valid roster!
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


