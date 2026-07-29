import React from 'react';
import { Check, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { computeRosterCounts, getCategoryDisplayLimits, findForceEntryById, isCategoryLinkHidden, getExtraResourceTotals, buildModifierEvalContext } from '../../solver/validator';
import { hasBlockingViolations, countBlockingViolations } from '../../evaluation/violationStats';
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

/** Eine Zeile der Armeeanforderungen: Kategoriename und der Zähl-Chip mit seinen Grenzen. */
function CategoryRequirementRow({ name, count, minValue, maxValue, minConstraint, maxConstraint }) {
  const isInvalid = count < minValue || count > maxValue;

  return (
    <div className="flex-between text-label sidebar-requirement-row">
      <span>
        {name}:
      </span>
      <CategoryCountBadge
        count={count}
        minValue={minValue}
        maxValue={maxValue}
        minConstraint={minConstraint}
        maxConstraint={maxConstraint}
        hasErrors={isInvalid}
      />
    </div>
  );
}

/**
 * Die Armeeanforderungen der ersten Streitmacht: je sichtbarem Kategorie-Link eine
 * Zeile mit aktueller Anzahl und den wirksamen Min-/Max-Grenzen.
 */
function CategoryRequirementList({ roster, system }) {
  const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
  const force = roster.forces[0];
  const forceDef = findForceEntryById(system, force?.forceEntryId);
  const forceCategoryCounts = force?.id ? (categoryCounts[force.id] || {}) : {};
  const displayContext = buildModifierEvalContext({
    roster, system, categorySlices: { selectionCounts, forceCategoryCounts }
  });

  return (forceDef?.categoryLinks || []).map(catLink => {
    if (isCategoryLinkHidden(catLink, { system, roster, selectionCounts, forceCategoryCounts })) {
      return null;
    }

    const { minValue, maxValue, minConstraint, maxConstraint } =
      getCategoryDisplayLimits(catLink, { system, forceDef, displayContext });

    return (
      <CategoryRequirementRow
        key={catLink.id}
        name={system.categoryEntries?.find(c => c.id === catLink.targetId)?.name || catLink.name}
        count={forceCategoryCounts[catLink.targetId] || 0}
        minValue={minValue}
        maxValue={maxValue}
        minConstraint={minConstraint}
        maxConstraint={maxConstraint}
      />
    );
  });
}

export default function RosterSidebar({
  roster,
  system,
  costs,
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
            {costs[roster.costLimitType] || 0} / {roster.costLimit} {costTypeLabel}
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
        {getExtraResourceTotals(system, roster, costs).map(res => (
          <div key={res.id} className="flex-between text-label text-dim sidebar-summary-resource">
            <span>{res.name}:</span>
            <span className="badge badge-muted">{res.total}</span>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="sidebar-section">
        <h4 data-testid="sidebar-army-requirements" className="sidebar-section-title">{t('editor.sidebar.armyRequirements')}</h4>
        <CategoryRequirementList roster={roster} system={system} />
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
