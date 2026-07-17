import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseSettings = vi.fn();

vi.mock('lucide-react', () => ({
  X: (props) => <span data-testid="icon-x" {...props} />,
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

import SettingsDialog from './SettingsDialog';

const SWITCH_NAME = 'Verlinkung zu 6th.whfb.app';

describe('SettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true, setWhfb6LinkingEnabled: vi.fn() });
    const { container } = render(<SettingsDialog isOpen={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the switch in the on state when linking is enabled', () => {
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true, setWhfb6LinkingEnabled: vi.fn() });
    render(<SettingsDialog isOpen={true} onClose={vi.fn()} />);
    const toggle = screen.getByRole('switch', { name: SWITCH_NAME });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('shows the switch in the off state when linking is disabled', () => {
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: false, setWhfb6LinkingEnabled: vi.fn() });
    render(<SettingsDialog isOpen={true} onClose={vi.fn()} />);
    const toggle = screen.getByRole('switch', { name: SWITCH_NAME });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('toggling from on calls setWhfb6LinkingEnabled with false', () => {
    const setWhfb6LinkingEnabled = vi.fn();
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true, setWhfb6LinkingEnabled });
    render(<SettingsDialog isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('switch', { name: SWITCH_NAME }));
    expect(setWhfb6LinkingEnabled).toHaveBeenCalledWith(false);
  });

  it('toggling from off calls setWhfb6LinkingEnabled with true', () => {
    const setWhfb6LinkingEnabled = vi.fn();
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: false, setWhfb6LinkingEnabled });
    render(<SettingsDialog isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('switch', { name: SWITCH_NAME }));
    expect(setWhfb6LinkingEnabled).toHaveBeenCalledWith(true);
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true, setWhfb6LinkingEnabled: vi.fn() });
    render(<SettingsDialog isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Schließen'));
    expect(onClose).toHaveBeenCalled();
  });
});
