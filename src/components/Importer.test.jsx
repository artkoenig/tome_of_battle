import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Importer, { transformIndexToSystems, findMissingLibraryDependencies } from './Importer';
import { getAllSystems, saveSystem, deleteSystem } from '../db/database';
import { extractZipFiles } from '../parser/zipExtractor';
import { processImportedData } from '../parser/xmlParser';
import { collectSchemaWarnings } from '../parser/importSchemaGate';
import { clearCatalogIndexCache } from '../db/catalogUpdate';
import JSZip from 'jszip';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  Upload: () => <span data-testid="icon-upload" />,
  Trash2: () => <span data-testid="icon-trash" />,
  FileText: () => <span data-testid="icon-file-text" />,
  CheckCircle2: () => <span data-testid="icon-check-circle" />,
  ShieldAlert: () => <span data-testid="icon-shield-alert" />,
  Edit: () => <span data-testid="icon-edit" />,
  Download: () => <span data-testid="icon-download" />,
  X: () => <span data-testid="icon-x" />,
}));


// Mock database
vi.mock('../db/database', () => ({
  getAllSystems: vi.fn(),
  saveSystem: vi.fn(),
  deleteSystem: vi.fn(),
}));

// Mock zipExtractor
vi.mock('../parser/zipExtractor', () => ({
  extractZipFiles: vi.fn(),
}));

// Mock xmlParser
vi.mock('../parser/xmlParser', () => ({
  processImportedData: vi.fn(),
}));

// Mock the import schema advisory. These component tests use synthetic/mock file
// content that is not real BattleScribe XML, so the collector reports no warnings by
// default; individual tests override it to simulate a schema-flagged import.
vi.mock('../parser/importSchemaGate', () => ({
  collectSchemaWarnings: vi.fn().mockResolvedValue([]),
}));

// Mock JSZip
const mockZipFile = vi.fn();
const mockZipGenerateAsync = vi.fn().mockResolvedValue(new Blob(['mock zip content'], { type: 'application/zip' }));
vi.mock('jszip', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      file: mockZipFile,
      generateAsync: mockZipGenerateAsync
    }))
  };
});

// The real catalogUpdate module is used unmocked: CATALOG_SOURCES now provides the real
// per-source raw base URLs, and the fetch stubs below match on file-name substrings, so
// no URL override is needed.

// The multi-source importer loads every CATALOG_SOURCES entry at mount (ADR 0016). A
// test that asserts on a single dataset serves it on the Lexicanum source and leaves the
// other source's index empty, so exactly one system set appears in the dropdown.
const LEXICANUM_CATPKG_URL_PART = 'Warhammer-Fantasy-Battles-6th-Definitive-edition/main/catpkg.json';
const ERGOFARG_SYSTEM_ID = '6d8e-38d9-3c69-febf';
const LEXICANUM_SYSTEM_ID = '0d13-7737-ea86-4662';

function makeCatpkgJsonResponse(index) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(index),
    text: () => Promise.resolve(JSON.stringify(index)),
  });
}

// Returns a catpkg response when `url` targets any source's index — the given `index`
// for the Lexicanum source, an empty index for every other source — or null when the
// URL is not a catpkg request (so callers fall through to their file-fetch handling).
function respondToCatpkg(url, index) {
  if (!url.includes('catpkg.json')) return null;
  const served = url.includes(LEXICANUM_CATPKG_URL_PART) ? index : { repositoryFiles: [] };
  return makeCatpkgJsonResponse(served);
}

describe('transformIndexToSystems', () => {
  const findCatalogue = (system, id) => system.catalogues.find(cat => cat.id === id);

  it('returns an empty list for a missing or empty index', () => {
    expect(transformIndexToSystems(null)).toEqual([]);
    expect(transformIndexToSystems({})).toEqual([]);
    expect(transformIndexToSystems({ repositoryFiles: [] })).toEqual([]);
  });

  it('passes the revision through for the game system and every catalogue', () => {
    const index = {
      repositoryFiles: [
        { id: 'sys-1', name: 'System One', type: 'gamesystem', revision: 5 },
        { id: 'cat-1', name: 'Bravo', type: 'catalogue', revision: 7 },
        { id: 'cat-2', name: 'Alpha', type: 'catalogue', revision: 3 }
      ]
    };

    const [system] = transformIndexToSystems(index);

    expect(system.gst.revision).toBe(5);
    expect(findCatalogue(system, 'cat-1').revision).toBe(7);
    expect(findCatalogue(system, 'cat-2').revision).toBe(3);
  });

  it('uses the index entry path as the file name, not a name-derived one', () => {
    // Upstream file names are not derivable from the catalogue name (e.g. name
    // "Chaos Dwarfs" vs file "Chaos Dwarves (6th definitive edition).cat").
    const index = {
      repositoryFiles: [
        { id: 'sys-1', name: 'System One', path: 'System One (6th definitive edition).gst', type: 'gamesystem', revision: 5 },
        { id: 'cat-1', name: 'Chaos Dwarfs', path: 'Chaos Dwarves (6th definitive edition).cat', type: 'catalogue', revision: 7 }
      ]
    };

    const [system] = transformIndexToSystems(index);

    expect(system.gst.fileName).toBe('System One (6th definitive edition).gst');
    expect(findCatalogue(system, 'cat-1').fileName).toBe('Chaos Dwarves (6th definitive edition).cat');
  });

  it('does not throw and yields an undefined revision when the index entry omits it', () => {
    const index = {
      repositoryFiles: [
        { id: 'sys-1', name: 'System One', type: 'gamesystem' },
        { id: 'cat-1', name: 'Alpha', type: 'catalogue' }
      ]
    };

    let systems;
    expect(() => {
      systems = transformIndexToSystems(index);
    }).not.toThrow();

    expect(systems[0].gst.revision).toBeUndefined();
    expect(findCatalogue(systems[0], 'cat-1').revision).toBeUndefined();
  });
});

