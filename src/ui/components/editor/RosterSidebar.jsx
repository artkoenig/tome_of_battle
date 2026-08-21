import React from 'react';
import { Check, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { useRosterSidebar } from '../../viewmodels/editor/useRosterSidebar';
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

/**
 * Die Zusammenfassung rechts neben dem Editor: Punktstand, Gesamtstatus,
 * Extra-Ressourcen, Armeeanforderungen und Verletzungsliste.
 *
 * Alles darin kommt seit Issue 0164 aus {@link useRosterSidebar} — auch der
 * Slot-Pfad des ersten Kontingents, den die Anforderungen brauchen.
 */
export default function RosterSidebar({ className }) {
  const { t } = useTranslation();
  const {
    totalCosts, costLimit, costTypeLabel, isValid, blockingErrorCount,
    extraResources, requirements, violations
  } = useRosterSidebar();

  return (
    <div className={`builder-right-bar ${className || ''}`}>
      <h3>{t('editor.sidebar.title')}</h3>
      <div className="sidebar-summary">
        <div data-testid="sidebar-total-costs" className="flex-between text-ui-title text-gold sidebar-summary-total">
          <span>{t('editor.sidebar.totalCosts')}</span>
          <span>
            {totalCosts} / {costLimit} {costTypeLabel}
          </span>
        </div>
        <div className="flex-between text-label text-dim">
          <span>{t('editor.sidebar.status')}</span>
          {isValid ? (
            <span className="badge badge-success">{t('editor.sidebar.valid')}</span>
          ) : (
            <span className="badge badge-danger">{t('editor.sidebar.invalid', { count: blockingErrorCount })}</span>
          )}
        </div>
        {extraResources.map(res => (
          <div key={res.id} className="flex-between text-label text-dim sidebar-summary-resource">
            <span>{res.name}:</span>
            <span className="badge badge-muted">{res.total}</span>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="sidebar-section">
        <h4 data-testid="sidebar-army-requirements" className="sidebar-section-title">{t('editor.sidebar.armyRequirements')}</h4>
        {requirements.map(requirement => (
          <div key={requirement.key} className="flex-between text-label sidebar-requirement-row">
            <span>
              {requirement.name}:
            </span>
            <CategoryCountBadge
              count={requirement.count}
              min={requirement.min}
              max={requirement.max}
              hasErrors={requirement.hasErrors}
            />
          </div>
        ))}
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
