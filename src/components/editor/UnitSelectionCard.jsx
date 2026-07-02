import React, { useState } from 'react';
import { Trash2, Copy, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { useDebugMode } from '../../hooks/DebugContext';
import SelectionConfigurator from './SelectionConfigurator';
import BottomSheet from './BottomSheet';
import { 
  resolveEntry, 
  findEntryInSystem, 
  calculateRosterCosts,
  collectUnitProfilesAndRules
} from '../../solver/validator';
import { groupProfilesByType } from '../../solver/rulesEvaluator';
import { UnitUpgradesChips, UnitRulesChips } from './UnitChips';

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
  setSelectedCatalogEntry,
  isSubUnit = false
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

  const openStatblock = (sel) => {
    const rawEntry = findEntryInSystem(system, sel.entryLinkId || sel.selectionEntryId, activeCatalogue?.id);
    const resolved = resolveEntry(system, rawEntry, activeCatalogue?.id);
    if (resolved) {
      setSelectedCatalogEntry(resolved);
    }
  };

  const renderProfileCell = (c, headerKey, sel) => {
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
            handleMouseEnter(`Modifikationen: ${c.name}`, c.modificationBreakdown.join('\n'), e);
          }
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          e.stopPropagation();
          if (modState && c.modificationBreakdown?.length > 0 && window.innerWidth <= 900) {
            setActiveInfo({
              title: `Modifikationen: ${c.name}`,
              text: (
                <ul style={{ margin: 0, paddingLeft: '20px', textAlign: 'left' }}>
                  {c.modificationBreakdown.map((b, bIdx) => (
                    <li key={bIdx} className="text-body" style={{ color: 'var(--text-parchment)', marginBottom: '4px' }}>{b}</li>
                  ))}
                </ul>
              )
            });
          } else {
            openStatblock(sel);
          }
        }}
      >
        {c.value}
      </td>
    );
  };

  const renderProfileTable = (group, sel, key) => {
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
    const nameHeader = isModel ? 'Modell' : (typeName || 'Profil');

    return (
      <table key={key} className="mini-profile-table">
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
              {headers.map(h => renderProfileCell(prof.characteristics?.find(char => char.name === h), h, sel))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderMiniProfile = (sel) => {
    const { profiles } = collectUnitProfilesAndRules(system, sel, activeCatalogue?.id, roster);
    const groups = groupProfilesByType(profiles);
    if (groups.length === 0) return null;

    return (
      <div
        className="mini-profile clickable"
        onClick={(e) => {
          e.stopPropagation();
          openStatblock(sel);
        }}
        title="Statblock anzeigen"
      >
        {groups.map((group, gIdx) => renderProfileTable(group, sel, group.typeName || gIdx))}
      </div>
    );
  };

  const isUnitEditing = selectedRosterSelection?.id === selection.id;
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
              {selection.number > 1 ? `${selection.number}x ` : ''}{selection.name}
              {showDebugIds && (
                <span className="debug-id-badge clickable" title="Definition-ID">def:{selection.entryLinkId || selection.selectionEntryId}</span>
              )}
            </span>
          </div>
          <div className="selection-node-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="selection-node-cost font-body">
              {displayPoints} {costTypeLabel}
            </span>
            {copyUnit && (
              <button 
                type="button"
                className="btn-primary square-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  copyUnit(selection.id);
                }}
                title="Kopieren"
              >
                <Copy size={14} />
              </button>
            )}
            <button 
              type="button"
              className="btn-danger square-btn" 
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
          showDebugIds={showDebugIds}
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
            showDebugIds={showDebugIds}
          />
        )}
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
              setSelectedCatalogEntry={setSelectedCatalogEntry}
              isSubUnit={true}
            />
          ))}
        </div>
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
