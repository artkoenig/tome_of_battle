import React, { useState, useRef } from 'react';
import { Trash2, Copy, AlertTriangle, MoreVertical, ReceiptText } from 'lucide-react';
import SelectionConfigurator from './SelectionConfigurator';
import BottomSheet from './BottomSheet';
import { UnitUpgradesChips, UnitRulesChips } from './UnitChips';
import GothicTooltip from '../GothicTooltip';
import { useUnitCard } from '../../viewmodels/editor/useUnitCard';
import { useTranslation } from '../../i18n/useTranslation';
import { formatViolation } from '../../i18n/violationMessages';

/**
 * Die Einheitenkarte — nur noch JSX (ADR-0038).
 *
 * Name, Punkte, Profil-Tabellen, Verletzungen, die eigenständigen
 * Untereinheiten und die beiden Kommandos kommen aus `useUnitCard`; die Karte
 * kennt weder `capabilities` noch `pathBySelectionId`.
 */
export default function UnitSelectionCard({
  selection,
  selectedRosterSelection,
  setSelectedRosterSelection,
  costTypeLabel,
  isSubUnit = false,
  onShowRule = null
}) {
  const { t } = useTranslation();
  const [activeInfo, setActiveInfo] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const menuRef = useRef(null);

  const card = useUnitCard({ selection, isSubUnit });

  const updateTooltipPosition = (e) => {
    const tooltipWidth = 320;
    const estimatedHeight = 150;
    let x = e.clientX + 15;
    let y = e.clientY + 15;

    if (x + tooltipWidth > window.innerWidth) {
      x = e.clientX - tooltipWidth - 15;
      if (x < 10) x = 10;
    }

    if (y + estimatedHeight > window.innerHeight) {
      y = e.clientY - estimatedHeight - 15;
      if (y < 10) y = 10;
    }
    return { x, y };
  };

  const handleMouseEnter = (title, text, e) => {
    if (window.innerWidth <= 900) return;
    const pos = updateTooltipPosition(e);
    setHoveredInfo({ title, text, x: pos.x, y: pos.y });
  };

  const handleMouseMove = (e) => {
    if (window.innerWidth <= 900) return;
    const pos = updateTooltipPosition(e);
    setHoveredInfo(prev => prev ? { ...prev, x: pos.x, y: pos.y } : null);
  };

  const handleMouseLeave = () => {
    setHoveredInfo(null);
  };

  // Die Hover- und Detailkanäle, die Konfigurator und Gruppen als ein Bündel
  // bekommen — statt vier einzelner Rückrufe im Prop-Satz jeder Ebene.
  const tooltip = {
    onEnter: handleMouseEnter,
    onMove: handleMouseMove,
    onLeave: handleMouseLeave,
    onOpen: setActiveInfo,
  };

  const renderProfileCell = (c, headerKey) => {
    if (!c) return <td key={headerKey} className="font-body">-</td>;

    const cell = card.profileCellOf(c);

    return (
      <td
        key={headerKey}
        className={cell.className}
        onMouseEnter={(e) => {
          if (cell.breakdown) {
            handleMouseEnter(t('common.modifications', { name: c.name }), cell.breakdown.join('\n'), e);
          }
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          if (cell.breakdown && window.innerWidth <= 900) {
            e.stopPropagation();
            setActiveInfo({
              title: t('common.modifications', { name: c.name }),
              text: (
                <ul className="modification-breakdown-list">
                  {cell.breakdown.map((b, bIdx) => (
                    <li key={bIdx} className="text-body">{b}</li>
                  ))}
                </ul>
              )
            });
          }
        }}
      >
        {c.value}
      </td>
    );
  };

  const renderProfileTable = (group, key) => {
    const { typeName, profiles, isModel } = group;
    if (!profiles || profiles.length === 0) return null;

    const headers = [];
    profiles.forEach(prof => {
      prof.characteristics?.forEach(c => {
        if (c.name && !headers.includes(c.name)) {
          headers.push(c.name);
        }
      });
    });

    // The model stat block keeps its historical look: no leading name column
    // unless several models share the table. Every other profile type gets a
    // leading column labelled with its own profileTypeName.
    const showNameCol = isModel ? profiles.length > 1 : true;
    const nameHeader = isModel ? t('common.model') : (typeName || t('common.profileHeader'));

    return (
      <div key={key} className="profile-table-container">
        <table className="profile-table">
          <thead>
            <tr>
              {showNameCol && <th>{nameHeader}</th>}
              {headers.map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((prof, pIdx) => (
              <tr key={prof.id || pIdx}>
                {showNameCol && (
                  <td className="font-body">
                    {prof.name}
                  </td>
                )}
                {headers.map(h => renderProfileCell(prof.characteristics?.find(char => char.name === h), h))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMiniProfile = () => {
    if (card.profileGroups.length === 0) return null;
    return (
      <div className="mini-profile">
        {card.profileGroups.map((group, gIdx) => renderProfileTable(group, group.typeName || gIdx))}
      </div>
    );
  };

  const isUnitEditing = selectedRosterSelection?.id === selection.id;
  // A sub-unit card carries neither the stat block nor the rules chips (both
  // hang on `!isSubUnit` below) -- its profiles are inherited upwards and read
  // off the parent card. Its only detail is the upgrade chip row, and that row
  // is empty whenever the sub-unit has no upgrades, so the toggle would open an
  // empty drawer. The chips therefore stay permanently visible and the sub-unit
  // card has no toggle at all; the play view's card does the same
  // (`PlayUnitDetails`, `!isSubUnit` on its toggle).
  const detailsOpen = isSubUnit || isDetailsOpen;

  return (
    <div className={`selection-node ${card.hasError ? 'has-error' : ''} ${card.copy ? '' : 'selection-node--sub'}`}>
      <div
        className="selection-node-header"
        onClick={() => setSelectedRosterSelection(isUnitEditing ? null : selection)}
      >
        <div className="selection-node-header-row">
          <div className="selection-node-title">
            <span className="selection-node-name text-ui-title">
              {card.count > 1 ? `${card.count}x ` : ''}{card.name}
            </span>
          </div>
          <div className="selection-node-right">
            {card.points > 0 && (
              <span className="selection-node-cost font-body">
                {card.points} {costTypeLabel}
              </span>
            )}
            {!isSubUnit && (
              <button
                type="button"
                className={`square-btn unit-card-details-toggle ${isDetailsOpen ? 'is-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDetailsOpen(!isDetailsOpen);
                }}
                title={isDetailsOpen ? t('editor.hideDetails') : t('editor.showDetails')}
                aria-expanded={isDetailsOpen}
              >
                <ReceiptText size={16} />
              </button>
            )}
            <div ref={menuRef} className="unit-card-menu-container" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                data-testid="unit-actions-menu"
                className="square-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title={t('common.actions')}
              >
                <MoreVertical size={16} />
              </button>

              <BottomSheet
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                title={t('common.actions')}
                desktopMode="popover"
                containerRef={menuRef}
              >
                <div className="popover-list">
                  {card.copy && (
                    <div
                      data-testid="unit-action-copy"
                      className="popover-item"
                      onClick={() => {
                        setIsMenuOpen(false);
                        card.copy();
                      }}
                    >
                      <span className="popover-item-name unit-card-menu-item">
                        <Copy size={14} />
                        {t('common.copy')}
                      </span>
                    </div>
                  )}
                  <div
                    data-testid="unit-action-delete"
                    className="popover-item"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setShowConfirmDelete(true);
                    }}
                  >
                    <span className="popover-item-name unit-card-menu-item unit-card-menu-item-danger">
                      <Trash2 size={14} />
                      {t('common.delete')}
                    </span>
                  </div>
                </div>
              </BottomSheet>
            </div>
          </div>
        </div>
        <div className={`unit-card-details ${detailsOpen ? 'is-open' : ''}`}>
          {!isSubUnit && renderMiniProfile()}
          <UnitUpgradesChips
            selection={selection}
            handleMouseEnter={handleMouseEnter}
            handleMouseMove={handleMouseMove}
            handleMouseLeave={handleMouseLeave}
            onClickDetails={(title, text) => {
              if (window.innerWidth <= 900) {
                setActiveInfo({ title, text });
              }
            }}
            onShowRule={onShowRule}
          />
          {!isSubUnit && (
            <UnitRulesChips
              selection={selection}
              handleMouseEnter={handleMouseEnter}
              handleMouseMove={handleMouseMove}
              handleMouseLeave={handleMouseLeave}
              onClickDetails={(title, text) => {
                if (window.innerWidth <= 900) {
                  setActiveInfo({ title, text });
                }
              }}
              onShowRule={onShowRule}
            />
          )}
          {!isUnitEditing && <div className="unit-card-torn-edge" aria-hidden="true" />}
        </div>
      </div>

      {card.violations.map((violation, idx) => (
        <div key={idx} className="unit-error-alert text-danger text-label">
          <AlertTriangle size={14} />
          <span>{formatViolation(violation, t)}</span>
        </div>
      ))}

      {isUnitEditing && (
        <SelectionConfigurator
          selection={selection}
          tooltip={tooltip}
          onShowRule={onShowRule}
        />
      )}

      {card.subUnits.length > 0 && (
        <div className="sub-units-container selection-node-sub-units">
          {card.subUnits.map(subSel => (
            <UnitSelectionCard
              key={subSel.id}
              selection={subSel}
              selectedRosterSelection={selectedRosterSelection}
              setSelectedRosterSelection={setSelectedRosterSelection}
              costTypeLabel={costTypeLabel}
              isSubUnit={true}
              // Without this hand-down the sub-unit card still draws the
              // BookOpen affordance on its linked rule chips, but the click
              // goes nowhere: RuleChipIcon only calls what it was given.
              onShowRule={onShowRule}
            />
          ))}
        </div>
      )}

      {hoveredInfo && (
        <GothicTooltip title={hoveredInfo.title} x={hoveredInfo.x} y={hoveredInfo.y}>
          {hoveredInfo.text}
        </GothicTooltip>
      )}

      <BottomSheet
        isOpen={!!activeInfo}
        onClose={() => setActiveInfo(null)}
        title={activeInfo?.title || ''}
        desktopMode="modal"
      >
        <div className="info-popup-body">
          {activeInfo?.text}
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        title={t('editor.deleteUnit.title')}
        desktopMode="modal"
      >
        <div className="info-popup-body unit-delete-confirm-body">
          <p className="unit-delete-confirm-question">{t('editor.deleteUnit.confirmPrefix')}<strong>{card.name}</strong>{t('editor.deleteUnit.confirmSuffix')}</p>
          <div className="unit-delete-confirm-actions">
            <button
              data-testid="unit-delete-cancel"
              className="btn"
              onClick={() => setShowConfirmDelete(false)}
            >
              {t('common.cancel')}
            </button>
            <button
              data-testid="unit-delete-confirm"
              className="btn btn-danger"
              onClick={() => {
                setShowConfirmDelete(false);
                card.remove();
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
