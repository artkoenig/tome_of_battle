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


export default function SystemEditorView({ system, onClose, onSystemSaved }) {
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

  const [activeTab, setActiveTab] = useState('manual');
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

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-dark)' }}>
          <button 
            className={`btn-sm`}
            onClick={() => setActiveTab('manual')}
            style={{
              padding: '10px 16px',
              backgroundColor: activeTab === 'manual' ? 'rgba(226,183,66,0.1)' : 'transparent',
              color: activeTab === 'manual' ? 'var(--text-gold)' : 'var(--text-dim)',
              border: '1px solid var(--border-dark)',
              borderBottom: activeTab === 'manual' ? '1px solid transparent' : '1px solid var(--border-dark)',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            Manuelle Suche &amp; Editor
          </button>
          <button 
            className={`btn-sm`}
            onClick={() => setActiveTab('auto')}
            style={{
              padding: '10px 16px',
              backgroundColor: activeTab === 'auto' ? 'rgba(226,183,66,0.1)' : 'transparent',
              color: activeTab === 'auto' ? 'var(--text-gold)' : 'var(--text-dim)',
              border: '1px solid var(--border-dark)',
              borderBottom: activeTab === 'auto' ? '1px solid transparent' : '1px solid var(--border-dark)',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            Automatische PDF-Analyse (Gemini Vision)
          </button>
        </div>

        {activeTab === 'manual' ? (
          <div>
            <div className="search-container" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }} />
                <input 
                  type="text"
                  placeholder="Suche nach Einheiten, Upgrades, Regeln oder Profilen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 40px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <h3 className="font-serif text-gold" style={{ fontSize: '1rem', marginBottom: '10px' }}>Suchergebnisse ({searchResults.length})</h3>
                {searchQuery.length < 2 ? (
                  <p className="text-dim" style={{ fontSize: '0.85rem' }}>Gib mindestens 2 Zeichen ein, um die Datenbank zu durchsuchen.</p>
                ) : searchResults.length === 0 ? (
                  <p className="text-danger" style={{ fontSize: '0.85rem' }}>Keine übereinstimmenden Einträge in der Spieldatenbank gefunden.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                    {searchResults.map(entry => (
                      <div 
                        key={entry.id} 
                        onClick={() => handleSelectEntryForEdit(entry)}
                        className={`catalog-item ${selectedEntry?.id === entry.id ? 'active' : ''}`}
                        style={{ 
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '10px 12px',
                          border: selectedEntry?.id === entry.id ? '1px solid var(--text-gold)' : '1px solid var(--border-dark)',
                          background: selectedEntry?.id === entry.id ? 'rgba(226,183,66,0.05)' : 'transparent'
                        }}
                      >
                        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600 }}>{entry.name}</span>
                          <span className="badge font-sans" style={{ fontSize: '0.7rem' }}>{entry.type}</span>
                        </div>
                        <span className="text-dim" style={{ fontSize: '0.75rem', marginTop: '4px' }}>{entry.path}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-serif text-gold" style={{ fontSize: '1rem', marginBottom: '10px' }}>Werte anpassen</h3>
                {!selectedEntry ? (
                  <div style={{ border: '1px dashed var(--border-dark)', padding: '40px 16px', textAlign: 'center', borderRadius: '4px' }}>
                    <p className="text-dim">Wähle einen Eintrag aus der Ergebnisliste aus, um die Punktekosten oder Regeln manuell im XML anzupassen.</p>
                  </div>
                ) : (
                  <div className="gothic-panel" style={{ background: 'rgba(226,183,66,0.02)', padding: '16px', borderStyle: 'solid', borderWidth: '1px' }}>
                    <div className="flex-between" style={{ marginBottom: '12px' }}>
                      <span className="font-sans text-dim" style={{ fontSize: '0.8rem' }}>ID: {selectedEntry.id}</span>
                      <span className="badge">{selectedEntry.type}</span>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Name / Bezeichnung</label>
                      <input 
                        type="text"
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        style={{ width: '100%', padding: '8px' }}
                      />
                    </div>

                    {selectedEntry.type === 'entry' && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Punktekosten</label>
                        {Object.entries(localCosts).map(([typeId, val]) => {
                          const costType = editingSystem.costTypes?.find(ct => ct.id === typeId);
                          const displayName = costType ? costType.name.trim() : (typeId === 'pts' || typeId === 'ecfa-8486-4f6c-c249' ? 'Points' : typeId);
                          return (
                            <div key={typeId} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                              <span className="font-sans" style={{ fontSize: '0.85rem', minWidth: '40px' }}>{displayName}:</span>
                              <input 
                                type="number"
                                value={val}
                                onChange={(e) => setLocalCosts(prev => ({ ...prev, [typeId]: e.target.value }))}
                                style={{ width: '100px', padding: '6px' }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(selectedEntry.type === 'entry' || selectedEntry.type === 'group') && Object.keys(localConstraints).length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Restriktionen / Constraints</label>
                        {Object.entries(localConstraints).map(([conId, val]) => {
                          const conDef = selectedEntry.ref.constraints?.find(c => c.id === conId);
                          return (
                            <div key={conId} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                              <span className="font-sans" style={{ fontSize: '0.8rem', minWidth: '100px' }}>{conDef?.type || 'Constraint'} ({conDef?.field || 'selections'}):</span>
                              <input 
                                type="number"
                                value={val}
                                onChange={(e) => setLocalConstraints(prev => ({ ...prev, [conId]: e.target.value }))}
                                style={{ width: '80px', padding: '6px' }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {selectedEntry.type === 'profile' && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Charakteristik / Profilwerte</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                          {Object.entries(localCharacteristics).map(([name, val]) => (
                            <div key={name} style={{ textAlign: 'center' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{name}</span>
                              <input 
                                type="text"
                                value={val}
                                onChange={(e) => setLocalCharacteristics(prev => ({ ...prev, [name]: e.target.value }))}
                                style={{ width: '100%', padding: '4px', textAlign: 'center', fontSize: '0.85rem', marginTop: '2px' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedEntry.type === 'rule' && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Regelbeschreibung</label>
                        <textarea 
                          value={localDescription}
                          onChange={(e) => setLocalDescription(e.target.value)}
                          rows={6}
                          style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', color: 'var(--text-parchment)', border: '1px solid var(--border-dark)', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}
                        />
                      </div>
                    )}

                    <button 
                      className="btn-primary" 
                      onClick={handleSaveEntryModifications}
                      style={{ width: '100%', marginTop: '8px', padding: '10px' }}
                    >
                      Speichern &amp; XML anpassen
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
