import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
const VERSION_LABEL = 'Version';
const APP_VERSION = 'v1.2.3';

describe('SettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('shows the current app version from VITE_APP_VERSION', () => {
    vi.stubEnv('VITE_APP_VERSION', APP_VERSION);
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true, setWhfb6LinkingEnabled: vi.fn() });
    render(<SettingsDialog isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(`${VERSION_LABEL} ${APP_VERSION}`)).not.toBeNull();
  });

  it('does not render the version line when the dialog is closed', () => {
    vi.stubEnv('VITE_APP_VERSION', APP_VERSION);
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true, setWhfb6LinkingEnabled: vi.fn() });
    render(<SettingsDialog isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText(new RegExp(`^${VERSION_LABEL}`))).toBeNull();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true, setWhfb6LinkingEnabled: vi.fn() });
    render(<SettingsDialog isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Schließen'));
    expect(onClose).toHaveBeenCalled();
  });
});
