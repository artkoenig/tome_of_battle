import React from 'react';
import { t } from '../../i18n/i18nStore';

// Shared renderer for the rich detail block of an upgrade/rule/magic item,
// used by the editor chips, the SelectionConfigurator and the OptionGroup.
// It renders what its ViewModel derived (`viewmodels/editor/upgradeDetailElements.js`,
// ADR-0038) — a finished list of rows, each with its label key, its text and
// its book source. Nothing here reads the catalogue.
export const renderUpgradeDetails = (elements) => {
  if (!elements) return null;

  return (
    <div className="upgrade-details">
      {elements.length > 0 ? elements.map(element => (
        element.kind === 'source' ? (
          <div key={element.key} className="upgrade-details-source">
            <span className="text-gold upgrade-details-label">{t(element.labelKey)}: </span>
            <span className="publication-ref">
              {element.source}
            </span>
          </div>
        ) : (
          <div key={element.key} className="upgrade-details-entry">
            <span className="text-gold upgrade-details-label">{t(element.labelKey, element.labelParams)}: </span>
            {element.text}
            {element.source && (
              <span className="publication-ref">
                {element.source}
              </span>
            )}
          </div>
        )
      )) : <span className="text-dim">{t('editor.details.noDescription')}</span>}
    </div>
  );
};
