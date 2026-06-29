import React, { useState } from 'react';
import { Trash2, Copy, AlertTriangle } from 'lucide-react';
import { useDebugMode } from '../../hooks/DebugContext';
import SelectionConfigurator from './SelectionConfigurator';
import BottomSheet from './BottomSheet';
import { 
  resolveEntry, 
  findEntryInSystem, 
  getSelectionTotalCost, 
  calculateRosterCosts,
  collectUnitProfilesAndRules
} from '../../solver/validator';
import { UPGRADE_DETAILS_KEYWORDS } from '../../solver/constants';

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
  setSelectedCatalogEntry
}) {
  const { showDebugIds } = useDebugMode();

  const [activeInfo, setActiveInfo] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);

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

  const renderMiniProfile = (sel) => {
    const { profiles } = collectUnitProfilesAndRules(system, sel, activeCatalogue?.id);
    if (!profiles || profiles.length === 0) return null;

    const unitProf = profiles.find(p => p.profileTypeName === 'Unit' || p.profileTypeName === 'Model');
    if (!unitProf) return null;

    return (
      <div 
        className="mini-profile clickable"
        onClick={(e) => {
          e.stopPropagation();
          const rawEntry = findEntryInSystem(system, sel.entryLinkId || sel.selectionEntryId, activeCatalogue?.id);
          const resolved = resolveEntry(system, rawEntry, activeCatalogue?.id);
          if (resolved) {
            setSelectedCatalogEntry(resolved);
          }
        }}
        title="Statblock anzeigen"
      >
        <table className="mini-profile-table">
          <thead>
            <tr>
              {unitProf.characteristics.map(c => (
                <th key={c.name}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {unitProf.characteristics.map(c => (
                <td key={c.name} className="font-body">{c.value}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const getSelectedUpgrades = (sel) => {
    const list = [];
    const collect = (node) => {
      if (!node.selections) return;
      node.selections.forEach(subSel => {
        const entryId = subSel.entryLinkId || subSel.selectionEntryId;
        const entry = findEntryInSystem(system, entryId, activeCatalogue?.id);
        const resolved = resolveEntry(system, entry, activeCatalogue?.id);
        if (resolved) {
          list.push({
            id: subSel.id,
            name: subSel.name,
            number: subSel.number || 1,
            resolved: resolved
          });
        }
        collect(subSel);
      });
    };
    collect(sel);
    return list;
  };

  const getUpgradeDescription = (res) => {
    if (!res) return '';
    const descriptions = [];
    if (res.rules && res.rules.length > 0) {
      res.rules.forEach(r => {
        if (r.description) descriptions.push(r.description);
      });
    }
    if (res.profiles && res.profiles.length > 0) {
      res.profiles.forEach(p => {
        const typeLower = p.profileTypeName?.toLowerCase() || '';
        if (UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k))) {
          const stats = p.characteristics.map(c => `${c.name}: ${c.value}`).join(', ');
          descriptions.push(`${p.name} (${stats})`);
        }
      });
    }
    return descriptions.join(' | ');
  };

  const renderUnitUpgrades = (sel) => {
    const selectedUpgrades = getSelectedUpgrades(sel);
    if (selectedUpgrades.length === 0) return null;

    return (
      <div 
        className="unit-header-upgrades" 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '6px', 
          marginTop: '4px',
          marginBottom: '2px',
          width: '100%',
          paddingRight: '24px'
        }}
      >
        {selectedUpgrades.map(upgrade => {
          const descText = getUpgradeDescription(upgrade.resolved);
          return (
            <span 
              key={upgrade.id}
              style={{
                fontSize: '0.72rem',
                backgroundColor: 'rgba(226, 183, 66, 0.06)',
                border: '1px solid rgba(226, 183, 66, 0.22)',
                color: 'var(--text-parchment)',
                padding: '2px 6px',
                borderRadius: '3px',
                fontFamily: 'var(--font-body)',
                display: 'inline-flex',
                alignItems: 'center',
                cursor: descText ? 'help' : 'default'
              }}
              onMouseEnter={(e) => descText && handleMouseEnter(upgrade.resolved?.name || upgrade.name, descText, e)}
              onMouseMove={descText ? handleMouseMove : null}
              onMouseLeave={descText ? handleMouseLeave : null}
              onClick={(e) => {
                e.stopPropagation();
                if (window.innerWidth <= 900 && descText) {
                  setActiveInfo({ title: upgrade.resolved?.name || upgrade.name, text: descText });
                }
              }}
            >
              {upgrade.number > 1 ? `${upgrade.number}x ` : ''}
              {upgrade.name || upgrade.resolved.name}
            </span>
          );
        })}
      </div>
    );
  };

  const isUnitEditing = selectedRosterSelection?.id === selection.id;
  const unitCosts = calculateRosterCosts({ forces: [{ selections: [selection] }] }, system);
  const displayPoints = unitCosts[roster.costLimitType] || 0;
  const hasSelectionError = validationErrors.some(e => e.selectionId === selection.id);
  const selectionErrors = validationErrors.filter(e => e.selectionId === selection.id);

  return (
    <div className={`selection-node ${hasSelectionError ? 'has-error' : ''}`}>
      <div 
        className="selection-node-header"
        style={{ cursor: 'pointer', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}
        onClick={() => setSelectedRosterSelection(isUnitEditing ? null : selection)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="selection-node-title">
            <span className="selection-node-name" style={{ fontSize: '1.05rem', fontWeight: 600 }}>
              {selection.name}
              {showDebugIds && (
                <span className="debug-id-badge clickable" title="Definition-ID">def:{selection.entryLinkId || selection.selectionEntryId}</span>
              )}
            </span>
          </div>
          <div className="selection-node-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="selection-node-cost font-body">
              {displayPoints} {costTypeLabel}
            </span>
            <button 
              type="button"
              className="btn-danger btn-sm" 
              style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Möchten Sie diese Einheit wirklich löschen?')) {
                  removeUnit(selection.id);
                }
              }}
              title="Löschen"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {renderMiniProfile(selection)}
        {renderUnitUpgrades(selection)}
        <button 
          type="button"
          className="btn-primary btn-sm" 
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '14px',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}
          onClick={(e) => {
            e.stopPropagation();
            copyUnit(selection.id);
          }}
          title="Kopieren"
        >
          <Copy size={14} />
        </button>
      </div>

      {selectionErrors.map((err, idx) => (
        <div key={idx} className="unit-error-alert text-danger font-body" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 12px', background: 'rgba(166,28,28,0.04)', borderBottom: '1px solid rgba(166,28,28,0.2)' }}>
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
        />
      )}

      {hoveredInfo && (
        <div 
          className="gothic-tooltip"
          style={{
            left: hoveredInfo.x,
            top: hoveredInfo.y
          }}
        >
          <div className="tooltip-title">{hoveredInfo.title}</div>
          <div className="tooltip-body">{hoveredInfo.text}</div>
        </div>
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
    </div>
  );
}
