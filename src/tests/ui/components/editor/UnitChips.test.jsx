import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnitRulesChipsHarness as UnitRulesChips, UnitUpgradesChipsHarness as UnitUpgradesChips } from '../../../../shared/test-utils/editorHarness';

// Both chip components decide between the 6th.whfb.app rule link and the catalogue
// fallback through the central useRuleUrl hook (ADR-0015). These tests exercise
// that real hook by mocking only its two dependencies — the mapping lookup and the
// linking setting — so the link-vs-fallback switch is verified end to end.

vi.mock('lucide-react', () => ({
  BookOpen: (props) => <span data-testid="icon-book" {...props} />,
  Info: (props) => <span data-testid="icon-info" {...props} />,
}));

const mockCollectUnitProfilesAndRules = vi.fn();
const mockFindEntryInSystem = vi.fn();
const mockResolveEntry = vi.fn();
const mockGroupProfilesByType = vi.fn();

// Die Komponente liest ihre Struktur-Helfer seit Issue 0121, Task 8 aus dem
// Schreibmodell src/domain/roster/ (Sammel-Modul). Das Prädikat „eigenständige
// Untereinheit" und die Schlüsselwortlisten sind ohne eigene Abhängigkeiten —
// der Mock reicht ihre echte Umsetzung durch, statt sie zu stubben.
vi.mock('../../../../domain/roster', async () => ({
  collectUnitProfilesAndRules: (...args) => mockCollectUnitProfilesAndRules(...args),
  findEntryInSystem: (...args) => mockFindEntryInSystem(...args),
  resolveEntry: (...args) => mockResolveEntry(...args),
  isIndependentSubUnit: (await vi.importActual('../../../../domain/roster/subUnit')).isIndependentSubUnit,
  groupProfilesByType: (...args) => mockGroupProfilesByType(...args),
  ...(await vi.importActual('../../../../domain/roster/constants')),
}));

const mockGetRuleUrl = vi.fn();
vi.mock('../../../../data/rules/rulesLookup', () => ({
  getRuleUrl: (name) => mockGetRuleUrl(name),
}));

