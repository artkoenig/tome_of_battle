import React, { useState, useEffect } from 'react';
import { Upload, Trash2, FileText, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { extractZipFiles } from '../parser/zipExtractor';
import { processImportedData } from '../parser/xmlParser';
import { saveSystem, getAllSystems, deleteSystem } from '../db/database';

export default function Importer({ onSystemImported }) {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

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
    setError(null);
    setSuccessMsg(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e) => {
    setError(null);
    setSuccessMsg(null);
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file) => {
    if (!file.name.endsWith('.zip')) {
      setError('Bitte lade eine gültige .zip-Datei hoch, die BSData-Kataloge enthält.');
      return;
    }

    setLoading(true);
    try {
      // 1. Extract ZIP files
      const { gstFiles, catFiles } = await extractZipFiles(file);
      
      // 2. Parse XML into JSON
      const systemData = processImportedData(gstFiles, catFiles);

      // 3. Save to database
      await saveSystem(systemData);

      setSuccessMsg(`Das System "${systemData.name}" mit ${systemData.catalogues.length} Katalogen wurde erfolgreich importiert!`);
      loadSystems();
      if (onSystemImported) onSystemImported();
    } catch (e) {
      console.error(e);
      setError(`Fehler beim Verarbeiten der ZIP-Datei: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Bist du sicher, dass du dieses Spielsystem löschen möchtest? Alle zugehörigen Listen gehen verloren.')) {
      try {
        await deleteSystem(id);
        setSuccessMsg('System gelöscht.');
        loadSystems();
        if (onSystemImported) onSystemImported();
      } catch (e) {
        setError('Fehler beim Löschen des Systems.');
      }
    }
  };

  return (
    <div className="container">
      <div className="gothic-panel">
        <h1>BSData Bibliothekar</h1>
        <p className="text-dim" style={{ textAlign: 'center', marginBottom: '20px' }}>
          Lade BSData Repository ZIP-Archive hoch (z.B. von BSData/wh40k-10th-edition). 
          Die Dateien werden komplett lokal auf deinem Gerät verarbeitet und in einer Browser-Datenbank gespeichert.
        </p>

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

        <div 
          className={`drop-zone ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-upload').click()}
        >
          <input 
            type="file" 
            id="file-upload" 
            style={{ display: 'none' }} 
            accept=".zip"
            onChange={handleFileInput}
          />
          <Upload className="drop-zone-icon" size={48} style={{ margin: '0 auto 12px' }} />
          <h3>Ziehe die BSData .zip hierher</h3>
          <p className="text-dim">oder klicke, um deine Dateien zu durchsuchen</p>
          {loading && (
            <div style={{ marginTop: '16px', color: 'var(--text-gold)' }}>
              <span className="font-serif">Beschwöre Spieldaten... (Verarbeite XML)</span>
            </div>
          )}
        </div>
      </div>

      <div className="gothic-panel" style={{ marginTop: '24px' }}>
        <h2>Importierte Spielsysteme</h2>
        {systems.length === 0 ? (
          <p className="text-dim" style={{ textAlign: 'center', padding: '20px 0' }}>
            Keine Spielsysteme geladen. Bitte importiere oben ein BSData-System (.zip).
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {systems.map((sys) => (
              <div 
                key={sys.id} 
                className="flex-between" 
                style={{ 
                  padding: '12px 16px', 
                  border: '1px solid var(--border-dark)', 
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255,255,255,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileText className="text-gold" size={24} />
                  <div>
                    <h4 style={{ margin: 0 }}>{sys.name}</h4>
                    <span className="text-dim" style={{ fontSize: '0.85rem' }}>
                      {sys.catalogues?.length || 0} Fraktionskataloge geladen
                    </span>
                  </div>
                </div>
                <button 
                  className="btn-danger btn-sm" 
                  onClick={() => handleDelete(sys.id)}
                  title="System löschen"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diagnostic Panel */}
      <div className="gothic-panel" style={{ marginTop: '24px' }}>
        <h2>Tome-Diagnostik</h2>
        <p className="text-dim" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
          Wenn bestimmte Ausrüstungsgegenstände oder Optionen nicht angezeigt werden, führe diese Diagnose aus und kopiere das Ergebnis hierher.
        </p>
        <button 
          onClick={async () => {
            const allSystems = await getAllSystems();
            const matches = [];
            
            allSystems.forEach(sys => {
              sys.catalogues?.forEach(cat => {
                const checkList = (list, path = "") => {
                  if (!list) return;
                  list.forEach(entry => {
                    const entryName = entry.name || "";
                    if (entryName.toLowerCase().includes("wizard") || 
                        entryName.toLowerCase().includes("arcane") || 
                        entryName.toLowerCase().includes("zauberer") ||
                        entryName.toLowerCase().includes("gegenstände") ||
                        entryName.toLowerCase().includes("relic") ||
                        entryName.toLowerCase().includes("mirror") ||
                        entryName.toLowerCase().includes("scroll") ||
                        entryName.toLowerCase().includes("stone") ||
                        entryName.toLowerCase().includes("magic") ||
                        entry.id === "36ea-06e6-53d9-6b07" ||
                        entry.id === "cbbf-b0c7-561e-bcd8") {
                      
                      matches.push({
                        system: sys.name,
                        catalogue: cat.name,
                        cataloguesInSystem: sys.catalogues.map(c => c.name),
                        path: path + " -> " + entryName + ` (id: ${entry.id}, targetId: ${entry.targetId || 'none'}, type: ${entry.type || 'none'})`,
                        selectionEntriesCount: entry.selectionEntries?.length || 0,
                        entryLinksCount: entry.entryLinks?.length || 0,
                        selectionEntryGroupsCount: entry.selectionEntryGroups?.length || 0,
                        rawChildren: (entry.selectionEntries || []).map(c => `${c.name} (${c.type})`).concat((entry.entryLinks || []).map(c => `${c.name} (${c.type}, target: ${c.targetId})`))
                      });
                    }
                    checkList(entry.selectionEntries, path + " -> " + entryName);
                    checkList(entry.entryLinks, path + " -> " + entryName);
                    checkList(entry.selectionEntryGroups, path + " -> " + entryName);
                  });
                };
                
                checkList(cat.selectionEntries, "root selectionEntries");
                checkList(cat.entryLinks, "root entryLinks");
                checkList(cat.sharedSelectionEntries, "sharedSelectionEntries");
                checkList(cat.sharedSelectionEntryGroups, "sharedSelectionEntryGroups");
              });
            });

            document.getElementById('diag-output').value = JSON.stringify(matches, null, 2);
          }}
        >
          Diagnose-Scan ausführen
        </button>
        <textarea 
          id="diag-output" 
          rows={10} 
          readOnly 
          style={{ 
            marginTop: '12px', 
            width: '100%', 
            fontFamily: 'monospace', 
            fontSize: '0.85rem',
            backgroundColor: 'var(--bg-dark)',
            color: 'var(--text-parchment)',
            border: '1px solid var(--border-gold-dim)'
          }}
          placeholder="Diagnose-Ergebnisse erscheinen hier nach dem Klick..."
        />
      </div>
    </div>
  );
}
