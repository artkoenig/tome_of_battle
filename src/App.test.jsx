import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import App from './App';
import { getAllSystems, getAllRosters, saveRoster } from './db/database';
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
// The dashboard and editor mocks expose the roster they are given (and the
// dashboard's callbacks), so tests can drive App's navigation and observe which
// roster state the open view actually renders.
const { dashboardProps, editorProps } = vi.hoisted(() => ({
  dashboardProps: { current: null },
  editorProps: { current: null },
}));

vi.mock('./components/RosterEditor', () => ({
  default: (props) => {
    editorProps.current = props;
    return <div data-testid="editor-mock">{props.roster?.name}</div>;
  },
}));
vi.mock('./components/PlayMode', () => ({ default: ({ roster }) => <div data-testid="playmode-mock">{roster?.name}</div> }));
vi.mock('./components/editor/NewRosterModal', () => ({ default: () => <div data-testid="new-roster-modal-mock">New Roster Modal Mock</div> }));
vi.mock('./components/RosterDashboard', () => ({
  default: (props) => {
    dashboardProps.current = props;
    return <div data-testid="dashboard-mock">RosterDashboard Mock</div>;
  },
}));

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

describe('App roster selection derived from the roster list', () => {
  const system = { id: 'sys-1', name: 'Stored System' };
  const roster = { id: 'roster-1', name: 'Alter Name', systemId: 'sys-1' };

  beforeEach(async () => {
    vi.clearAllMocks();
    dashboardProps.current = null;
    editorProps.current = null;
    getAllSystems.mockResolvedValue([system]);
    getAllRosters.mockResolvedValue([roster]);
    runSystemMigrations.mockImplementation((systems) =>
      Promise.resolve({ systems: systems || [], failures: [] })
    );
  });

  const renderAppAndOpenBuilder = async () => {
    render(<App />);
    await waitFor(() => expect(dashboardProps.current).not.toBeNull());
    await act(async () => {
      dashboardProps.current.onOpenRoster(roster, 'builder');
    });
    await waitFor(() => expect(screen.queryByTestId('editor-mock')).not.toBeNull());
  };

  it('renames a roster and reflects the new name in the open view immediately', async () => {
    await renderAppAndOpenBuilder();
    expect(screen.getByTestId('editor-mock').textContent).toBe('Alter Name');

    // The rename writes to IndexedDB and reloads the list — the open view must
    // follow that list instead of holding on to a stale roster copy.
    const renamed = { ...roster, name: 'Neuer Name' };
    getAllRosters.mockResolvedValue([renamed]);

    await act(async () => {
      await dashboardProps.current.onRenameRoster(roster, 'Neuer Name');
    });

    expect(saveRoster).toHaveBeenCalledWith(renamed);
    await waitFor(() => {
      expect(screen.getByTestId('editor-mock').textContent).toBe('Neuer Name');
    });
  });

  it('carries the editor state into play mode when switching views', async () => {
    await renderAppAndOpenBuilder();

    const editedRoster = { ...roster, name: 'Im Editor geändert' };
    await act(async () => {
      editorProps.current.onPlay(editedRoster);
    });

    await waitFor(() => {
      expect(screen.getByTestId('playmode-mock').textContent).toBe('Im Editor geändert');
    });
  });

  it('restores the selected roster from a browser back navigation', async () => {
    await renderAppAndOpenBuilder();

    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', {
        state: { view: 'rosters', rosterId: null },
      }));
    });
    await waitFor(() => expect(screen.queryByTestId('dashboard-mock')).not.toBeNull());

    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', {
        state: { view: 'builder', rosterId: roster.id },
      }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('editor-mock').textContent).toBe('Alter Name');
    });
  });
});


