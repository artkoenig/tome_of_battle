import React, { useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { findEntryInSystem } from '../../roster';
import { childSlotsOf } from '../../evaluation/slotLookups';
import { useTranslation } from '../../i18n/useTranslation';
import BottomSheet from './BottomSheet';

/**
 * Aushebe-Dialog einer Kategorie (Issue 0121, Task 6; ADR-0035/0036).
 *
 * Kandidatenliste und Zustand kommen aus den **Fähigkeitsdatensätzen** des
 * Evaluator-Berichts (`capabilities`), abgelesen an den Slots direkt unter dem
 * Ziel-Kontingent (`forcePath`): wählbar ist, was dort als Angebots-Anker,
 * Pflicht-Phantom oder belegter Slot mit Restspielraum hängt; gesperrt
 * (`isBlocked`) wird deaktiviert mit „(Nicht verfügbar)" gezeigt; versteckt
 * (`isHidden`) erscheint gar nicht. Kosten liest `capability.costs`. Der
 * frühere Solver-Diff (Baseline-Validierung + hypothetisches Ausheben,
 * ADR-0022) ist ersatzlos entfallen (ADR-0035).
 *
 * `addUnit(kandidat, categoryId)` bleibt der Aushebe-Callback; als Kandidat
 * wird der Katalogeintrag der Definition übergeben (Auflösung über die
 * Solver-Fassade — die Schreibmechanik bleibt bis Task 8 beim Solver),
 * ersatzweise ein `{ id, name }`-Paar aus dem Slot.
 */

/** Die Ankerarten, deren Slots im Dialog als Kandidaten erscheinen. */
const CANDIDATE_ANCHOR_KINDS = new Set(['occupied', 'offerAnchor', 'mandatoryPhantom']);

export default function CategoryUnitAdder({
  categoryId = null,
  categoryName,
  capabilities,
  forcePath = null,
  system,
  activeCatalogue,
  costTypeLabel,
  costLimitType,
  addUnit,
  entries = null
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  if (!activeCatalogue) return null;

  // Erlaubte Definitions-Ids, wenn eine explizite Eintragsliste vorgegeben ist
  // (z. B. armeeweite Selektoren ohne eigene Kategorie-Sektion).
  const allowedIds = entries === null
    ? null
    : new Set(entries.flatMap(entry => [entry.id, entry.targetId].filter(Boolean)));

  // Kandidaten: je Definition genau ein Slot unter dem Kontingent. Versteckte
  // Slots erscheinen nicht; die Kategorie-Zuordnung liest die **effektive**
  // Primärkategorie aus dem Bericht (§8: nie aus rohen Katalog-Links).
  const seenDefIds = new Set();
  const candidates = [];
  for (const { path, capability } of childSlotsOf(capabilities, forcePath)) {
    if (!CANDIDATE_ANCHOR_KINDS.has(capability.anchorKind)) continue;
    if (capability.isHidden) continue;
    if (seenDefIds.has(capability.defId)) continue;
    if (allowedIds !== null) {
      if (!allowedIds.has(capability.defId)
        && !(capability.targetDefId && allowedIds.has(capability.targetDefId))) continue;
    } else if (capability.primaryCategoryId !== categoryId) {
      continue;
    }
    seenDefIds.add(capability.defId);
    candidates.push({ path, capability });
  }

  const costOf = ({ capability }) => capability.costs?.[costLimitType] ?? 0;
  candidates.sort((a, b) => costOf(b) - costOf(a)); // Descending

  if (candidates.length === 0) return null;

  // Der Aushebe-Callback erwartet den Katalogeintrag der Definition (die
  // Selektions-Fabrik liest ihn); bei einer expliziten Eintragsliste ist er
  // schon da, sonst löst ihn die Solver-Fassade aus dem System auf.
  const entryFor = (capability) => {
    const fromEntries = entries?.find(entry =>
      entry.id === capability.defId || entry.id === capability.targetDefId
      || (entry.targetId && entry.targetId === capability.targetDefId));
    if (fromEntries) return fromEntries;
    return findEntryInSystem(system, capability.defId, activeCatalogue.id)
      ?? { id: capability.defId, name: capability.name };
  };

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
          {candidates.map(({ path, capability }) => {
            const points = costOf({ capability });
            // Verfügbarkeit wird **abgelesen** (ADR-0035): gesperrt ist, wessen
            // Höchstmaß ausgeschöpft ist — keine Diff-Rechnung, keine Sperrtabelle.
            const isBlocked = capability.isBlocked === true;

            return (
              <div
                key={path}
                className={`popover-item ${isBlocked ? 'disabled' : ''}`}
                aria-disabled={isBlocked}
                onClick={() => {
                  if (isBlocked) return;
                  addUnit(entryFor(capability), categoryId);
                  setIsOpen(false);
                }}
              >
                <div className="popover-item-name popover-item-label">
                  <span>{capability.name}</span>
                  {isBlocked && <span className="text-danger text-micro popover-item-unavailable">{t('editor.adder.unavailable')}</span>}
                </div>
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
