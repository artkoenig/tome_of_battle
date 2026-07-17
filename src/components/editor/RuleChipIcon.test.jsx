import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RuleChipIcon from './RuleChipIcon';

vi.mock('lucide-react', () => ({
  BookOpen: (props) => <span data-testid="icon-book" {...props} />,
  Info: (props) => <span data-testid="icon-info" {...props} />,
}));

const mockGetRuleUrl = vi.fn();
vi.mock('../../data/rulesLookup', () => ({
  getRuleUrl: (name) => mockGetRuleUrl(name),
}));

// The component resolves links through the real useRuleUrl hook, which combines
// the whfb6 linking setting with the mapping lookup. Mocking only useSettings
// (not the hook itself) exercises that real wiring, so the disabled-state test
// verifies the actual link-vs-fallback decision rather than a stubbed shortcut.
const mockUseSettings = vi.fn();
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

describe('RuleChipIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true });
  });

  it('renders the BookOpen link when a rule URL exists', () => {
    mockGetRuleUrl.mockReturnValue('https://6th.whfb.app/special-rules/regeneration');
    render(<RuleChipIcon name="Regeneration" hasInfo={true} onShowRule={vi.fn()} />);
    expect(screen.getByTestId('icon-book')).toBeTruthy();
    expect(screen.queryByTestId('icon-info')).toBeNull();
  });

  it('link takes priority: Info is not offered even when catalogue info exists', () => {
    mockGetRuleUrl.mockReturnValue('https://6th.whfb.app/weapons/halberd');
    render(<RuleChipIcon name="Halberd" hasInfo={true} onInfoEnter={vi.fn()} onShowRule={vi.fn()} />);
    expect(screen.queryByTestId('icon-info')).toBeNull();
  });

  it('calls onShowRule (and stops propagation) when the link is clicked', () => {
    mockGetRuleUrl.mockReturnValue('https://6th.whfb.app/special-rules/killing-blow');
    const onShowRule = vi.fn();
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <RuleChipIcon name="Killing Blow" hasInfo={false} onShowRule={onShowRule} />
      </div>
    );
    fireEvent.click(screen.getByTestId('icon-book'));
    expect(onShowRule).toHaveBeenCalledWith('Killing Blow');
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('falls back to the Info icon when no rule URL exists but catalogue info is present', () => {
    mockGetRuleUrl.mockReturnValue(null);
    const onInfoEnter = vi.fn();
    render(<RuleChipIcon name="Barding" hasInfo={true} onInfoEnter={onInfoEnter} />);
    const info = screen.getByTestId('icon-info');
    expect(info).toBeTruthy();
    expect(screen.queryByTestId('icon-book')).toBeNull();
    fireEvent.mouseEnter(info);
    expect(onInfoEnter).toHaveBeenCalled();
  });

  it('calls onInfoClick (and stops propagation) when provided', () => {
    mockGetRuleUrl.mockReturnValue(null);
    const onInfoClick = vi.fn();
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <RuleChipIcon name="Barding" hasInfo={true} onInfoClick={onInfoClick} />
      </div>
    );
    fireEvent.click(screen.getByTestId('icon-info'));
    expect(onInfoClick).toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('renders nothing when there is neither a rule URL nor catalogue info', () => {
    mockGetRuleUrl.mockReturnValue(null);
    const { container } = render(<RuleChipIcon name="Nothing" hasInfo={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('falls back to the catalogue Info when linking is disabled, even though a mapping exists', () => {
    // Setting off: the resolver must behave as if no mapping existed, so the
    // catalogue fallback (Info) is offered instead of the BookOpen link.
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: false });
    mockGetRuleUrl.mockReturnValue('https://6th.whfb.app/special-rules/killing-blow');
    const onInfoEnter = vi.fn();

    render(<RuleChipIcon name="Killing Blow" hasInfo={true} onInfoEnter={onInfoEnter} onShowRule={vi.fn()} />);

    expect(screen.getByTestId('icon-info')).toBeTruthy();
    expect(screen.queryByTestId('icon-book')).toBeNull();
  });

  it('renders nothing when linking is disabled and there is no catalogue info', () => {
    // Without a mapping-derived link and without catalogue info, the chip has no
    // affordance at all — the disabled setting must not resurrect the link.
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: false });
    mockGetRuleUrl.mockReturnValue('https://6th.whfb.app/special-rules/killing-blow');

    const { container } = render(<RuleChipIcon name="Killing Blow" hasInfo={false} />);

    expect(container.innerHTML).toBe('');
  });
});
