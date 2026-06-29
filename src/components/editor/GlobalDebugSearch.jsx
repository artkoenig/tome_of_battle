import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { searchEditableEntries } from '../../parser/catalogEditor';

export default function GlobalDebugSearch({ systems, onSelectEntry }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    let allResults = [];
    for (const sys of systems) {
      const sysResults = searchEditableEntries(sys, query);
      sysResults.forEach(r => r.system = sys);
      allResults = allResults.concat(sysResults);
    }
    setResults(allResults.slice(0, 50));
  }, [query, systems]);

  return (
    <div style={{ position: 'relative', margin: '0 16px', flex: 1, maxWidth: '400px' }}>
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input
           type="text"
           placeholder="Globale Katalog-Suche..."
           value={query}
           onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
           onFocus={() => setIsOpen(true)}
           style={{ width: '100%', padding: '6px 12px 6px 32px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-gold-dim)', color: 'var(--text-gold)', borderRadius: '4px', outline: 'none' }}
        />
      </div>
      {isOpen && query.length >= 2 && (
         <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-gold-dim)', maxHeight: '400px', overflowY: 'auto', zIndex: 1000, marginTop: '4px', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
           {results.length === 0 ? (
             <div style={{ padding: '8px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>Keine Ergebnisse.</div>
           ) : (
             results.map((r, idx) => (
               <div 
                 key={idx} 
                 onClick={() => { 
                   onSelectEntry({ ref: r.ref, path: r.path, catalogueName: r.system.name }, r.system); 
                   setIsOpen(false); 
                   setQuery(''); 
                 }}
                 style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-dark)', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
               >
                 <span style={{ color: 'var(--text-gold)', fontWeight: 'bold', fontSize: '0.9rem' }}>{r.name}</span>
                 <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{r.type} • {r.system.name}</span>
               </div>
             ))
           )}
         </div>
      )}
    </div>
  );
}
