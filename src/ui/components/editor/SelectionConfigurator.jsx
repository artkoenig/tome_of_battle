import React from 'react';
import { Plus, Minus } from 'lucide-react';
import OptionGroupComponent from './OptionGroup';
import { renderUpgradeDetails } from './upgradeDetails';
import RuleChipIcon from './RuleChipIcon';
import { useSelectionConfigurator } from '../../viewmodels/editor/useSelectionConfigurator';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Auswahl-Konfigurator einer Selection — nur noch JSX (ADR-0038).
 *
 * Die Abschnitte (Gruppen und gruppenlose Options-Zeilen), ihre Zustände,
 * Grenzen, Kosten und Beschreibungen kommen aus `useSelectionConfigurator`;
 * die Komponente kennt weder `capabilities` noch `pathBySelectionId`.
 *
 * @param {{ selection: Object, isListRule?: boolean, tooltip?: Object,
 *   onShowRule?: Function|null }} props
 */
export default function SelectionConfigurator({
  selection,
  // Hover- und Detailkanäle der Karte: `{ onEnter, onMove, onLeave, onOpen }`.
  tooltip = {},
  onShowRule,
  isListRule = false
}) {
  const { t } = useTranslation();
  // Ein Klick auf den Schalter der Zeile ist nicht der Klick auf die Zeile.
  const isControlClick = (e) => e.target.closest('button') || e.target.closest('input');
  const { sections, sectionsForRow } = useSelectionConfigurator({ selection });

  /**
   * Die Kind-Slots einer belegten Zeilen-Auswahl, eingerückt unter ihrer Zeile
   * gerendert (die Auswahl ist selbst ein Rahmen). `null`, solange die Zeile
   * nicht gewählt ist oder ihr Rahmen keine Abschnitte hat.
   */
  const renderRowChildren = (rowSelectionId) => {
    const childSections = sectionsForRow(rowSelectionId);
    if (childSections.length === 0) return null;
    return (
      <div className="nested-option-block">
        {childSections.map(renderSection)}
      </div>
    );
  };

  const renderStandaloneRow = (row) => (
    <React.Fragment key={row.key}>
      <div
        className={`sub-selection-row ${row.isClickable ? 'clickable' : 'disabled'}${row.isUnavailable ? ' sub-selection-row--unavailable' : ''}`}
        onClick={(e) => {
          if (isControlClick(e)) return;
          row.onRowClick();
        }}
      >
        <div className="sub-selection-label">
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
          {/* Das Kosten-Budget der Zeile: eine Option, die selbst ein Punktekontingent
              deckelt (der Magiegegenstands-Block), fuehrt es neben ihrem Schalter —
              ihre Unter-Auswahlen rendern eingerueckt darunter und zahlen darauf ein. */}
          {row.costBudgets.map(budget => (
            <span key={budget} className="text-micro sub-selection-cost-budget">({budget})</span>
          ))}
          {row.isSubUnitWithOwnOptions ? (
            <button
              type="button"
              className="btn-primary text-label sub-selection-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                row.onAdd();
              }}
              disabled={row.isAddDisabled}
            >
              <Plus size={12} className="sub-selection-add-btn-icon" />
              {t('common.add')}
            </button>
          ) : row.isBinary ? (
            <input
              type="checkbox"
              checked={row.count > 0 || row.isObligationHeld}
              disabled={row.isObligationHeld || (row.count > 0 ? !row.canRemove : row.isSelectDisabled)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => row.onToggle(e.target.checked)}
            />
          ) : (
            <div className="quantity-control">
              <button
                className="qty-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  row.onDecrease();
                }}
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
                disabled={row.isAddDisabled}
              >
                <Plus size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
      {renderRowChildren(row.rowSelectionId)}
    </React.Fragment>
  );

  const renderSection = (section) => {
    if (section.kind === 'standalone') return renderStandaloneRow(section);
    return (
      <OptionGroupComponent
        key={section.group.id || section.group.name}
        group={section.group}
        selection={section.frameSelection}
        selectionPath={section.framePath}
        nestedSections={section.children.map(renderSection)}
        // Eine haltende Gruppe klappt auf, wenn eine ihrer Mitgliedsgruppen schon
        // etwas trägt — sonst verschwände eine getroffene Wahl hinter ihrer Kopfzeile.
        hasSelectedDescendant={section.hasSelectedDescendant === true}
        renderRowChildren={renderRowChildren}
        tooltip={tooltip}
        onShowRule={onShowRule}
      />
    );
  };

  return (
    <div className="selection-node-body">
      {/* Listenregeln sind Einstellungen, keine Ausrüstung: die Überschrift entfällt. */}
      {!isListRule && <h4>{t('editor.configurator.title')}</h4>}
      <div className="sub-selection-group sub-selection-group--flush">
        {sections.map(renderSection)}
      </div>
    </div>
  );
}
