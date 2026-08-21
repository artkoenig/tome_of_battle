import React from 'react';
import { ChevronDown, ChevronRight, Plus, Minus } from 'lucide-react';
import { renderUpgradeDetails } from './upgradeDetails';
import RuleChipIcon from './RuleChipIcon';
import { useOptionGroup } from '../../viewmodels/editor/useOptionGroup';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Options-Gruppe einer Auswahl — nur noch JSX (ADR-0038).
 *
 * Zustand, Grenzen, Kosten, Namen, Beschreibung und Wahlverhalten der Zeilen
 * kommen aus `useOptionGroup`; die Komponente kennt weder `capabilities` noch
 * `pathBySelectionId`. Eine Gruppe kann ihrerseits **Gruppen halten**:
 * `nestedSections` sind die vom Konfigurator bereits gerenderten Abschnitte der
 * Gruppen, die im Katalog in dieser hier liegen (Issue 0131, ADR-0036).
 *
 * @param {{ group: Object, selection: Object, selectionPath?: string|null,
 *   nestedSections?: React.ReactNode[], hasSelectedDescendant?: boolean,
 *   renderRowChildren?: (rowSelectionId: string|null) => React.ReactNode,
 *   tooltip?: Object, onShowRule?: Function }} props
 */
export default function OptionGroupComponent({
  group,
  selection,
  selectionPath = null,
  // Renders any sub-options re-emitted by a selected row, indented beneath it.
  renderRowChildren = (_rowSelectionId) => null,
  nestedSections = [],
  // Ob eine der gehaltenen Gruppen schon etwas trägt — dann startet auch diese
  // Gruppe aufgeklappt, obwohl sie selbst keine belegte Zeile hat.
  hasSelectedDescendant = false,
  // Hover- und Detailkanäle der Karte: `{ onEnter, onMove, onLeave, onOpen }`.
  tooltip = {},
  onShowRule
}) {
  const { t } = useTranslation();
  // Ein Klick auf den Schalter der Zeile ist nicht der Klick auf die Zeile.
  const isControlClick = (e) => e.target.closest('button') || e.target.closest('input');
  const {
    rows, limitText, selectedItemsSummary, hasGroupError, isExpanded, toggleExpanded,
  } = useOptionGroup({ group, selection, selectionPath, hasSelectedDescendant });

  return (
    <div className="option-group">
      <div
        onClick={toggleExpanded}
        className={`option-group-header${hasGroupError ? ' option-group-header--error' : ''}`}
      >
        <div className="option-group-titles">
          <span className={hasGroupError ? "text-ui-title text-danger" : "text-ui-title text-gold"}>
            <span>{group.name}</span>
            {limitText && <span className="text-micro option-group-limit"> {limitText}</span>}
          </span>
          {selectedItemsSummary && (
            <span className="text-micro option-group-summary">
              {t('editor.optionGroup.selection', { summary: selectedItemsSummary })}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown size={16} className={hasGroupError ? "text-danger" : "text-gold"} />
        ) : (
          <ChevronRight size={16} className={hasGroupError ? "text-danger" : "text-gold"} />
        )}
      </div>

      {isExpanded && (
        <div className="option-group-items">
          {rows.map(row => (
            <React.Fragment key={row.key}>
              <div
                className={`sub-selection-row ${row.isClickable ? 'clickable' : 'disabled'}${row.isUnavailable ? ' sub-selection-row--unavailable' : ''}`}
                onClick={(e) => {
                  if (isControlClick(e)) return;
                  row.onRowClick();
                }}
              >
                <div className="sub-selection-label sub-selection-label--indented">
                  <span className={`sub-selection-option-name${row.isUnavailable ? ' sub-selection-option-name--unavailable' : ''}`}>
                    {row.name}
                    <RuleChipIcon
                      name={row.name}
                      hasInfo={!!row.descText}
                      onShowRule={onShowRule}
                      onInfoClick={() => {
                        if (row.detailElements && window.innerWidth <= 900) {
                          tooltip.onOpen?.({ title: row.name, text: renderUpgradeDetails(row.detailElements) });
                        }
                      }}
                      onInfoEnter={(e) => { if (row.detailElements) tooltip.onEnter?.(row.name, renderUpgradeDetails(row.detailElements), e); }}
                      onInfoMove={tooltip.onMove}
                      onInfoLeave={tooltip.onLeave}
                    />
                  </span>
                </div>
                <div className="sub-selection-controls">
                  {row.points > 0 && <span className="text-gold text-label sub-selection-cost">+{row.points} {row.costTypeLabel}</span>}
                  {row.isBinary ? (
                    row.isRadio ? (
                      <input
                        type="radio"
                        name={row.radioName}
                        // Eine EINGELÖSTE Pflichtzeile ist genommen und nicht abwählbar —
                        // genau wie im Checkbox-Zweig darunter und auf dem gruppenlosen
                        // Pfad des Konfigurators. Eine noch offene Pflicht
                        // (`isMandatoryUnmet`) ist dagegen ein gewöhnliches Angebot
                        // (Issue 0145).
                        checked={row.count > 0 || row.isObligationHeld}
                        disabled={row.isObligationHeld || (row.count > 0 ? !row.canRemove : row.isSelectDisabled)}
                        onClick={(e) => {
                          e.stopPropagation();
                          row.onRadioClick();
                        }}
                        onChange={() => {}}
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={row.count > 0 || row.isObligationHeld}
                        disabled={row.isObligationHeld || (row.count > 0 ? !row.canRemove : row.isSelectDisabled)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => row.onToggle(e.target.checked)}
                      />
                    )
                  ) : (
                    <div className="quantity-control">
                      <button
                        className="qty-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          row.onDecrease();
                        }}
                        // Dieselbe Regel wie auf dem gruppenlosen Pfad: nie unter das
                        // effektive Minimum, und nie eine eingelöste Pflicht zurück.
                        disabled={!row.canRemove}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="quantity-value font-body">{row.count}</span>
                      <button
                        className="qty-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          row.onIncrease();
                        }}
                        disabled={row.isSelectDisabled}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {renderRowChildren(row.rowSelectionId)}
            </React.Fragment>
          ))}
          {nestedSections}
        </div>
      )}
    </div>
  );
}
