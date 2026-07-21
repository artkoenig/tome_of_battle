import React, { useState, useEffect } from 'react';
import { Trash2, FileText, CheckCircle2, ShieldAlert, Edit, Download } from 'lucide-react';
import JSZip from 'jszip';
import { extractZipFiles } from '../parser/zipExtractor';
import { getAllSystems, deleteSystem } from '../db/database';
import ConfirmationDialog from './editor/ConfirmationDialog';
import { fetchCatalogText, buildRawFileUrl } from '../db/catalogUpdate';
import { loadAvailableSystemsFromSources } from '../db/catalogSourceIndex';
import { completeSystemImport, SYSTEM_IMPORT_STATUS } from '../db/systemImport';
import {
  catalogueDirectoryFromIndex,
  catalogueDirectoryFromLinks,
} from '../parser/libraryDependencies';
import { buildRevisionDisplay, revisionLabelClassName } from './importer/revisionDisplay';
import {
  buildFailedCatalogueMessage,
  buildImportSuccessMessage,
  buildMissingLibraryDependencyMessage,
} from './importer/importMessages';

/** Failure texts the Importer raises itself, rather than receiving them as data. */
const IMPORTER_ERROR_MESSAGE = Object.freeze({
  systemListUnavailable:
    'Die importierten Spielsysteme konnten nicht aus der Datenbank geladen werden.',
});

/**
 * A selection map that marks every catalogue of a system as selected. Used to preselect
 * all factions whenever a system becomes the active one in the dropdown.
 */
function buildAllSelectedCats(system) {
  const selected = {};
  (system?.catalogues ?? []).forEach(cat => {
    selected[cat.id] = true;
  });
  return selected;
}

/**
 * @param {object} props
 * @param {() => Promise<void>|void} [props.onSystemImported] runs after a system was stored.
 * @param {(message: string) => void} [props.onReportError] carries a failure to the app-wide
 *   channel. Needed because a completed import navigates away and unmounts this screen, so
 *   its own error area would take the message with it.
 */
