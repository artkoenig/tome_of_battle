import React from 'react';
import { Check, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { computeRosterCounts, getModifiedConstraintValue, getEffectiveModifiers, findForceEntryById, isCategoryLinkHidden, getExtraResourceTotals, formatConstraintLimit, hasBlockingViolations, countBlockingViolations, ValidationSeverity } from '../../solver/validator';
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
  const blockingErrorCount = countBlockingViolations(validationErrors);
  return (
    <div className={`builder-right-bar ${className || ''}`}>
      <h3>Lagerbericht</h3>
      <div className="sidebar-summary">
        <div className="flex-between text-ui-title text-gold sidebar-summary-total">
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
          <div key={res.id} className="flex-between text-label text-dim sidebar-summary-resource">
            <span>{res.name}:</span>
            <span className="badge badge-muted">{res.total}</span>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="sidebar-section">
        <h4 className="sidebar-section-title">Armeeanforderungen</h4>
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
                className="flex-between text-label sidebar-requirement-row"
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
        <h4 className="sidebar-section-title">Regelverstöße</h4>
        {validationErrors.length === 0 ? (
          <p className="text-label text-success flex-row gap-6">
            <Check size={16} /> Alle Riten eingehalten. Roster ist bereit für die Schlacht.
          </p>
        ) : (
          <div className="sidebar-violation-list">
            {validationErrors.map((err, idx) => {
              const { Icon, itemClass } = SEVERITY_PRESENTATION[err.severity] || SEVERITY_PRESENTATION[ValidationSeverity.ERROR];
              return (
                <div key={idx} className={`validation-error-item ${itemClass}`}>
                  <div className="sidebar-violation-body">
                    <Icon size={14} className="sidebar-violation-icon" />
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