describe('findMissingLibraryDependencies', () => {
  const availableCatalogues = [
    { id: 'dogs', name: 'Dogs of War' },
    { id: 'merc', name: 'Mercenaries' },
    { id: 'empire', name: 'Empire' },
  ];

  it('flags a catalogueLink target that exists but was left out of the selection', () => {
    const loadedCatalogues = [
      { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'merc', name: 'Mercenaries' }] },
    ];

    const missing = findMissingLibraryDependencies(loadedCatalogues, new Set(['dogs']), availableCatalogues);

    expect(missing).toEqual([{ id: 'merc', name: 'Mercenaries', requiredBy: ['Dogs of War'] }]);
  });

  it('returns nothing when the linked target is part of the selection', () => {
    const loadedCatalogues = [
      { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'merc', name: 'Mercenaries' }] },
      { id: 'merc', name: 'Mercenaries', catalogueLinks: [] },
    ];

    const missing = findMissingLibraryDependencies(loadedCatalogues, new Set(['dogs', 'merc']), availableCatalogues);

    expect(missing).toEqual([]);
  });

  it('ignores a target that is not a selectable catalogue at all', () => {
    const loadedCatalogues = [
      { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'ghost', name: 'Phantom' }] },
    ];

    const missing = findMissingLibraryDependencies(loadedCatalogues, new Set(['dogs']), availableCatalogues);

    expect(missing).toEqual([]);
  });

  it('deduplicates a shared missing dependency and lists every referencing catalogue', () => {
    const loadedCatalogues = [
      { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'merc' }] },
      { id: 'empire', name: 'Empire', catalogueLinks: [{ targetId: 'merc' }] },
    ];

    const missing = findMissingLibraryDependencies(loadedCatalogues, new Set(['dogs', 'empire']), availableCatalogues);

    expect(missing).toEqual([{ id: 'merc', name: 'Mercenaries', requiredBy: ['Dogs of War', 'Empire'] }]);
  });

  it('tolerates catalogues without catalogueLinks', () => {
    const loadedCatalogues = [{ id: 'empire', name: 'Empire' }];

    const missing = findMissingLibraryDependencies(loadedCatalogues, new Set(['empire']), availableCatalogues);

    expect(missing).toEqual([]);
  });
});

