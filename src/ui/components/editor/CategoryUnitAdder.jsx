import React, { useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { useRecruitOffer } from '../../viewmodels/editor/useRecruitOffer';
import { useTranslation } from '../../i18n/useTranslation';
import BottomSheet from './BottomSheet';

/**
 * Aushebe-Dialog einer Kategorie (Issue 0121, Task 6; ADR-0035/0036).
 *
 * Seit Issue 0164 rechnet die Komponente nichts mehr: die Kandidatenliste
 * kommt fertig aus {@link useRecruitOffer} — dort steht, welche Slots ein
 * Kategorie-Angebot ausmachen, wie sie bepreist und sortiert werden und welcher
 * Katalog-Eintrag am Aushebe-Callback hängt. Hier bleibt der Knopf, das
 * Aufklappen und die Abbildung einer Zeile auf Markup.
 */
export default function CategoryUnitAdder({
  forceId = null,
  forcePath = null,
  categoryId = null,
  categoryName,
  entries = null
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const { candidates, costTypeLabel } = useRecruitOffer({ forceId, forcePath, categoryId, entries });

  if (candidates.length === 0) return null;

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
          {candidates.map(candidate => (
            <div
              key={candidate.key}
              className={`popover-item ${candidate.isBlocked ? 'disabled' : ''}`}
              aria-disabled={candidate.isBlocked}
              onClick={() => {
                if (candidate.isBlocked) return;
                candidate.recruit();
                setIsOpen(false);
              }}
            >
              <div className="popover-item-name popover-item-label">
                <span>{candidate.name}</span>
                {candidate.isBlocked && <span className="text-danger text-micro popover-item-unavailable">{t('editor.adder.unavailable')}</span>}
              </div>
              {candidate.points > 0 && (
                <span className="popover-item-cost font-body text-gold">
                  +{candidate.points} {costTypeLabel}
                </span>
              )}
            </div>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
