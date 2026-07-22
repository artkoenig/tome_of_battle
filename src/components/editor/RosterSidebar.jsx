import React from 'react';
import { Check, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { computeRosterCounts, getModifiedConstraintValue, getEffectiveModifiers, findForceEntryById, isCategoryLinkHidden, getExtraResourceTotals, hasBlockingViolations, countBlockingViolations, ValidationSeverity } from '../../solver/validator';
import CategoryCountBadge from './CategoryCountBadge';
import { ConstraintKind } from '../../parser/schema/battlescribeSchema.generated.js';

// Icon/CSS-Klasse je Schweregrad einer Validierungsmeldung — nur `error`
// blockiert das Roster (siehe hasBlockingViolations); `warning`/`info`
// erscheinen mit eigener, nicht-alarmierender Darstellung.
const SEVERITY_PRESENTATION = {
  [ValidationSeverity.ERROR]: { Icon: ShieldAlert, itemClass: '' },
  [ValidationSeverity.WARNING]: { Icon: AlertTriangle, itemClass: 'validation-error-item--warning' },
  [ValidationSeverity.INFO]: { Icon: Info, itemClass: 'validation-error-item--info' }
};

// Die „Helden“-Kategorie trägt in den Katalogdaten kein eigenes Maximum, teilt sich
// die Obergrenze aber mit den „Charaktermodellen“.
const HEROES_CATEGORY_ID = 'c16b-f319-2c62-2c12';
const CHARACTERS_CATEGORY_ID = '7a1c-d611-c2dc-def1';

/**
 * Wirksame Obergrenze eines Kategorie-Links. Fehlt die Constraint oder ergibt sie nach
 * Anwendung der Modifikatoren einen negativen Wert, gilt die Kategorie als unbegrenzt.
 */
function resolveMaxLimit(maxConstraint, modifiers, displayContext) {
  if (!maxConstraint) return Infinity;
  const value = getModifiedConstraintValue(maxConstraint, modifiers, displayContext);
  return value < 0 ? Infinity : value;
}

/**
 * Rückgriff für „Helden“: übernimmt die Obergrenze der „Charaktermodelle“, weil die
 * Kategorie sonst fälschlich als unbegrenzt erschiene.
 */
function resolveHeroesMaxLimit(forceDef, displayContext) {
  const charactersLink = forceDef?.categoryLinks?.find(link => link.targetId === CHARACTERS_CATEGORY_ID);
  const charactersMaxConstraint = charactersLink?.constraints?.find(c => c.type === ConstraintKind.MAX);
  return resolveMaxLimit(charactersMaxConstraint, getEffectiveModifiers(charactersLink), displayContext);
}

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
  const displayContext = { roster, system, selectionCounts, forceCategoryCounts };

  return (forceDef?.categoryLinks || []).map(catLink => {
    if (isCategoryLinkHidden(catLink, { system, roster, selectionCounts, forceCategoryCounts })) {
      return null;
    }

    const catLinkModifiers = getEffectiveModifiers(catLink);
    const minConstraint = catLink.constraints?.find(c => c.type === ConstraintKind.MIN);
    const minValue = minConstraint
      ? Math.max(0, getModifiedConstraintValue(minConstraint, catLinkModifiers, displayContext))
      : 0;

    const maxConstraint = catLink.constraints?.find(c => c.type === ConstraintKind.MAX);
    let maxValue = resolveMaxLimit(maxConstraint, catLinkModifiers, displayContext);
    if (catLink.targetId === HEROES_CATEGORY_ID && maxValue === Infinity) {
      maxValue = resolveHeroesMaxLimit(forceDef, displayContext);
    }

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
        <div data-testid="sidebar-total-costs" className="flex-between text-ui-title text-gold sidebar-summary-total">
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
        <h4 data-testid="sidebar-army-requirements" className="sidebar-section-title">Armeeanforderungen</h4>
        <CategoryRequirementList roster={roster} system={system} />
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
