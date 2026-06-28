import React, { useState, useEffect } from 'react';
import { Upload, Trash2, FileText, CheckCircle2, AlertTriangle, ShieldAlert, Edit, ArrowLeft } from 'lucide-react';
import { extractZipFiles } from '../parser/zipExtractor';
import { processImportedData } from '../parser/xmlParser';
import { saveSystem, getAllSystems, deleteSystem } from '../db/database';
import { resolveEntry, findEntryInSystem } from '../solver/validator';

const searchEditableEntries = (system, query) => {
  if (!query || query.length < 2) return [];
  const results = [];
  const q = query.toLowerCase();

  const addEntry = (entry, catalogueName, path) => {
    if (entry.name && entry.name.toLowerCase().includes(q)) {
      results.push({
        type: 'entry',
        id: entry.id,
        name: entry.name,
        catalogueName,
        path,
        ref: entry
      });
    }
  };

  const addGroup = (group, catalogueName, path) => {
    if (group.name && group.name.toLowerCase().includes(q)) {
      results.push({
        type: 'group',
        id: group.id,
        name: group.name,
        catalogueName,
        path,
        ref: group
      });
    }
  };

  const addProfile = (profile, catalogueName, path) => {
    if (profile.name && profile.name.toLowerCase().includes(q)) {
      results.push({
        type: 'profile',
        id: profile.id,
        name: profile.name,
        catalogueName,
        path,
        ref: profile
      });
    }
  };

  const traverse = (item, catalogueName, path) => {
    if (!item) return;

    if (item.selectionEntries) {
      item.selectionEntries.forEach(se => {
        addEntry(se, catalogueName, path + " -> " + se.name);
        traverse(se, catalogueName, path + " -> " + se.name);
      });
    }
    if (item.entryLinks) {
      item.entryLinks.forEach(el => {
        if (el.constraints?.length > 0) {
          addEntry(el, catalogueName, path + " -> Link: " + el.name);
        }
      });
    }
    if (item.selectionEntryGroups) {
      item.selectionEntryGroups.forEach(seg => {
        addGroup(seg, catalogueName, path + " -> Group: " + seg.name);
        traverse(seg, catalogueName, path + " -> Group: " + seg.name);
      });
    }
    if (item.profiles) {
      item.profiles.forEach(p => {
        addProfile(p, catalogueName, path + " -> Profile: " + p.name);
      });
    }
  };

  system.catalogues?.forEach(cat => {
    traverse(cat, cat.name, cat.name);

    cat.sharedSelectionEntries?.forEach(se => {
      addEntry(se, cat.name, cat.name + " (Shared) -> " + se.name);
      traverse(se, cat.name, cat.name + " (Shared) -> " + se.name);
    });
    cat.sharedSelectionEntryGroups?.forEach(seg => {
      addGroup(seg, cat.name, cat.name + " (Shared) -> " + seg.name);
      traverse(seg, cat.name, cat.name + " (Shared) -> " + seg.name);
    });
    cat.sharedProfiles?.forEach(p => {
      addProfile(p, cat.name, cat.name + " (Shared) -> " + p.name);
    });
  });

  return results.slice(0, 50);
};

