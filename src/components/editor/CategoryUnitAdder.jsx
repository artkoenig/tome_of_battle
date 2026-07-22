import React, { useState, useRef, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { resolveEntry, getOptionDisplayCost, getEffectiveName, collectPrimaryCategoryEntries, validateRoster, getEntryAddAvailability } from '../../solver/validator';
import { useTranslation } from '../../i18n/useTranslation';
import { formatValidationError } from '../../i18n/formatValidationError';
import BottomSheet from './BottomSheet';

export default function CategoryUnitAdder({
  categoryId = null,
  categoryName,
  system,
  activeCatalogue,
  costTypeLabel,
  costLimitType,
  addUnit,
  roster,
  selectionCounts,
  force = null,
  entries = null
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Ziel-Force, in die ausgehoben würde: die vom Editor durchgereichte Force, sonst
  // die erste Force der Liste (Verfügbarkeit und Kategorie-Aufzählung teilen sie).
  const targetForce = force || roster?.forces?.[0];

  // Baseline-Validierung: die Verfügbarkeit jedes Kandidaten ist ein Diff gegen die
  // Liste *ohne* ihn (ADR-0022). Einmal pro Dialog berechnet — pro Kandidat läuft nur
  // die hypothetische Validierung (ADR-0005). Memoisiert an Roster/System.
  const baselineErrors = useMemo(
    () => validateRoster(roster, system),
    [roster, system]
  );

  if (!activeCatalogue) return null;

  // Jede Auflösung hier läuft gegen den angezeigten Katalog: bei mehreren geladenen
  // Katalogen (ADR-0018) ist eine Eintrags-Id nur innerhalb ihres Katalogs eindeutig.
  const displayCtx = {
    roster,
    system,
    selectionCounts,
    parentCatalogueId: activeCatalogue.id
  };

  // Effektive (post-modifier) Primärkategorie über den geteilten Solver-Helfer
  // aufzählen — dieselbe Grundlage nutzt die Listenregel-Erkennung (ADR 0003 §4).
  const getCatalogItemsByCategory = (catId) =>
    collectPrimaryCategoryEntries(system, activeCatalogue, catId, { roster, selectionCounts, force: targetForce })
      .map(({ entry }) => entry);

  // When an explicit entry list is supplied (e.g. army-wide selectors that no category
  // surfaces), offer exactly those; otherwise fall back to the entries of the category.
  const availableUnits = (entries || getCatalogItemsByCategory(categoryId))
    .sort((a, b) => {
      const aPoints = getOptionDisplayCost(system, a, costLimitType, displayCtx) || 0;
      const bPoints = getOptionDisplayCost(system, b, costLimitType, displayCtx) || 0;
      return bPoints - aPoints; // Descending
    });

  if (availableUnits.length === 0) return null;

  return (
    <div ref={wrapperRef} className="category-unit-adder-container">
      <button
        type="button"
        className="qty-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={t('editor.adder.raise', { category: categoryName })}
      >
        {isOpen ? <X size={12} /> : <Plus size={12} />}
      </button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t('editor.adder.raise', { category: categoryName })}
        desktopMode="popover"
        containerRef={wrapperRef}
      >
        <div className="popover-list">
          {availableUnits.map(entry => {
            const res = resolveEntry(system, entry, activeCatalogue.id);
            const points = getOptionDisplayCost(system, entry, costLimitType, displayCtx);

            // Einziger Verfügbarkeits-Codepfad (ADR-0022): hypothetisches Ausheben +
            // validateRoster-Diff gegen die Baseline. Der frühere isMaxedOut-Einzelpfad
            // (genau ein max-Constraint) ist ersatzlos entfallen.
            const { available, reasons } = getEntryAddAvailability({
              entry, categoryId, force: targetForce, roster, system,
              catalogueId: activeCatalogue.id, baselineErrors
            });
            const isBlocked = !available;

            return (
              <div
                key={res.id}
                className={`popover-item ${isBlocked ? 'disabled' : ''}`}
                aria-disabled={isBlocked}
                onClick={() => {
                  if (isBlocked) return;
                  addUnit(entry, categoryId);
                  setIsOpen(false);
                }}
              >
                <span className="popover-item-name popover-item-label">
                  <span>{getEffectiveName(res, displayCtx)}</span>
                  {isBlocked && <span className="text-danger text-micro popover-item-unavailable">{t('editor.adder.unavailable')}</span>}
                  {isBlocked && reasons.map((reason, idx) => (
                    <span key={idx} className="text-danger text-micro popover-item-reason">
                      {formatValidationError(reason, t, { omitCurrentCount: true })}
                    </span>
                  ))}
                </span>
                {points > 0 && (
                  <span className="popover-item-cost font-body text-gold">
                    +{points} {costTypeLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
