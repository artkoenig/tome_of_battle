import React, { useState, useEffect } from 'react';
import { Upload, Trash2, FileText, CheckCircle2, ShieldAlert, Edit, Download, Bot } from 'lucide-react';
import JSZip from 'jszip';
import { extractZipFiles } from '../parser/zipExtractor';
import { processImportedData } from '../parser/xmlParser';
import { getAllSystems, saveSystem, deleteSystem } from '../db/database';

import SystemEditorView from './importer/SystemEditorView';
import { useDebugMode } from '../hooks/DebugContext';

export default function Importer({ onSystemImported, showAsEmptyState = false }) {
  const { showDebugIds } = useDebugMode();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [editingSystem, setEditingSystem] = useState(null);

  useEffect(() => {
    loadSystems();
  }, []);

  const loadSystems = async () => {
    try {
      const data = await getAllSystems();
      setSystems(data);
    } catch (e) {
      console.error("Error loading systems", e);
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
        setSuccessMsg('Spielsystem erfolgreich gelöscht.');
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

  if (editingSystem) {
    return (
      <SystemEditorView 
        system={editingSystem} 
        onClose={() => { setEditingSystem(null); loadSystems(); }} 
        onSystemSaved={loadSystems}
      />
    );
  }

  return (
    <div className="container" style={showAsEmptyState ? { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 40px)' } : {}}>
      <div className={showAsEmptyState ? "" : "gothic-panel"} style={showAsEmptyState ? { textAlign: 'center', maxWidth: '600px', width: '100%' } : {}}>
        {showAsEmptyState ? (
          <>
            <div style={{
              width: '100%',
              maxWidth: '400px',
              height: '350px',
              backgroundImage: 'url(/empty_systems.png)',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              margin: '0 auto 24px auto',
            }} />
            <h2 style={{ fontSize: '2.2rem', marginBottom: '16px', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>Willkommen bei Tome of Battle</h2>
            <p className="text-dim" style={{ maxWidth: '500px', margin: '0 auto 24px', fontSize: '1.2rem', lineHeight: '1.6' }}>
              Dein Buch des Wissens ist noch leer. Importiere zuerst Spieldaten (BattleScribe .bsr), um Armeen ausheben zu können.
            </p>
          </>
        ) : (
          <>
            <h1>Bibliothekar</h1>
            <p className="text-dim" style={{ textAlign: 'center', marginBottom: '20px' }}>
              Lade BSData Repository ZIP-Archive hoch (z.B. von BSData/wh40k-10th-edition). 
              Die Dateien werden komplett lokal auf deinem Gerät verarbeitet und in einer Browser-Datenbank gespeichert.
            </p>
          </>
        )}

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
          <div style={{ marginTop: '16px', color: 'var(--text-gold)', textAlign: 'center' }}>
            <span className="font-serif">Beschwöre Spieldaten... (Verarbeite XML)</span>
          </div>
        )}

        <div 
          className={`drop-zone desktop-drop-zone ${dragActive ? 'active' : ''}`}
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
      </div>

      {!showAsEmptyState && (
        <div className="gothic-panel" style={{ marginTop: '24px' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText className="text-gold" size={24} />
                    <div>
                      <h4 style={{ margin: 0 }}>
                        {sys.name}
                        {showDebugIds && <span className="debug-id-badge">{sys.id}</span>}
                      </h4>
                      <span className="text-dim" style={{ fontSize: '0.85rem' }}>
                        {sys.catalogues?.length || 0} Fraktionskataloge geladen
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn-gold btn-sm" 
                      onClick={() => { setEditingSystem(sys); setError(null); setSuccessMsg(null); }}
                      title="KI-Scanner (PDF Abgleich)"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
                    >
                      <Bot size={16} />
                    </button>
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
