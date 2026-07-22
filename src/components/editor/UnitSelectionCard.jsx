import React, { useState, useRef } from 'react';
import { Trash2, Copy, AlertTriangle, MoreVertical, ReceiptText } from 'lucide-react';
import SelectionConfigurator from './SelectionConfigurator';
import BottomSheet from './BottomSheet';
import {
  resolveEntry,
  findEntryInSystem,
  calculateRosterCosts,
  collectUnitProfilesAndRules,
  getEffectiveSelectionName,
  isIndependentSubUnit,
  groupProfilesByType
} from '../../solver/validator';
import { UnitUpgradesChips, UnitRulesChips } from './UnitChips';
import GothicTooltip from '../GothicTooltip';
import { getProfileCellClassName } from '../profileCellClasses';
import { useTranslation } from '../../i18n/useTranslation';

const getModificationState = (characteristic) => {
  if (!characteristic || characteristic.originalValue === undefined) return null;
  
  const valStr = characteristic.value;
  const origStr = characteristic.originalValue;
  if (valStr === origStr) return null;

  const getNumericValue = (str) => {
    const match = str.match(/-?\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  const valNum = getNumericValue(valStr);
  const origNum = getNumericValue(origStr);

  if (valNum !== null && origNum !== null) {
    if (valNum > origNum) return 'positive';
    if (valNum < origNum) return 'negative';
  }
  return 'modified';
};

export default function UnitSelectionCard({
  selection,
  selectedRosterSelection,
  setSelectedRosterSelection,
  roster,
  system,
  validationErrors,
  costTypeLabel,
  removeUnit,
  copyUnit,
  subSelectionOperations,
  activeCatalogue,
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

  const renderProfileCell = (c, headerKey) => {
    if (!c) return <td key={headerKey} className="font-body">-</td>;

    const modState = getModificationState(c);
    const className = getProfileCellClassName(modState);

    return (
      <td
        key={headerKey}
        className={className}
        onMouseEnter={(e) => {
          if (modState && c.modificationBreakdown?.length > 0) {
            handleMouseEnter(t('common.modifications', { name: c.name }), c.modificationBreakdown.join('\n'), e);
          }
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          if (modState && c.modificationBreakdown?.length > 0 && window.innerWidth <= 900) {
            e.stopPropagation();
            setActiveInfo({
              title: t('common.modifications', { name: c.name }),
              text: (
                <ul className="modification-breakdown-list">
                  {c.modificationBreakdown.map((b, bIdx) => (
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

  const renderMiniProfile = (sel) => {
    const { profiles } = collectUnitProfilesAndRules(system, sel, activeCatalogue?.id, roster);
    const groups = groupProfilesByType(profiles);
    if (groups.length === 0) return null;

    return (
      <div className="mini-profile">
        {groups.map((group, gIdx) => renderProfileTable(group, group.typeName || gIdx))}
      </div>
    );
  };

  const isUnitEditing = selectedRosterSelection?.id === selection.id;
  const detailsOpen = isDetailsOpen;
  const effectiveName = getEffectiveSelectionName(selection, { system, roster, parentCatalogueId: activeCatalogue?.id });
  const unitCosts = calculateRosterCosts({ forces: [{ selections: [selection] }] }, system);
  const displayPoints = unitCosts[roster.costLimitType] || 0;
  const hasSelectionError = validationErrors.some(e => e.selectionId === selection.id);
  const selectionErrors = validationErrors.filter(e => e.selectionId === selection.id);

  const independentSubUnits = (selection.selections || []).filter(subSel => {
    const entryId = subSel.entryLinkId || subSel.selectionEntryId;
    const entry = findEntryInSystem(system, entryId, activeCatalogue?.id);
    const resolved = resolveEntry(system, entry, activeCatalogue?.id);
    
    
    return isIndependentSubUnit(resolved);
  });

  return (
    <div className={`selection-node ${hasSelectionError ? 'has-error' : ''} ${copyUnit ? '' : 'selection-node--sub'}`}>
      <div
        className="selection-node-header"
        onClick={() => setSelectedRosterSelection(isUnitEditing ? null : selection)}
      >
        <div className="selection-node-header-row">
          <div className="selection-node-title">
            <span className="selection-node-name text-ui-title">
              {selection.number > 1 ? `${selection.number}x ` : ''}{effectiveName}
            </span>
          </div>
          <div className="selection-node-right">
            {displayPoints > 0 && (
              <span className="selection-node-cost font-body">
                {displayPoints} {costTypeLabel}
              </span>
            )}
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
                  {copyUnit && (
                    <div
                      data-testid="unit-action-copy"
                      className="popover-item"
                      onClick={() => {
                        setIsMenuOpen(false);
                        copyUnit(selection.id);
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
          {!isSubUnit && renderMiniProfile(selection)}
          <UnitUpgradesChips
            selection={selection}
            system={system}
            activeCatalogueId={activeCatalogue?.id}
            roster={roster}
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
              system={system}
              activeCatalogueId={activeCatalogue?.id}
              roster={roster}
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

      {selectionErrors.map((err, idx) => (
        <div key={idx} className="unit-error-alert text-danger text-label">
          <AlertTriangle size={14} />
          <span>{err.message}</span>
        </div>
      ))}

      {isUnitEditing && (
        <SelectionConfigurator
          selection={selection}
          system={system}
          roster={roster}
          subSelectionOperations={subSelectionOperations}
          activeCatalogue={activeCatalogue}
          handleMouseEnter={handleMouseEnter}
          handleMouseMove={handleMouseMove}
          handleMouseLeave={handleMouseLeave}
          setActiveInfo={setActiveInfo}
          onShowRule={onShowRule}
        />
      )}

      {independentSubUnits.length > 0 && (
        <div className="sub-units-container selection-node-sub-units">
          {independentSubUnits.map(subSel => (
            <UnitSelectionCard 
              key={subSel.id}
              selection={subSel}
              selectedRosterSelection={selectedRosterSelection}
              setSelectedRosterSelection={setSelectedRosterSelection}
              roster={roster}
              system={system}
              validationErrors={validationErrors}
              costTypeLabel={costTypeLabel}
              removeUnit={(subUnitSelectionId) => subSelectionOperations.removeInstance(selection.id, subUnitSelectionId)}
              copyUnit={null}
              subSelectionOperations={subSelectionOperations}
              activeCatalogue={activeCatalogue}
              isSubUnit={true}
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
          <p className="unit-delete-confirm-question">{t('editor.deleteUnit.confirmPrefix')}<strong>{effectiveName}</strong>{t('editor.deleteUnit.confirmSuffix')}</p>
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
                removeUnit(selection.id);
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
