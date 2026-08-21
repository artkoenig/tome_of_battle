import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { setActiveLanguage } from '../i18n/i18nStore';
import { LANGUAGE_STORAGE_KEY } from '../i18n/constants';

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
const CLOSE_LABEL = 'Schließen';
const TITLE_DE = 'Einstellungen';
const TITLE_EN = 'Settings';

describe('SettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSettings.mockReturnValue({ whfb6LinkingEnabled: true, setWhfb6LinkingEnabled: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    // The language switch mutates global i18n state and localStorage; reset both
    // so tests stay independent.
    window.localStorage.clear();
    setActiveLanguage('de');
  });

  it('renders nothing when closed', () => {
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
    render(<SettingsDialog isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(`${VERSION_LABEL} ${APP_VERSION}`)).not.toBeNull();
  });

  it('does not render the version line when the dialog is closed', () => {
    vi.stubEnv('VITE_APP_VERSION', APP_VERSION);
    render(<SettingsDialog isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText(new RegExp(`^${VERSION_LABEL}`))).toBeNull();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<SettingsDialog isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(CLOSE_LABEL));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the German title when the language is pinned to German', () => {
    render(<SettingsDialog isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(TITLE_DE)).not.toBeNull();
  });

  it('offers both languages with German marked active', () => {
    render(<SettingsDialog isOpen={true} onClose={vi.fn()} />);
    const german = screen.getByTestId('language-option-de');
    const english = screen.getByTestId('language-option-en');
    expect(german.getAttribute('aria-checked')).toBe('true');
    expect(english.getAttribute('aria-checked')).toBe('false');
    expect(german.textContent).toBe('Deutsch');
    expect(english.textContent).toBe('English');
  });

  it('switches the whole dialog to English immediately when English is chosen', () => {
    render(<SettingsDialog isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(TITLE_DE)).not.toBeNull();

    act(() => {
      fireEvent.click(screen.getByTestId('language-option-en'));
    });

    expect(screen.getByText(TITLE_EN)).not.toBeNull();
    expect(screen.getByTestId('language-option-en').getAttribute('aria-checked')).toBe('true');
  });

  it('persists the chosen language and updates the document lang attribute', () => {
    render(<SettingsDialog isOpen={true} onClose={vi.fn()} />);
    act(() => {
      fireEvent.click(screen.getByTestId('language-option-en'));
    });

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
