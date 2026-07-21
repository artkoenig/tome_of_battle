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
  Download: () => <span data-testid="icon-download" />,
  Upload: () => <span data-testid="icon-upload" />,
  WifiOff: () => <span data-testid="icon-wifioff" />,
  MoreVertical: () => <span data-testid="icon-more-vertical" />,
}));

// Mock BottomSheet
vi.mock('./editor/BottomSheet', () => ({
  default: ({ children, isOpen, title }) => isOpen ? (
    <div data-testid="bottom-sheet">
      <h3>{title}</h3>
      {children}
    </div>
  ) : null
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
    expect(screen.getByText('Punkte')).toBeDefined();
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
    });
  });

  describe('Roster Import & Export', () => {
    it('calls onImportRoster when a file is selected', () => {
      const mockImport = vi.fn();
      render(
        <RosterDashboard
          rosters={[]}
          systems={mockSystems}
          onImportRoster={mockImport}
        />
      );
      
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).not.toBeNull();
      
      const file = new File(['mock content'], 'test.rosz', { type: 'application/zip' });
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      expect(mockImport).toHaveBeenCalledWith(file);
    });

    it('calls onExportRoster when clicking the Exportieren button', () => {
      const mockExport = vi.fn();
      render(
        <RosterDashboard
          rosters={mockRosters}
          systems={mockSystems}
          onExportRoster={mockExport}
        />
      );
      
      const exportBtn = screen.getByTitle('Liste exportieren');
      expect(exportBtn).not.toBeNull();
      fireEvent.click(exportBtn);
      
      expect(mockExport).toHaveBeenCalledWith(mockRosters[0]);
    });
  });

  describe('Mobile Action Sheet', () => {
    it('opens BottomSheet with options when clicking mobile FAB and invokes handlers', () => {
      const mockImport = vi.fn();
      const mockNewRoster = vi.fn();

      render(
        <RosterDashboard
          rosters={mockRosters}
          systems={mockSystems}
          onNewRoster={mockNewRoster}
          onImportRoster={mockImport}
        />
      );

      // BottomSheet should be closed initially
      expect(screen.queryByTestId('bottom-sheet')).toBeNull();

      // Click FAB button
      const fabBtn = screen.getByTitle('Aktionen');
      expect(fabBtn).not.toBeNull();
      fireEvent.click(fabBtn);

      // BottomSheet should be open
      expect(screen.getByTestId('bottom-sheet')).not.toBeNull();
      expect(screen.getByText('Armee-Aktionen')).toBeDefined();

      // Test "Neue Armeeliste ausheben"
      const newRosterOption = screen.getByText('Neue Armeeliste ausheben');
      fireEvent.click(newRosterOption);
      expect(mockNewRoster).toHaveBeenCalledTimes(1);

      // BottomSheet should close
      expect(screen.queryByTestId('bottom-sheet')).toBeNull();

      // Open FAB again to test import
      fireEvent.click(screen.getByTitle('Aktionen'));

      // Test "Armeeliste importieren" - should trigger file input click
      const fileInput = document.querySelector('input[type="file"]');
      const clickSpy = vi.spyOn(fileInput, 'click');

      const importOption = screen.getByText('Armeeliste importieren');
      fireEvent.click(importOption);

      expect(clickSpy).toHaveBeenCalled();
      expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    });
  });
});
