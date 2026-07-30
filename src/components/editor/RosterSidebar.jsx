import React from 'react';
import { Check, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { hasBlockingViolations, countBlockingViolations } from '../../evaluation/violationStats';
import { categoryAnchorSlotsOf } from '../../evaluation/slotLookups';
import { extraResourceTotalsOf } from '../../evaluation/costDisplays';
import CategoryCountBadge from './CategoryCountBadge';
import { useTranslation } from '../../i18n/useTranslation';
import { formatViolation } from '../../i18n/violationMessages';

// Icon/CSS-Klasse je Schweregrad einer Verletzung des Evaluator-Berichts —
// nur `error` blockiert das Roster (siehe violationStats.js); `warning`/`info`
// erscheinen mit eigener, nicht-alarmierender Darstellung.
const SEVERITY_PRESENTATION = {
  error: { Icon: ShieldAlert, itemClass: '' },
  warning: { Icon: AlertTriangle, itemClass: 'validation-error-item--warning' },
  info: { Icon: Info, itemClass: 'validation-error-item--info' }
};

// Die Armeeanforderungen zeigen das erste Kontingent des Rosters; sein
// Slot-Pfad ist sein Eingabe-Index (Pfad-Schema der Evaluator-Fassade).
const FIRST_FORCE_PATH = '0';

/**
 * Die Armeeanforderungen der ersten Streitmacht, gelesen aus den
 * Kategorie-Anker-Slots des Evaluator-Berichts (Issue 0121, Task 7): je
 * sichtbarem Kategorie-Anker eine Zeile mit aktuellem Stand (`current`) und
 * den wirksamen Grenzen (`effectiveMin`/`effectiveMax`; `null` = unbegrenzt).
 */
function CategoryRequirementList({ capabilities }) {
  return categoryAnchorSlotsOf(capabilities, FIRST_FORCE_PATH)
    .filter(({ capability }) => capability.isHidden !== true)
    .map(({ path, capability }) => {
      const isInvalid = capability.isMandatoryUnmet === true
        || (capability.effectiveMax !== null && capability.current > capability.effectiveMax);
      return (
        <div key={path} className="flex-between text-label sidebar-requirement-row">
          <span>
            {capability.name}:
          </span>
          <CategoryCountBadge
            count={capability.current}
            min={capability.effectiveMin}
            max={capability.effectiveMax}
            hasErrors={isInvalid}
          />
        </div>
      );
    });
}

export default function RosterSidebar({
  roster,
  costTotals,
  costTypes,
  capabilities,
  violations,
  costTypeLabel,
  className
}) {
  const { t } = useTranslation();
  // Nur blockierende Verletzungen machen das Roster ungültig; warning/info zählen nicht mit.
  const blockingErrorCount = countBlockingViolations(violations);
  return (
    <div className={`builder-right-bar ${className || ''}`}>
      <h3>{t('editor.sidebar.title')}</h3>
      <div className="sidebar-summary">
        <div data-testid="sidebar-total-costs" className="flex-between text-ui-title text-gold sidebar-summary-total">
          <span>{t('editor.sidebar.totalCosts')}</span>
          <span>
            {costTotals?.[roster.costLimitType] || 0} / {roster.costLimit} {costTypeLabel}
          </span>
        </div>
        <div className="flex-between text-label text-dim">
          <span>{t('editor.sidebar.status')}</span>
          {hasBlockingViolations(violations) ? (
            <span className="badge badge-danger">{t('editor.sidebar.invalid', { count: blockingErrorCount })}</span>
          ) : (
            <span className="badge badge-success">{t('editor.sidebar.valid')}</span>
          )}
        </div>
        {extraResourceTotalsOf(costTotals, costTypes, roster.costLimitType).map(res => (
          <div key={res.id} className="flex-between text-label text-dim sidebar-summary-resource">
            <span>{res.name}:</span>
            <span className="badge badge-muted">{res.total}</span>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="sidebar-section">
        <h4 data-testid="sidebar-army-requirements" className="sidebar-section-title">{t('editor.sidebar.armyRequirements')}</h4>
        <CategoryRequirementList capabilities={capabilities} />
      </div>

      {/* Validation Errors Detailed List */}
      <div>
        <h4 className="sidebar-section-title">{t('editor.sidebar.violations')}</h4>
        {violations.length === 0 ? (
          <p className="text-label text-success flex-row gap-6">
            <Check size={16} /> {t('editor.sidebar.allClear')}
          </p>
        ) : (
          <div className="sidebar-violation-list">
            {violations.map((violation, idx) => {
              const { Icon, itemClass } = SEVERITY_PRESENTATION[violation.severity] || SEVERITY_PRESENTATION.error;
              return (
                <div key={idx} className={`validation-error-item ${itemClass}`}>
                  <div className="sidebar-violation-body">
                    <Icon size={14} className="sidebar-violation-icon" />
                    <span>{formatViolation(violation, t)}</span>
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
