import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { saveSystem } from '../../db/database';
import { updateRawXml } from '../../parser/catalogEditor';
import { processImportedData } from '../../parser/xmlParser';

export default function DebugEntryEditorModal({ entry, system, onClose, onSave }) {
  const [localName, setLocalName] = useState(entry.name || '');
  const [localCosts, setLocalCosts] = useState({});
  const [localConstraints, setLocalConstraints] = useState({});
  const [localCharacteristics, setLocalCharacteristics] = useState({});
  const [localDescription, setLocalDescription] = useState('');
  const [localPublicationId, setLocalPublicationId] = useState('');
  const [localPage, setLocalPage] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (entry && entry.ref) {
      setLocalName(entry.ref.name || entry.name || '');

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
      setLocalPublicationId(entry.ref.publicationId || '');
      setLocalPage(entry.ref.page || '');
      setError(null);
      setSuccessMsg(null);
    }
  }, [entry]);

  const getSystemPublications = () => {
    const list = [];
    if (system.publications) {
      list.push(...system.publications);
    }
    system.catalogues?.forEach(cat => {
      if (cat.publications) {
        list.push(...cat.publications);
      }
    });
    const seen = new Set();
    return list.filter(p => {
      if (!p || !p.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  };

  const handleSave = async () => {
    try {
      updateRawXml(
        system,
        entry.id,
        entry.type,
        localName,
        localCosts,
        localConstraints,
        localCharacteristics,
        localDescription,
        localPublicationId,
        localPage
      );

      let nextSystem = system;
      if (system.rawXmls && system.rawXmls.gst && system.rawXmls.gst.length > 0) {
        const reParsed = processImportedData(system.rawXmls.gst, system.rawXmls.cat || []);
        reParsed.rawXmls = system.rawXmls;
        nextSystem = reParsed;
      }

      await saveSystem(nextSystem);
      setSuccessMsg('Änderungen erfolgreich gespeichert und XMLs modifiziert!');
      if (onSave) {
        onSave(nextSystem);
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Speichern der Änderungen: ' + err.message);
    }
  };

  if (!entry) return null;

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0 }} className="font-serif text-gold">Daten anpassen</h3>
            <div className="text-dim text-micro" style={{ marginTop: '4px' }}>
              {entry.path || entry.id}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
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

          <div style={{ marginBottom: '12px' }}>
            <div className="flex-between" style={{ marginBottom: '6px' }}>
              <span className="text-dim text-micro">ID: {entry.id}</span>
              <span className="badge">{entry.type}</span>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              Name / Bezeichnung
            </label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label className="text-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Publikationsreferenz
              </label>
              <select
                value={localPublicationId}
                onChange={(e) => setLocalPublicationId(e.target.value)}
                style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', color: 'var(--text-parchment)', border: '1px solid var(--border-dark)' }}
                className="text-label"
              >
                <option value="">-- Keine --</option>
                {getSystemPublications().map(pub => (
                  <option key={pub.id} value={pub.id}>
                    {pub.name} {pub.shortName ? `(${pub.shortName})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Seite (Page)
              </label>
              <input
                type="text"
                value={localPage}
                onChange={(e) => setLocalPage(e.target.value)}
                style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', color: 'var(--text-parchment)', border: '1px solid var(--border-dark)' }}
                className="text-label"
              />
            </div>
          </div>

          {entry.type === 'entry' && Object.keys(localCosts).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label className="text-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Punktekosten
              </label>
              {Object.entries(localCosts).map(([typeId, val]) => {
                const costType = system.costTypes?.find(ct => ct.id === typeId);
                const displayName = costType ? costType.name.trim() : (typeId === 'pts' || typeId === 'ecfa-8486-4f6c-c249' ? 'Points' : typeId);
                return (
                  <div key={typeId} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span className="text-label" style={{ minWidth: '80px' }}>{displayName}:</span>
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => setLocalCosts(prev => ({ ...prev, [typeId]: e.target.value }))}
                      style={{ width: '120px', padding: '6px' }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {['entry', 'group', 'categoryLink', 'forceEntry'].includes(entry.type) && Object.keys(localConstraints).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label className="text-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Restriktionen / Constraints
              </label>
              {Object.entries(localConstraints).map(([conId, val]) => {
                const conDef = entry.ref.constraints?.find(c => c.id === conId);
                return (
                  <div key={conId} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span className="text-micro" style={{ minWidth: '120px' }}>
                      {conDef?.type || 'Constraint'} ({conDef?.field || 'selections'}):
                    </span>
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => setLocalConstraints(prev => ({ ...prev, [conId]: e.target.value }))}
                      style={{ width: '100px', padding: '6px' }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {entry.type === 'profile' && Object.keys(localCharacteristics).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label className="text-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Charakteristik / Profilwerte
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {Object.entries(localCharacteristics).map(([name, val]) => (
                  <div key={name} style={{ textAlign: 'center' }}>
                    <span className="text-micro" style={{ fontWeight: 'bold' }}>{name}</span>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => setLocalCharacteristics(prev => ({ ...prev, [name]: e.target.value }))}
                      style={{ width: '100%', padding: '4px', textAlign: 'center', marginTop: '2px' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {entry.type === 'rule' && (
            <div style={{ marginBottom: '16px' }}>
              <label className="text-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Regelbeschreibung
              </label>
              <textarea
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-card)',
                  color: 'var(--text-parchment)',
                  border: '1px solid var(--border-dark)'
                }}
                className="text-label"
              />
            </div>
          )}

          {entry.ref && (
            (entry.ref.selectionEntries && entry.ref.selectionEntries.length > 0) ||
            (entry.ref.selectionEntryGroups && entry.ref.selectionEntryGroups.length > 0) ||
            (entry.ref.entryLinks && entry.ref.entryLinks.length > 0) ||
            (entry.ref.infoLinks && entry.ref.infoLinks.length > 0) ||
            (entry.ref.profiles && entry.ref.profiles.length > 0) ||
            (entry.ref.rules && entry.ref.rules.length > 0)
          ) && (
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
              <label className="text-body" style={{ display: 'block', marginBottom: '12px', fontWeight: 600, color: 'var(--text-gold)' }}>
                Kind-Elemente
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {entry.ref.selectionEntries?.map(child => (
                  <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="text-micro text-dim" style={{ minWidth: '80px' }}>Entry:</span>
                    <span className="debug-id-badge clickable" style={{ cursor: 'pointer' }}>
                      {child.name || 'Unbenannt'}: {child.id}
                    </span>
                  </div>
                ))}
                
                {entry.ref.selectionEntryGroups?.map(child => (
                  <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="text-micro text-dim" style={{ minWidth: '80px' }}>Group:</span>
                    <span className="debug-id-badge clickable" style={{ cursor: 'pointer' }}>
                      {child.name || 'Unbenannt'}: {child.id}
                    </span>
                  </div>
                ))}

                {entry.ref.entryLinks?.map(child => (
                  <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="text-micro text-dim" style={{ minWidth: '80px' }}>Link:</span>
                    <span className="debug-id-badge clickable" style={{ cursor: 'pointer' }}>
                      {child.name || 'Unbenannter Link'}: {child.id}
                    </span>
                  </div>
                ))}

                {entry.ref.infoLinks?.map(child => (
                  <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="text-micro text-dim" style={{ minWidth: '80px' }}>Link ({child.type}):</span>
                    <span className="debug-id-badge clickable" style={{ cursor: 'pointer' }}>
                      {child.name || 'InfoLink'}: {child.targetId}
                    </span>
                  </div>
                ))}

                {entry.ref.profiles?.map(child => (
                  <div key={child.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="text-micro text-dim" style={{ minWidth: '80px' }}>Profile:</span>
                      <span className="debug-id-badge clickable" style={{ cursor: 'pointer' }}>
                        {child.name || 'Unbenannt'}: {child.id}
                      </span>
                    </div>
                    {child.characteristics?.length > 0 && (
                      <div style={{ marginLeft: '88px', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                        {child.characteristics.map(ch => (
                          <span key={ch.name} className="text-micro text-dim">
                            <span style={{ fontWeight: 'bold' }}>{ch.name}:</span> {ch.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {entry.ref.rules?.map(child => (
                  <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="text-micro text-dim" style={{ minWidth: '80px' }}>Rule:</span>
                    <span className="debug-id-badge clickable" style={{ cursor: 'pointer' }}>
                      {child.name || 'Unbenannt'}: {child.id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
