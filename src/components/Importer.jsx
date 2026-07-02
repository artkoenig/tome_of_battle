import React, { useState, useEffect } from 'react';
import { Upload, Trash2, FileText, CheckCircle2, ShieldAlert, Edit, Download } from 'lucide-react';
import JSZip from 'jszip';
import { extractZipFiles } from '../parser/zipExtractor';
import { processImportedData } from '../parser/xmlParser';
import { getAllSystems, saveSystem, deleteSystem } from '../db/database';
import { useDebugMode } from '../hooks/DebugContext';

const getAbsoluteUrl = (path) => {
  const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
  if (origin && path.startsWith('/')) {
    return `${origin}${path}`;
  }
  return path;
};

export default function Importer({ onSystemImported, showAsEmptyState = false }) {
  const { showDebugIds } = useDebugMode();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

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
      const response = await fetch(getAbsoluteUrl('/catalogs/manifest.json'));
      if (response.ok) {
        const data = await response.json();
        setAvailableSystems(data);
        if (data.length > 0) {
          setSelectedBundleSysId(data[0].id);
          const initialCats = {};
          data[0].catalogues.forEach(cat => {
            initialCats[cat.id] = true;
          });
          setSelectedCats(initialCats);
        }
      }
    } catch (e) {
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'test') {
        console.warn("Could not load pre-bundled catalogs manifest", e);
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
      const gstUrl = `/catalogs/${system.dir}/${system.gst.fileName}`;
      const gstRes = await fetch(getAbsoluteUrl(gstUrl));
      if (!gstRes.ok) throw new Error(`Fehler beim Laden des Spielsystems: ${gstRes.statusText}`);
      const gstText = await gstRes.text();
      const gstFiles = [{ name: system.gst.fileName, content: gstText }];

      const catFiles = await Promise.all(selectedCatList.map(async (cat) => {
        const catUrl = `/catalogs/${system.dir}/${cat.fileName}`;
        const catRes = await fetch(getAbsoluteUrl(catUrl));
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

  const handleDelete = async (id) => {
    if (confirm('Bist du sicher, dass du dieses Spielsystem und alle zugehörigen Kataloge löschen möchtest?')) {
      try {
        await deleteSystem(id);
        loadSystems();
        if (onSystemImported) onSystemImported();
      } catch (e) {
        console.error(e);
        setError('Fehler beim Löschen des Spielsystems.');
      }
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

    return (
      <div className="gothic-panel bundle-importer-panel">
        <h3 className="text-subheading">Vordefinierte Spieldaten importieren</h3>
        <p className="text-dim text-body">
          Importiere ein komplettes Spielsystem inklusive ausgewählter Fraktionen direkt aus den mitgelieferten Dateien.
        </p>

        <div className="bundle-form-group">
          <label className="text-label text-gold">Spielsystem:</label>
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
              {selectedSystem.catalogues.map(cat => (
                <label key={cat.id} className="bundle-catalog-item-label">
                  <input 
                    type="checkbox" 
                    checked={!!selectedCats[cat.id]} 
                    onChange={() => handleToggleCat(cat.id)}
                    disabled={loading}
                    aria-label={cat.name}
                  />
                  <span className="text-body">{cat.name}</span>
                </label>
              ))}
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
        </div>
      ) : (
        <div className="importer-layout">
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

      <button 
        className="fab-mobile mobile-only"
        onClick={() => document.getElementById('file-upload').click()}
        title="Datei hochladen"
      >
        <Upload size={24} />
      </button>

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
                        {showDebugIds && <span className="debug-id-badge">{sys.id}</span>}
                      </h4>
                      <span className="text-dim" style={{ fontSize: '0.85rem' }}>
                        {sys.catalogues?.length || 0} Fraktionskataloge geladen
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button 
                      className="btn-gold btn-sm" 
                      onClick={() => handleExport(sys)}
                      title="Spielsystem exportieren (.zip)"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
                    >
                      <Download size={16} />
                    </button>
                    <button 
                      className="btn-danger btn-sm" 
                      onClick={() => handleDelete(sys.id)}
                      title="System löschen"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
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
    </div>
  );
}
