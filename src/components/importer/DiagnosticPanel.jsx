import React from 'react';
import { getAllSystems } from '../../db/database';

export default function DiagnosticPanel() {
  const handleRunDiagnosis = async () => {
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

    const outputEl = document.getElementById('diag-output');
    if (outputEl) {
      outputEl.value = JSON.stringify(matches, null, 2);
    }
  };

  return (
    <div className="gothic-panel" style={{ marginTop: '24px' }}>
      <h2>Tome-Diagnostik</h2>
      <p className="text-dim" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
        Wenn bestimmte Ausrüstungsgegenstände oder Optionen nicht angezeigt werden, führe diese Diagnose aus und kopiere das Ergebnis hierher.
      </p>
      <button onClick={handleRunDiagnosis}>
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
  );
}
