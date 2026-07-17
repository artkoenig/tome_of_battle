import React, { useState, useEffect } from 'react';
import { Upload, Trash2, FileText, CheckCircle2, ShieldAlert, Edit, Download } from 'lucide-react';
import JSZip from 'jszip';
import { extractZipFiles } from '../parser/zipExtractor';
import { processImportedData } from '../parser/xmlParser';
import { getAllSystems, saveSystem, deleteSystem } from '../db/database';
import ConfirmationDialog from './editor/ConfirmationDialog';
import {
  loadCatalogIndex,
  fetchCatalogText,
  buildRawFileUrl,
  deriveRevisionState,
  REVISION_STATE,
} from '../db/catalogUpdate';

const REVISION_LABEL_PREFIX = 'Rev';
const REVISION_SEGMENT_SEPARATOR = ' · ';
const NEW_STATE_TEXT = 'neu';
const CURRENT_STATE_TEXT = 'aktuell';
const UPDATE_AVAILABLE_TEXT = 'Update verfügbar';
const LOCAL_REVISION_PREFIX = 'lokal';
const UNKNOWN_LOCAL_REVISION_TEXT = 'unbekannt';

// Visual tone of a revision status per ADR 0014's state matrix, mapped to the theme's
// helper classes: a subtle secondary text, the gold accent that flags an available
// update, and the neutral default for a self-uploaded (higher) local revision.
const REVISION_TONE = {
  SUBTLE: 'text-dim',
  ACCENT: 'text-gold',
  NEUTRAL: '',
};

/**
 * The `revision` from a catpkg index entry is an optional integer update counter
 * (see ADR 0014). Older or incomplete indices may omit it, so a non-numeric value
 * yields no label rather than an error.
 */
function formatRevisionLabel(revision) {
  if (typeof revision !== 'number') return null;
  return `${REVISION_LABEL_PREFIX} ${revision}`;
}

function formatLocalRevisionSegment(localFile) {
  const localRevision = localFile?.revision;
  const value = typeof localRevision === 'number' ? localRevision : UNKNOWN_LOCAL_REVISION_TEXT;
  return `${LOCAL_REVISION_PREFIX} ${value}`;
}

// Per-state presentation (suffix segments appended after the available revision, plus
// tone). Keyed by state so a new state is added here rather than in a growing switch.
const REVISION_STATE_PRESENTATION = {
  [REVISION_STATE.NEW]: () => ({ segments: [NEW_STATE_TEXT], tone: REVISION_TONE.SUBTLE }),
  [REVISION_STATE.CURRENT]: () => ({ segments: [CURRENT_STATE_TEXT], tone: REVISION_TONE.SUBTLE }),
  [REVISION_STATE.OUTDATED]: (localFile) => ({
    segments: [formatLocalRevisionSegment(localFile), UPDATE_AVAILABLE_TEXT],
    tone: REVISION_TONE.ACCENT,
  }),
  [REVISION_STATE.AHEAD]: (localFile) => ({
    segments: [formatLocalRevisionSegment(localFile)],
    tone: REVISION_TONE.NEUTRAL,
  }),
};

/**
 * Builds the full revision display for one catalog file, comparing the available
 * revision against the locally stored file (or `null` when it is not imported). Returns
 * `{ text, tone }` per ADR 0014's state matrix, or `null` when no available revision is
 * known (nothing to show).
 */
function buildRevisionDisplay(availableRevision, localFile) {
  const availableLabel = formatRevisionLabel(availableRevision);
  if (availableLabel === null) return null;

  const state = deriveRevisionState(availableRevision, localFile);
  const { segments, tone } = REVISION_STATE_PRESENTATION[state](localFile);
  return {
    text: [availableLabel, ...segments].join(REVISION_SEGMENT_SEPARATOR),
    tone,
  };
}

function revisionLabelClassName(tone) {
  return ['bundle-revision-label', tone].filter(Boolean).join(' ');
}

