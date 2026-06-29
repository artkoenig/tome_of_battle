import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShieldAlert, CheckCircle2, Search, RefreshCw } from 'lucide-react';
import { saveSystem } from '../../db/database';
import { 
  updateRawXml, 
  findAndMutateJsonPatch, 
  getCatalogueContext, 
  parsePageNumbers, 
  runVisionAnalysis,
  searchEditableEntries
} from '../../parser/pdfRulesExtractor';
import { processImportedData } from '../../parser/xmlParser';
import { useDebugMode } from '../../hooks/DebugContext';


export default function SystemEditorView({ system, onClose, onSystemSaved }) {
  const { showDebugIds } = useDebugMode();
  const [editingSystem, setEditingSystem] = useState(system);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);

  const [localName, setLocalName] = useState('');
  const [localCosts, setLocalCosts] = useState({});
  const [localConstraints, setLocalConstraints] = useState({});
  const [localCharacteristics, setLocalCharacteristics] = useState({});
  const [localDescription, setLocalDescription] = useState('');

  const [activeTab, setActiveTab] = useState('auto');
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pageRange, setPageRange] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [analysisLogs, setAnalysisLogs] = useState([]);
  const [detectedPatches, setDetectedPatches] = useState([]);

  // Search trigger
  useEffect(() => {
    if (editingSystem) {
      const results = searchEditableEntries(editingSystem, searchQuery);
      setSearchResults(results);
    }
  }, [searchQuery, editingSystem]);

  const loadPdfJs = () => {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const handleSelectEntryForEdit = (entry) => {
    setSelectedEntry(entry);
    setLocalName(entry.ref.name || '');
    
    const costsMap = {};
    entry.ref.costs?.forEach(c => {
      costsMap[c.typeId] = c.value;
    });
    setLocalCosts(costsMap);

    const conMap = {};
    entry.ref.constraints?.forEach(c => {
      conMap[c.id] = c.value;
    });
    setLocalConstraints(conMap);

    const charMap = {};
    entry.ref.characteristics?.forEach(c => {
      charMap[c.name] = c.value;
    });
    setLocalCharacteristics(charMap);

    setLocalDescription(entry.ref.description || '');
    setError(null);
    setSuccessMsg(null);
  };

  const handleSaveEntryModifications = async () => {
    try {
      updateRawXml(editingSystem, selectedEntry.id, selectedEntry.type, localName, localCosts, localConstraints, localCharacteristics, localDescription);
      
      let nextSystem = editingSystem;
      if (editingSystem.rawXmls && editingSystem.rawXmls.gst && editingSystem.rawXmls.gst.length > 0) {
        const reParsed = processImportedData(editingSystem.rawXmls.gst, editingSystem.rawXmls.cat || []);
        reParsed.rawXmls = editingSystem.rawXmls;
        nextSystem = reParsed;
      }
      
      await saveSystem(nextSystem);
      setEditingSystem(nextSystem);
      setSuccessMsg(`Änderungen an "${localName}" erfolgreich gespeichert und XML modifiziert!`);
      
      const updatedResults = searchEditableEntries(nextSystem, searchQuery);
      setSearchResults(updatedResults);
      
      // Update local edit reference
      const updatedEntry = updatedResults.find(r => r.id === selectedEntry.id);
      if (updatedEntry) {
        setSelectedEntry(updatedEntry);
      }
      onSystemSaved();
    } catch (e) {
      console.error(e);
      setError('Fehler beim Speichern der Änderungen.');
    }
  };

  const handleStartAnalysis = async () => {
    if (!apiKey) {
      setError('Bitte trage einen Gemini API-Schlüssel ein.');
      return;
    }
    if (!selectedCatalogId) {
      setError('Bitte wähle zuerst eine Fraktion (Katalog) aus.');
      return;
    }
    if (!pdfFile) {
      setError('Bitte lade ein Armeebuch-PDF hoch.');
      return;
    }
    if (!pageRange) {
      setError('Bitte gib einen Seitenbereich an.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisLogs([{ type: 'info', message: 'Lese Armeebuch-PDF ein...' }]);
    setDetectedPatches([]);
    setError(null);
    setSuccessMsg(null);

    try {
      const pagesToProcess = parsePageNumbers(pageRange);
      if (pagesToProcess.length === 0) {
        throw new Error('Ungültiger Seitenbereich. Bitte verwende Zahlen (z. B. "55-70" oder "60").');
      }

      setAnalysisProgress('Lade PDF.js Renderer...');
      const pdfjsLib = await loadPdfJs();

      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const catalogueEntries = getCatalogueContext(editingSystem, selectedCatalogId);
      if (catalogueEntries.length === 0) {
        throw new Error('Es wurden keine Einträge für den ausgewählten Katalog gefunden.');
      }

      setAnalysisLogs(prev => [...prev, {
        type: 'info',
        message: `${catalogueEntries.length} Fraktions-Einträge für den Abgleich geladen.`
      }]);

      for (let i = 0; i < pagesToProcess.length; i++) {
        const pageNum = pagesToProcess[i];
        if (pageNum < 1 || pageNum > pdfDoc.numPages) {
          setAnalysisLogs(prev => [...prev, {
            type: 'error',
            message: `Seite ${pageNum} existiert nicht im PDF (max: ${pdfDoc.numPages}). Überspringe.`
          }]);
          continue;
        }

        setAnalysisProgress(`Rendere Seite ${pageNum} (${i + 1} von ${pagesToProcess.length})...`);
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

        setAnalysisProgress(`Analysiere Seite ${pageNum} via Gemini Vision KI...`);
        setAnalysisLogs(prev => [...prev, {
          type: 'info',
          message: `Sende Seite ${pageNum} an Gemini Vision API...`
        }]);

        const patches = await runVisionAnalysis(apiKey, base64Data, catalogueEntries);

        if (!Array.isArray(patches) || patches.length === 0) {
          setAnalysisLogs(prev => [...prev, {
            type: 'info',
            message: `[Seite ${pageNum}] Keine Abweichungen festgestellt.`
          }]);
        } else {
          setAnalysisLogs(prev => [...prev, {
            type: 'info',
            message: `[Seite ${pageNum}] ${patches.length} Abweichung(en) gefunden!`
          }]);
          
          patches.forEach(p => {
            setAnalysisLogs(prev => [...prev, {
              type: 'patch',
              message: `-> Korrektur für "${p.id}" (${p.field}): ${p.originalValue} -> ${p.newValue} (${p.reason})`
            }]);
            setDetectedPatches(prev => [...prev, p]);
          });
        }
      }

      setAnalysisProgress('Analyse abgeschlossen.');
      setAnalysisLogs(prev => [...prev, {
        type: 'success',
        message: `Analyse beendet. Insgesamt wurden ${detectedPatches.length + 1} Abweichungen auf den analysierten Seiten gefunden.`
      }]);
      localStorage.setItem('gemini_api_key', apiKey);
    } catch (e) {
      console.error(e);
      setError(`Kritischer Fehler bei der Analyse: ${e.message}`);
      setAnalysisLogs(prev => [...prev, {
        type: 'error',
        message: `Analyse abgebrochen aufgrund von Fehlermeldung: ${e.message}`
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyPatches = async () => {
    try {
      const sys = { ...editingSystem };
      let count = 0;

      detectedPatches.forEach(patch => {
        const result = findAndMutateJsonPatch(sys, patch);
        if (result) {
          count++;
        }
      });

      await saveSystem(sys);
      setEditingSystem(sys);
      setSuccessMsg(`${count} Korrekturen erfolgreich in die Spieldaten und XMLs eingespielt!`);
      setDetectedPatches([]);
      onSystemSaved();
    } catch (e) {
      console.error(e);
      setError(`Fehler beim Übernehmen der Korrekturen: ${e.message}`);
    }
  };

  return (
    <div className="container">
      <div className="gothic-panel">
        <div className="flex-between" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-gold-dim)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="btn-gold btn-sm" 
              onClick={onClose}
              style={{ padding: '4px 8px' }}
            >
              <ArrowLeft size={16} />
            </button>
            <h2 style={{ margin: 0 }} className="font-serif text-gold">Daten anpassen: {editingSystem.name}</h2>
          </div>
        </div>

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

        {/* Automatische PDF-Analyse (Gemini Vision) */}
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="gothic-panel" style={{ padding: '16px', borderStyle: 'solid', borderWidth: '1px' }}>
                <h3 className="font-serif text-gold" style={{ fontSize: '1rem', marginTop: 0 }}>Vision-Scanner Konfiguration</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Gemini API-Schlüssel</label>
                    <input 
                      type="password"
                      placeholder="AIzaSy..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      style={{ width: '100%', padding: '8px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Katalog zum Abgleich</label>
                    <select 
                      value={selectedCatalogId} 
                      onChange={(e) => setSelectedCatalogId(e.target.value)}
                      style={{ width: '100%', padding: '8px', height: '38px' }}
                    >
                      <option value="">-- Katalog wählen --</option>
                      {editingSystem.catalogues?.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Armeebuch PDF hochladen</label>
                    <input 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0])}
                      style={{ width: '100%', padding: '6px', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Seitenbereich (z. B. "50-52, 55")</label>
                    <input 
                      type="text"
                      placeholder="z. B. 45-50"
                      value={pageRange}
                      onChange={(e) => setPageRange(e.target.value)}
                      style={{ width: '100%', padding: '8px' }}
                    />
                  </div>
                </div>

                <button 
                  className="btn-primary" 
                  onClick={handleStartAnalysis}
                  disabled={isAnalyzing}
                  style={{ width: '100%', marginTop: '16px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="animate-spin" size={18} />
                      {analysisProgress}
                    </>
                  ) : (
                    'KI-Abgleich starten'
                  )}
                </button>
              </div>

              <div className="gothic-panel" style={{ padding: '16px', borderStyle: 'solid', borderWidth: '1px', maxHeight: '300px', overflowY: 'auto' }}>
                <h3 className="font-serif text-gold" style={{ fontSize: '1rem', marginTop: 0 }}>Gefundene Abweichungen</h3>
                {detectedPatches.length === 0 ? (
                  <p className="text-dim" style={{ fontSize: '0.85rem', textAlign: 'center', marginTop: '40px' }}>Noch keine Abweichungen gefunden. Führe den KI-Scan aus.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {detectedPatches.map((patch, pIdx) => (
                      <div key={pIdx} style={{ fontSize: '0.75rem', padding: '6px', border: '1px solid var(--border-dark)', borderRadius: '4px' }}>
                        <strong className="text-gold">{patch.id}</strong> ({patch.field}):<br />
                        <span className="text-dim">{patch.originalValue}</span> -&gt; <span className="text-success" style={{ fontWeight: 'bold' }}>{patch.newValue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="gothic-panel" style={{ padding: '16px', borderStyle: 'solid', borderWidth: '1px' }}>
              <h3 className="font-serif text-gold" style={{ fontSize: '1rem', marginTop: 0 }}>Scan-Protokoll</h3>
              <div style={{ 
                height: '180px', 
                overflowY: 'auto', 
                backgroundColor: 'rgba(0,0,0,0.2)', 
                border: '1px solid var(--border-dark)', 
                borderRadius: '4px',
                padding: '10px',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {analysisLogs.length === 0 && <span className="text-dim">Bereit zum Scannen...</span>}
                {analysisLogs.map((log, lIdx) => {
                  let color = 'var(--text-parchment)';
                  if (log.type === 'error') color = 'var(--color-danger)';
                  if (log.type === 'success') color = 'var(--color-success)';
                  if (log.type === 'patch') color = 'var(--text-gold)';
                  return (
                    <div key={lIdx} style={{ color }}>
                      [{new Date().toLocaleTimeString()}] {log.message}
                    </div>
                  );
                })}
              </div>

              {detectedPatches.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <button 
                    className="btn-primary" 
                    onClick={handleApplyPatches}
                    style={{ width: '100%', padding: '12px', backgroundColor: '#1b7340', borderColor: '#1b7340', fontSize: '1.05rem', fontWeight: 'bold' }}
                  >
                    Alle {detectedPatches.length} Korrekturen anwenden &amp; XMLs patchen
                  </button>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}
