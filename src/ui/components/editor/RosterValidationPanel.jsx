import React from 'react';
import { Play, AlertTriangle, Check } from 'lucide-react';
import { useValidationPanel } from '../../viewmodels/editor/useValidationPanel';
import { useTranslation } from '../../i18n/useTranslation';
import ValidationMessage from './ValidationMessage';

/**
 * Der „Lagerbericht“ des Editors: Gesamtstatus der Liste, die blockierenden
 * Verletzungen des Evaluator-Berichts, die rein informativen Hinweise des
 * Katalogautors (warning/info) und die zusätzlichen Ressourcen-Summen.
 *
 * Was darin steht, sagt seit Issue 0164 {@link useValidationPanel}: es liest
 * Verletzungen, unaufgeloeste Auswahlen und Ressourcen-Summen aus dem
 * Bericht-Kontext. Hier bleibt allein das Markup.
 */
export default function RosterValidationPanel({ onPlay }) {
  const { t } = useTranslation();
  const {
    blockingViolations, advisoryViolations, blockingCount, isRosterValid,
    unresolvedSelections, extraResources
  } = useValidationPanel();

  return (
    <div
      id="general-errors-section"
      className={`gothic-panel general-errors-panel ${isRosterValid ? 'general-errors-panel--valid' : 'general-errors-panel--invalid'}`}
    >
      <h3 className="font-serif text-gold general-errors-title">
        {t('editor.validation.title')}
        {/* Zähler der blockierenden Verletzungen — bei 0 verborgen, der
            Gesamtstatus sagt dann bereits alles. */}
        {blockingCount > 0 && (
          <span data-testid="blocking-violation-count" className="badge badge-danger">
            {blockingCount}
          </span>
        )}
      </h3>

      {isRosterValid ? (
        <div className="flex-col gap-12">
          <div className="text-success text-ui-title flex-row gap-8 text-strong">
            <Check size={20} />
            <span>{t('editor.validation.valid')}</span>
          </div>
          <p className="text-body text-dim animate-fade-in roster-valid-flavour">
            {t('editor.validation.flavour')}
          </p>
          {/* Mobile-only Play button */}
          <div className="mobile-only w-full">
            <button
              type="button"
              className="btn-primary roster-play-btn-mobile"
              onClick={onPlay}
            >
              <Play size={18} /> {t('common.play')}
            </button>
          </div>
        </div>
      ) : (
        <div className="validation-error-list">
          {unresolvedSelections.map(entry => (
            <div
              key={entry.defId}
              data-testid="unresolved-selection"
              className="validation-error-item text-danger text-body flex-row gap-10"
            >
              <AlertTriangle size={18} className="no-shrink" />
              <div className="validation-message-body">
                {t('validation.evaluator.unresolvedEntry', { selectionName: entry.name })}
              </div>
            </div>
          ))}
          {blockingViolations.map((violation, idx) => (
            <div key={idx} className="validation-error-item text-danger text-body flex-row gap-10">
              <AlertTriangle size={18} className="no-shrink" />
              <div className="validation-message-body">
                <ValidationMessage violation={violation} />
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Rein informative Hinweise des Katalogautors (warning/info) — sichtbar,
          aber ohne die Liste zu blockieren; daher unabhängig von isRosterValid. */}
      {advisoryViolations.length > 0 && (
        <div className="validation-error-list validation-error-list--advisory">
          {advisoryViolations.map((violation, idx) => (
            <div key={idx} className="validation-error-item text-dim text-body flex-row gap-10">
              <AlertTriangle size={18} className="no-shrink" />
              <div className="validation-message-body">
                <ValidationMessage violation={violation} />
              </div>
            </div>
          ))}
        </div>
      )}
      {extraResources.length > 0 && (
        <div className="roster-extra-resources">
          {extraResources.map(res => (
            <div key={res.id} className="flex-between text-label text-dim">
              <span>{res.name}:</span>
              <span className="badge badge-muted">{res.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
