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

describe('RuleChipIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
