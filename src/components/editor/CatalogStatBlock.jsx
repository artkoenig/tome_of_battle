import React from 'react';
import { useDebugMode } from '../../hooks/DebugContext';

export default function CatalogStatBlock({ selectedCatalogEntry, setSelectedCatalogEntry }) {
  const { showDebugIds } = useDebugMode();

  if (!selectedCatalogEntry) return null;

  return (
    <div className="gothic-panel" style={{ borderStyle: 'solid', borderWidth: '1px', padding: '16px', marginBottom: '24px' }}>
      <div className="flex-between">
        <h3>
          {selectedCatalogEntry.name}
          {showDebugIds && <span className="debug-id-badge clickable">{selectedCatalogEntry.id}</span>}
          {' '} - Statblock
        </h3>
        <button className="btn-sm" onClick={() => setSelectedCatalogEntry(null)}>Schließen</button>
      </div>
      
      {selectedCatalogEntry.profiles?.map(prof => (
        <div key={prof.id} style={{ marginTop: '12px' }}>
          <span className="font-serif text-gold" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            {prof.name}
            {showDebugIds && <span className="debug-id-badge clickable">{prof.id}</span>}
            {' '}({prof.profileTypeName})
          </span>
          <div className="profile-table-container">
            <table className="profile-table">
              <thead>
                <tr>
                  {prof.characteristics.map(c => (
                    <th key={c.name}>{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {prof.characteristics.map(c => (
                    <td key={c.name} className="font-body">{c.value}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {selectedCatalogEntry.rules?.map(rule => (
        <div key={rule.id} style={{ marginTop: '8px' }}>
          <strong className="text-gold">
            {rule.name}
            {showDebugIds && <span className="debug-id-badge clickable">{rule.id}</span>}
            :
          </strong> <span style={{ fontSize: '0.9rem', color: 'var(--text-parchment)', fontStyle: 'italic' }}>{rule.description}</span>
        </div>
      ))}
    </div>
  );
}
