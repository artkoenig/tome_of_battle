import React, { useState, useRef } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Trash2, Copy, AlertTriangle, MoreVertical, ReceiptText } from 'lucide-react';
import SelectionConfigurator from './SelectionConfigurator';
import BottomSheet from './BottomSheet';
import {
  resolveEntry,
  findEntryInSystem,
  calculateRosterCosts,
  collectUnitProfilesAndRules,
  getEffectiveSelectionName
} from '../../solver/validator';
import { groupProfilesByType } from '../../solver/rulesEvaluator';
import { UnitUpgradesChips, UnitRulesChips } from './UnitChips';
import GothicTooltip from '../GothicTooltip';

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
  updateSubSelection,
  activeCatalogue,
  isSubUnit = false,
  onShowRule
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
    const cellStyle = {};
    let className = "font-body";
    if (modState === 'positive') {
      className += " text-success";
      cellStyle.backgroundColor = 'rgba(27, 115, 64, 0.12)';
      cellStyle.fontWeight = 'bold';
      cellStyle.cursor = 'help';
    } else if (modState === 'negative') {
      className += " text-danger";
      cellStyle.backgroundColor = 'rgba(166, 28, 28, 0.12)';
      cellStyle.fontWeight = 'bold';
      cellStyle.cursor = 'help';
    } else if (modState === 'modified') {
      className += " text-gold";
      cellStyle.backgroundColor = 'rgba(226, 183, 66, 0.12)';
      cellStyle.fontWeight = 'bold';
      cellStyle.cursor = 'help';
    }

    return (
      <td
        key={headerKey}
        className={className}
        style={cellStyle}
        onMouseEnter={(e) => {
          if (modState && c.modificationBreakdown?.length > 0) {
            handleMouseEnter(t('editor.unitCard.modifications', { name: c.name }), c.modificationBreakdown.join('\n'), e);
          }
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          if (modState && c.modificationBreakdown?.length > 0 && window.innerWidth <= 900) {
            e.stopPropagation();
            setActiveInfo({
              title: t('editor.unitCard.modifications', { name: c.name }),
              text: (
                <ul style={{ margin: 0, paddingLeft: '20px', textAlign: 'left' }}>
                  {c.modificationBreakdown.map((b, bIdx) => (
                    <li key={bIdx} className="text-body" style={{ color: 'var(--text-parchment)', marginBottom: '4px' }}>{b}</li>
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
    const nameHeader = isModel ? t('editor.profile.model') : (typeName || t('editor.profile.profile'));

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
  const effectiveName = getEffectiveSelectionName(selection, { system, roster, parentCatalogueId: activeCatalogue?.id });
  const unitCosts = calculateRosterCosts({ forces: [{ selections: [selection] }] }, system);
  const displayPoints = unitCosts[roster.costLimitType] || 0;
  const hasSelectionError = validationErrors.some(e => e.selectionId === selection.id);
  const selectionErrors = validationErrors.filter(e => e.selectionId === selection.id);

  const independentSubUnits = (selection.selections || []).filter(subSel => {
    const entryId = subSel.entryLinkId || subSel.selectionEntryId;
    const entry = findEntryInSystem(system, entryId, activeCatalogue?.id);
    const resolved = resolveEntry(system, entry, activeCatalogue?.id);
    
    const hasEntryChildren = (entryNode) => {
      if (!entryNode) return false;
      return (entryNode.selectionEntries && entryNode.selectionEntries.length > 0) ||
             (entryNode.entryLinks && entryNode.entryLinks.length > 0) ||
             (entryNode.selectionEntryGroups && entryNode.selectionEntryGroups.length > 0);
    };
    
    return resolved && (resolved.type === 'unit' || resolved.type === 'model') && (resolved.collective === false || resolved.collective === 'false') && hasEntryChildren(resolved);
  });

  return (
    <div className={`selection-node ${hasSelectionError ? 'has-error' : ''}`} style={copyUnit ? {} : { marginTop: '8px', border: '1px solid rgba(226, 183, 66, 0.2)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
      <div 
        className="selection-node-header"
        style={{ cursor: 'pointer', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}
        onClick={() => setSelectedRosterSelection(isUnitEditing ? null : selection)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="selection-node-title">
            <span className="selection-node-name text-ui-title">
              {selection.number > 1 ? `${selection.number}x ` : ''}{effectiveName}
            </span>
          </div>
          <div className="selection-node-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              title={isDetailsOpen ? t('editor.unitCard.hideDetails') : t('editor.unitCard.showDetails')}
              aria-expanded={isDetailsOpen}
            >
              <ReceiptText size={16} />
            </button>
            <div ref={menuRef} className="unit-card-menu-container" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="square-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title={t('editor.unitCard.actions')}
              >
                <MoreVertical size={16} />
              </button>

              <BottomSheet
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                title={t('editor.unitCard.actions')}
                desktopMode="popover"
                containerRef={menuRef}
              >
                <div className="popover-list">
                  {copyUnit && (
                    <div
                      className="popover-item"
                      onClick={() => {
                        setIsMenuOpen(false);
                        copyUnit(selection.id);
                      }}
                    >
                      <span className="popover-item-name unit-card-menu-item">
                        <Copy size={14} />
                        {t('editor.unitCard.copy')}
                      </span>
                    </div>
                  )}
                  <div
                    className="popover-item"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setShowConfirmDelete(true);
                    }}
                  >
                    <span className="popover-item-name unit-card-menu-item unit-card-menu-item-danger">
                      <Trash2 size={14} />
                      {t('editor.unitCard.delete')}
                    </span>
                  </div>
                </div>
              </BottomSheet>
            </div>
          </div>
        </div>
        <div className={`unit-card-details ${isDetailsOpen ? 'is-open' : ''}`}>
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
        <div key={idx} className="unit-error-alert text-danger text-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(166,28,28,0.04)', borderBottom: '1px solid rgba(166,28,28,0.2)' }}>
          <AlertTriangle size={14} />
          <span>{err.message}</span>
        </div>
      ))}

      {isUnitEditing && (
        <SelectionConfigurator
          selection={selection}
          system={system}
          roster={roster}
          updateSubSelection={updateSubSelection}
          costTypeLabel={costTypeLabel}
          activeCatalogue={activeCatalogue}
          handleMouseEnter={handleMouseEnter}
          handleMouseMove={handleMouseMove}
          handleMouseLeave={handleMouseLeave}
          setActiveInfo={setActiveInfo}
          onShowRule={onShowRule}
        />
      )}

      {independentSubUnits.length > 0 && (
        <div className="sub-units-container" style={{ paddingLeft: '16px', borderLeft: '2px solid rgba(226, 183, 66, 0.2)', marginTop: '8px' }}>
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
              removeUnit={(id) => updateSubSelection(selection.id, id, 'remove_instance')}
              copyUnit={null}
              updateSubSelection={updateSubSelection}
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
        title={t('dialogs.deleteUnit.title')}
        desktopMode="modal"
      >
        <div className="info-popup-body" style={{ textAlign: 'center', padding: '16px 16px 24px 16px' }}>
          <p style={{ marginBottom: '24px', color: 'var(--text-parchment)' }}>
            <Trans
              i18nKey="dialogs.deleteUnit.message"
              values={{ name: effectiveName }}
              components={{ strong: <strong /> }}
            />
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              className="btn"
              onClick={() => setShowConfirmDelete(false)}
            >
              {t('dialogs.cancel')}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                setShowConfirmDelete(false);
                removeUnit(selection.id);
              }}
            >
              {t('dialogs.delete')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
