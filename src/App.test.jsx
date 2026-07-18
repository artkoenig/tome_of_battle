import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import App, { getDiffChanges } from './App';
import { getAllSystems, getAllRosters } from './db/database';
import { runSystemMigrations } from './db/migrations';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  BookOpen: () => <span data-testid="icon-book" />,
  FolderOpen: () => <span data-testid="icon-folder" />,
  Plus: () => <span data-testid="icon-plus" />,
  Trash2: () => <span data-testid="icon-trash" />,
  Shield: () => <span data-testid="icon-shield" />,
  Play: () => <span data-testid="icon-play" />,
  Edit3: () => <span data-testid="icon-edit" />,
  Search: () => <span data-testid="icon-search" />,
  WifiOff: () => <span data-testid="icon-wifioff" />,
  Download: () => <span data-testid="icon-download" />,
  Settings: () => <span data-testid="icon-settings" />,
  X: () => <span data-testid="icon-x" />,
}));


// Mock DB and Migrations
vi.mock('./db/database', () => ({
  getAllSystems: vi.fn().mockResolvedValue([]),
  getAllRosters: vi.fn().mockResolvedValue([]),
  saveRoster: vi.fn().mockResolvedValue(null),
  deleteRoster: vi.fn().mockResolvedValue(null),
  getWhfb6LinkingEnabled: vi.fn().mockResolvedValue(true),
  setWhfb6LinkingEnabled: vi.fn().mockResolvedValue(undefined),
  WHFB6_LINKING_DEFAULT: true,
}));

vi.mock('./db/migrations', () => ({
  runSystemMigrations: vi.fn((systems) => Promise.resolve({ systems: systems || [], failures: [] })),
}));

// Mock child components. The Importer mock exposes a button that invokes the
// `onSystemImported` callback so tests can drive the post-import flow.
vi.mock('./components/Importer', () => ({
  default: ({ onSystemImported }) => (
    <div data-testid="importer-mock">
      Importer Mock
      <button data-testid="trigger-import" onClick={() => onSystemImported?.()}>Import</button>
    </div>
  ),
}));
vi.mock('./components/RosterEditor', () => ({ default: () => <div data-testid="editor-mock">RosterEditor Mock</div> }));
vi.mock('./components/PlayMode', () => ({ default: () => <div data-testid="playmode-mock">PlayMode Mock</div> }));
vi.mock('./components/editor/NewRosterModal', () => ({ default: () => <div data-testid="new-roster-modal-mock">New Roster Modal Mock</div> }));
vi.mock('./components/RosterDashboard', () => ({ default: () => <div data-testid="dashboard-mock">RosterDashboard Mock</div> }));

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

describe('App first-import catalog decoupling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllRosters.mockResolvedValue([]);
  });

  it('navigates to the dashboard after import without waiting for the network catalog refresh', async () => {
    const importedSystem = { id: 'sys-1', name: 'Imported System' };
    // Empty at mount, then populated once the import has written to IndexedDB.
    getAllSystems.mockResolvedValueOnce([]).mockResolvedValue([importedSystem]);
    // A slow/hanging network refresh that never resolves — the bug was that the
    // navigation awaited exactly this call.
    runSystemMigrations.mockReturnValue(new Promise(() => {}));

    render(<App />);

    // With no systems yet, the empty-state Importer is shown.
    const importButton = await screen.findByTestId('trigger-import');
    await act(async () => {
      fireEvent.click(importButton);
    });

    // The dashboard must appear even though runSystemMigrations is still pending,
    // proving leaving the import view is no longer gated on the network refresh.
    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-mock')).not.toBeNull();
    });
  });

  it('still surfaces the failure toast when the background catalog refresh reports failures', async () => {
    const storedSystem = { id: 'sys-1', name: 'Stored System' };
    getAllSystems.mockResolvedValue([storedSystem]);
    runSystemMigrations.mockResolvedValue({
      systems: [storedSystem],
      failures: [{ id: 'sys-1', name: 'Stored System' }],
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText(/Konnte folgende Systeme nicht aktualisieren/)).not.toBeNull();
      expect(screen.queryByText(/Stored System/)).not.toBeNull();
    });
  });
});