export default function Importer({ onSystemImported, onReportError, showAsEmptyState = false }) {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [systemToDelete, setSystemToDelete] = useState(null);

  // States for pre-bundled catalog import
  const [availableSystems, setAvailableSystems] = useState([]);
  const [selectedBundleSysId, setSelectedBundleSysId] = useState('');
  const [selectedCats, setSelectedCats] = useState({});

  useEffect(() => {
    loadSystems();
    fetchAvailableSystems();
  }, []);

  const loadSystems = async () => {
    try {
      const data = await getAllSystems();
      setSystems(data);
    } catch (e) {
      console.error("Error loading systems", e);
      setError(IMPORTER_ERROR_MESSAGE.systemListUnavailable);
    }
  };

  const fetchAvailableSystems = async () => {
    try {
      const { systems, anyIndexReachable } = await loadAvailableSystemsFromSources(fetchCatalogText);
      if (systems.length > 0) {
        setAvailableSystems(systems);
        setSelectedBundleSysId(systems[0].id);
        setSelectedCats(buildAllSelectedCats(systems[0]));
      } else if (!anyIndexReachable) {
        setError('Der Katalog-Index ist derzeit nicht erreichbar. Bitte versuche es später erneut.');
      }
    } catch (e) {
      console.warn("Could not load catalog index from fork", e);
      // Nur wenn noch keine Auswahl steht, ist der Fehler für den Nutzer relevant —
      // andernfalls kann er mit dem bereits geladenen Index weiterarbeiten.
      if (availableSystems.length === 0) {
        setError('Keine Spieldaten zum Import verfügbar. Der Katalog-Index konnte nicht geladen werden.');
      }
    }
  };

  const handleSystemChange = (sysId) => {
    setSelectedBundleSysId(sysId);
    const system = availableSystems.find(s => s.id === sysId);
    setSelectedCats(buildAllSelectedCats(system));
  };

  const handleToggleCat = (catId) => {
    setSelectedCats(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const handleToggleAllCats = (checked) => {
    const system = availableSystems.find(s => s.id === selectedBundleSysId);
    if (!system) return;
    const nextCats = {};
    system.catalogues.forEach(cat => {
      nextCats[cat.id] = checked;
    });
    setSelectedCats(nextCats);
  };

  /**
   * Runs the shared import completion for raw XML files that either import path has
   * gathered, and reflects its outcome in the UI. Both paths therefore share the schema
   * advisory, the library-dependency guard, persistence and the success confirmation.
   * Catalogues that failed to parse are named in the same error area as the dependency
   * warning, and the confirmation reports the import as incomplete.
   */
  const finishImport = async (gstFiles, catFiles, catalogueDirectory) => {
    const result = await completeSystemImport({ gstFiles, catFiles, catalogueDirectory });

    if (result.status === SYSTEM_IMPORT_STATUS.MISSING_LIBRARY_DEPENDENCIES) {
      setError(buildMissingLibraryDependencyMessage(result.missingDependencies));
      return;
    }

    const failedCatalogues = result.failedCatalogues ?? [];
    if (failedCatalogues.length > 0) {
      const failureMessage = buildFailedCatalogueMessage(failedCatalogues);
      setError(failureMessage);
      if (onReportError) onReportError(failureMessage);
    }
    setSuccessMsg(buildImportSuccessMessage(result.system, failedCatalogues));
    loadSystems();
    // Await the parent so it has already switched to the Heerlager view before
    // `finally` clears `loading` and unmounts this Importer — no visible flash.
    if (onSystemImported) await onSystemImported();
  };

  const handleImportBundle = async () => {
    const system = availableSystems.find(s => s.id === selectedBundleSysId);
    if (!system) return;

    const selectedCatList = system.catalogues.filter(cat => selectedCats[cat.id]);
    
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const gstUrl = buildRawFileUrl(system.rawBaseUrl, system.gst.fileName);
      const gstRes = await fetch(gstUrl);
      if (!gstRes.ok) throw new Error(`Fehler beim Laden des Spielsystems: ${gstRes.statusText}`);
      const gstText = await gstRes.text();
      const gstFiles = [{ name: system.gst.fileName, content: gstText }];

      const catFiles = await Promise.all(selectedCatList.map(async (cat) => {
        const catUrl = buildRawFileUrl(system.rawBaseUrl, cat.fileName);
        const catRes = await fetch(catUrl);
        if (!catRes.ok) throw new Error(`Fehler beim Laden des Katalogs ${cat.name}: ${catRes.statusText}`);
        const catText = await catRes.text();
        return { name: cat.fileName, content: catText };
      }));

      // The catalog index knows every selectable catalogue, so a link target it does not
      // list is broken upstream rather than a selection the user could complete.
      await finishImport(gstFiles, catFiles, catalogueDirectoryFromIndex(system.catalogues));
    } catch (e) {
      console.error(e);
      setError(`Fehler beim Importieren der Spieldaten: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileInput = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await processUploadedFile(e.target.files[0]);
    }
  };

  const processUploadedFile = async (file) => {
    setError(null);
    setSuccessMsg(null);

    if (!file.name.endsWith('.zip')) {
      setError('Bitte lade eine gültige .zip-Datei hoch.');
      return;
    }

    setLoading(true);
    try {
      const { gstFiles, catFiles } = await extractZipFiles(file);
      // An uploaded archive comes with no index bounding its catalogues, so every link
      // target missing from the archive is one the user could add to it.
      await finishImport(gstFiles, catFiles, catalogueDirectoryFromLinks());
    } catch (e) {
      console.error(e);
      setError(`Fehler beim Verarbeiten der Datei: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    const sys = systems.find(s => s.id === id);
    if (sys) {
      setSystemToDelete(sys);
    }
  };

  const handleExport = async (sys) => {
    try {
      if (!sys.rawXmls) {
        setError('Dieses Spielsystem wurde vor dem Update importiert und besitzt keine XML-Originaldateien in der Datenbank. Bitte importiere das Spielsystem (.zip) erneut, um den Export nutzen zu können.');
        return;
      }

      const zip = new JSZip();
      sys.rawXmls.gst?.forEach(f => {
        zip.file(f.name, f.content);
      });
      sys.rawXmls.cat?.forEach(f => {
        zip.file(f.name, f.content);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sys.name}_original.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSuccessMsg(`Spielsystem "${sys.name}" erfolgreich als .zip (Originalformat) exportiert!`);
    } catch (e) {
      console.error(e);
      setError(`Fehler beim Exportieren des Spielsystems als ZIP: ${e.message}`);
    }
  };

  const renderBundleImporter = () => {
    if (availableSystems.length === 0) return null;

    const selectedSystem = availableSystems.find(s => s.id === selectedBundleSysId);
    const selectedCount = selectedSystem ? selectedSystem.catalogues.filter(cat => selectedCats[cat.id]).length : 0;
    const allChecked = selectedSystem ? selectedSystem.catalogues.every(cat => selectedCats[cat.id]) : false;
    // The locally stored counterpart of the selected system (already loaded via
    // getAllSystems — no extra DB access) drives the "new/current/outdated/ahead" state.
    const storedSystem = selectedSystem ? systems.find(s => s.id === selectedSystem.id) ?? null : null;
    const selectedSystemRevisionDisplay = selectedSystem
      ? buildRevisionDisplay(selectedSystem.gst.revision, storedSystem)
      : null;

    return (
      <div className="gothic-panel bundle-importer-panel full-width">
        <h3 className="text-subheading">Vordefinierte Spieldaten importieren</h3>
        <p className="text-dim text-body">
          Importiere ein komplettes Spielsystem inklusive ausgewählter Fraktionen direkt aus den mitgelieferten Dateien.
        </p>

        <div className="bundle-form-group">
          <div className="bundle-form-group-header">
            <label className="text-label text-gold">Spielsystem:</label>
            {selectedSystemRevisionDisplay && (
              <span
                className={revisionLabelClassName(selectedSystemRevisionDisplay.tone)}
                data-testid="selected-system-revision"
              >
                {selectedSystemRevisionDisplay.text}
              </span>
            )}
          </div>
          <select
            value={selectedBundleSysId}
            onChange={(e) => handleSystemChange(e.target.value)}
            disabled={loading}
          >
            {availableSystems.map(sys => (
              <option key={sys.id} value={sys.id}>{sys.name}</option>
            ))}
          </select>
        </div>

        {selectedSystem && (
          <div className="bundle-form-group">
            <div className="bundle-importer-header">
              <label className="text-label text-gold">Kataloge ({selectedCount} ausgewählt):</label>
              <button 
                type="button" 
                className="btn-gold btn-sm"
                onClick={() => handleToggleAllCats(!allChecked)}
                disabled={loading}
              >
                {allChecked ? 'Alle abwählen' : 'Alle auswählen'}
              </button>
            </div>
            <div className="bundle-catalog-list-container">
              {selectedSystem.catalogues.map(cat => {
                const storedCatalogue = storedSystem?.catalogues?.find(c => c.id === cat.id) ?? null;
                const catalogueRevisionDisplay = buildRevisionDisplay(cat.revision, storedCatalogue);
                return (
                  <label key={cat.id} className="bundle-catalog-item-label">
                    <input
                      type="checkbox"
                      checked={!!selectedCats[cat.id]}
                      onChange={() => handleToggleCat(cat.id)}
                      disabled={loading}
                      aria-label={cat.name}
                    />
                    <span className="text-body">{cat.name}</span>
                    {catalogueRevisionDisplay && (
                      <span
                        className={revisionLabelClassName(catalogueRevisionDisplay.tone)}
                        data-testid={`catalog-revision-${cat.id}`}
                      >
                        {catalogueRevisionDisplay.text}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="bundle-importer-actions">
          <button 
            type="button" 
            className="btn-primary" 
            onClick={handleImportBundle}
            disabled={loading || selectedCount === 0}
          >
            Importieren
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`container ${showAsEmptyState ? 'empty-state-wrapper' : ''}`}>
      {error && (
        <div className="validation-error-item importer-status-banner importer-status-banner--error">
          <ShieldAlert className="text-danger" size={20} />
          <span className="text-danger">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="validation-error-item importer-status-banner importer-status-banner--success">
          <CheckCircle2 className="text-success" size={20} />
          <span className="text-success">{successMsg}</span>
        </div>
      )}

      {loading && (
        <div className="modal-overlay">
          <div className="loader-overlay-content">
            <div className="gothic-spinner" />
            <h3 className="text-subheading text-gold">Beschwöre Spieldaten...</h3>
            <span className="text-body text-dim">Verarbeite XML-Dateien, bitte warten...</span>
          </div>
        </div>
      )}

      {showAsEmptyState ? (
        <div className="empty-importer-layout">
          <div className="empty-importer-text-center">
            <div className="empty-state-image empty-importer-image empty-importer-image-centered" />
            <h2 className="empty-state-title empty-state-title-large">Willkommen bei Tome of Battle</h2>
            <p className="empty-state-text text-dim">
              Dein Buch des Wissens ist noch leer. Um Armeen ausheben zu können, benötigst du zunächst Spieldaten im BattleScribe-Format. 
            </p>
          </div>

          {renderBundleImporter()}
        </div>
      ) : (
        <div className="importer-layout">
          {renderBundleImporter()}
        </div>
      )}

      <input 
        type="file" 
        id="file-upload"
        className="is-hidden"
        accept=".zip"
        onChange={handleFileInput}
      />

      {!showAsEmptyState && (
        <div className="margin-top-md">
          <h2>Importierte Spielsysteme</h2>
          {systems.length === 0 ? (
            <p className="text-dim importer-empty-hint">Keine Spielsysteme in der Datenbank vorhanden.</p>
          ) : (
            <div className="imported-system-list">
              {systems.map((sys) => (
                <div
                  key={sys.id}
                  className="catalog-item imported-system-item"
                >
                  <div className="imported-system-info">
                    <FileText className="text-gold no-shrink" size={24} />
                    <div className="flex-grow-truncating">
                      <h4 className="imported-system-name">
                        {sys.name}
                      </h4>
                      <span className="text-dim imported-system-catalogue-count">
                        {sys.catalogues?.length || 0} Fraktionskataloge geladen
                      </span>
                    </div>
                  </div>
                  <div className="imported-system-actions">
                    <button
                      className="btn-gold square-btn"
                      onClick={() => handleExport(sys)}
                      title="Spielsystem exportieren (.zip)"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      className="btn-danger square-btn"
                      onClick={() => handleDelete(sys.id)}
                      title="System löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Confirmation Dialog for deleting System */}
      <ConfirmationDialog
        isOpen={!!systemToDelete}
        onClose={() => setSystemToDelete(null)}
        onConfirm={async () => {
          if (!systemToDelete) return;
          const id = systemToDelete.id;
          setSystemToDelete(null);
          try {
            await deleteSystem(id);
            loadSystems();
            if (onSystemImported) onSystemImported();
          } catch (e) {
            console.error(e);
            setError('Fehler beim Löschen des Spielsystems.');
          }
        }}
        title="Spielsystem löschen"
        message={
          <>
            Bist du sicher, dass du das Spielsystem <strong>{systemToDelete?.name}</strong> und alle zugehörigen Kataloge löschen möchtest?
          </>
        }
        confirmLabel="Löschen"
        isDanger={true}
      />
    </div>
  );
}
