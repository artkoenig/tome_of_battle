import React from 'react';
import { Check, ShieldAlert } from 'lucide-react';
import { computeRosterCounts, getModifiedConstraintValue } from '../../solver/validator';
import { useDebugMode } from '../../hooks/DebugContext';

export default function RosterSidebar({
  roster,
  system,
  costs,
  validationErrors,
  costTypeLabel,
  className
}) {
  const { showDebugIds } = useDebugMode();
  return (
    <div className={`builder-right-bar ${className || ''}`}>
      <h3>Lagerbericht</h3>
      <div style={{ margin: '16px 0', borderBottom: '1px solid var(--border-dark)', paddingBottom: '12px' }}>
        <div className="flex-between font-serif text-gold" style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
          <span>Gesamtkosten:</span>
          <span className="font-sans">
            {costs[roster.costLimitType] || 0} / {roster.costLimit} {costTypeLabel}
          </span>
        </div>
        <div className="flex-between text-dim" style={{ fontSize: '0.85rem' }}>
          <span>Status:</span>
          {validationErrors.length === 0 ? (
            <span className="badge badge-success">Gültig</span>
          ) : (
            <span className="badge badge-danger">Fehlerhaft ({validationErrors.length})</span>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Detachement Anforderungen</h4>
        {(() => {
          const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
          const forceId = roster.forces[0]?.id;
          const forceCategoryCounts = forceId ? (categoryCounts[forceId] || {}) : {};

          return system.forceEntries?.[0]?.categoryLinks?.map(catLink => {
            const catName = system.categoryEntries?.find(c => c.id === catLink.targetId)?.name || catLink.name;
            const count = forceCategoryCounts[catLink.targetId] || 0;

            const minConRef = catLink.constraints?.find(c => c.type === 'min');
            const minCon = minConRef 
              ? Math.max(0, getModifiedConstraintValue(minConRef, catLink.modifiers, roster, selectionCounts, forceCategoryCounts))
              : 0;

            const maxConRef = catLink.constraints?.find(c => c.type === 'max');
            let maxCon = maxConRef 
              ? (() => {
                  const val = getModifiedConstraintValue(maxConRef, catLink.modifiers, roster, selectionCounts, forceCategoryCounts);
                  return val < 0 ? Infinity : val;
                })()
              : Infinity;

            // Fallback for Heroes category limit to match Characters limit
            if (catLink.targetId === 'c16b-f319-2c62-2c12' && maxCon === Infinity) {
              const charCatLink = system.forceEntries?.[0]?.categoryLinks?.find(cl => cl.targetId === '7a1c-d611-c2dc-def1');
              const charMaxConRef = charCatLink?.constraints?.find(c => c.type === 'max');
              if (charMaxConRef) {
                const val = getModifiedConstraintValue(charMaxConRef, charCatLink.modifiers, roster, selectionCounts, forceCategoryCounts);
                if (val >= 0) maxCon = val;
              }
            }
            
            const isInvalid = count < minCon || count > maxCon;

            return (
              <div 
                key={catLink.id} 
                className="flex-between" 
                style={{ 
                  fontSize: '0.85rem', 
                  padding: '6px 0', 
                  color: 'var(--text-parchment)'
                }}
              >
                <span>
                  {catName}
                  {showDebugIds && <span className="debug-id-badge">{catLink.targetId}</span>}
                  :
                </span>
                <span 
                  className={isInvalid ? "badge badge-danger font-sans" : "badge font-sans"} 
                  style={{ 
                    fontSize: '0.8rem', 
                    padding: '2px 8px',
                    ...(isInvalid ? {} : {
                      backgroundColor: 'rgba(226, 183, 66, 0.05)',
                      border: '1px solid rgba(226, 183, 66, 0.2)',
                      color: 'var(--text-gold)'
                    })
                  }}
                >
                  {(() => {
                    const limitParts = [];
                    if (minCon > 0) limitParts.push(`Min: ${minCon}`);
                    if (maxCon !== Infinity) limitParts.push(`Max: ${maxCon}`);
                    const limitText = limitParts.length > 0 ? `/ ${limitParts.join(', ')}` : '';
                    return `${count} ${limitText}`.trim();
                  })()}
                </span>
              </div>
            );
          });
        })()}
      </div>

      {/* Validation Errors Detailed List */}
      <div>
        <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Regelverstöße</h4>
        {validationErrors.length === 0 ? (
          <p className="text-success" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={16} /> Alle Riten eingehalten. Roster ist bereit für die Schlacht.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {validationErrors.map((err, idx) => (
              <div key={idx} className="validation-error-item">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <ShieldAlert size={14} className="text-danger" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>{err.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
