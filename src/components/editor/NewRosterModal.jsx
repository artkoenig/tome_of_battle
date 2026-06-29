import React from 'react';
import { useDebugMode } from '../../hooks/DebugContext';

export default function NewRosterModal({
  isOpen,
  onClose,
  onSubmit,
  systems,
  newRosterName,
  setNewRosterName,
  newRosterSystemId,
  handleSystemChange,
  newRosterCatId,
  setNewRosterCatId,
  newRosterLimit,
  setNewRosterLimit
}) {
  const { showDebugIds } = useDebugMode();
  
  if (!isOpen) return null;

  const activeModalSystem = systems.find(s => s.id === newRosterSystemId);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Neues Heer ausheben</h3>
          <button type="button" className="modal-close" onClick={onClose}>X</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Name des Heeres</label>
              <input 
                type="text" 
                placeholder="z. B. Ultramarines 2. Kompanie" 
                value={newRosterName}
                onChange={(e) => setNewRosterName(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Spielsystem</label>
              <select 
                value={newRosterSystemId} 
                onChange={(e) => handleSystemChange(e.target.value)}
                required
              >
                <option value="" disabled>System auswählen...</option>
                {systems.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{showDebugIds ? ` [ID: ${s.id}]` : ''}
                  </option>
                ))}
              </select>
              {systems.length === 0 && (
                <p className="text-danger" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                  Keine Spielsysteme importiert. Bitte gehe erst in den Bibliothekar.
                </p>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Katalog / Fraktion</label>
              <select 
                value={newRosterCatId}
                onChange={(e) => setNewRosterCatId(e.target.value)}
                required
                disabled={!newRosterSystemId || activeModalSystem?.catalogues?.length === 0}
              >
                <option value="" disabled>Fraktion auswählen...</option>
                {activeModalSystem?.catalogues?.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}{showDebugIds ? ` [ID: ${cat.id}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Punktegrenze</label>
              <input 
                type="number" 
                value={newRosterLimit}
                onChange={(e) => setNewRosterLimit(e.target.value)}
                required
                min={1}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose}>Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={systems.length === 0}>
              Heerschau starten
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