export default function Importer({ onSystemImported }) {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [editingSystem, setEditingSystem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);

  const [localName, setLocalName] = useState('');
  const [localCosts, setLocalCosts] = useState({});
  const [localConstraints, setLocalConstraints] = useState({});
  const [localCharacteristics, setLocalCharacteristics] = useState({});

  useEffect(() => {
    if (editingSystem) {
      const results = searchEditableEntries(editingSystem, searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, editingSystem]);

  const handleSelectEntry = (res) => {
    setSelectedEntry(res);
    setLocalName(res.ref.name || '');
    
    const costsMap = {};
    if (res.type === 'entry' && res.ref.costs) {
      res.ref.costs.forEach(c => {
        costsMap[c.typeId] = c.value || 0;
      });
    }
    setLocalCosts(costsMap);

    const constraintsMap = {};
    if ((res.type === 'entry' || res.type === 'group') && res.ref.constraints) {
      res.ref.constraints.forEach(con => {
        constraintsMap[con.id] = con.value || 0;
      });
    }
    setLocalConstraints(constraintsMap);

    const characteristicsMap = {};
    if (res.type === 'profile' && res.ref.characteristics) {
      res.ref.characteristics.forEach(ch => {
        characteristicsMap[ch.name] = ch.value || '';
      });
    }
    setLocalCharacteristics(characteristicsMap);
  };

  const handleSave = async () => {
    try {
      selectedEntry.ref.name = localName;
      if (selectedEntry.type === 'entry') {
        if (selectedEntry.ref.costs) {
          selectedEntry.ref.costs.forEach(c => {
            if (localCosts[c.typeId] !== undefined) {
              c.value = parseFloat(localCosts[c.typeId]) || 0;
            }
          });
        }
        if (selectedEntry.ref.constraints) {
          selectedEntry.ref.constraints.forEach(con => {
            if (localConstraints[con.id] !== undefined) {
              con.value = parseFloat(localConstraints[con.id]) || 0;
            }
          });
        }
      } else if (selectedEntry.type === 'group') {
        if (selectedEntry.ref.constraints) {
          selectedEntry.ref.constraints.forEach(con => {
            if (localConstraints[con.id] !== undefined) {
              con.value = parseFloat(localConstraints[con.id]) || 0;
            }
          });
        }
      } else if (selectedEntry.type === 'profile') {
        if (selectedEntry.ref.characteristics) {
          selectedEntry.ref.characteristics.forEach(ch => {
            if (localCharacteristics[ch.name] !== undefined) {
              ch.value = localCharacteristics[ch.name];
            }
          });
        }
      }

      await saveSystem(editingSystem);
      setSuccessMsg(`"${localName}" erfolgreich gespeichert!`);
      setSelectedEntry(null);
      loadSystems();
      if (onSystemImported) onSystemImported();
    } catch (e) {
      console.error(e);
      setError('Fehler beim Speichern der Änderungen.');
    }
  };

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

  if (editingSystem) {
    return (
      <div className="container">
        <div className="gothic-panel">
          <div className="flex-between" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-gold-dim)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                className="btn-gold btn-sm" 
                onClick={() => { setEditingSystem(null); setSelectedEntry(null); setSearchQuery(''); setError(null); setSuccessMsg(null); }}
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

          {!selectedEntry ? (
            <div>
              <p className="text-dim" style={{ marginBottom: '16px', fontFamily: 'var(--font-body)' }}>
                Suche nach Einheiten, Upgrades, Ausrüstungs-Kategorien oder Profilen, um deren Werte (Punkte, Profile, Limits) direkt anzupassen.
              </p>
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Suche nach Name (mind. 2 Zeichen)..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-dark)',
                    color: 'var(--text-parchment)',
                    border: '1px solid var(--border-gold-dim)',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    fontFamily: 'var(--font-body)'
                  }}
                />
              </div>

              {/* Search Results */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {searchResults.map((res) => (
                  <div 
                    key={`${res.type}-${res.id}`} 
                    className="flex-between hover-row"
                    onClick={() => handleSelectEntry(res)}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid var(--border-dark)',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          padding: '2px 6px', 
                          borderRadius: '3px',
                          backgroundColor: res.type === 'entry' ? 'rgba(226,183,66,0.1)' : res.type === 'group' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                          color: res.type === 'entry' ? 'var(--text-gold)' : res.type === 'group' ? '#60a5fa' : '#34d399',
                          border: `1px solid ${res.type === 'entry' ? 'var(--border-gold-dim)' : res.type === 'group' ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.3)'}`
                        }}>
                          {res.type === 'entry' ? 'Einheit/Option' : res.type === 'group' ? 'Kategorie/Gruppe' : 'Profil'}
                        </span>
                        <strong style={{ fontSize: '0.95rem' }} className="font-serif">{res.name}</strong>
                      </div>
                      <div className="text-dim" style={{ fontSize: '0.75rem', marginTop: '4px', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
                        {res.path}
                      </div>
                    </div>
                  </div>
                ))}
                {searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-dim" style={{ textAlign: 'center', padding: '12px', fontFamily: 'var(--font-body)' }}>
                    Keine Einträge für "{searchQuery}" gefunden.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Editing Form */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="flex-between">
                <h3 className="font-serif text-gold" style={{ margin: 0 }}>Eintrag bearbeiten</h3>
                <button 
                  className="btn-gold btn-sm"
                  onClick={() => setSelectedEntry(null)}
                >
                  Zurück zur Suche
                </button>
              </div>

              <div style={{ padding: '16px', border: '1px solid var(--border-gold-dim)', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                {/* Type Badge */}
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    padding: '2px 6px', 
                    borderRadius: '3px',
                    backgroundColor: selectedEntry.type === 'entry' ? 'rgba(226,183,66,0.1)' : selectedEntry.type === 'group' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                    color: selectedEntry.type === 'entry' ? 'var(--text-gold)' : selectedEntry.type === 'group' ? '#60a5fa' : '#34d399',
                    border: `1px solid ${selectedEntry.type === 'entry' ? 'var(--border-gold-dim)' : selectedEntry.type === 'group' ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.3)'}`
                  }}>
                    {selectedEntry.type === 'entry' ? 'Einheit/Option' : selectedEntry.type === 'group' ? 'Kategorie/Gruppe' : 'Profil'}
                  </span>
                  <span className="text-dim font-sans" style={{ fontSize: '0.8rem', marginLeft: '12px' }}>
                    ID: {selectedEntry.id}
                  </span>
                </div>

                {/* Name Input */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>Name</label>
                  <input 
                    type="text" 
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-dark)',
                      color: 'var(--text-parchment)',
                      border: '1px solid var(--border-dark)',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-body)'
                    }}
                  />
                </div>

                {/* Costs Editor (for Selection Entries) */}
                {selectedEntry.type === 'entry' && selectedEntry.ref.costs?.length > 0 && (
                  <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-dark)', paddingTop: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>Punktekosten</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedEntry.ref.costs.map((c) => (
                        <div key={c.typeId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.85rem', width: '100px', fontFamily: 'var(--font-body)' }}>{c.name || 'Punkte'}:</span>
                          <input 
                            type="number" 
                            value={localCosts[c.typeId] || 0}
                            onChange={(e) => setLocalCosts({ ...localCosts, [c.typeId]: e.target.value })}
                            style={{
                              width: '100px',
                              padding: '6px 8px',
                              backgroundColor: 'var(--bg-dark)',
                              color: 'var(--text-parchment)',
                              border: '1px solid var(--border-dark)',
                              borderRadius: '4px',
                              textAlign: 'right',
                              fontFamily: 'var(--font-body)'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Profile Characteristics Editor */}
                {selectedEntry.type === 'profile' && selectedEntry.ref.characteristics?.length > 0 && (
                  <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-dark)', paddingTop: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>Profilwerte</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px' }}>
                      {selectedEntry.ref.characteristics.map((ch) => (
                        <div key={ch.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{ch.name}</span>
                          <input 
                            type="text" 
                            value={localCharacteristics[ch.name] || ''}
                            onChange={(e) => setLocalCharacteristics({ ...localCharacteristics, [ch.name]: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '6px',
                              textAlign: 'center',
                              backgroundColor: 'var(--bg-dark)',
                              color: 'var(--text-parchment)',
                              border: '1px solid var(--border-dark)',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontFamily: 'var(--font-body)'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Constraints Editor */}
                {(selectedEntry.type === 'entry' || selectedEntry.type === 'group') && selectedEntry.ref.constraints?.length > 0 && (
                  <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-dark)', paddingTop: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>Regeln &amp; Limits (Constraints)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedEntry.ref.constraints.map((con) => (
                        <div 
                          key={con.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            border: '1px solid var(--border-dark)',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(0,0,0,0.1)'
                          }}
                        >
                          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                            <strong>{con.type === 'max' ? 'Maximal' : 'Mindestens'}:</strong>
                            <span style={{ marginLeft: '6px', color: 'var(--text-dim)' }}>
                              {con.field === 'pts' || con.field === 'ecfa-8486-4f6c-c249' ? 'Punkte' : 'Auswahlen'} (Scope: {con.scope})
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                              type="number" 
                              value={localConstraints[con.id] || 0}
                              onChange={(e) => setLocalConstraints({ ...localConstraints, [con.id]: e.target.value })}
                              style={{
                                width: '80px',
                                padding: '6px 8px',
                                backgroundColor: 'var(--bg-dark)',
                                color: 'var(--text-parchment)',
                                border: '1px solid var(--border-dark)',
                                borderRadius: '4px',
                                textAlign: 'right',
                                fontFamily: 'var(--font-body)'
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn-primary" 
                  onClick={handleSave}
                  style={{ flex: 1, padding: '10px' }}
                >
                  Speichern
                </button>
                <button 
                  className="btn-gold" 
                  onClick={() => setSelectedEntry(null)}
                  style={{ flex: 1, padding: '10px' }}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="gothic-panel">
        <h1>...</h1>
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn-gold btn-sm" 
                    onClick={() => { setEditingSystem(sys); setSearchQuery(''); setSelectedEntry(null); setError(null); setSuccessMsg(null); }}
                    title="Daten anpassen"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
                  >
                    <Edit size={16} />
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
