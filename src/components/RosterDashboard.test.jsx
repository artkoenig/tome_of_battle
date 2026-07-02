import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterDashboard from './RosterDashboard';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Trash2: () => <span data-testid="icon-trash" />,
  Play: () => <span data-testid="icon-play" />,
  Edit3: () => <span data-testid="icon-edit" />,
}));

describe('RosterDashboard Component', () => {
  const mockOpenRoster = vi.fn();
  const mockDeleteRoster = vi.fn();
  const mockNewRoster = vi.fn();

  const mockSystems = [
    {
      id: 'sys-1',
      name: 'Warhammer Fantasy',
      costTypes: [{ id: 'pts', name: 'Punkte' }],
      catalogues: [{ id: 'cat-1', name: 'Empire' }]
    }
  ];

  const mockRosters = [
    {
      id: 'roster-1',
      name: 'Empire Army',
      systemId: 'sys-1',
      catalogueId: 'cat-1',
      costLimit: 2000,
      costLimitType: 'pts'
    }
  ];

  it('renders the empty state when no rosters exist', () => {
    render(
      <RosterDashboard
        rosters={[]}
        systems={mockSystems}
        onOpenRoster={mockOpenRoster}
        onDeleteRoster={mockDeleteRoster}
        onNewRoster={mockNewRoster}
      />
    );

    expect(screen.getByText('Die Waffenkammern sind leer')).toBeDefined();
    expect(screen.getByText(/Noch wehen keine Banner in deinem Heerlager/)).toBeDefined();
    
    const newBtn = screen.getByText('Erste Armeeliste ausheben');
    fireEvent.click(newBtn);
    expect(mockNewRoster).toHaveBeenCalledTimes(1);
  });

  it('renders grouped rosters when they exist', () => {
    render(
      <RosterDashboard
        rosters={mockRosters}
        systems={mockSystems}
        onOpenRoster={mockOpenRoster}
        onDeleteRoster={mockDeleteRoster}
        onNewRoster={mockNewRoster}
      />
    );

    expect(screen.getByText('Warhammer Fantasy')).toBeDefined();
    expect(screen.getByText('Empire')).toBeDefined();
    expect(screen.getByText('Empire Army')).toBeDefined();
    expect(screen.getByText('2000')).toBeDefined();
    expect(screen.getByText('Pkt.')).toBeDefined();
  });

  it('calls correct actions on button clicks', () => {
    render(
      <RosterDashboard
        rosters={mockRosters}
        systems={mockSystems}
        onOpenRoster={mockOpenRoster}
        onDeleteRoster={mockDeleteRoster}
        onNewRoster={mockNewRoster}
      />
    );

    // Klick auf "Ausrüsten"
    const editBtn = screen.getByText('Ausrüsten');
    fireEvent.click(editBtn);
    expect(mockOpenRoster).toHaveBeenCalledWith(mockRosters[0], 'builder');

    // Klick auf "Spielen"
    const playBtn = screen.getByText('Spielen');
    fireEvent.click(playBtn);
    expect(mockOpenRoster).toHaveBeenCalledWith(mockRosters[0], 'play');

    // Klick auf Löschen
    const deleteBtn = screen.getByTestId('icon-trash').closest('button');
    fireEvent.click(deleteBtn);
    expect(mockDeleteRoster).toHaveBeenCalledWith('roster-1', expect.any(Object));
  });

  describe('Roster Title Editing', () => {
    it('shows input field when clicking the title and renames on blur', () => {
      const mockRename = vi.fn();
      render(
        <RosterDashboard
          rosters={mockRosters}
          systems={mockSystems}
          onOpenRoster={mockOpenRoster}
          onDeleteRoster={mockDeleteRoster}
          onRenameRoster={mockRename}
          onNewRoster={mockNewRoster}
        />
      );

      const titleContainer = screen.getByTitle('Titel bearbeiten');
      fireEvent.click(titleContainer);

      const nameInput = screen.getByRole('textbox');
      expect(nameInput.value).toBe('Empire Army');

      fireEvent.change(nameInput, { target: { value: 'New Name' } });
      fireEvent.blur(nameInput);

      expect(mockRename).toHaveBeenCalledWith(mockRosters[0], 'New Name');
    });

    it('renames on Enter key', () => {
      const mockRename = vi.fn();
      render(
        <RosterDashboard
          rosters={mockRosters}
          systems={mockSystems}
          onOpenRoster={mockOpenRoster}
          onDeleteRoster={mockDeleteRoster}
          onRenameRoster={mockRename}
          onNewRoster={mockNewRoster}
        />
      );

      fireEvent.click(screen.getByTitle('Titel bearbeiten'));
      const nameInput = screen.getByRole('textbox');
      fireEvent.change(nameInput, { target: { value: 'Another Name' } });
      fireEvent.keyDown(nameInput, { key: 'Enter', code: 'Enter' });

      expect(mockRename).toHaveBeenCalledWith(mockRosters[0], 'Another Name');
    });

    it('cancels editing on Escape without renaming', () => {
      const mockRename = vi.fn();
      render(
        <RosterDashboard
          rosters={mockRosters}
          systems={mockSystems}
          onOpenRoster={mockOpenRoster}
          onDeleteRoster={mockDeleteRoster}
          onRenameRoster={mockRename}
          onNewRoster={mockNewRoster}
        />
      );

      fireEvent.click(screen.getByTitle('Titel bearbeiten'));
      const nameInput = screen.getByRole('textbox');
      fireEvent.change(nameInput, { target: { value: 'Ignored Name' } });
      fireEvent.keyDown(nameInput, { key: 'Escape', code: 'Escape' });

      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.getByText('Empire Army')).toBeDefined();
      expect(mockRename).not.toHaveBeenCalled();
    });
  });
});
