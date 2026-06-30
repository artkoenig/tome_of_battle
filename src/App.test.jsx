import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  BookOpen: () => <span data-testid="icon-book" />,
  FolderOpen: () => <span data-testid="icon-folder" />,
  Plus: () => <span data-testid="icon-plus" />,
  Trash2: () => <span data-testid="icon-trash" />,
  Shield: () => <span data-testid="icon-shield" />,
  Play: () => <span data-testid="icon-play" />,
  Edit3: () => <span data-testid="icon-edit" />,
  Bug: () => <span data-testid="icon-bug" />,
  Search: () => <span data-testid="icon-search" />,
  WifiOff: () => <span data-testid="icon-wifioff" />,
  Download: () => <span data-testid="icon-download" />,
}));

// Mock DB and Migrations
vi.mock('./db/database', () => ({
  getAllSystems: vi.fn().mockResolvedValue([]),
  getAllRosters: vi.fn().mockResolvedValue([]),
  saveRoster: vi.fn().mockResolvedValue(null),
  deleteRoster: vi.fn().mockResolvedValue(null),
}));

vi.mock('./db/migrations', () => ({
  runSystemMigrations: vi.fn((systems) => Promise.resolve(systems || [])),
}));

// Mock child components
vi.mock('./components/Importer', () => ({ default: () => <div data-testid="importer-mock">Importer Mock</div> }));
vi.mock('./components/RosterEditor', () => ({ default: () => <div data-testid="editor-mock">RosterEditor Mock</div> }));
vi.mock('./components/PlayMode', () => ({ default: () => <div data-testid="playmode-mock">PlayMode Mock</div> }));
vi.mock('./components/editor/DebugEntryEditorModal', () => ({ default: () => <div data-testid="debug-modal-mock">Debug Modal Mock</div> }));
vi.mock('./components/editor/GlobalDebugSearch', () => ({ default: () => <div data-testid="global-debug-search-mock">Global Debug Search Mock</div> }));
vi.mock('./components/editor/NewRosterModal', () => ({ default: () => <div data-testid="new-roster-modal-mock">New Roster Modal Mock</div> }));
vi.mock('./components/RosterDashboard', () => ({ default: () => <div data-testid="dashboard-mock">RosterDashboard Mock</div> }));

// Mock useDebugMode
let mockShowDebugIds = false;
const mockToggleShowDebugIds = vi.fn();
vi.mock('./hooks/DebugContext', () => ({
  useDebugMode: () => ({
    showDebugIds: mockShowDebugIds,
    toggleShowDebugIds: mockToggleShowDebugIds
  })
}));

describe('App Component Debug Button local filtering', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    mockShowDebugIds = false;
    
    // Set up default window.location spy
    delete window.location;
    window.location = { ...originalLocation, hostname: 'localhost' };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('renders the debug button when hostname is localhost', async () => {
    render(<App />);
    
    // The button has title="Debugging: IDs ein-/ausblenden" and content "Debug"
    await waitFor(() => {
      const debugButton = screen.queryByTitle('Debugging: IDs ein-/ausblenden');
      expect(debugButton).not.toBeNull();
    });
  });

  it('does NOT render the debug button when hostname is not local (e.g. example.com)', async () => {
    window.location = { ...originalLocation, hostname: 'tomeofbattle.com' };
    
    render(<App />);
    
    await waitFor(() => {
      const debugButton = screen.queryByTitle('Debugging: IDs ein-/ausblenden');
      expect(debugButton).toBeNull();
    });
  });
});
