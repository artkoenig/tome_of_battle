import React from 'react';
import { Check, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { computeRosterCounts, getModifiedConstraintValue, getEffectiveModifiers, findForceEntryById, isCategoryLinkHidden, getExtraResourceTotals, formatConstraintLimit, hasBlockingViolations, ValidationSeverity } from '../../solver/validator';
// Icon/CSS-Klasse je Schweregrad einer Validierungsmeldung — nur `error`
// blockiert das Roster (siehe hasBlockingViolations); `warning`/`info`
// erscheinen mit eigener, nicht-alarmierender Darstellung.
const SEVERITY_PRESENTATION = {
  [ValidationSeverity.ERROR]: { Icon: ShieldAlert, itemClass: '' },
  [ValidationSeverity.WARNING]: { Icon: AlertTriangle, itemClass: 'validation-error-item--warning' },
  [ValidationSeverity.INFO]: { Icon: Info, itemClass: 'validation-error-item--info' }
};

export default function RosterSidebar({
  roster,
  system,
  costs,
  validationErrors,
  costTypeLabel,
  className
}) {
  // Nur blockierende Verstöße machen das Roster ungültig; warning/info zählen nicht mit.
  const blockingErrorCount = validationErrors.filter(e => e.severity === ValidationSeverity.ERROR).length;
  return (
    <div className={`builder-right-bar ${className || ''}`}>
      <h3>Lagerbericht</h3>
      <div style={{ margin: '16px 0', borderBottom: '1px solid var(--border-dark)', paddingBottom: '12px' }}>
        <div className="flex-between text-ui-title text-gold" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
          <span>Gesamtkosten:</span>
          <span>
            {costs[roster.costLimitType] || 0} / {roster.costLimit} {costTypeLabel}
          </span>
        </div>
        <div className="flex-between text-label text-dim">
          <span>Status:</span>
          {hasBlockingViolations(validationErrors) ? (
            <span className="badge badge-danger">Fehlerhaft ({blockingErrorCount})</span>
          ) : (
            <span className="badge badge-success">Gültig</span>
          )}
        </div>
        {getExtraResourceTotals(system, roster, costs).map(res => (
          <div key={res.id} className="flex-between text-label text-dim" style={{ marginTop: '6px' }}>
            <span>{res.name}:</span>
            <span className="badge badge-muted">{res.total}</span>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '10px' }}>Armeeanforderungen</h4>
        {(() => {
          const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
          const forceId = roster.forces[0]?.id;
          const forceEntryId = roster.forces[0]?.forceEntryId;
          const forceDef = findForceEntryById(system, forceEntryId);
          const categoryLinks = forceDef?.categoryLinks || [];
          const forceCategoryCounts = forceId ? (categoryCounts[forceId] || {}) : {};

          return categoryLinks.map(catLink => {
            if (isCategoryLinkHidden(catLink, system, roster, selectionCounts, forceCategoryCounts)) {
              return null;
            }

            const catName = system.categoryEntries?.find(c => c.id === catLink.targetId)?.name || catLink.name;
            const count = forceCategoryCounts[catLink.targetId] || 0;
            const displayCtx = { roster, system, selectionCounts, forceCategoryCounts };

            const catLinkModifiers = getEffectiveModifiers(catLink);
            const minConRef = catLink.constraints?.find(c => c.type === 'min');
            const minCon = minConRef
              ? Math.max(0, getModifiedConstraintValue(minConRef, catLinkModifiers, displayCtx))
              : 0;

            const maxConRef = catLink.constraints?.find(c => c.type === 'max');
            let maxCon = maxConRef
              ? (() => {
                  const val = getModifiedConstraintValue(maxConRef, catLinkModifiers, displayCtx);
                  return val < 0 ? Infinity : val;
                })()
              : Infinity;

            // Fallback for Heroes category limit to match Characters limit
            if (catLink.targetId === 'c16b-f319-2c62-2c12' && maxCon === Infinity) {
              const charCatLink = forceDef?.categoryLinks?.find(cl => cl.targetId === '7a1c-d611-c2dc-def1');
              const charMaxConRef = charCatLink?.constraints?.find(c => c.type === 'max');
              if (charMaxConRef) {
                const val = getModifiedConstraintValue(charMaxConRef, getEffectiveModifiers(charCatLink), displayCtx);
                if (val >= 0) maxCon = val;
              }
            }
            
            const isInvalid = count < minCon || count > maxCon;

            return (
              <div 
                key={catLink.id} 
                className="flex-between text-label" 
                style={{ 
                  padding: '6px 0', 
                  color: 'var(--text-parchment)'
                }}
              >
                <span>
                  {catName}:
                </span>
                <span 
                  className={isInvalid ? "badge badge-danger" : "badge badge-muted"} 
                >
                  {(() => {
                    const limitParts = [];
                    if (minCon > 0) limitParts.push(`Min: ${formatConstraintLimit(minCon, minConRef)}`);
                    if (maxCon !== Infinity) limitParts.push(`Max: ${formatConstraintLimit(maxCon, maxConRef)}`);
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
        <h4 style={{ marginBottom: '10px' }}>Regelverstöße</h4>
        {validationErrors.length === 0 ? (
          <p className="text-label text-success" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={16} /> Alle Riten eingehalten. Roster ist bereit für die Schlacht.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {validationErrors.map((err, idx) => {
              const { Icon, itemClass } = SEVERITY_PRESENTATION[err.severity] || SEVERITY_PRESENTATION[ValidationSeverity.ERROR];
              return (
                <div key={idx} className={`validation-error-item ${itemClass}`}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <Icon size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>{err.message}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
