import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppDialogs from './AppDialogs';

// Die drei Dialoge werden gemockt, damit die Präsentationskomponente isoliert
// gegen ihre weitergereichten Flags und Callbacks geprüft werden kann.
const { settingsProps, newRosterProps, confirmProps } = vi.hoisted(() => ({
  settingsProps: { current: null },
  newRosterProps: { current: null },
  confirmProps: { current: null },
}));

vi.mock('./SettingsDialog', () => ({
  default: (props) => {
    settingsProps.current = props;
    return <div data-testid="settings-mock">{props.isOpen ? 'offen' : 'zu'}</div>;
  },
}));
vi.mock('./editor/NewRosterModal', () => ({
  default: (props) => {
    newRosterProps.current = props;
    return <div data-testid="new-roster-mock">{props.isOpen ? 'offen' : 'zu'}</div>;
  },
}));
vi.mock('./editor/ConfirmationDialog', () => ({
  default: (props) => {
    confirmProps.current = props;
    return (
      <div data-testid="confirm-mock">
        <div data-testid="confirm-open">{props.isOpen ? 'offen' : 'zu'}</div>
        <div data-testid="confirm-message">{props.message}</div>
        <button onClick={props.onConfirm}>{props.confirmLabel}</button>
      </div>
    );
  },
}));

const baseProps = {
  isSettingsOpen: false,
  onCloseSettings: vi.fn(),
  isNewRosterModalOpen: false,
  onCloseNewRosterModal: vi.fn(),
  onCreateRoster: vi.fn(),
  systems: [{ id: 'sys-1' }],
  rosterToDelete: null,
  onCancelRosterDeletion: vi.fn(),
  onConfirmRosterDeletion: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  settingsProps.current = null;
  newRosterProps.current = null;
  confirmProps.current = null;
});

describe('AppDialogs', () => {
  it('rendert alle drei Dialoge', () => {
    render(<AppDialogs {...baseProps} />);

    expect(screen.getByTestId('settings-mock')).toBeDefined();
    expect(screen.getByTestId('new-roster-mock')).toBeDefined();
    expect(screen.getByTestId('confirm-mock')).toBeDefined();
  });

  it('reicht die Sichtbarkeits-Flags der Dialoge durch', () => {
    render(<AppDialogs {...baseProps} isSettingsOpen={true} isNewRosterModalOpen={true} />);

    expect(settingsProps.current.isOpen).toBe(true);
    expect(newRosterProps.current.isOpen).toBe(true);
  });

  it('leitet Systeme und Create-Callback ans Neues-Roster-Modal weiter', () => {
    render(<AppDialogs {...baseProps} />);

    expect(newRosterProps.current.systems).toEqual([{ id: 'sys-1' }]);
    expect(newRosterProps.current.onCreate).toBe(baseProps.onCreateRoster);
  });

  it('öffnet die Lösch-Bestätigung nur, wenn ein Roster zum Löschen vorgemerkt ist', () => {
    const { rerender } = render(<AppDialogs {...baseProps} rosterToDelete={null} />);
    expect(confirmProps.current.isOpen).toBe(false);

    rerender(<AppDialogs {...baseProps} rosterToDelete={{ id: 'r-1', name: 'Meine Liste' }} />);
    expect(confirmProps.current.isOpen).toBe(true);
  });

  it('zeigt den Namen des zu löschenden Rosters in der Bestätigung', () => {
    render(<AppDialogs {...baseProps} rosterToDelete={{ id: 'r-1', name: 'Meine Liste' }} />);

    expect(screen.getByTestId('confirm-message').textContent).toContain('Meine Liste');
  });

  it('löst beim Bestätigen den Lösch-Callback aus', () => {
    render(<AppDialogs {...baseProps} rosterToDelete={{ id: 'r-1', name: 'Meine Liste' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(baseProps.onConfirmRosterDeletion).toHaveBeenCalled();
  });

  it('verdrahtet die Schließen-/Abbrechen-Callbacks', () => {
    render(<AppDialogs {...baseProps} />);

    expect(settingsProps.current.onClose).toBe(baseProps.onCloseSettings);
    expect(newRosterProps.current.onClose).toBe(baseProps.onCloseNewRosterModal);
    expect(confirmProps.current.onClose).toBe(baseProps.onCancelRosterDeletion);
  });
});
