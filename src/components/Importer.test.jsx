import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Importer from './Importer';
import { getAllSystems, saveSystem, deleteSystem } from '../db/database';
import { extractZipFiles } from '../parser/zipExtractor';
import { processImportedData } from '../parser/xmlParser';
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

describe('Importer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllSystems.mockResolvedValue([]);
    deleteSystem.mockResolvedValue({});
    saveSystem.mockResolvedValue({});
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

  it.skip('9. Drag and Drop events and file drop', async () => {
    render(<Importer showAsEmptyState={false} />);
    
    await waitFor(() => {
      expect(getAllSystems).toHaveBeenCalled();
    });

    const dropZone = screen.getByText('Ziehe ein .zip-Archiv hierher');

    // Drag events
    fireEvent.dragEnter(dropZone);
    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);

    // Drop file
    const file = new File(['zipcontent'], 'drop_system.zip', { type: 'application/zip' });
    extractZipFiles.mockResolvedValue({ gstFiles: [], catFiles: [] });
    processImportedData.mockReturnValue({ id: 'dropped', name: 'Dropped System', catalogues: [] });
    
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file]
      }
    });

    await waitFor(() => {
      expect(extractZipFiles).toHaveBeenCalledWith(file);
    });
  });

  it.skip('10. Click drop-zone triggers hidden input click', async () => {
    const { container } = render(<Importer showAsEmptyState={false} />);
    
    await waitFor(() => {
      expect(getAllSystems).toHaveBeenCalled();
    });

    const fileInput = container.querySelector('#file-upload');
    const inputClickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {});

    const dropZone = screen.getByText('Ziehe ein .zip-Archiv hierher');
    fireEvent.click(dropZone);

    expect(inputClickSpy).toHaveBeenCalled();
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
      const mockManifest = [
        {
          id: 'sys-bundle-1',
          name: 'Warhammer Fantasy Bundle',
          dir: 'whfb6',
          gst: { id: 'sys-bundle-1', name: 'Warhammer Fantasy Bundle', fileName: 'rules.gst' },
          catalogues: [
            { id: 'cat-bundle-1', name: 'Bretonnia', fileName: 'Bretonnia.cat' },
            { id: 'cat-bundle-2', name: 'Empire', fileName: 'Empire.cat' }
          ]
        }
      ];

      fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url) => {
        if (url.endsWith('/catalogs/manifest.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockManifest)
          });
        }
        if (url.endsWith('/catalogs/whfb6/rules.gst')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('<gameSystem id="sys-bundle-1" name="Warhammer Fantasy Bundle"></gameSystem>')
          });
        }
        if (url.endsWith('/catalogs/whfb6/Bretonnia.cat')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('<catalogue id="cat-bundle-1" name="Bretonnia"></catalogue>')
          });
        }
        if (url.endsWith('/catalogs/whfb6/Empire.cat')) {
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

    it('should fetch manifest and render pre-bundled importer', async () => {
      render(<Importer showAsEmptyState={false} />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/catalogs/manifest.json'));
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
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/catalogs/whfb6/rules.gst'));
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/catalogs/whfb6/Bretonnia.cat'));
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/catalogs/whfb6/Empire.cat'));

        expect(processImportedData).toHaveBeenCalledWith(
          [{ name: 'rules.gst', content: '<gameSystem id="sys-bundle-1" name="Warhammer Fantasy Bundle"></gameSystem>' }],
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
});

