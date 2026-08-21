import React, { useState } from 'react';
import { Plus, Wand2 } from 'lucide-react';
import { useAutoFillSuggestions } from '../../viewmodels/editor/useAutoFillSuggestions';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Vorschläge, die die Liste auf ihren eingestellten Punktwert bringen
 * (Issue 0135/0151; ADR-0034/0035).
 *
 * Welche Slots vorgeschlagen werden, was sie kosten, ob das Panel überhaupt
 * offen ist und was ein Klick auslöst, sagt seit Issue 0164
 * {@link useAutoFillSuggestions}. Hier bleibt das Markup und der eine
 * Anzeige-Zustand „alle anzeigen": über {@link VISIBLE_SUGGESTION_COUNT}
 * Vorschläge hinaus wird der Rest aufklappbar, weil schon eine kleine Liste
 * dutzende Kandidaten hat.
 */

/** So viele Vorschläge stehen ohne Aufklappen da. */
const VISIBLE_SUGGESTION_COUNT = 8;

export default function AutoFillSuggestions({ forceId = null, forcePath = null }) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const { isOpen, remainingPoints, costTypeLabel, suggestions } =
    useAutoFillSuggestions({ forceId, forcePath });

  if (!isOpen) return null;

  const hasMore = suggestions.length > VISIBLE_SUGGESTION_COUNT;
  const visible = showAll || !hasMore ? suggestions : suggestions.slice(0, VISIBLE_SUGGESTION_COUNT);

  return (
    <div className="gothic-panel autofill-panel">
      <div className="autofill-header">
        <Wand2 className="text-gold" size={20} />
        <h3 className="font-serif text-gold no-margin">{t('editor.autofill.title')}</h3>
        <span className="text-label text-dim autofill-remaining">
          {t('editor.autofill.remaining', { points: remainingPoints, costType: costTypeLabel })}
        </span>
      </div>

      {suggestions.length === 0 && (
        <p className="text-dim no-margin">{t('editor.autofill.nothingFits')}</p>
      )}

      <div className="autofill-upgrade-list">
        {visible.map((suggestion) => (
          <div key={suggestion.key} className="sub-selection-row autofill-upgrade-row">
            <div className="flex-col">
              <span className="text-strong">{suggestion.name}</span>
              {suggestion.unitName && (
                <span className="text-micro text-dim">{t('editor.autofill.forUnit', { unit: suggestion.unitName })}</span>
              )}
            </div>
            <div className="sub-selection-controls autofill-upgrade-controls">
              <span className="text-gold text-label">+{suggestion.cost} {costTypeLabel}</span>
              {suggestion.apply && (
                <button
                  className="btn-secondary square-btn"
                  onClick={suggestion.apply}
                  title={t('common.add')}
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          className="btn-secondary autofill-toggle-btn"
          onClick={() => setShowAll(value => !value)}
        >
          {showAll
            ? t('editor.autofill.showLess')
            : t('editor.autofill.showAll', { count: suggestions.length })}
        </button>
      )}
    </div>
  );
}
