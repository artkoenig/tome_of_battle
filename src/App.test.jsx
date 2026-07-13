import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import App, { getDiffChanges } from './App';

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
  X: () => <span data-testid="icon-x" />,
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

describe('App Component PWA Update Toast Notification', () => {
  it('displays the toast notification when pwa-update-available is dispatched', async () => {
    render(<App />);

    // Create a mock service worker
    const mockWorker = {
      postMessage: vi.fn()
    };

    // Dispatch the custom event
    const event = new CustomEvent('pwa-update-available', { detail: mockWorker });
    await act(async () => {
      window.dispatchEvent(event);
    });

    // Verify the toast is visible
    await waitFor(() => {
      expect(screen.queryByText('Chronik der Veränderungen')).not.toBeNull();
      expect(screen.queryByText('Eine neue Version wurde im Hintergrund geladen.')).not.toBeNull();
    });

    // Find and click the reload button
    const reloadButton = screen.getByRole('button', { name: 'Neu laden' });
    await act(async () => {
      fireEvent.click(reloadButton);
    });

    // Verify it sent the SKIP_WAITING message to the service worker
    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('shows the current version changes carried by the update event', async () => {
    render(<App />);

    const mockWorker = { postMessage: vi.fn() };
    const detail = {
      worker: mockWorker,
      release: { version: 'v1.2.0', date: '2026-07-04', changes: ['Neues Feature A', 'Bugfix B'] },
    };

    const event = new CustomEvent('pwa-update-available', { detail });
    await act(async () => {
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(screen.queryByText('Chronik der Veränderungen')).not.toBeNull();
      expect(screen.queryByText(/Version v1\.2\.0/)).not.toBeNull();
      expect(screen.queryByText('Neues Feature A')).not.toBeNull();
      expect(screen.queryByText('Bugfix B')).not.toBeNull();
    });

    // The generic fallback description must not appear when changes are present.
    expect(screen.queryByText('Eine neue Version wurde im Hintergrund geladen.')).toBeNull();
  });

  describe('getDiffChanges Utility', () => {
    it('returns legacy changes if commits or tags are missing', () => {
      const release = { changes: ['Commit A', 'Commit B'] };
      expect(getDiffChanges('v1.0.0', release)).toEqual(['Commit A', 'Commit B']);
    });

    it('filters commits based on installed tag version', () => {
      const release = {
        commits: [
          { hash: 'aaaaaaa', subject: 'feat: Commit 3' },
          { hash: 'bbbbbbb', subject: 'feat: Commit 2' },
          { hash: 'ccccccc', subject: 'feat: Commit 1' }
        ],
        tags: [
          { name: 'v1.1.0', hash: 'aaaaaaa' },
          { name: 'v1.0.0', hash: 'bbbbbbb' }
        ]
      };
      expect(getDiffChanges('v1.0.0', release)).toEqual(['feat: Commit 3']);
    });

    it('filters commits based on installed hash version (+hash)', () => {
      const release = {
        commits: [
          { hash: 'aaaaaaa', subject: 'feat: Commit 3' },
          { hash: 'bbbbbbb', subject: 'feat: Commit 2' },
          { hash: 'ccccccc', subject: 'feat: Commit 1' }
        ],
        tags: []
      };
      expect(getDiffChanges('v1.0.0+bbbbbbb', release)).toEqual(['feat: Commit 3']);
    });

    it('falls back to showing first 50 commits + message if installed version not found', () => {
      const release = {
        commits: Array.from({ length: 60 }, (_, i) => ({ hash: i.toString(16).padStart(7, 'a'), subject: `feat: Commit ${i}` })),
        tags: []
      };
      const diff = getDiffChanges('v1.0.0', release);
      expect(diff.length).toBe(51);
      expect(diff[50]).toBe('...und weitere Einträge.');
    });

    it('caps diff at 50 commits + message if diff is too large', () => {
      const commits = Array.from({ length: 60 }, (_, i) => ({ hash: i.toString(16).padStart(7, 'a'), subject: `feat: Commit ${i}` }));
      const release = {
        commits,
        tags: [
          { name: 'v1.0.0', hash: (55).toString(16).padStart(7, 'a') }
        ]
      };
      const diff = getDiffChanges('v1.0.0', release);
      expect(diff.length).toBe(51);
      expect(diff[50]).toBe('...und weitere Einträge.');
    });
  });
});

vi.mock('./parser/catalogEditor', () => ({
  findExactEntryById: vi.fn(),
  searchEditableEntries: vi.fn(),
}));

describe('App Component Debug Entry Click Redirection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowDebugIds = true;
  });

  it('redirects entryLink to target selectionEntry on global click', async () => {
    const mockLinkEntry = {
      type: 'entryLink',
      id: 'link-123',
      name: 'Linked Weapon',
      ref: { targetId: 'target-456' }
    };
    const mockTargetEntry = {
      type: 'entry',
      id: 'target-456',
      name: 'Real Weapon',
      ref: { name: 'Real Weapon' }
    };

    const { getAllSystems } = await import('./db/database');
    const mockGst = { id: 'sys-1', name: 'Test System', catalogues: [] };
    getAllSystems.mockResolvedValue([mockGst]);

    const { findExactEntryById } = await import('./parser/catalogEditor');
    findExactEntryById.mockImplementation((sys, id) => {
      if (id === 'link-123') return mockLinkEntry;
      if (id === 'target-456') return mockTargetEntry;
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-mock')).not.toBeNull();
    });

    const badge = document.createElement('span');
    badge.className = 'debug-id-badge clickable';
    badge.textContent = 'link-123';
    document.body.appendChild(badge);

    await act(async () => {
      fireEvent.click(badge);
    });

    document.body.removeChild(badge);

    expect(findExactEntryById).toHaveBeenCalledWith(mockGst, 'target-456');
  });
});