export function transformIndexToSystems(index) {
  if (!index?.repositoryFiles) return [];

  const gsType = 'gamesystem';
  const catType = 'catalogue';

  const gameSystemEntries = index.repositoryFiles.filter(
    entry => (entry.type || '').toLowerCase() === gsType
  );
  const catalogueEntries = index.repositoryFiles.filter(
    entry => (entry.type || '').toLowerCase() === catType
  );

  return gameSystemEntries.map(gs => ({
    id: gs.id,
    name: gs.name,
    gst: {
      id: gs.id,
      name: gs.name,
      fileName: `${gs.name}.gst`,
      revision: gs.revision
    },
    catalogues: catalogueEntries.map(cat => ({
        id: cat.id,
        name: cat.name,
        fileName: `${cat.name}.cat`,
        revision: cat.revision
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }));
}

export default function Importer({ onSystemImported, showAsEmptyState = false }) {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
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
    }
  };

  const fetchAvailableSystems = async () => {
    try {
      const data = await loadCatalogIndex(fetchCatalogText);
      if (data) {
        const systems = transformIndexToSystems(data);
        setAvailableSystems(systems);
        if (systems.length > 0) {
          setSelectedBundleSysId(systems[0].id);
          const initialCats = {};
          systems[0].catalogues.forEach(cat => {
            initialCats[cat.id] = true;
          });
          setSelectedCats(initialCats);
        }
      } else {
        setError('Der Katalog-Index ist derzeit nicht erreichbar. Bitte versuche es später erneut.');
      }
    } catch (e) {
      console.warn("Could not load catalog index from fork", e);
      if (availableSystems.length === 0) {
        setError('Keine Spieldaten zum Import verfügbar. Der Katalog-Index konnte nicht geladen werden.');
      }
    }
  };

  const handleSystemChange = (sysId) => {
    setSelectedBundleSysId(sysId);
    const system = availableSystems.find(s => s.id === sysId);
    const initialCats = {};
    if (system) {
      system.catalogues.forEach(cat => {
        initialCats[cat.id] = true;
      });
    }
    setSelectedCats(initialCats);
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

  const handleImportBundle = async () => {
    const system = availableSystems.find(s => s.id === selectedBundleSysId);
    if (!system) return;

    const selectedCatList = system.catalogues.filter(cat => selectedCats[cat.id]);
    
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const gstUrl = buildRawFileUrl(system.gst.fileName);
      const gstRes = await fetch(gstUrl);
      if (!gstRes.ok) throw new Error(`Fehler beim Laden des Spielsystems: ${gstRes.statusText}`);
      const gstText = await gstRes.text();
      const gstFiles = [{ name: system.gst.fileName, content: gstText }];

      const catFiles = await Promise.all(selectedCatList.map(async (cat) => {
        const catUrl = buildRawFileUrl(cat.fileName);
        const catRes = await fetch(catUrl);
        if (!catRes.ok) throw new Error(`Fehler beim Laden des Katalogs ${cat.name}: ${catRes.statusText}`);
        const catText = await catRes.text();
        return { name: cat.fileName, content: catText };
      }));

      const systemData = processImportedData(gstFiles, catFiles);
      systemData.rawXmls = {
        gst: gstFiles,
        cat: catFiles
      };

      await deleteSystem(systemData.id);
      await saveSystem(systemData);

      setSuccessMsg(`Das System "${systemData.name}" mit ${systemData.catalogues.length} Katalogen wurde erfolgreich importiert!`);
      loadSystems();
      if (onSystemImported) onSystemImported();
    } catch (e) {
      console.error(e);
      setError(`Fehler beim Importieren der Spieldaten: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processUploadedFile(e.dataTransfer.files[0]);
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
      const systemData = processImportedData(gstFiles, catFiles);
      systemData.rawXmls = {
        gst: gstFiles,
        cat: catFiles
      };
      await deleteSystem(systemData.id);
      await saveSystem(systemData);
      setSuccessMsg(`Das System "${systemData.name}" mit ${systemData.catalogues.length} Katalogen wurde erfolgreich importiert!`);
      loadSystems();
      if (onSystemImported) onSystemImported();
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
        <div className="validation-error-item" style={{ borderColor: 'var(--color-danger)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert className="text-danger" size={20} />
          <span className="text-danger">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="validation-error-item" style={{ borderColor: 'var(--color-success)', background: 'rgba(27,115,64,0.05)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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

          {false && (
            <div className="gothic-panel full-width">
              <h3 className="text-subheading">Eigene Spieldaten hochladen</h3>
              <p className="text-dim text-body">
                Hast du eigene Battlescribe-Dateien? Lade sie als ZIP-Archiv hoch, um sie in deiner lokalen Bibliothek zu speichern.
              </p>
              <div 
                className={`drop-zone desktop-drop-zone ${dragActive ? 'active' : ''} margin-top-md`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload').click()}
              >
                <Upload className="drop-zone-icon" size={48} style={{ margin: '0 auto 12px' }} />
                <h3>Ziehe ein .zip-Archiv hierher</h3>
                <p className="text-dim">oder klicke, um deine Dateien zu durchsuchen</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="importer-layout">
          {false && (
            <div className="gothic-panel bundle-importer-panel">
              <h3 className="text-subheading">Eigene Spieldaten hochladen</h3>
              <p className="text-dim text-body">
                Ziehe ein .zip-Archiv hierher oder klicke, um deine Dateien zu durchsuchen.
              </p>
              <div 
                className={`drop-zone desktop-drop-zone ${dragActive ? 'active' : ''} margin-top-md`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload').click()}
              >
                <Upload className="drop-zone-icon" size={48} style={{ margin: '0 auto 12px' }} />
                <h3>Ziehe ein .zip-Archiv hierher</h3>
                <p className="text-dim">oder klicke, um deine Dateien zu durchsuchen</p>
              </div>
            </div>
          )}

          {renderBundleImporter()}
        </div>
      )}

      <input 
        type="file" 
        id="file-upload" 
        style={{ display: 'none' }} 
        accept=".zip"
        onChange={handleFileInput}
      />

      {false && (
        <button 
          className="fab-mobile mobile-only"
          onClick={() => document.getElementById('file-upload').click()}
          title="Datei hochladen"
        >
          <Upload size={24} />
        </button>
      )}

      {!showAsEmptyState && (
        <div className="margin-top-md">
          <h2>Importierte Spielsysteme</h2>
          {systems.length === 0 ? (
            <p className="text-dim" style={{ textAlign: 'center', padding: '20px 0' }}>Keine Spielsysteme in der Datenbank vorhanden.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {systems.map((sys) => (
                <div 
                  key={sys.id} 
                  className="catalog-item"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, paddingRight: '16px' }}>
                    <FileText className="text-gold" size={24} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {sys.name}
                      </h4>
                      <span className="text-dim" style={{ fontSize: '0.85rem' }}>
                        {sys.catalogues?.length || 0} Fraktionskataloge geladen
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
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
