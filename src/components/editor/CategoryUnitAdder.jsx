import React, { useState, useRef, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { resolveEntry, getOptionDisplayCost, getEffectiveName, collectPrimaryCategoryEntries, validateRoster, getEntryAddAvailability } from '../../solver/validator';
import BottomSheet from './BottomSheet';

export default function CategoryUnitAdder({
  categoryId,
  categoryName,
  system,
  activeCatalogue,
  costTypeLabel,
  costLimitType,
  addUnit,
  roster,
  selectionCounts,
  force,
  entries = null
}) {
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

  // Effektive (post-modifier) Primärkategorie über den geteilten Solver-Helfer
  // aufzählen — dieselbe Grundlage nutzt die Listenregel-Erkennung (ADR 0003 §4).
  const getCatalogItemsByCategory = (catId) =>
    collectPrimaryCategoryEntries(system, activeCatalogue, catId, { roster, selectionCounts, force: targetForce })
      .map(({ entry }) => entry);

  // When an explicit entry list is supplied (e.g. army-wide selectors that no category
  // surfaces), offer exactly those; otherwise fall back to the entries of the category.
  const availableUnits = (entries || getCatalogItemsByCategory(categoryId))
    .sort((a, b) => {
      const aPoints = getOptionDisplayCost(system, a, costLimitType) || 0;
      const bPoints = getOptionDisplayCost(system, b, costLimitType) || 0;
      return bPoints - aPoints; // Descending
    });

  if (availableUnits.length === 0) return null;

  const displayCtx = {
    roster,
    system,
    selectionCounts,
    parentCatalogueId: activeCatalogue?.id
  };

  return (
    <div ref={wrapperRef} className="category-unit-adder-container">
      <button
        type="button"
        className="qty-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={`${categoryName} ausheben`}
      >
        {isOpen ? <X size={12} /> : <Plus size={12} />}
      </button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`${categoryName} ausheben`}
        desktopMode="popover"
        containerRef={wrapperRef}
      >
        <div className="popover-list">
          {availableUnits.map(entry => {
            const res = resolveEntry(system, entry);
            const points = getOptionDisplayCost(system, entry, costLimitType);

            // Einziger Verfügbarkeits-Codepfad (ADR-0022): hypothetisches Ausheben +
            // validateRoster-Diff gegen die Baseline. Der frühere isMaxedOut-Einzelpfad
            // (genau ein max-Constraint) ist ersatzlos entfallen.
            const { available, reasons } = getEntryAddAvailability({
              entry, categoryId, force: targetForce, roster, system, baselineErrors
            });
            const isBlocked = !available;

            return (
              <div
                key={res.id}
                className={`popover-item ${isBlocked ? 'disabled' : ''}`}
                style={{ opacity: isBlocked ? 0.5 : 1, cursor: isBlocked ? 'not-allowed' : 'pointer' }}
                aria-disabled={isBlocked}
                onClick={() => {
                  if (isBlocked) return;
                  addUnit(entry, categoryId);
                  setIsOpen(false);
                }}
              >
                <span className="popover-item-name" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: isBlocked ? 'var(--text-dim)' : 'inherit' }}>{getEffectiveName(res, displayCtx)}</span>
                  {isBlocked && <span className="text-danger text-micro" style={{ marginLeft: '6px', fontWeight: 600 }}>(Nicht verfügbar)</span>}
                  {isBlocked && reasons.map((reason, idx) => (
                    <span key={idx} className="text-danger text-micro popover-item-reason" style={{ flexBasis: '100%', marginTop: '2px', opacity: 0.9 }}>
                      {reason}
                    </span>
                  ))}
                </span>
                {points > 0 && (
                  <span className="popover-item-cost font-body text-gold" style={{ color: isBlocked ? 'var(--text-dim)' : 'var(--text-gold)' }}>
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