describe('Importer Component', () => {
  // These tests exercise the stored-systems / upload flows, not the bundle index.
  // Still, the component fetches the catalog index on mount; without a stub that
  // would be a real network request whose async failure state ("index unavailable")
  // races with the assertions below. Stub it with a valid but empty index so mount
  // resolves deterministically and offline. Tests that need a populated index
  // (nested describes below) install their own fetch spy on top.
  let indexFetchSpy;

  beforeEach(() => {
    clearCatalogIndexCache();
    vi.clearAllMocks();
    getAllSystems.mockResolvedValue([]);
    deleteSystem.mockResolvedValue({});
    saveSystem.mockResolvedValue({});
    const emptyIndex = { repositoryFiles: [] };
    indexFetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyIndex),
      text: () => Promise.resolve(JSON.stringify(emptyIndex)),
    });
  });

  afterEach(() => {
    indexFetchSpy.mockRestore();
  });

  it('1. Render Empty State', async () => {
    render(<Importer showAsEmptyState={true} onSystemImported={vi.fn()} />);

    expect(screen.getByText('Willkommen bei Tome of Battle')).toBeDefined();
    expect(screen.queryByText('Eigene Spieldaten hochladen')).toBeNull();
    
    // Check that systems list container is not rendered
    expect(screen.queryByText('Importierte Spielsysteme')).toBeNull();

    await waitFor(() => {
      expect(getAllSystems).toHaveBeenCalled();
    });
  });

  it('2. Render Empty System List', async () => {
    getAllSystems.mockResolvedValue([]);
    render(<Importer showAsEmptyState={false} onSystemImported={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Keine Spielsysteme in der Datenbank vorhanden.')).toBeDefined();
    });
    expect(screen.getByText('Importierte Spielsysteme')).toBeDefined();
  });

  it('3. Render Systems List', async () => {
    const mockSystems = [
      { id: 'sys-1', name: 'Warhammer Fantasy', catalogues: [{ id: 'cat-1' }, { id: 'cat-2' }] },
      { id: 'sys-2', name: 'Warhammer 40k', catalogues: [{ id: 'cat-3' }] }
    ];
    getAllSystems.mockResolvedValue(mockSystems);

    render(<Importer showAsEmptyState={false} onSystemImported={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Warhammer Fantasy')).toBeDefined();
      expect(screen.getByText('Warhammer 40k')).toBeDefined();
    });

    expect(screen.getByText('2 Fraktionskataloge geladen')).toBeDefined();
    expect(screen.getByText('1 Fraktionskataloge geladen')).toBeDefined();
    expect(screen.getAllByTestId('icon-download').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('icon-trash').length).toBeGreaterThan(0);
  });

  it('should render loading overlay during import', async () => {
    let resolveZip;
    const zipPromise = new Promise((resolve) => {
      resolveZip = resolve;
    });
    extractZipFiles.mockReturnValue(zipPromise);
    processImportedData.mockReturnValue({ id: 'dummy', catalogues: [] });
    saveSystem.mockResolvedValue({});

    const { container } = render(<Importer showAsEmptyState={false} />);
    const file = new File(['zipcontent'], 'game_system.zip', { type: 'application/zip' });
    const fileInput = container.querySelector('#file-upload');

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Verify loading overlay is visible
    expect(screen.getByText('Beschwöre Spieldaten...')).toBeDefined();
    expect(container.querySelector('.modal-overlay')).not.toBeNull();
    expect(container.querySelector('.gothic-spinner')).not.toBeNull();

    // Resolve the promise to finish the lifecycle
    resolveZip({ gstFiles: [], catFiles: [] });
    
    await waitFor(() => {
      expect(container.querySelector('.modal-overlay')).toBeNull();
    });
  });

  it('5. Success Import Flow', async () => {
    const onSystemImportedMock = vi.fn();
    const systemData = { id: 'sys-new', name: 'New Imported System', catalogues: [{ id: 'cat-new' }] };
    
    extractZipFiles.mockResolvedValue({ gstFiles: [{ name: 'rules.gst' }], catFiles: [{ name: 'faction.cat' }] });
    processImportedData.mockReturnValue(systemData);
    saveSystem.mockResolvedValue({});
    getAllSystems.mockResolvedValue([]);

    const { container } = render(<Importer showAsEmptyState={false} onSystemImported={onSystemImportedMock} />);

    const file = new File(['zipcontent'], 'game_system.zip', { type: 'application/zip' });
    const fileInput = container.querySelector('#file-upload');

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(extractZipFiles).toHaveBeenCalledWith(file);
      expect(processImportedData).toHaveBeenCalledWith([{ name: 'rules.gst' }], [{ name: 'faction.cat' }]);
      expect(deleteSystem).toHaveBeenCalledWith('sys-new');
      expect(saveSystem).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Imported System' }));
      expect(onSystemImportedMock).toHaveBeenCalled();
    });

    expect(screen.getByText(/erfolgreich importiert/)).toBeDefined();
  });

  it('6. Invalid Extension Rejection', async () => {
    const onSystemImportedMock = vi.fn();
    const { container } = render(<Importer showAsEmptyState={false} onSystemImported={onSystemImportedMock} />);

    const file = new File(['textcontent'], 'game_system.txt', { type: 'text/plain' });
    const fileInput = container.querySelector('#file-upload');

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Bitte lade eine gültige .zip-Datei hoch.')).toBeDefined();
    });

    expect(extractZipFiles).not.toHaveBeenCalled();
    expect(onSystemImportedMock).not.toHaveBeenCalled();
  });

  it('7. Failed Import Flow', async () => {
    const onSystemImportedMock = vi.fn();
    extractZipFiles.mockRejectedValue(new Error('Zip extraction failed'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(<Importer showAsEmptyState={false} onSystemImported={onSystemImportedMock} />);

    const file = new File(['zipcontent'], 'invalid.zip', { type: 'application/zip' });
    const fileInput = container.querySelector('#file-upload');

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Verarbeiten der Datei: Zip extraction failed')).toBeDefined();
    });

    expect(onSystemImportedMock).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('7b. Schema-invalid manual import logs a locatable advisory warning to the console but still imports', async () => {
    const onSystemImportedMock = vi.fn();
    const systemData = { id: 'sys-new', name: 'New Imported System', catalogues: [{ id: 'cat-new' }] };

    extractZipFiles.mockResolvedValue({
      gstFiles: [{ name: 'rules.gst', content: '<gameSystem/>' }],
      catFiles: [{ name: 'faction.cat', content: '<catalogue/>' }],
    });
    processImportedData.mockReturnValue(systemData);
    const locatableMessage =
      'Die Datei „faction.cat" entspricht nicht vollständig dem BattleScribe-Schema (v2.03); ' +
      'der Import wurde dennoch fortgesetzt. 1 Schemaverstoß/-verstöße gefunden. ' +
      'Erster Verstoß (Zeile 4): Element ist nicht erlaubt.';
    collectSchemaWarnings.mockResolvedValueOnce([
      { fileName: 'faction.cat', errors: [{ line: 4, column: null, message: 'Element ist nicht erlaubt.' }], message: locatableMessage },
    ]);
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { container } = render(<Importer showAsEmptyState={false} onSystemImported={onSystemImportedMock} />);

    const file = new File(['zipcontent'], 'game_system.zip', { type: 'application/zip' });
    fireEvent.change(container.querySelector('#file-upload'), { target: { files: [file] } });

    await waitFor(() => {
      expect(onSystemImportedMock).toHaveBeenCalled();
    });

    // The advisory warning is logged to the console (not rendered in the DOM),
    // carrying the locatable message (file + line).
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([locatableMessage])
    );
    expect(screen.queryByTestId('schema-warnings')).toBeNull();

    // Advisory: the flagged file is still parsed and stored; the import proceeds.
    expect(processImportedData).toHaveBeenCalled();
    expect(saveSystem).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Imported System' }));

    consoleWarnSpy.mockRestore();
  });

  it('8. Export & Delete Actions', async () => {
    const mockSystems = [
      { 
        id: 'sys-export', 
        name: 'Export System', 
        catalogues: [], 
        rawXmls: {
          gst: [{ name: 'rules.gst', content: '<gst />' }],
          cat: [{ name: 'faction.cat', content: '<cat />' }]
        } 
      }
    ];
    getAllSystems.mockResolvedValue(mockSystems);
    const onSystemImportedMock = vi.fn();

    const { container } = render(<Importer showAsEmptyState={false} onSystemImported={onSystemImportedMock} />);

    await waitFor(() => {
      expect(screen.getByText('Export System')).toBeDefined();
    });

    // 8a. Test Export Action
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const createObjectUrlMock = vi.fn().mockReturnValue('blob:http://localhost/mock-blob-uuid');
    const revokeObjectUrlMock = vi.fn();
    window.URL.createObjectURL = createObjectUrlMock;
    window.URL.revokeObjectURL = revokeObjectUrlMock;

    // Spy on link.click
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const exportBtn = screen.getByTitle('Spielsystem exportieren (.zip)');
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(JSZip).toHaveBeenCalled();
      expect(mockZipFile).toHaveBeenCalledWith('rules.gst', '<gst />');
      expect(mockZipFile).toHaveBeenCalledWith('faction.cat', '<cat />');
      expect(mockZipGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
      expect(createObjectUrlMock).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectUrlMock).toHaveBeenCalled();
    });

    expect(screen.getByText(/erfolgreich als .zip \(Originalformat\) exportiert/)).toBeDefined();

    // 8b. Test Delete Action (Confirm = true)
    deleteSystem.mockResolvedValue({});

    const deleteBtn = screen.getByTitle('System löschen');
    fireEvent.click(deleteBtn);

    // Wait for the modal and click "Löschen"
    const confirmDeleteBtn = screen.getByRole('button', { name: 'Löschen' });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteSystem).toHaveBeenCalledWith('sys-export');
      expect(onSystemImportedMock).toHaveBeenCalled();
    });

    // 8c. Test Delete Action (Confirm = false)
    deleteSystem.mockClear();
    fireEvent.click(deleteBtn);

    // Wait for the modal and click "Abbrechen"
    const cancelDeleteBtn = screen.getByRole('button', { name: 'Abbrechen' });
    fireEvent.click(cancelDeleteBtn);

    await waitFor(() => {
      expect(screen.queryByText('Spielsystem löschen')).toBeNull();
    });
    expect(deleteSystem).not.toHaveBeenCalled();
  });

  it('11. Export system missing rawXmls error handling', async () => {
    const mockSystems = [
      { id: 'sys-no-xml', name: 'No Xml System', catalogues: [] }
    ];
    getAllSystems.mockResolvedValue(mockSystems);

    render(<Importer showAsEmptyState={false} />);

    await waitFor(() => {
      expect(screen.getByText('No Xml System')).toBeDefined();
    });

    const exportBtn = screen.getByTitle('Spielsystem exportieren (.zip)');
    fireEvent.click(exportBtn);

    expect(screen.getByText(/Dieses Spielsystem wurde vor dem Update importiert und besitzt keine XML-Originaldateien/)).toBeDefined();
  });

  it('12. Failed Delete Action', async () => {
    const mockSystems = [
      { id: 'sys-del-fail', name: 'Delete Fail System', catalogues: [] }
    ];
    getAllSystems.mockResolvedValue(mockSystems);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<Importer showAsEmptyState={false} />);

    await waitFor(() => {
      expect(screen.getByText('Delete Fail System')).toBeDefined();
    });

    deleteSystem.mockRejectedValue(new Error('Delete DB error'));

    const deleteBtn = screen.getByTitle('System löschen');
    fireEvent.click(deleteBtn);

    // Click confirm in modal
    const confirmDeleteBtn = screen.getByRole('button', { name: 'Löschen' });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Löschen des Spielsystems.')).toBeDefined();
    });

    consoleErrorSpy.mockRestore();
  });

  it('13. Failed Export Action', async () => {
    const mockSystems = [
      { 
        id: 'sys-exp-fail', 
        name: 'Export Fail System', 
        catalogues: [], 
        rawXmls: { gst: [], cat: [] } 
      }
    ];
    getAllSystems.mockResolvedValue(mockSystems);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<Importer showAsEmptyState={false} />);

    await waitFor(() => {
      expect(screen.getByText('Export Fail System')).toBeDefined();
    });

    mockZipGenerateAsync.mockRejectedValueOnce(new Error('Zip gen error'));

    const exportBtn = screen.getByTitle('Spielsystem exportieren (.zip)');
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Exportieren des Spielsystems als ZIP: Zip gen error')).toBeDefined();
    });

    consoleErrorSpy.mockRestore();
  });

  describe('Pre-bundled catalogs import', () => {
    let fetchSpy;

    beforeEach(() => {
      const mockIndex = {
        repositoryFiles: [
          {
            id: 'sys-bundle-1',
            name: 'Warhammer Fantasy Bundle',
            type: 'gamesystem',
            revision: 9,
            fileUrl: 'https://raw.githubusercontent.com/artkoenig/Warhammer-Fantasy-6th-edition/master/Warhammer%20Fantasy%20Bundle.gst'
          },
          {
            id: 'cat-bundle-1',
            name: 'Bretonnia',
            type: 'catalogue',
            revision: 8,
            fileUrl: 'https://raw.githubusercontent.com/artkoenig/Warhammer-Fantasy-6th-edition/master/Bretonnia.cat'
          },
          {
            id: 'cat-bundle-2',
            name: 'Empire',
            type: 'catalogue',
            revision: 11,
            fileUrl: 'https://raw.githubusercontent.com/artkoenig/Warhammer-Fantasy-6th-edition/master/Empire.cat'
          }
        ]
      };

      fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url) => {
        const catpkg = respondToCatpkg(url, mockIndex);
        if (catpkg) return catpkg;
        if (url.includes('Warhammer%20Fantasy%20Bundle.gst')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('<gameSystem id="sys-bundle-1" name="Warhammer Fantasy Bundle"></gameSystem>')
          });
        }
        if (url.includes('Bretonnia.cat')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('<catalogue id="cat-bundle-1" name="Bretonnia"></catalogue>')
          });
        }
        if (url.includes('Empire.cat')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('<catalogue id="cat-bundle-2" name="Empire"></catalogue>')
          });
        }
        return Promise.reject(new Error(`Unknown fetch URL: ${url}`));
      });
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('should fetch catalog index and render pre-bundled importer', async () => {
      render(<Importer showAsEmptyState={false} />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('catpkg.json'));
        expect(screen.getByText('Vordefinierte Spieldaten importieren')).toBeDefined();
        expect(screen.getByText('Warhammer Fantasy Bundle')).toBeDefined();
        expect(screen.getByLabelText('Bretonnia')).toBeDefined();
        expect(screen.getByLabelText('Empire')).toBeDefined();
      });
    });

    it('should allow toggling individual catalogs and using select all/none button', async () => {
      render(<Importer showAsEmptyState={false} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Bretonnia')).toBeDefined();
      });

      const bretonniaCheckbox = screen.getByLabelText('Bretonnia');
      const empireCheckbox = screen.getByLabelText('Empire');

      expect(bretonniaCheckbox.checked).toBe(true);
      expect(empireCheckbox.checked).toBe(true);

      fireEvent.click(bretonniaCheckbox);
      expect(bretonniaCheckbox.checked).toBe(false);
      expect(empireCheckbox.checked).toBe(true);

      const toggleAllBtn = screen.getByText('Alle auswählen');
      fireEvent.click(toggleAllBtn);

      expect(bretonniaCheckbox.checked).toBe(true);
      expect(empireCheckbox.checked).toBe(true);

      const toggleNoneBtn = screen.getByText('Alle abwählen');
      fireEvent.click(toggleNoneBtn);

      expect(bretonniaCheckbox.checked).toBe(false);
      expect(empireCheckbox.checked).toBe(false);

      expect(screen.getByText('Alle auswählen')).toBeDefined();
    });

    it('should trigger fetches and import process on clicking import button', async () => {
      const onSystemImportedMock = vi.fn();
      const systemData = { id: 'sys-bundle-1', name: 'Warhammer Fantasy Bundle', catalogues: [{ id: 'cat-bundle-1' }, { id: 'cat-bundle-2' }] };
      processImportedData.mockReturnValue(systemData);
      saveSystem.mockResolvedValue({});

      render(<Importer showAsEmptyState={false} onSystemImported={onSystemImportedMock} />);

      await waitFor(() => {
        expect(screen.getByText('Importieren')).toBeDefined();
      });

      const importBtn = screen.getByText('Importieren');
      fireEvent.click(importBtn);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('Warhammer%20Fantasy%20Bundle.gst'));
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('Bretonnia.cat'));
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('Empire.cat'));

        expect(processImportedData).toHaveBeenCalledWith(
          [{ name: 'Warhammer Fantasy Bundle.gst', content: '<gameSystem id="sys-bundle-1" name="Warhammer Fantasy Bundle"></gameSystem>' }],
          [
            { name: 'Bretonnia.cat', content: '<catalogue id="cat-bundle-1" name="Bretonnia"></catalogue>' },
            { name: 'Empire.cat', content: '<catalogue id="cat-bundle-2" name="Empire"></catalogue>' }
          ]
        );

        expect(deleteSystem).toHaveBeenCalledWith('sys-bundle-1');
        expect(saveSystem).toHaveBeenCalledWith(expect.objectContaining({
          id: 'sys-bundle-1',
          name: 'Warhammer Fantasy Bundle'
        }));

        expect(onSystemImportedMock).toHaveBeenCalled();
      });

      expect(screen.getByText(/Das System "Warhammer Fantasy Bundle" mit 2 Katalogen wurde erfolgreich importiert/)).toBeDefined();
    });
  });

  describe('Library-catalog dependency guard on bundle import', () => {
    let fetchSpy;

    beforeEach(() => {
      const mockIndex = {
        repositoryFiles: [
          { id: 'sys-lex', name: 'WHFB Lexicanum', type: 'gamesystem', revision: 1 },
          { id: 'dogs', name: 'Dogs of War', type: 'catalogue', revision: 1 },
          { id: 'merc', name: 'Mercenaries', type: 'catalogue', revision: 1 }
        ]
      };

      fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url) => {
        const catpkg = respondToCatpkg(url, mockIndex);
        if (catpkg) return catpkg;
        if (url.includes('WHFB%20Lexicanum.gst')) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve('<gameSystem id="sys-lex" />') });
        }
        if (url.includes('Dogs%20of%20War.cat')) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve('<catalogue id="dogs" />') });
        }
        if (url.includes('Mercenaries.cat')) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve('<catalogue id="merc" library="true" />') });
        }
        return Promise.reject(new Error(`Unknown fetch URL: ${url}`));
      });
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('aborts the import and names the missing library catalog when its dependent stays selected', async () => {
      // "Dogs of War" links to the "Mercenaries" library catalog; deselecting Mercenaries
      // while keeping Dogs of War must abort rather than import a broken dataset.
      processImportedData.mockReturnValue({
        id: 'sys-lex',
        name: 'WHFB Lexicanum',
        catalogues: [
          { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'merc', name: 'Mercenaries' }] }
        ]
      });

      render(<Importer showAsEmptyState={false} onSystemImported={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Mercenaries')).toBeDefined();
      });

      fireEvent.click(screen.getByLabelText('Mercenaries'));
      fireEvent.click(screen.getByText('Importieren'));

      const errorMessage = await screen.findByText(/Import abgebrochen/);

      // The whole guard message lives in one element, so assert its content there rather
      // than via getByText — the catalog checkboxes also render "Mercenaries"/"Dogs of War".
      expect(errorMessage.textContent).toContain('Mercenaries');
      expect(errorMessage.textContent).toContain('Dogs of War');
      expect(saveSystem).not.toHaveBeenCalled();
      expect(deleteSystem).not.toHaveBeenCalled();
      expect(screen.queryByText(/erfolgreich importiert/)).toBeNull();
    });

    it('imports normally when the referenced library catalog is part of the selection', async () => {
      const onSystemImportedMock = vi.fn();
      processImportedData.mockReturnValue({
        id: 'sys-lex',
        name: 'WHFB Lexicanum',
        catalogues: [
          { id: 'dogs', name: 'Dogs of War', catalogueLinks: [{ targetId: 'merc', name: 'Mercenaries' }] },
          { id: 'merc', name: 'Mercenaries', catalogueLinks: [] }
        ]
      });

      render(<Importer showAsEmptyState={false} onSystemImported={onSystemImportedMock} />);

      await waitFor(() => {
        expect(screen.getByText('Importieren')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Importieren'));

      await waitFor(() => {
        expect(saveSystem).toHaveBeenCalledWith(expect.objectContaining({ id: 'sys-lex' }));
        expect(onSystemImportedMock).toHaveBeenCalled();
      });

      expect(screen.getByText(/erfolgreich importiert/)).toBeDefined();
      expect(screen.queryByText(/Import abgebrochen/)).toBeNull();
    });
  });

  describe('Revision labels in the bundle importer', () => {
    let fetchSpy;

    const mockIndexFetch = (index) => {
      fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url) => {
        const catpkg = respondToCatpkg(url, index);
        if (catpkg) return catpkg;
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });
    };

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it('shows the available revision per catalogue row and for the selected game system', async () => {
      mockIndexFetch({
        repositoryFiles: [
          { id: 'sys-1', name: 'Warhammer Fantasy Bundle', type: 'gamesystem', revision: 9 },
          { id: 'cat-1', name: 'Bretonnia', type: 'catalogue', revision: 8 },
          { id: 'cat-2', name: 'Empire', type: 'catalogue', revision: 11 }
        ]
      });

      render(<Importer showAsEmptyState={false} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Bretonnia')).toBeDefined();
      });

      // No locally stored systems (getAllSystems -> []), so every file is "neu".
      expect(screen.getByTestId('selected-system-revision').textContent).toBe('Rev 9 · neu');
      expect(screen.getByText('Rev 8 · neu')).toBeDefined();
      expect(screen.getByText('Rev 11 · neu')).toBeDefined();
    });

    it('updates the shown game-system revision when the dropdown selection changes', async () => {
      mockIndexFetch({
        repositoryFiles: [
          { id: 'sys-a', name: 'System A', type: 'gamesystem', revision: 3 },
          { id: 'sys-b', name: 'System B', type: 'gamesystem', revision: 7 },
          { id: 'cat-1', name: 'Alpha', type: 'catalogue', revision: 5 }
        ]
      });

      render(<Importer showAsEmptyState={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('selected-system-revision').textContent).toBe('Rev 3 · neu');
      });

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sys-b' } });

      expect(screen.getByTestId('selected-system-revision').textContent).toBe('Rev 7 · neu');
    });

    it('renders no revision label when the index entry omits the revision', async () => {
      mockIndexFetch({
        repositoryFiles: [
          { id: 'sys-1', name: 'System Without Revision', type: 'gamesystem' },
          { id: 'cat-1', name: 'Catalogue Without Revision', type: 'catalogue' }
        ]
      });

      render(<Importer showAsEmptyState={false} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Catalogue Without Revision')).toBeDefined();
      });

      expect(screen.queryByTestId('selected-system-revision')).toBeNull();
      expect(screen.queryByText(/^Rev /)).toBeNull();
    });
  });

  describe('Revision state comparison in the bundle importer', () => {
    let fetchSpy;

    const mockIndexFetch = (index) => {
      fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url) => {
        const catpkg = respondToCatpkg(url, index);
        if (catpkg) return catpkg;
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });
    };

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it('shows the derived state per catalogue row and for the game system against locally stored revisions', async () => {
      mockIndexFetch({
        repositoryFiles: [
          { id: 'sys-1', name: 'System One', type: 'gamesystem', revision: 9 },
          { id: 'cat-new', name: 'Newcomer', type: 'catalogue', revision: 5 },
          { id: 'cat-current', name: 'UpToDate', type: 'catalogue', revision: 8 },
          { id: 'cat-outdated', name: 'Behind', type: 'catalogue', revision: 12 },
          { id: 'cat-ahead', name: 'SelfUpload', type: 'catalogue', revision: 4 },
          { id: 'cat-legacy', name: 'Legacy', type: 'catalogue', revision: 6 }
        ]
      });

      // Locally stored counterpart: system behind (7 < 9); catalogues cover every
      // matrix row. cat-new is deliberately absent (never imported) -> "neu".
      getAllSystems.mockResolvedValue([
        {
          id: 'sys-1',
          name: 'System One',
          revision: 7,
          catalogues: [
            { id: 'cat-current', revision: 8 },
            { id: 'cat-outdated', revision: 10 },
            { id: 'cat-ahead', revision: 9 },
            { id: 'cat-legacy' }
          ]
        }
      ]);

      render(<Importer showAsEmptyState={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('selected-system-revision').textContent).toBe('Rev 9 · lokal 7 · Update verfügbar');
      });

      expect(screen.getByTestId('catalog-revision-cat-new').textContent).toBe('Rev 5 · neu');
      expect(screen.getByTestId('catalog-revision-cat-current').textContent).toBe('Rev 8 · aktuell');
      expect(screen.getByTestId('catalog-revision-cat-outdated').textContent).toBe('Rev 12 · lokal 10 · Update verfügbar');
      expect(screen.getByTestId('catalog-revision-cat-ahead').textContent).toBe('Rev 4 · lokal 9');
      expect(screen.getByTestId('catalog-revision-cat-legacy').textContent).toBe('Rev 6 · lokal unbekannt · Update verfügbar');
    });

    it('recomputes the catalogue state when the selected game system changes', async () => {
      // The index assigns every catalogue to every game system, so cat-shared appears
      // under both systems; its state depends on which system's stored revision applies.
      mockIndexFetch({
        repositoryFiles: [
          { id: 'sys-a', name: 'System A', type: 'gamesystem', revision: 5 },
          { id: 'sys-b', name: 'System B', type: 'gamesystem', revision: 5 },
          { id: 'cat-shared', name: 'Shared', type: 'catalogue', revision: 8 }
        ]
      });

      getAllSystems.mockResolvedValue([
        { id: 'sys-a', name: 'System A', revision: 5, catalogues: [{ id: 'cat-shared', revision: 3 }] },
        { id: 'sys-b', name: 'System B', revision: 5, catalogues: [{ id: 'cat-shared', revision: 8 }] }
      ]);

      render(<Importer showAsEmptyState={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('catalog-revision-cat-shared').textContent).toBe('Rev 8 · lokal 3 · Update verfügbar');
      });

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sys-b' } });

      expect(screen.getByTestId('catalog-revision-cat-shared').textContent).toBe('Rev 8 · aktuell');
    });
  });

  describe('Multiple catalog sources (ADR 0016)', () => {
    let fetchSpy;

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it('lists both sources together in one dropdown under their real catalog names', async () => {
      const ergofargName = 'Warhammer Fantasy Battle 6th edition';
      const lexicanumName = 'Warhammer Fantasy Battles (6th definitive edition)';
      const ergofargIndex = {
        repositoryFiles: [
          { id: ERGOFARG_SYSTEM_ID, name: ergofargName, type: 'gamesystem', revision: 1 },
        ],
      };
      const lexicanumIndex = {
        repositoryFiles: [
          { id: LEXICANUM_SYSTEM_ID, name: lexicanumName, type: 'gamesystem', revision: 1 },
        ],
      };
      fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url) => {
        if (url.includes('catpkg.json')) {
          const index = url.includes(LEXICANUM_CATPKG_URL_PART) ? lexicanumIndex : ergofargIndex;
          return makeCatpkgJsonResponse(index);
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });

      render(<Importer showAsEmptyState={false} />);

      // Each system is shown under its own catalog name (Child-Issue 10): the real
      // `.gst` name, with no short label and no source qualifier appended.
      await waitFor(() => {
        expect(screen.getByRole('option', { name: ergofargName })).toBeDefined();
      });
      expect(screen.getByRole('option', { name: lexicanumName })).toBeDefined();
      expect(screen.queryByText(/WHFB 6th ed\./)).toBeNull();
      expect(screen.queryByText(/\(Ergofarg\)|\(Lexicanum\)/)).toBeNull();
    });

    it('imports the selected source from its own raw base URL', async () => {
      const ergofargIndex = {
        repositoryFiles: [
          { id: ERGOFARG_SYSTEM_ID, name: 'Ergofarg', type: 'gamesystem', revision: 1 },
          { id: 'ergofarg-cat', name: 'Kislev', type: 'catalogue', revision: 1 },
        ],
      };
      const requestedFileHosts = [];
      fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url) => {
        if (url.includes('catpkg.json')) {
          const index = url.includes(LEXICANUM_CATPKG_URL_PART) ? { repositoryFiles: [] } : ergofargIndex;
          return makeCatpkgJsonResponse(index);
        }
        requestedFileHosts.push(url);
        return Promise.resolve({ ok: true, text: () => Promise.resolve('<xml />') });
      });
      processImportedData.mockReturnValue({ id: ERGOFARG_SYSTEM_ID, name: 'Ergofarg', catalogues: [{ id: 'ergofarg-cat' }] });

      render(<Importer showAsEmptyState={false} onSystemImported={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Kislev')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Importieren'));

      await waitFor(() => {
        expect(saveSystem).toHaveBeenCalledWith(expect.objectContaining({ id: ERGOFARG_SYSTEM_ID }));
      });
      // Files are fetched from the Ergofarg fork base, not the Lexicanum one.
      expect(requestedFileHosts.every((url) => url.includes('Warhammer-Fantasy-6th-edition/master/'))).toBe(true);
      expect(requestedFileHosts.some((url) => url.includes('Kislev.cat'))).toBe(true);
    });

    it('shows a stored system under its real catalog name, with no short label (Child-Issue 10)', async () => {
      // Uses the outer beforeEach's empty-index fetch stub: no dropdown systems, so the
      // asserted name can only come from the imported-systems list.
      const ergofargName = 'Warhammer Fantasy Battle 6th edition';
      getAllSystems.mockResolvedValue([
        { id: ERGOFARG_SYSTEM_ID, name: ergofargName, catalogues: [] },
      ]);

      render(<Importer showAsEmptyState={false} />);

      await waitFor(() => {
        expect(screen.getByText(ergofargName)).toBeDefined();
      });
      expect(screen.queryByText(/WHFB 6th ed\./)).toBeNull();
    });
  });
});