const mockUseSettings = vi.fn();
vi.mock('../../../../ui/viewmodels/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

const RULE_NAME = 'Killing Blow';
const RULE_URL = 'https://6th.whfb.app/special-rules/killing-blow';
const UPGRADE_NAME = 'Sword of Might';
const UPGRADE_URL = 'https://6th.whfb.app/magic-item/sword-of-might';

const noop = vi.fn();

const baseProps = {
  system: {},
  activeCatalogueId: 'cat-1',
  roster: { costLimitType: 'pts', forces: [] },
  handleMouseEnter: vi.fn(),
  handleMouseMove: vi.fn(),
  handleMouseLeave: vi.fn(),
};

describe('UnitChips link resolution honors the whfb6 linking setting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true });
    // No profiles feed the "already shown in the stats table" exclusion, so every
    // rule/upgrade stays visible as a chip.
    mockGroupProfilesByType.mockReturnValue([]);
  });

  describe('UnitRulesChips', () => {
    // Die Regeln kommen seit Issue 0121, Task 7 aus der Info-Projektion des
    // Fähigkeitsdatensatzes (`capability.infoElements`), nicht mehr aus
    // `collectUnitProfilesAndRules`.
    const mappedRuleCapability = {
      anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null,
      infoElements: [{ kind: 'rule', id: 'r1', name: RULE_NAME, text: 'A deadly blow' }],
    };

    const renderRulesChips = (overrides = {}) =>
      render(
        <UnitRulesChips
          {...baseProps}
          selection={{ id: 'sel-1', selections: [] }}
          capability={mappedRuleCapability}
          onClickDetails={noop}
          onShowRule={noop}
          {...overrides}
        />
      );

    beforeEach(() => {
      mockGetRuleUrl.mockImplementation((name) => (name === RULE_NAME ? RULE_URL : null));
    });

    it('shows the rule link and calls onShowRule when linking is enabled', () => {
      const onShowRule = vi.fn();
      const onClickDetails = vi.fn();
      renderRulesChips({ onShowRule, onClickDetails });

      expect(screen.getByTestId('icon-book')).toBeTruthy();
      expect(screen.queryByTestId('icon-info')).toBeNull();

      fireEvent.click(screen.getByText(RULE_NAME));
      expect(onShowRule).toHaveBeenCalledWith(RULE_NAME);
      expect(onClickDetails).not.toHaveBeenCalled();
    });

    it('falls back to the catalogue details when linking is disabled, even with a mapping', () => {
      mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: false });
      const onShowRule = vi.fn();
      const onClickDetails = vi.fn();
      renderRulesChips({ onShowRule, onClickDetails });

      expect(screen.getByTestId('icon-info')).toBeTruthy();
      expect(screen.queryByTestId('icon-book')).toBeNull();

      fireEvent.click(screen.getByText(RULE_NAME));
      expect(onShowRule).not.toHaveBeenCalled();
      expect(onClickDetails).toHaveBeenCalledWith(RULE_NAME, expect.anything());
    });
  });

  describe('UnitUpgradesChips', () => {
    const upgradeSelection = {
      id: 'sel-1',
      selections: [
        { id: 'sub-1', name: UPGRADE_NAME, entryLinkId: 'el-sword', number: 1, selections: [] },
      ],
    };
    const resolvedUpgrade = {
      id: 'res-sword',
      name: UPGRADE_NAME,
      profiles: [],
    };

    // Der Regeltext einer Aufwertung kommt aus der Info-Projektion ihres Slots
    // (`capability.infoElements`), nicht mehr aus dem aufgeloesten Eintrag.
    const upgradeCapabilities = new Map([
      ['0', {
        anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false,
        primaryCategoryId: null, name: 'Unit', infoElements: [],
      }],
      ['0/0', {
        anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false,
        primaryCategoryId: null, name: UPGRADE_NAME,
        infoElements: [{ kind: 'rule', id: 'r-sword', name: UPGRADE_NAME, text: 'A mighty sword' }],
      }],
    ]);
    const upgradePathBySelectionId = new Map([['sel-1', '0'], ['sub-1', '0/0']]);

    const renderUpgradesChips = (overrides = {}) =>
      render(
        <UnitUpgradesChips
          {...baseProps}
          capabilities={upgradeCapabilities}
          pathBySelectionId={upgradePathBySelectionId}
          selection={upgradeSelection}
          onClickDetails={noop}
          onShowRule={noop}
          {...overrides}
        />
      );

    beforeEach(() => {
      mockCollectUnitProfilesAndRules.mockReturnValue({ profiles: [], rules: [] });
      mockFindEntryInSystem.mockReturnValue({ id: 'raw-sword' });
      mockResolveEntry.mockReturnValue(resolvedUpgrade);
      mockGetRuleUrl.mockImplementation((name) => (name === UPGRADE_NAME ? UPGRADE_URL : null));
    });

    it('shows the rule link and calls onShowRule when linking is enabled', () => {
      const onShowRule = vi.fn();
      const onClickDetails = vi.fn();
      renderUpgradesChips({ onShowRule, onClickDetails });

      expect(screen.getByTestId('icon-book')).toBeTruthy();
      expect(screen.queryByTestId('icon-info')).toBeNull();

      fireEvent.click(screen.getByText(UPGRADE_NAME));
      expect(onShowRule).toHaveBeenCalledWith(UPGRADE_NAME);
      expect(onClickDetails).not.toHaveBeenCalled();
    });

    it('falls back to the catalogue details when linking is disabled, even with a mapping', () => {
      mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: false });
      const onShowRule = vi.fn();
      const onClickDetails = vi.fn();
      renderUpgradesChips({ onShowRule, onClickDetails });

      expect(screen.getByTestId('icon-info')).toBeTruthy();
      expect(screen.queryByTestId('icon-book')).toBeNull();

      fireEvent.click(screen.getByText(UPGRADE_NAME));
      expect(onShowRule).not.toHaveBeenCalled();
      expect(onClickDetails).toHaveBeenCalledWith(UPGRADE_NAME, expect.anything());
    });
  });
});
